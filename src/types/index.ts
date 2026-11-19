export interface GameData {
  id: string; // Gerado localmente se não tiver ID BGG ainda
  bggId?: string;
  name: string; // 'jogos'
  status: string; // ex: 'Na Coleção', 'Vendido'
  spend: number | string; // 'valor' - valor pago pelo jogo
  type: string; // 'tipo' - ex: 'Base', 'Expansão', 'Acessório'
  value: number | string; // 'valor mercado' - valor atual de mercado
  soldValue?: number | string; // valor de venda
  isPlayed?: boolean; // Rastreamento de partidas (Status: Jogado / Não Jogado)
  isSealed?: boolean; // Rastreamento de conservação (Status: Lacrado / Aberto)
  
  // Dados extras do BGG & Ludopedia & Compara Jogos
  thumbnail?: string;
  image?: string;
  minPlayers?: number;
  maxPlayers?: number;
  rating?: number; // Nota Média BGG (average)
  geekRating?: number; // BGG Geek Rating (bayesaverage)
  yearPublished?: number;
  ludoId?: string;
  ludoRating?: number;
  weight?: number; // 1-5 (complexidade)
  playtime?: number; // tempo de partida
  domains?: string[]; // categories/mechanics
  mechanics?: string[]; // mecânicas BGG
  honors?: string[]; // prêmios do jogo (boardgamehonor)
  suggestedPlayers?: {
    best?: string[];
    recommended?: string[];
    summary?: string;
  }; // quantidade ideal de jogadores (poll suggested_numplayers)
  rank?: number; // posição no ranking (bgg_rank)
  description?: string; // resumo/descrição do jogo (BGG)
  descriptionPt?: string; // sinopse/descrição em português (Ludopedia)
  retailPrice?: number; // menor preço de varejo (Compara Jogos)
  usedPrice?: number; // estimativa de mercado de usados (Compara Jogos)

  // Dados de Sleeves (Compara Jogos & Rastreamento Pessoal)
  cardSleeves?: CardSleevesData;
  isSleeved?: boolean; // Se o jogo já está sleevado na coleção do usuário (geral)
  sleeveStatus?: GameSleeveStatus; // 'none' (Não Sleevado) | 'partial' (Sleevado Parcial) | 'full' (Sleevado)
  sleeveBrand?: string; // Marca do sleeve usado (ou resumo de marcas)
  sleeveType?: string; // Tipo/espessura (ou resumo de tipos)
  sleevesUsed?: GameSleeveUsage[]; // Lista de múltiplos sleeves/marcas adicionados pelo usuário
  noCards?: boolean; // Se o jogo não possui cartas (ex: Hive, Carcassonne, Xadrez)
}

export type GameSleeveStatus = 'none' | 'partial' | 'full';

export interface CardSleeveSet {
  name?: string; // Nome do conjunto de cartas (ex: "Reference cards")
  quantity: number; // Quantidade de cartas/sleeves
  width: number; // Largura em mm
  height: number; // Altura em mm
  sizeName?: string; // Nome padrão do tamanho (ex: "Padrão", "Mini Euro", "Tarot")
  sleeveProductName?: string; // Nome comercial do produto sleeve
  isSleeved?: boolean; // Se este conjunto específico está sleevado
  sleeveBrand?: string; // Marca do sleeve usado para este conjunto
  sleeveType?: string; // Tipo/espessura usado para este conjunto
}

export interface GameSleeveUsage {
  id?: string;
  sizeName: string; // Nome do modelo/tamanho (ex: "Padrão (63,5 × 88 mm)")
  dimensions?: string; // Dimensões formatadas (ex: "63,5 × 88 mm")
  width?: number;
  height?: number;
  quantity?: number; // Quantidade de cartas associadas
  isSleeved: boolean; // Se este tipo está sleevado
  sleeveBrand?: string; // Marca do sleeve (ex: Bucaneiros, Gamegenic)
  sleeveType?: string; // Tipo/espessura (ex: Premium, Slim, Matte)
}

export interface CardSleevesData {
  source?: string; // "Compara Jogos"
  sourceUrl?: string; // Link direto no Compara Jogos
  sets: CardSleeveSet[];
  noCards?: boolean;
}

export interface SleeveStockItem {
  id: string;
  model: string; // Modelo/tamanho (ex: "Padrão (63,5 × 88 mm)")
  brand: string; // Marca (ex: "Bucaneiros", "Gamegenic")
  quantity: number; // Quantidade disponível no estoque
  type?: string; // Tipo/espessura (ex: "Premium", "Slim", "Padrão", "Matte")
  notes?: string; // Observações opcionais
  updatedAt?: string; // Data ISO da última alteração
}

export interface ColumnMapping {
  name: string;
  status: string;
  spend: string;
  type: string;
  value: string;
  soldValue?: string;
}

