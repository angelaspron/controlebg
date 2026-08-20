export interface GameData {
  id: string; // Gerado localmente se não tiver ID BGG ainda
  bggId?: string;
  name: string; // 'jogos'
  status: string; // ex: 'Na Coleção', 'Vendido'
  spend: number | string; // 'valor' - valor pago pelo jogo
  type: string; // 'tipo' - ex: 'Base', 'Expansão', 'Acessório'
  value: number | string; // 'valor mercado' - valor atual de mercado
  soldValue?: number | string; // valor de venda
  
  // Dados extras do BGG
  thumbnail?: string;
  image?: string;
  minPlayers?: number;
  maxPlayers?: number;
  rating?: number;
  yearPublished?: number;
  ludoId?: string;
  ludoRating?: number;
  weight?: number; // 1-5
  playtime?: number; // tempo de partida
  domains?: string[]; // categories/mechanics
  rank?: number; // posição no ranking (bgg_rank)
}

export interface ColumnMapping {
  name: string;
  status: string;
  spend: string;
  type: string;
  value: string;
  soldValue?: string;
}
