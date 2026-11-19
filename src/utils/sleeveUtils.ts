import type { GameData, SleeveStockItem, CardSleeveSet, GameSleeveUsage, GameSleeveStatus } from '../types';

export interface StandardSleeveSize {
  width: number;
  height: number;
  name: string;
  source?: string;
}

export const STANDARD_SLEEVE_SIZES: StandardSleeveSize[] = [
  { width: 41, height: 63, name: 'Mini USA' },
  { width: 43.5, height: 67.5, name: 'Mini Chimeuro' },
  { width: 43, height: 65, name: 'Mini Chimera' },
  { width: 45, height: 68, name: 'Mini Euro' },
  { width: 56, height: 87, name: 'Padrão USA' },
  { width: 57.5, height: 89, name: 'Chimera' },
  { width: 59, height: 92, name: 'Padrão Euro' },
  { width: 61, height: 112, name: 'French Tarot' },
  { width: 63.5, height: 88, name: 'Padrão / Standard' },
  { width: 65, height: 100, name: 'Copper' },
  { width: 70, height: 70, name: 'Quadrado' },
  { width: 70, height: 110, name: 'Silver' },
  { width: 70, height: 120, name: 'Tarot' },
  { width: 80, height: 120, name: 'Gold' },
];

export const KNOWN_SLEEVE_BRANDS = [
  'Bucaneiros',
  'Meeple Virus',
  'Meeple BR',
  'Mayday',
  'Dragon Shield',
  'Sleeve Kings',
  'Central',
  'Mosaico',
  'Jelly Monster',
];

export const POPULAR_SLEEVE_MODELS = [
  'Mini USA (41 x 63 mm)',
  'Mini Chimeuro (43,5 x 67,5 mm)',
  'Mini Chimera (43 x 65 mm)',
  'Mini Euro (45 x 68 mm)',
  'Padrão USA (56 x 87 mm)',
  'Chimera (57,5 x 89 mm)',
  'Padrão Euro (59 x 92 mm)',
  'French Tarot (61 x 112 mm)',
  'Padrão / Standard (63,5 x 88 mm)',
  'Padrão Premium (63,5 x 88 mm - mais espesso)',
  'Padrão Fit / Shield Perfect Size (ajuste justo)',
  'Copper (65 x 100 mm)',
  'Quadrado (70 x 70 mm)',
  'Silver (70 x 110 mm)',
  'Tarot (70 x 120 mm)',
  'Gold (80 x 120 mm)',
];

export const SLEEVE_SUBTYPES = ['Normal', 'Premium', 'Slim'] as const;
export type SleeveSubtype = typeof SLEEVE_SUBTYPES[number];

function isApprox(val: number, target: number, tolerance: number): boolean {
  return Math.abs(val - target) <= tolerance;
}

/**
 * Identifica o nome padrão de tamanho de sleeve a partir da largura e altura
 */
export function getCardSleeveSizeName(width: number, height: number, productName?: string): string {
  if (productName) {
    const cleaned = productName.replace(/^sleeve\s+/i, '').trim();
    if (cleaned) {
      if (/fit|perfect\s*size/i.test(cleaned)) return 'Padrão Fit / Shield Perfect Size';
      if (/premium/i.test(cleaned) && isApprox(width, 63.5, 0.8) && isApprox(height, 88, 1.5)) {
        return 'Padrão Premium';
      }
    }
  }

  const match = STANDARD_SLEEVE_SIZES.find(s => 
    isApprox(width, s.width, 0.6) && isApprox(height, s.height, 1.2)
  );
  if (match) return match.name;

  if (isApprox(width, 63.5, 1.0) && isApprox(height, 88, 2.0)) return 'Padrão / Standard';
  if (isApprox(width, 41, 1.0) && isApprox(height, 63, 1.5)) return 'Mini USA';
  if (isApprox(width, 45, 1.0) && isApprox(height, 68, 1.5)) return 'Mini Euro';
  if (isApprox(width, 56, 1.0) && isApprox(height, 87, 1.5)) return 'Padrão USA';
  if (isApprox(width, 57.5, 1.0) && isApprox(height, 89, 1.5)) return 'Chimera';
  if (isApprox(width, 59, 1.0) && isApprox(height, 92, 1.5)) return 'Padrão Euro';
  if (isApprox(width, 70, 1.0) && isApprox(height, 120, 2.0)) return 'Tarot';
  if (isApprox(width, 80, 1.0) && isApprox(height, 120, 2.0)) return 'Gold';
  if (isApprox(width, 70, 1.0) && isApprox(height, 70, 1.5)) return 'Quadrado';
  if (isApprox(width, 70, 1.0) && isApprox(height, 110, 1.5)) return 'Silver';
  if (isApprox(width, 65, 1.0) && isApprox(height, 100, 1.5)) return 'Copper';
  if (isApprox(width, 61, 1.0) && isApprox(height, 112, 1.5)) return 'French Tarot';
  if (isApprox(width, 43.5, 1.0) && isApprox(height, 67.5, 1.5)) return 'Mini Chimeuro';
  if (isApprox(width, 43, 1.0) && isApprox(height, 65, 1.5)) return 'Mini Chimera';

  if (productName) {
    const cleaned = productName.replace(/^sleeve\s+/i, '').trim();
    if (cleaned) {
      return cleaned;
    }
  }

  return 'Especial';
}

