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
  playCount?: number; // Quantidade de vezes jogadas (exclusivo da Ludopedia)
  isSealed?: boolean; // Rastreamento de conservação (Status: Lacrado / Aberto)
  
  // Dados extras do BGG & Ludopedia & Compara Jogos
  namePt?: string; // Nome nacional em português (Ludopedia)
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
  mechanicsPt?: string[]; // mecânicas em português (Ludopedia)
  categories?: string[]; // categorias BGG / Ludopedia
  themes?: string[]; // temas Ludopedia
  designers?: string[]; // designers / autores do jogo
  artists?: string[]; // artistas / ilustradores
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

  // Rastreamento Temporal na Coleção (Retrospectiva)
  acquiredAt?: string; // Data de entrada na coleção (YYYY-MM-DD)
  soldAt?: string; // Data de saída/venda da coleção (YYYY-MM-DD)
  wishlistAt?: string; // Data de adição à lista de desejos (YYYY-MM-DD)

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

// ==========================================
// ESTRUTURAS DE PARTIDAS (LUDOPEDIA V1 API)
// ==========================================

export interface LudopediaMatchPlayer {
  id_partida_jogador: number;
  nome: string;
  id_usuario?: number | null;
  fl_vencedor: number; // 0 ou 1
  vl_pontos?: number | null;
  observacao?: string | null;
  thumb?: string;
}

export interface LudopediaMatchGame {
  id_jogo: number;
  nm_jogo: string;
  nm_original?: string;
  thumb?: string;
  link?: string;
}

export interface LudopediaMatch {
  id_partida: number;
  qt_partidas: number;
  fl_digital: number; // 0 = Presencial, 1 = Digital
  duracao: number | null; // Duração em minutos
  dt_partida: string; // yyyy-mm-dd
  descricao: string | null;
  grupo?: {
    id_grupo_jogo: number;
    nm_grupo: string;
  };
  jogo: LudopediaMatchGame;
  expansoes?: LudopediaMatchGame[];
  jogadores: LudopediaMatchPlayer[];
}

export interface LudopediaPlaysSummary {
  qt_partidas: number;
  vl_duracao: number; // Duração acumulada em minutos
  qt_duracao: number; // Quantidade de partidas com duração cadastrada
  qt_jogos: number; // Quantidade de jogos únicos
  qt_expansoes: number; // Quantidade de expansões únicas
  qt_vitorias: number; // Vitórias do usuário
  qt_usuarios: number; // Usuários registrados participantes
  qt_nao_usuarios: number; // Não-usuários registrados
}

export interface LudopediaMeProfile {
  id_usuario: number;
  usuario: string;
  thumb?: string;
}

export interface LudopediaWishlistItem {
  ludoId: string;
  name: string;
  thumbnail?: string;
  yearPublished?: number;
  link?: string;
}

export type RetrospectiveDrilldownKind = 'games' | 'matches' | 'titles';

export interface RetrospectiveDrilldownData {
  kind: RetrospectiveDrilldownKind;
  title: string;
  subtitle?: string;
  accentColor?: string;
  games?: GameData[];
  matches?: LudopediaMatch[];
  extraStats?: {
    label: string;
    value: string;
    color?: string;
  }[];
  externalLinks?: {
    label: string;
    url: string;
  }[];
  playerHeader?: {
    name: string;
    thumb?: string;
    totalPlays: number;
    totalHours: number;
    userWinsWithPlayer: number;
    playerWins: number;
    topGames: { name: string; count: number; thumb?: string }[];
  };
}



