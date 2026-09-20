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
  ludoToken?: string
): Promise<GameData> {
  let bggId = game.bggId;
  if (!bggId) {
    bggId = (await searchBGGId(game.name)) || undefined;
  }

  // Executa chamadas concorrentes para as 3 APIs baseadas no BGG ID e Nome
  const [bggResult, ludoResult, comparaResult] = await Promise.allSettled([
    bggId ? fetchBGGThingWithRetry(bggId) : Promise.resolve(null),
    ludoToken ? fetchLudopediaData(game.name, ludoToken, game.ludoId) : Promise.resolve(null),
    fetchComparaJogosData(game.name, bggId),
  ]);

  const bggData: BGGParsedData | null = bggResult.status === 'fulfilled' ? bggResult.value : null;
  const ludoData: LudopediaParsedData | null = ludoResult.status === 'fulfilled' ? ludoResult.value : null;
  const comparaData: ComparaPriceData | null = comparaResult.status === 'fulfilled' ? comparaResult.value : null;

  // Determinação precisa de Tipo (Base vs Expansão) com base estrutural da Ludopedia e BGG
  let inferredType = game.type || 'Base';
  if (ludoData?.isExpansion || (ludoData?.type && ludoData.type !== 'Base')) {
    inferredType = ludoData.type;
  } else if (game.name.toLowerCase().includes('expans') || game.name.toLowerCase().includes('expansion')) {
    inferredType = 'Expansão';
  }

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
    type: inferredType,
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

      const updated = await updateSingleGameParallel(game, options.ludoToken);
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
