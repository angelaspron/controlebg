import type { GameData, SleeveStockItem, CardSleeveSet, GameSleeveUsage } from '../types';

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
  sleeveBrand?: string;
  sleeveType?: string;
} {
  if (!sets || sets.length === 0) {
    return { isSleeved: false };
  }

  const sleevedList = sets.filter(s => Boolean(s.isSleeved));
  const isSleeved = sleevedList.length > 0;

  const brands = Array.from(new Set(sleevedList.map(s => s.sleeveBrand?.trim()).filter(Boolean) as string[]));
  const types = Array.from(new Set(sleevedList.map(s => s.sleeveType?.trim()).filter(Boolean) as string[]));

  return {
    isSleeved,
    sleeveBrand: brands.length > 0 ? brands.join(', ') : undefined,
    sleeveType: types.length > 0 ? types.join(', ') : undefined,
  };
}

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
      const key = `${Math.round(canonicalWidth * 2) / 2}x${Math.round(canonicalHeight)}`;

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
