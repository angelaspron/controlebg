import type { GameData } from '../types/index.ts';
import { fetchBGGThingWithRetry, searchBGGId, type BGGParsedData } from './bggService.ts';
import { fetchLudopediaData, type LudopediaParsedData } from './ludopediaService.ts';
import { fetchComparaJogosData, type ComparaPriceData } from './comparaService.ts';

export interface BatchProgress {
  current: number;
  total: number;
  percentage: number;
  currentGameName: string;
  activeApi: string;
}

export interface BatchOptions {
  concurrencyLimit?: number;
  ludoToken?: string;
  bggToken?: string;
  onProgress?: (progress: BatchProgress) => void;
  onGameStart?: (gameId: string) => void;
  onGameComplete?: (updatedGame: GameData) => void;
  signal?: AbortSignal;
}

/**
 * Atualiza um único jogo de forma concorrente em paralelo (Promise.allSettled)
 * consumindo BGG, Ludopedia e Compara Jogos simultaneamente.
 */
export async function updateSingleGameParallel(
  game: GameData,
  ludoToken?: string,
  bggToken?: string
): Promise<GameData> {
  let bggId = game.bggId;
  if (!bggId) {
    bggId = (await searchBGGId(game.name, { token: bggToken })) || undefined;
  }

  // Executa chamadas concorrentes para as 3 APIs baseadas no BGG ID e Nome
  const [bggResult, ludoResult, comparaResult] = await Promise.allSettled([
    bggId ? fetchBGGThingWithRetry(bggId, { token: bggToken }) : Promise.resolve(null),
    ludoToken ? fetchLudopediaData(game.name, ludoToken, game.ludoId) : Promise.resolve(null),
    fetchComparaJogosData(game.name, bggId),
  ]);

  const bggData: BGGParsedData | null = bggResult.status === 'fulfilled' ? bggResult.value : null;
  const ludoData: LudopediaParsedData | null = ludoResult.status === 'fulfilled' ? ludoResult.value : null;
  const comparaData: ComparaPriceData | null = comparaResult.status === 'fulfilled' ? comparaResult.value : null;

  // 2. Heurística de Blindagem no Merge (OR Lógico)
  // O tipo "Base" só é mantido se TODAS as APIs confirmarem.
  let finalType = 'Base';
  
  const bggType = bggData?.type || 'Base';
  const ludoType = ludoData?.type || 'Base';
  const gameType = game.type || 'Base';

  const isBggNonBase = bggType !== 'Base';
  const isLudoNonBase = ludoType !== 'Base';
  const isGameNonBase = gameType !== 'Base' && gameType !== 'Desconhecido';

  if (bggData?.isExpansion || ludoData?.isExpansion || bggType === 'Expansão' || ludoType === 'Expansão') {
    finalType = 'Expansão';
  } else if (bggType === 'Promo' || ludoType === 'Promo') {
    finalType = 'Promo';
  } else if (bggType === 'Acessório' || ludoType === 'Acessório') {
    finalType = 'Acessório';
  } else if (isBggNonBase) {
    finalType = bggType;
  } else if (isLudoNonBase) {
    finalType = ludoType;
  } else if (isGameNonBase) {
    finalType = gameType;
  }

  // 3. Fallback por Substring no Merge Final
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const nomeFinal = normalize(ludoData?.namePt || bggData?.name || game.name);
  
  if (
    nomeFinal.includes('(expans') || 
    nomeFinal.includes('expedition') || 
    nomeFinal.includes('expansion') || 
    nomeFinal.includes(' pack')
  ) {
    finalType = 'Expansão';
  }

  // 4. Log de Depuração Temporário
  console.log({
    nome: ludoData?.namePt || bggData?.name || game.name,
    tipoLudo: ludoType,
    tipoBGG: bggType,
    resultado: finalType
  });

  // Consolidação dos domínios e mecânicas
  const mergedDomains = Array.from(new Set([
    ...(game.domains || []),
    ...(bggData?.domains || []),
    ...(ludoData?.domains || []),
  ]));

  // Determinar preço de mercado
  let marketValue = game.value;
  if (comparaData?.retailPrice !== undefined && comparaData.retailPrice > 0) {
    marketValue = comparaData.retailPrice;
  } else if (comparaData?.usedPrice !== undefined && comparaData.usedPrice > 0) {
    marketValue = comparaData.usedPrice;
  }

  return {
    ...game,
    bggId: bggId || game.bggId,
    ludoId: ludoData?.ludoId || game.ludoId,
    type: finalType,
    thumbnail: ludoData?.thumbnail || bggData?.thumbnail || game.thumbnail,
    image: bggData?.image || ludoData?.image || game.image,
    yearPublished: bggData?.yearPublished || ludoData?.yearPublished || game.yearPublished,
    minPlayers: bggData?.minPlayers || ludoData?.minPlayers || game.minPlayers,
    maxPlayers: bggData?.maxPlayers || ludoData?.maxPlayers || game.maxPlayers,
    rating: bggData?.rating || game.rating,
    geekRating: bggData?.geekRating || game.geekRating,
    ludoRating: ludoData?.ludoRating || game.ludoRating,
    weight: bggData?.weight || game.weight,
    rank: bggData?.rank || ludoData?.rank || game.rank,
    domains: mergedDomains.length > 0 ? mergedDomains : game.domains,
    mechanics: bggData?.mechanics || game.mechanics,
    honors: bggData?.honors || game.honors,
    suggestedPlayers: bggData?.suggestedPlayers || game.suggestedPlayers,
    description: bggData?.description || game.description,
    descriptionPt: ludoData?.descriptionPt || game.descriptionPt,
    retailPrice: comparaData?.retailPrice || game.retailPrice,
    usedPrice: comparaData?.usedPrice || game.usedPrice,
    value: marketValue,
    isPlayed: (game.isPlayed !== undefined || ludoData?.isPlayed !== undefined)
      ? Boolean(game.isPlayed || ludoData?.isPlayed)
      : undefined,
  };
}

/**
 * Processador em lote com controle de concorrência reduzida (padrão: 5 requisições por vez)
 */
export async function processBatchWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const runWorker = async () => {
    while (currentIndex < items.length) {
      if (signal?.aborted) {
        throw new Error('Operação cancelada pelo usuário');
      }

      const index = currentIndex++;
      const item = items[index];
      results[index] = await worker(item, index);
    }
  };

  const poolSize = Math.min(limit, items.length);
  const workers = Array.from({ length: poolSize }, () => runWorker());
  await Promise.all(workers);

  return results;
}

/**
 * Atualiza múltiplos jogos usando controle de concorrência em blocos de 5
 */
export async function batchUpdateGamesParallel(
  gamesToUpdate: GameData[],
  options: BatchOptions = {}
): Promise<GameData[]> {
  const limit = options.concurrencyLimit ?? 5;
  const total = gamesToUpdate.length;
  let completed = 0;

  return processBatchWithConcurrency(
    gamesToUpdate,
    limit,
    async (game) => {
      if (options.onGameStart) {
        options.onGameStart(game.id);
      }

      if (options.onProgress) {
        options.onProgress({
          current: completed,
          total,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          currentGameName: game.name,
          activeApi: 'Paralelo (BGG + Ludo + Compara)',
        });
      }

      const updated = await updateSingleGameParallel(game, options.ludoToken, options.bggToken);
      completed++;

      if (options.onGameComplete) {
        options.onGameComplete(updated);
      }

      if (options.onProgress) {
        options.onProgress({
          current: completed,
          total,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 100,
          currentGameName: game.name,
          activeApi: 'Concluído',
        });
      }

      return updated;
    },
    options.signal
  );
}
