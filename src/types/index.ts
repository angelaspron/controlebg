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
}

export interface ColumnMapping {
  name: string;
  status: string;
  spend: string;
  type: string;
  value: string;
  soldValue?: string;
}