/**
 * Formata as dimensões de largura e altura no padrão "63,5 x 88 mm"
 */
export function formatCardSleeveDimensions(width: number, height: number): string {
  const formatNum = (n: number) => Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  return `${formatNum(width)} x ${formatNum(height)} mm`;
}

/**
 * Extrai dimensões (largura, altura em mm) a partir do nome de um modelo comum ou personalizado
 * Ex: "Padrão / Standard (63,5 x 88 mm)" -> { width: 63.5, height: 88, sizeName: "Padrão / Standard" }
 * Ex: "Quadrado (70 x 70 mm)" -> { width: 70, height: 70, sizeName: "Quadrado" }
 * Ex: "75x105" -> { width: 75, height: 105, sizeName: "75 x 105 mm" }
 */
export function parseModelDimensions(modelStr: string): { width: number; height: number; sizeName: string } {
  if (!modelStr || !modelStr.trim()) {
    return { width: 63.5, height: 88, sizeName: 'Padrão / Standard' };
  }

  // Caso especial: Padrão Fit / Shield Perfect Size
  if (/fit|perfect\s*size/i.test(modelStr)) {
    return { width: 63.5, height: 88, sizeName: 'Padrão Fit / Shield Perfect Size' };
  }

  const match = modelStr.match(/(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)/);
  if (match) {
    const width = parseFloat(match[1].replace(',', '.'));
    const height = parseFloat(match[2].replace(',', '.'));
    let candidateName = '';
    if (modelStr.includes('(')) {
      candidateName = modelStr.split('(')[0].trim();
    } else {
      candidateName = modelStr
        .replace(/(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?/gi, '')
        .trim();
    }
    const standardName = getCardSleeveSizeName(width, height);
    const sizeName = candidateName || (standardName !== 'Especial' ? standardName : formatCardSleeveDimensions(width, height));
    return { width, height, sizeName };
  }
  return { width: 63.5, height: 88, sizeName: modelStr.trim() || 'Padrão / Standard' };
}

/**
 * Resume múltiplos sleeves configurados em um jogo para os campos gerais de compatibilidade
 */
export function summarizeGameSleeves(
  sets: (CardSleeveSet | GameSleeveUsage)[]
): {
  isSleeved: boolean;
  sleeveStatus: GameSleeveStatus;
  sleeveBrand?: string;
  sleeveType?: string;
} {
  if (!sets || sets.length === 0) {
    return { isSleeved: false, sleeveStatus: 'none' };
  }

  const validSets = sets.filter(s => (s.quantity ?? 1) > 0);
  const targetSets = validSets.length > 0 ? validSets : sets;
  const sleevedList = targetSets.filter(s => Boolean(s.isSleeved));

  let sleeveStatus: GameSleeveStatus = 'none';
  if (sleevedList.length === 0) {
    sleeveStatus = 'none';
  } else if (sleevedList.length === targetSets.length) {
    sleeveStatus = 'full';
  } else {
    sleeveStatus = 'partial';
  }

  const isSleeved = sleevedList.length > 0;
  const listToInspect = sleevedList.length > 0 ? sleevedList : targetSets;

  const brands = Array.from(new Set(listToInspect.map(s => s.sleeveBrand?.trim()).filter(Boolean) as string[]));
  const types = Array.from(new Set(listToInspect.map(s => s.sleeveType?.trim()).filter(Boolean) as string[]));

  return {
    isSleeved,
    sleeveStatus,
    sleeveBrand: brands.length > 0 ? brands.join(', ') : undefined,
    sleeveType: types.length > 0 ? types.join(', ') : undefined,
  };
}

/**
 * Retorna o status de sleeve do jogo: 'none' (Não Sleevado), 'partial' (Sleevado Parcial) ou 'full' (Sleevado)
 */
export function getGameSleeveStatus(game: Partial<GameData> | null | undefined): GameSleeveStatus {
  if (!game || game.noCards) return 'none';

  const sets: (CardSleeveSet | GameSleeveUsage)[] = 
    (game.cardSleeves?.sets && game.cardSleeves.sets.length > 0)
      ? game.cardSleeves.sets
      : (game.sleevesUsed || []);

  if (sets.length > 0) {
    const validSets = sets.filter(s => (s.quantity ?? 1) > 0);
    const targetSets = validSets.length > 0 ? validSets : sets;
    const sleevedCount = targetSets.filter(s => s.isSleeved !== undefined ? Boolean(s.isSleeved) : Boolean(game.isSleeved)).length;

    if (sleevedCount === 0) return 'none';
    if (sleevedCount === targetSets.length) return 'full';
    return 'partial';
  }

  if (game.sleeveStatus) return game.sleeveStatus;
  if (game.isSleeved) return 'full';
  return 'none';
}

export const SLEEVE_STATUS_LABELS: Record<GameSleeveStatus, string> = {
  none: 'Não Sleevado',
  partial: 'Sleevado Parcial',
  full: 'Sleevado',
};

export interface CollectionSleeveDemand {
  key: string; // ex: "63.5-88" ou "Padrão"
  modelName: string; // "Padrão"
  dimensions: string; // "63,5 × 88 mm"
  width: number;
  height: number;
  totalCards: number; // total de cartas necessárias
  neededCards: number; // total de cartas em jogos AINDA NÃO sleevados
  games: {
    id: string;
    name: string;
    quantity: number;
    isSleeved: boolean;
    sleeveBrand?: string;
  }[];
}

/**
 * Verifica estritamente se o jogo pertence à coleção ativa do usuário.
 * Exclui categoricamente jogos vendidos, com tag VENDIDOS/VENDIDO, ex-coleção ou em lista de desejos.
 */
export function isGameInCollection(game: GameData): boolean {
  if (!game) return false;

  // 1. Se possuir valor de venda registrado maior que zero, o jogo foi vendido
  if (game.soldValue !== undefined && game.soldValue !== null && game.soldValue !== '' && game.soldValue !== 0 && game.soldValue !== '0') {
    const cleanedSold = String(game.soldValue).replace(/[^\d.,]/g, '').replace(',', '.');
    const soldNum = parseFloat(cleanedSold);
    if (!isNaN(soldNum) && soldNum > 0) {
      return false;
    }
    const soldStr = String(game.soldValue).toLowerCase().trim();
    if (soldStr && soldStr !== '0' && soldStr !== 'não' && soldStr !== 'nao' && soldStr !== 'false') {
      return false;
    }
  }

  // 2. Coletar e normalizar todos os campos de status, tag, tags, situação, estado e tipo
  const combined = [
    game.status,
    (game as any).tag,
    (game as any).tags,
    (game as any).statusBadge,
    (game as any).situacao,
    (game as any).situação,
    (game as any).estado,
    game.type,
    (game as any).tipo,
    (game as any).notes,
    (game as any).observacao,
    (game as any).observação
  ]
    .filter(Boolean)
    .map(v => Array.isArray(v) ? v.join(' ') : String(v))
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos (ex: "coleção" -> "colecao", "não" -> "nao")

  // 3. Bloqueio estrito de venda, desapego, troca, doação ou ex-coleção em qualquer formato
  const soldKeywords = [
    'vendid', 'venda', 'vendeu', 'vendi',
    'sold', 'prevowned',
    'fora da colecao', 'ex-colecao', 'ex colecao',
    'desapeg', 'desapego', 'desapegado',
    'repassad', 'passad',
    'trocad',
    'doad',
    'nao tenho', 'sem jogo',
    'teve', 'ja teve'
  ];
  if (soldKeywords.some(kw => combined.includes(kw))) {
    return false;
  }

  // 4. Bloqueio de lista de desejos
  const wishlistKeywords = ['desejo', 'wishlist', 'quero', 'pretendo', 'interesse', 'comprar'];
  if (wishlistKeywords.some(kw => combined.includes(kw))) {
    return false;
  }

  // 5. Posse ativa comprovada na coleção
  const ownedKeywords = [
    'colecao', 'na colecao', 'minha colecao',
    'possuo', 'tenho', 'owned', 'in collection',
    'sim', 'true', 'ativo'
  ];
  const hasOwnedKeyword = ownedKeywords.some(kw => combined.includes(kw));
  const s = String(game.status || '').toLowerCase().trim();
  const isStandardType = s === '' || s === 'base' || s === 'expansão' || s === 'expansao' || s === 'promo' || s === 'acessório' || s === 'acessorio';

  return hasOwnedKeyword || isStandardType;
}

/**
 * Agrupa todas as necessidades de sleeves da coleção para cruzamento com o estoque,
 * respeitando o status de sleevado e marca individual de cada conjunto/tamanho.
 */
export function computeCollectionSleeveDemands(games: GameData[]): CollectionSleeveDemand[] {
  const demandMap = new Map<string, CollectionSleeveDemand>();

  // Apenas jogos que estão estritamente na coleção atual (exclui jogos vendidos)
  const ownedGames = games.filter(isGameInCollection);

  for (const game of ownedGames) {
    // Jogos marcados expressamente como sem cartas não geram demanda de sleeves
    if (game.noCards) continue;

    // Processar tanto cardSleeves.sets quanto sleevesUsed adicionados pelo usuário
    const sets: (CardSleeveSet | GameSleeveUsage)[] = (game.cardSleeves?.sets && game.cardSleeves.sets.length > 0)
      ? game.cardSleeves.sets
      : (game.sleevesUsed || []);

    if (!sets || sets.length === 0) continue;

    for (const set of sets) {
      const parsedDim = parseModelDimensions((set as any).dimensions || set.sizeName || '');
      const width = Number(set.width) || parsedDim.width;
      const height = Number(set.height) || parsedDim.height;
      const quantity = Number(set.quantity) || 0;
      if (quantity <= 0) continue;

      const standardMatch = STANDARD_SLEEVE_SIZES.find(s => 
        isApprox(width, s.width, 0.8) && isApprox(height, s.height, 1.8)
      );
      const canonicalWidth = standardMatch ? standardMatch.width : width;
      const canonicalHeight = standardMatch ? standardMatch.height : height;
      const sizeName = (set.sizeName && set.sizeName !== 'Especial')
        ? set.sizeName 
        : (standardMatch ? standardMatch.name : getCardSleeveSizeName(width, height, (set as any).sleeveProductName));
      const dimensions = formatCardSleeveDimensions(canonicalWidth, canonicalHeight);
      // Chave única para agrupar tamanhos equivalentes
      const key = getCanonicalDimensionKey(canonicalWidth, canonicalHeight);

      let item = demandMap.get(key);
      if (!item) {
        item = {
          key,
          modelName: sizeName !== 'Especial' ? sizeName : `${dimensions}`,
          dimensions,
          width: canonicalWidth,
          height: canonicalHeight,
          totalCards: 0,
          neededCards: 0,
          games: []
        };
        demandMap.set(key, item);
      }

      const isSetSleeved = set.isSleeved !== undefined ? Boolean(set.isSleeved) : Boolean(game.isSleeved);
      item.totalCards += quantity;
      if (!isSetSleeved) {
        item.neededCards += quantity;
      }

      item.games.push({
        id: game.id,
        name: game.name,
        quantity,
        isSleeved: isSetSleeved,
        sleeveBrand: set.sleeveBrand || (isSetSleeved ? game.sleeveBrand : undefined)
      });
    }
  }

  return Array.from(demandMap.values()).sort((a, b) => b.totalCards - a.totalCards);
}

/**
 * Tenta encontrar correspondência entre um item de estoque e a demanda da coleção
 */
export function matchStockToDemand(stockItem: SleeveStockItem, demands: CollectionSleeveDemand[]): CollectionSleeveDemand | undefined {
  const modelLower = stockItem.model.toLowerCase();
  
  return demands.find(d => {
    const dModelLower = d.modelName.toLowerCase();
    const dDimLower = d.dimensions.toLowerCase().replace('×', 'x');
    const normalizedModel = modelLower.replace('×', 'x');

    if (
      normalizedModel.includes(dModelLower) ||
      dModelLower.includes(normalizedModel) ||
      normalizedModel.includes(dDimLower)
    ) {
      return true;
    }

    // Comparação por dimensões (ex: "63,5" e "88")
    const wStr = String(d.width).replace('.', ',');
    const hStr = String(d.height);
    if (normalizedModel.includes(wStr) && normalizedModel.includes(hStr)) {
      return true;
    }

    return false;
  });
}

/**
 * Retorna uma chave canônica para agrupar dimensões equivalentes
 */
export function getCanonicalDimensionKey(width: number, height: number): string {
  const standardMatch = STANDARD_SLEEVE_SIZES.find(s => 
    isApprox(width, s.width, 0.8) && isApprox(height, s.height, 1.8)
  );
  const canonicalWidth = standardMatch ? standardMatch.width : width;
  const canonicalHeight = standardMatch ? standardMatch.height : height;
  return `${Math.round(canonicalWidth * 2) / 2}x${Math.round(canonicalHeight)}`;
}

/**
 * Encontra itens em estoque compatíveis com um determinado sleeve de jogo,
 * ordenando pelo melhor match (marca, tipo, dimensões e disponibilidade).
 */
export function findCompatibleStockItems(
  sleeve: { width: number; height: number; sizeName?: string; sleeveBrand?: string; sleeveType?: string; quantity?: number },
  stock: SleeveStockItem[]
): { item: SleeveStockItem; score: number }[] {
  if (!stock || stock.length === 0) return [];

  const results: { item: SleeveStockItem; score: number }[] = [];
  const reqWidth = Number(sleeve.width) || 0;
  const reqHeight = Number(sleeve.height) || 0;
  const reqBrand = (sleeve.sleeveBrand || '').trim().toLowerCase();
  const reqType = (sleeve.sleeveType || '').trim().toLowerCase();
  const reqSizeName = (sleeve.sizeName || '').trim().toLowerCase();
  const reqQty = sleeve.quantity || 1;

  const stdCardName = getCardSleeveSizeName(reqWidth, reqHeight).toLowerCase();

  for (const item of stock) {
    const stockModel = (item.model || '').trim();
    const stockModelLower = stockModel.toLowerCase();
    const stockBrand = (item.brand || '').trim().toLowerCase();
    const stockType = (item.type || '').trim().toLowerCase();

    const dim = parseModelDimensions(stockModel);
    const stockStdName = getCardSleeveSizeName(dim.width, dim.height).toLowerCase();

    // Verificação de compatibilidade dimensional
    const isDimensionMatch = 
      (reqWidth > 0 && reqHeight > 0 && dim.width > 0 && dim.height > 0) &&
      (Math.abs(dim.width - reqWidth) <= 1.2 && Math.abs(dim.height - reqHeight) <= 2.2);

    // Verificação de compatibilidade por nome ou texto
    const isNameMatch = 
      (stdCardName !== 'especial' && stdCardName === stockStdName) ||
      (reqSizeName && reqSizeName !== 'especial' && stockModelLower.includes(reqSizeName)) ||
      (stockModelLower.includes(String(reqWidth).replace('.', ',')) && stockModelLower.includes(String(reqHeight)));

    if (!isDimensionMatch && !isNameMatch) {
      continue;
    }

    let score = 10;

    // Dimensão exata ou muito próxima
    if (isDimensionMatch && Math.abs(dim.width - reqWidth) <= 0.6 && Math.abs(dim.height - reqHeight) <= 1.0) {
      score += 5;
    }

    // Marca correspondente
    if (reqBrand && stockBrand) {
      if (stockBrand === reqBrand) {
        score += 20;
      } else if (stockBrand.includes(reqBrand) || reqBrand.includes(stockBrand)) {
        score += 10;
      }
    }

    // Tipo / espessura correspondente
    if (reqType && stockType) {
      if (stockType === reqType) {
        score += 10;
      } else if (stockType.includes(reqType) || reqType.includes(stockType)) {
        score += 5;
      }
    }

    // Disponibilidade em estoque
    if (item.quantity >= reqQty) {
      score += 5;
    } else if (item.quantity > 0) {
      score += 2;
    }

    results.push({ item, score });
  }

  return results.sort((a, b) => b.score - a.score || b.item.quantity - a.item.quantity);
}

export interface SleeveDeductionCandidate {
  id: string;
  name?: string;
  sizeName: string;
  dimensions: string;
  width: number;
  height: number;
  totalCards: number;
  cardsToDeduct: number;
  sleeveBrand?: string;
  sleeveType?: string;
  compatibleStock: { item: SleeveStockItem; score: number }[];
  selectedStockId?: string;
  deductQuantity: number;
  shouldDeduct: boolean;
}

/**
 * Calcula quais conjuntos de sleeves de um jogo foram recentemente sleevados
 * e monta a lista de candidatos a desconto no estoque.
 */
export function calculateSleeveDeductionCandidates(
  originalGame: GameData | null | undefined,
  newSets: CardSleeveSet[],
  stock: SleeveStockItem[]
): SleeveDeductionCandidate[] {
  if (!stock || stock.length === 0 || !newSets || newSets.length === 0) {
    return [];
  }

  // Se o jogo era marcado como noCards, não havia sleeves sleevados
  const origNoCards = Boolean(originalGame?.noCards);
  const origIsSleeved = Boolean(originalGame?.isSleeved);

  // Mapear quantidades anteriormente sleevadas por chave canônica
  const prevSleevedMap = new Map<string, number>();

  if (!origNoCards && originalGame) {
    const prevSets: CardSleeveSet[] = (originalGame.cardSleeves?.sets && originalGame.cardSleeves.sets.length > 0)
      ? originalGame.cardSleeves.sets
      : (originalGame.sleevesUsed || []).map(su => ({
          quantity: su.quantity || 0,
          width: su.width || 0,
          height: su.height || 0,
          sizeName: su.sizeName,
          isSleeved: su.isSleeved,
          sleeveBrand: su.sleeveBrand,
          sleeveType: su.sleeveType,
        }));

    for (const pSet of prevSets) {
      const isSleeved = pSet.isSleeved !== undefined ? Boolean(pSet.isSleeved) : origIsSleeved;
      if (isSleeved && pSet.quantity > 0 && pSet.width > 0 && pSet.height > 0) {
        const key = getCanonicalDimensionKey(pSet.width, pSet.height);
        prevSleevedMap.set(key, (prevSleevedMap.get(key) || 0) + pSet.quantity);
      }
    }
  }

  const candidates: SleeveDeductionCandidate[] = [];

  for (let idx = 0; idx < newSets.length; idx++) {
    const nSet = newSets[idx];
    if (!nSet.isSleeved || nSet.quantity <= 0) continue;

    const width = Number(nSet.width) || 0;
    const height = Number(nSet.height) || 0;
    const key = (width > 0 && height > 0) ? getCanonicalDimensionKey(width, height) : `custom-${idx}`;
    const prevQty = prevSleevedMap.get(key) || 0;

    let newlySleeved = nSet.quantity;
    if (prevQty > 0) {
      const amortized = Math.min(prevQty, nSet.quantity);
      newlySleeved = nSet.quantity - amortized;
      prevSleevedMap.set(key, prevQty - amortized);
    }

    if (newlySleeved <= 0) {
      // Este conjunto já estava contemplado como sleevado anteriormente
      continue;
    }

    const compatibleStock = findCompatibleStockItems(nSet, stock);
    const bestMatch = compatibleStock.length > 0 ? compatibleStock[0].item : undefined;
    const initialSelectedStockId = bestMatch ? bestMatch.id : undefined;
    const initialDeductQty = bestMatch ? Math.min(newlySleeved, bestMatch.quantity) : 0;

    candidates.push({
      id: (nSet as any).id || `deduct-${idx}-${Date.now()}`,
      name: nSet.name,
      sizeName: nSet.sizeName || getCardSleeveSizeName(width, height),
      dimensions: formatCardSleeveDimensions(width, height),
      width,
      height,
      totalCards: nSet.quantity,
      cardsToDeduct: newlySleeved,
      sleeveBrand: nSet.sleeveBrand,
      sleeveType: nSet.sleeveType,
      compatibleStock,
      selectedStockId: initialSelectedStockId,
      deductQuantity: initialDeductQty,
      shouldDeduct: initialDeductQty > 0,
    });
  }

  return candidates;
}
