import type { GameData, SleeveStockItem, CardSleeveSet, GameSleeveUsage } from '../types';

export interface StandardSleeveSize {
  width: number;
  height: number;
  name: string;
  source?: string;
}

export const STANDARD_SLEEVE_SIZES: StandardSleeveSize[] = [
  { width: 41, height: 63, name: 'Mini USA', source: 'Mayday Games / Sleeve Kings' },
  { width: 45, height: 68, name: 'Mini Euro', source: 'Mayday Games / Sleeve Kings' },
  { width: 54, height: 80, name: 'Yucatan', source: 'Mayday Games / Catan' },
  { width: 56, height: 87, name: 'Standard USA', source: 'Mayday Games / Sleeve Kings' },
  { width: 57.5, height: 89, name: 'USA Chimera', source: 'Mayday Games / Sleeve Kings' },
  { width: 59, height: 92, name: 'Euro', source: 'Mayday Games / Sleeve Kings' },
  { width: 63.5, height: 88, name: 'Padrão', source: 'BoardGameGeek / Mayday Games' },
  { width: 65, height: 100, name: 'Copper', source: 'Bucaneiros / 7 Wonders' },
  { width: 70, height: 70, name: 'Quadrado pequeno', source: 'Mayday Games / Sleeve Kings' },
  { width: 70, height: 120, name: 'Tarot', source: 'Mayday Games / Sleeve Kings' },
  { width: 80, height: 120, name: 'Ilustrada grande (Dixit)', source: 'Mayday Games / Sleeve Kings' },
  { width: 80, height: 90, name: 'Quadrado grande', source: 'Mayday Games / Sleeve Kings' },
  { width: 82, height: 122, name: 'Magnum Silver', source: 'Mayday Games' },
];

export const KNOWN_SLEEVE_BRANDS = [
  'Bucaneiros',
  'Gamegenic',
  'MeepleBR',
  'Mayday Games',
  'Central',
  'Redbox',
  'Ultra Pro',
  'Ultimate Guard',
  'Blue Core',
  'Just Sleeves',
  'Meeple Virus',
  'Sleeve Kings',
  'Dragon Shield',
  'Arcane Tinmen',
  'KMC'
];

export const POPULAR_SLEEVE_MODELS = [
  'Padrão (63,5 × 88 mm)',
  'Mini Euro (45 × 68 mm)',
  'Mini USA (41 × 63 mm)',
  'Euro (59 × 92 mm)',
  'Standard USA (56 × 87 mm)',
  'USA Chimera (57,5 × 89 mm)',
  'Yucatan (54 × 80 mm)',
  'Tarot (70 × 120 mm)',
  'Quadrado Pequeno (70 × 70 mm)',
  'Ilustrada Grande / Dixit (80 × 120 mm)',
  'Copper (65 × 100 mm)',
  'Quadrado Grande (80 × 90 mm)',
  'Magnum Silver (82 × 122 mm)',
];

function isApprox(val: number, target: number, tolerance: number): boolean {
  return Math.abs(val - target) <= tolerance;
}

/**
 * Identifica o nome padrão de tamanho de sleeve a partir da largura e altura
 */
export function getCardSleeveSizeName(width: number, height: number, productName?: string): string {
  const match = STANDARD_SLEEVE_SIZES.find(s => 
    isApprox(width, s.width, 0.6) && isApprox(height, s.height, 1.2)
  );
  if (match) return match.name;

  if (isApprox(width, 80, 0.6) && isApprox(height, 90, 1.5)) return 'Quadrado grande';
  if (isApprox(width, 70, 0.6) && isApprox(height, 70, 1.2)) return 'Quadrado pequeno';

  // Se o Compara Jogos retornou um sleeveProduct com nome (ex: "Sleeve Yucatan (54x80mm)")
  if (productName) {
    const cleaned = productName.replace(/^sleeve\s+/i, '').trim();
    if (cleaned) {
      return cleaned;
    }
  }

  return 'Especial';
}

/**
 * Formata as dimensões de largura e altura no padrão "63,5 × 88 mm"
 */
export function formatCardSleeveDimensions(width: number, height: number): string {
  const formatNum = (n: number) => Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  return `${formatNum(width)} × ${formatNum(height)} mm`;
}

/**
 * Extrai dimensões (largura, altura em mm) a partir do nome de um modelo comum ou personalizado
 * Ex: "Padrão (63,5 × 88 mm)" -> { width: 63.5, height: 88, sizeName: "Padrão" }
 * Ex: "Quadrado (70 × 70 mm)" -> { width: 70, height: 70, sizeName: "Quadrado" }
 * Ex: "75x105" -> { width: 75, height: 105, sizeName: "75 × 105 mm" }
 */
export function parseModelDimensions(modelStr: string): { width: number; height: number; sizeName: string } {
  if (!modelStr || !modelStr.trim()) {
    return { width: 63.5, height: 88, sizeName: 'Padrão' };
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
  return { width: 63.5, height: 88, sizeName: modelStr.trim() || 'Padrão' };
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
 * Agrupa todas as necessidades de sleeves da coleção para cruzamento com o estoque,
 * respeitando o status de sleevado e marca individual de cada conjunto/tamanho.
 */
export function computeCollectionSleeveDemands(games: GameData[]): CollectionSleeveDemand[] {
  const demandMap = new Map<string, CollectionSleeveDemand>();

  // Apenas jogos que estão na coleção (ou vendidos mas o usuário quer saber) - preferência para Na Coleção
  const ownedGames = games.filter(g => {
    const s = String(g.status || '').toLowerCase();
    return s.includes('coleção') || s.includes('sim') || !s.includes('vendido');
  });

  for (const game of ownedGames) {
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

      const sizeName = set.sizeName || getCardSleeveSizeName(width, height, (set as any).sleeveProductName);
      const dimensions = formatCardSleeveDimensions(width, height);
      // Chave única para agrupar tamanhos equivalentes
      const key = `${Math.round(width * 2) / 2}x${Math.round(height)}`;

      let item = demandMap.get(key);
      if (!item) {
        item = {
          key,
          modelName: sizeName !== 'Especial' ? sizeName : `${dimensions}`,
          dimensions,
          width,
          height,
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
