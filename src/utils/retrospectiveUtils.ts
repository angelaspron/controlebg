import type {
  GameData,
  LudopediaMatch,
  LudopediaMatchPlayer,
  LudopediaMeProfile,
  LudopediaWishlistItem,
} from '../types/index.ts';
import { matchesGameName, normalizeGameName } from './nameMatcher.ts';

// Mapeamento de mecânicas BGG (EN) para termos oficiais da Ludopedia (PT-BR)
const BGG_MECHANIC_TO_PT: Record<string, string> = {
  'action drafting': 'Seleção de Ações',
  'action points': 'Pontos de Ação',
  'action queue': 'Fila de Ações',
  'action retrieval': 'Recuperação de Ações',
  'action/event': 'Ação / Evento',
  'action / event': 'Ação / Evento',
  'advantage token': 'Ficha de Vantagem',
  'alliances': 'Alianças',
  'area majority / influence': 'Influência / Maioria na Área',
  'area movement': 'Movimento de Área',
  'area-impulse': 'Impulso de Área',
  'auction / bidding': 'Leilão',
  'auction: sealed bid': 'Leilão Fechado',
  'betting and bluffing': 'Apostas e Blefe',
  'campaign / battle card driven': 'Campanha / Batalhas Dirigidas por Cartas',
  'card play conflict resolution': 'Resolução de Conflito por Cartas',
  'closed drafting': 'Seleção Fechada',
  'command cards': 'Cartas de Comando',
  'communication limits': 'Comunicação Limitada',
  'connections': 'Conexões',
  'contracts': 'Contratos',
  'cooperative game': 'Cooperativo',
  'deck, bag, and pool building': 'Construção de Baralho / Peças',
  'deck construction': 'Construção de Baralhos',
  'deduction': 'Dedução',
  'dice rolling': 'Rolagem de Dados',
  'die icon resolution': 'Resolução por Ícones de Dados',
  'end game bonuses': 'Bônus de Fim de Jogo',
  'events': 'Eventos',
  'follow': 'Seguir Ação',
  'grid movement': 'Movimento em Grade',
  'hand management': 'Gerenciamento de Mãos',
  'hexagon grid': 'Tabuleiro Hexagonal',
  'hidden movement': 'Movimento Oculto',
  'hidden roles': 'Papéis Ocultos',
  'income': 'Renda',
  'increase value of unchosen resources': 'Valorização de Recursos Não Escolhidos',
  'legacy game': 'Legacy',
  'market': 'Mercado',
  'matching': 'Combinação',
  'melding and splaying': 'Combinação de Cartas',
  'memory': 'Memória',
  'modular board': 'Tabuleiro Modular',
  'multi-use cards': 'Cartas Multiuso',
  'negotiation': 'Negociação',
  'network and route building': 'Construção de Rotas',
  'once-per-game abilities': 'Habilidades Únicas por Partida',
  'open drafting': 'Seleção Aberta',
  'ownership': 'Posse',
  'pattern building': 'Construção de Padrões',
  'pattern recognition': 'Reconhecimento de Padrões',
  'pick-up and deliver': 'Pegar e Entregar',
  'player elimination': 'Eliminação de Jogadores',
  'point to point movement': 'Movimento Ponto a Ponto',
  'push your luck': 'Forçar a Sorte',
  'race': 'Corrida',
  'resource queue': 'Fila de Recursos',
  'resource to move': 'Recurso para Movimento',
  'roll / spin and move': 'Rolar e Mover',
  'rondel': 'Rondel',
  'scenario / mission / campaign game': 'Cenário / Missão / Campanha',
  'score-and-reset game': 'Pontuação e Reinício',
  'secret unit deployment': 'Posicionamento Secreto',
  'set collection': 'Colecionar Componentes',
  'simulation': 'Simulação',
  'simultaneous action selection': 'Seleção de Ação Simultânea',
  'solo / solitaire game': 'Solo / Solitário',
  'stat check resolution': 'Teste de Atributo',
  'stock holding': 'Compra de Ações',
  'storytelling': 'Narração de Histórias',
  'sudden death ending': 'Fim por Morte Súbita',
  'take that': 'Toma Essa',
  'team-based game': 'Jogo em Equipe',
  'tech trees / tech tracks': 'Árvore Tecnológica',
  'tile placement': 'Colocação de Peças',
  'time track': 'Trilha de Tempo',
  'track movement': 'Movimento em Trilha',
  'trading': 'Troca / Negociação',
  'trick-taking': 'Vazas',
  'tug of war': 'Cabo-de-Guerra',
  'turn order: claim action': 'Ordem de Turno: Ação de Reivindicação',
  'turn order: pass order': 'Ordem de Turno: Ordem de Passar',
  'turn order: progressive': 'Ordem de Turno: Progressiva',
  'turn order: stat-based': 'Ordem de Turno: Baseado em Estatísticas',
  'variable phase order': 'Ordem de Fases Variável',
  'variable player powers': 'Jogadores com Diferentes Habilidades',
  'variable set-up': 'Preparação Variável',
  'victory points as a resource': 'Pontos de Vitória como Recurso',
  'voting': 'Votação',
  'worker placement': 'Alocação de Trabalhadores',
  'worker placement with dice workers': 'Alocação de Trabalhadores com Dados',
  'worker placement, different worker types': 'Alocação com Trabalhadores Diferentes',
  'zone of control': 'Zona de Controle',
};

const KNOWN_PT_MECHANICS_SET = new Set(Object.values(BGG_MECHANIC_TO_PT).map(v => v.toLowerCase()));

export function parseNumericPrice(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;
  // Se tiver vírgula e ponto (ex: "1.250,50"), remove pontos de milhar e troca vírgula
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function isGameExpansionType(game: Pick<GameData, 'type'>): boolean {
  const t = String(game.type || '').toLowerCase();
  return t.includes('expans') || t.includes('expansion');
}

export function isGameBaseType(game: Pick<GameData, 'type'>): boolean {
  const t = String(game.type || '').toLowerCase().trim();
  return t === '' || t.includes('base');
}

export function isGameOwnedStatus(game: Pick<GameData, 'status'>): boolean {
  const s = String(game.status || '').toLowerCase();
  return s.includes('coleção') || s.includes('colecao') || s.includes('sim');
}

export function isGameSoldStatus(game: Pick<GameData, 'status'>): boolean {
  const s = String(game.status || '').toLowerCase();
  return s.includes('vendido') || s.includes('teve') || s.includes('saiu');
}

export function isGameWishlistStatus(game: Pick<GameData, 'status'>): boolean {
  const s = String(game.status || '').toLowerCase();
  return s.includes('desejo') || s.includes('wishlist');
}

/**
 * Retorna a lista limpa de mecânicas em Português (sem duplicar termos EN/PT).
 */
export function getGameMechanicsPt(game: GameData): string[] {
  if (Array.isArray(game.mechanicsPt) && game.mechanicsPt.length > 0) {
    return Array.from(new Set(game.mechanicsPt.map(m => m.trim()).filter(Boolean)));
  }

  const out: string[] = [];
  const seenLower = new Set<string>();

  const addUnique = (label: string) => {
    const clean = label.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!seenLower.has(key)) {
      seenLower.add(key);
      out.push(clean);
    }
  };

  // Se domains contém mecânicas em português já importadas da Ludopedia, priorizá-las
  if (Array.isArray(game.domains)) {
    for (const d of game.domains) {
      const clean = String(d || '').trim();
      if (!clean) continue;
      if (KNOWN_PT_MECHANICS_SET.has(clean.toLowerCase())) {
        addUnique(clean);
      }
    }
  }

  // Mapear mecânicas BGG (EN -> PT-BR) sem duplicar o que já veio de domains
  if (Array.isArray(game.mechanics)) {
    for (const m of game.mechanics) {
      const clean = String(m || '').trim();
      if (!clean) continue;
      const mapped = BGG_MECHANIC_TO_PT[clean.toLowerCase()] || clean;
      addUnique(mapped);
    }
  }

  return out;
}

/**
 * Extrai data ISO (YYYY-MM-DD) a partir do timestamp incorporado no ID local/bgg/ludo.
 */
export function extractDateFromGameId(id: string): string | undefined {
  if (!id) return undefined;
  const parts = id.split('-');
  for (let i = parts.length - 1; i >= 0; i--) {
    const num = Number(parts[i]);
    if (Number.isFinite(num) && num > 1577836800000 && num < 2208988800000) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
  }
  return undefined;
}

export function extractYearFromIsoDate(dateStr?: string): number | null {
  if (!dateStr || dateStr === 'legacy') return null;
  const m = String(dateStr).trim().match(/^(\d{4})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return y >= 1990 && y <= 2100 ? y : null;
}

export interface ResolvedGameDates {
  hasExplicitDates: boolean;
  acquiredById: Record<string, string | undefined>;
  soldById: Record<string, string | undefined>;
  wishlistById: Record<string, string | undefined>;
}

/**
 * Resolve datas efetivas de entrada, saída e desejo respeitando datas explícitas
 * ou caindo para modo de data de cadastro no sistema quando nenhuma data foi refinada ainda.
 */
export function resolveCollectionDates(games: GameData[]): ResolvedGameDates {
  const hasExplicitDates = games.some(g => Boolean(g.acquiredAt || g.soldAt || g.wishlistAt));
  const acquiredById: Record<string, string | undefined> = {};
  const soldById: Record<string, string | undefined> = {};
  const wishlistById: Record<string, string | undefined> = {};

  for (const g of games) {
    const idDate = !hasExplicitDates ? extractDateFromGameId(g.id) : undefined;

    if (g.acquiredAt && g.acquiredAt !== 'legacy') {
      acquiredById[g.id] = g.acquiredAt;
    } else if (!hasExplicitDates && !isGameWishlistStatus(g)) {
      acquiredById[g.id] = idDate;
    }

    if (g.soldAt && g.soldAt !== 'legacy') {
      soldById[g.id] = g.soldAt;
    } else if (!hasExplicitDates && isGameSoldStatus(g)) {
      soldById[g.id] = idDate;
    }

    if (g.wishlistAt && g.wishlistAt !== 'legacy') {
      wishlistById[g.id] = g.wishlistAt;
    } else if (!hasExplicitDates && isGameWishlistStatus(g)) {
      wishlistById[g.id] = idDate;
    }
  }

  return { hasExplicitDates, acquiredById, soldById, wishlistById };
}

/**
 * Retorna os anos disponíveis para seleção na Retrospectiva (ordenados do mais recente ao mais antigo).
 */
export function getAvailableRetrospectiveYears(
  games: GameData[],
  matches: LudopediaMatch[],
  referenceDate: Date = new Date()
): number[] {
  const years = new Set<number>();
  years.add(referenceDate.getFullYear());

  for (const m of matches) {
    const y = extractYearFromIsoDate(m.dt_partida);
    if (y) years.add(y);
  }

  const resolved = resolveCollectionDates(games);
  for (const g of games) {
    const ay = extractYearFromIsoDate(resolved.acquiredById[g.id]);
    const sy = extractYearFromIsoDate(resolved.soldById[g.id]);
    const wy = extractYearFromIsoDate(resolved.wishlistById[g.id]);
    if (ay) years.add(ay);
    if (sy) years.add(sy);
    if (wy) years.add(wy);
  }

  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Localiza o objeto do jogador correspondente ao usuário logado em uma partida.
 */
export function identifyUserPlayerInMatch(
  match: LudopediaMatch,
  me?: LudopediaMeProfile | null,
  fallbackUsername?: string
): LudopediaMatchPlayer | null {
  const players = Array.isArray(match.jogadores) ? match.jogadores : [];
  if (players.length === 0) return null;

  if (me?.id_usuario) {
    const byId = players.find(p => p.id_usuario && Number(p.id_usuario) === Number(me.id_usuario));
    if (byId) return byId;
  }

  const targetNames = [me?.usuario, fallbackUsername]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map(v => v.trim().toLowerCase());

  if (targetNames.length > 0) {
    const byName = players.find(p => p.nome && targetNames.includes(p.nome.trim().toLowerCase()));
    if (byName) return byName;
  }

  return null;
}

export function evaluateMatchUserVictory(
  match: LudopediaMatch,
  me?: LudopediaMeProfile | null,
  fallbackUsername?: string
): { hasMarkedWinner: boolean; userWon: boolean } {
  const players = Array.isArray(match.jogadores) ? match.jogadores : [];
  const hasMarkedWinner = players.some(p => Number(p.fl_vencedor) === 1);
  if (!hasMarkedWinner) {
    return { hasMarkedWinner: false, userWon: false };
  }

  const userPlayer = identifyUserPlayerInMatch(match, me, fallbackUsername);
  if (userPlayer) {
    return { hasMarkedWinner: true, userWon: Number(userPlayer.fl_vencedor) === 1 };
  }

  // Fallback se não houver perfil de usuário identificado
  return { hasMarkedWinner: true, userWon: false };
}

export function findCollectionGameForMatch(
  matchGame: { id_jogo?: number; nm_jogo?: string; nm_original?: string } | undefined,
  games: GameData[]
): GameData | undefined {
  if (!matchGame) return undefined;
  const targetLudoId = matchGame.id_jogo ? String(matchGame.id_jogo) : undefined;
  if (targetLudoId) {
    const byLudoId = games.find(g => g.ludoId && String(g.ludoId) === targetLudoId);
    if (byLudoId) return byLudoId;
  }

  const candidateNames = [matchGame.nm_jogo, matchGame.nm_original].filter((n): n is string => Boolean(n && n.trim()));
  for (const name of candidateNames) {
    const norm = normalizeGameName(name);
    const exact = games.find(g => normalizeGameName(g.name) === norm || (g.namePt && normalizeGameName(g.namePt) === norm));
    if (exact) return exact;
    const fuzzy = games.find(g => matchesGameName(g.name, name) || (g.namePt && matchesGameName(g.namePt, name)));
    if (fuzzy) return fuzzy;
  }

  return undefined;
}

export interface RankedEntityGroup {
  name: string;
  count: number;
  games: GameData[];
  allCollectionGames: GameData[];
}

export interface PlayedGameStat {
  gameKey: string;
  ludoId?: string;
  name: string;
  thumb?: string;
  link?: string;
  playCount: number;
  totalMinutes: number;
  matches: LudopediaMatch[];
  collectionGame?: GameData;
  firstPlayDate?: string;
}

export interface CoPlayerStat {
  key: string;
  name: string;
  thumb?: string;
  playCount: number;
  totalMinutes: number;
  userWinsTogether: number;
  playerWins: number;
  matches: LudopediaMatch[];
  topGames: { name: string; count: number; thumb?: string }[];
}

export interface CalendarDayCell {
  dateStr: string;
  inYear: boolean;
  count: number;
  minutes: number;
  matches: LudopediaMatch[];
  level: 0 | 1 | 2 | 3 | 4;
  isBusiestDay: boolean;
}

export interface CalendarMonthMarker {
  monthIndex: number;
  label: string;
  weekCol: number;
}

export interface MonthlyMatchStat {
  monthIndex: number;
  label: string;
  fullName: string;
  playCount: number;
  minutes: number;
  hours: number;
  matches: LudopediaMatch[];
}

export interface WeekdayStat {
  dayIndex: number; // 0=Seg .. 6=Dom
  shortLabel: string;
  fullLabel: string;
  playCount: number;
  percentage: number;
  isTopDay: boolean;
  matches: LudopediaMatch[];
}

export interface RetrospectiveTitleBadge {
  id: string;
  title: string;
  subtitle: string;
  reason: string;
  accent: string;
  earned: boolean;
}

export interface RetrospectiveSummary {
  year: number | 'all';
  calendarYear: number;
  cutoffLabel: string;
  isFallbackDateMode: boolean;

  // Herói
  primaryTitle: RetrospectiveTitleBadge;
  secondaryTitle: RetrospectiveTitleBadge | null;
  allBadges: RetrospectiveTitleBadge[];
  collageCovers: string[];

  // Na Estante
  enteredGames: GameData[];
  enteredBaseGames: GameData[];
  enteredExpGames: GameData[];
  enteredOtherGames: GameData[];
  leftGames: GameData[];
  netBalance: number;
  shelfEndCount: number;
  wishlistNewGames: GameData[];
  wishlistFulfilledGames: GameData[];
  wishlistTotalCount: number;
  wishlistDisplayGames: GameData[];

  topMechanics: RankedEntityGroup[];
  topCategories: RankedEntityGroup[];
  topDesigners: RankedEntityGroup[];
  topArtists: RankedEntityGroup[];
  oldestArrival: { game: GameData; year: number } | null;
  newestArrival: { game: GameData; year: number } | null;
  avgNewWeight: number | null;
  heaviestArrival: GameData | null;
  lightestArrival: GameData | null;
  missingDesignersCount: number;

  arrivalsBasePlayed: GameData[];
  arrivalsBaseUnplayed: GameData[];
  arrivalsAllPlayed: GameData[];
  arrivalsAllUnplayed: GameData[];
  arrivalsSealed: GameData[];

  totalInvested: number;
  investedGames: GameData[];
  freeArrivals: GameData[];
  avgPaidPrice: number;
  mostExpensiveArrival: { game: GameData; price: number } | null;
  arrivalsMarketValue: number;
  soldRevenue: number;
  soldCostBasis: number;
  soldProfit: number;

  // Na Mesa
  yearMatches: LudopediaMatch[];
  totalPlays: number;
  prevYearTotalPlays: number | null;
  yoyGrowthPct: number | null;
  uniqueDaysCount: number;
  daysPerSession: number | null;
  longestStreakDays: number;
  uniqueGamesPlayedCount: number;
  uniqueGamesPlayedList: PlayedGameStat[];
  totalMinutes: number;
  totalHours: number;
  totalHoursRounded: number;
  totalFullDays: number;
  avgMatchMinutes: number;
  longestMatch: LudopediaMatch | null;
  hIndex: number;

  presencialCount: number;
  digitalCount: number;
  presencialMatches: LudopediaMatch[];
  digitalMatches: LudopediaMatch[];

  busiestMonth: MonthlyMatchStat | null;
  busiestDay: { dateStr: string; formattedDate: string; count: number; matches: LudopediaMatch[] } | null;
  calendarWeeks: CalendarDayCell[][];
  calendarMonthMarkers: CalendarMonthMarker[];
  monthlyStats: MonthlyMatchStat[];

  mostPlayedGames: PlayedGameStat[];
  mostPlayedByHours: PlayedGameStat[];
  gamesOver5PlaysCount: number;

  debuts: PlayedGameStat[];
  debutRatePct: number;

  winStats: {
    matchesWithWinnerCount: number;
    userWinsCount: number;
    winRatePct: number;
    wonMatches: LudopediaMatch[];
    otherMatches: LudopediaMatch[];
  };

  weekdayStats: WeekdayStat[];
  topWeekday: WeekdayStat | null;

  coPlayers: CoPlayerStat[];
  topGroups: { name: string; count: number; matches: LudopediaMatch[] }[];
  topExpansionsPlayed: { name: string; count: number; thumb?: string; matches: LudopediaMatch[] }[];
}

const MONTH_SHORT_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTH_FULL_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const WEEKDAY_SHORT_PT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const WEEKDAY_FULL_PT = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatPtBrDayMonthLong(dateStr: string): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  const day = parseInt(m[3], 10);
  const monthIdx = parseInt(m[2], 10) - 1;
  return `${day} de ${MONTH_FULL_PT[monthIdx] || m[2]}`;
}

export function formatPtBrDayMonthShort(dateStr?: string): string {
  if (!dateStr) return '';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  const day = parseInt(m[3], 10);
  const monthIdx = parseInt(m[2], 10) - 1;
  return `${day}/${MONTH_SHORT_PT[monthIdx] || m[2]}`;
}

/**
 * Calcula todos os indicadores, séries, calendário, rankings e conquistas da Retrospectiva.
 */
export function computeRetrospectiveData(params: {
  year: number | 'all';
  games: GameData[];
  allMatches: LudopediaMatch[];
  me?: LudopediaMeProfile | null;
  fallbackUsername?: string;
  wishlistItems?: LudopediaWishlistItem[];
  referenceDate?: Date;
}): RetrospectiveSummary {
  const {
    year,
    games,
    allMatches,
    me,
    fallbackUsername,
    wishlistItems = [],
    referenceDate = new Date(),
  } = params;

  const isAllYears = year === 'all';
  const currentSystemYear = referenceDate.getFullYear();
  const calendarYear = isAllYears ? currentSystemYear : year;

  // 1. Resolução de datas da coleção
  const dateInfo = resolveCollectionDates(games);

  const matchesSelectedYear = (dateStr?: string) => {
    const y = extractYearFromIsoDate(dateStr);
    if (!y) return false;
    return isAllYears ? true : y === year;
  };

  const enteredGames = games.filter(g => {
    if (isGameWishlistStatus(g)) return false;
    return matchesSelectedYear(dateInfo.acquiredById[g.id]);
  });

  const leftGames = games.filter(g => {
    if (!isGameSoldStatus(g)) return false;
    return matchesSelectedYear(dateInfo.soldById[g.id]);
  });

  const enteredBaseGames = enteredGames.filter(g => isGameBaseType(g));
  const enteredExpGames = enteredGames.filter(g => isGameExpansionType(g));
  const enteredOtherGames = enteredGames.filter(g => !isGameBaseType(g) && !isGameExpansionType(g));
  const netBalance = enteredGames.length - leftGames.length;

  // Cálculo retroativo exato da estante ao fim do ano:
  // shelfEnd(Y) = currentOwned - enteredAfter(Y) + leftAfter(Y)
  const currentOwnedCount = games.filter(isGameOwnedStatus).length;
  let shelfEndCount = currentOwnedCount;
  if (!isAllYears) {
    const enteredAfterY = games.filter(g => {
      if (isGameWishlistStatus(g)) return false;
      const y = extractYearFromIsoDate(dateInfo.acquiredById[g.id]);
      return y !== null && y > year;
    }).length;
    const leftAfterY = games.filter(g => {
      if (!isGameSoldStatus(g)) return false;
      const y = extractYearFromIsoDate(dateInfo.soldById[g.id]);
      return y !== null && y > year;
    }).length;
    shelfEndCount = Math.max(0, currentOwnedCount - enteredAfterY + leftAfterY);
  }

  // Desejos (combinando jogos com status 'Desejo' locais + lista_desejos da Ludopedia sem duplicar)
  const localWishlistGames = games.filter(isGameWishlistStatus);
  const wishlistNewGames = localWishlistGames.filter(g => matchesSelectedYear(dateInfo.wishlistById[g.id]));
  const wishlistFulfilledGames = games.filter(
    g => Boolean(g.wishlistAt) && isGameOwnedStatus(g) && matchesSelectedYear(dateInfo.acquiredById[g.id])
  );
  const mergedWishlistDisplay: GameData[] = [...localWishlistGames];
  for (const w of wishlistItems) {
    const alreadyExists = mergedWishlistDisplay.some(
      lg => (lg.ludoId && lg.ludoId === w.ludoId) || normalizeGameName(lg.name) === normalizeGameName(w.name)
    );
    if (!alreadyExists) {
      mergedWishlistDisplay.push({
        id: `wishlist-ludo-${w.ludoId}`,
        ludoId: w.ludoId,
        name: w.name,
        status: 'Desejo',
        spend: 0,
        type: 'Base',
        value: 0,
        thumbnail: w.thumbnail,
        yearPublished: w.yearPublished,
      });
    }
  }
  const wishlistTotalCount = mergedWishlistDisplay.length;

  // 2. Agregações dos jogos que entraram (Mecânicas, Categorias, Designers, Artistas, Ano, Peso)
  const buildRankedGroups = (
    targetGames: GameData[],
    allGames: GameData[],
    extractor: (g: GameData) => string[]
  ): RankedEntityGroup[] => {
    const yearMap = new Map<string, { display: string; games: GameData[] }>();
    const fullMap = new Map<string, GameData[]>();

    for (const g of allGames) {
      for (const rawItem of extractor(g)) {
        const clean = rawItem.trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        const arr = fullMap.get(key) || [];
        arr.push(g);
        fullMap.set(key, arr);
      }
    }

    for (const g of targetGames) {
      const seenInGame = new Set<string>();
      for (const rawItem of extractor(g)) {
        const clean = rawItem.trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (seenInGame.has(key)) continue;
        seenInGame.add(key);
        const existing = yearMap.get(key);
        if (existing) {
          existing.games.push(g);
        } else {
          yearMap.set(key, { display: clean, games: [g] });
        }
      }
    }

    return Array.from(yearMap.entries())
      .map(([key, entry]) => ({
        name: entry.display,
        count: entry.games.length,
        games: entry.games,
        allCollectionGames: fullMap.get(key) || entry.games,
      }))
      .sort((a, b) => b.count - a.count || b.allCollectionGames.length - a.allCollectionGames.length || a.name.localeCompare(b.name));
  };

  const topMechanics = buildRankedGroups(enteredGames, games, getGameMechanicsPt);
  const topCategories = buildRankedGroups(enteredGames, games, g => g.categories || []);
  const topDesigners = buildRankedGroups(enteredGames, games, g => g.designers || []);
  const topArtists = buildRankedGroups(enteredGames, games, g => g.artists || []);

  const missingDesignersCount = (enteredGames.length > 0 ? enteredGames : games).filter(
    g => (!g.designers || g.designers.length === 0) && (g.bggId || g.ludoId)
  ).length;

  const arrivalsWithYear = enteredGames
    .filter(g => g.yearPublished && g.yearPublished > 1800 && g.yearPublished <= currentSystemYear + 2)
    .sort((a, b) => (a.yearPublished || 9999) - (b.yearPublished || 9999));

  const oldestArrival = arrivalsWithYear.length > 0
    ? { game: arrivalsWithYear[0], year: arrivalsWithYear[0].yearPublished! }
    : null;
  const newestArrival = arrivalsWithYear.length > 0
    ? { game: arrivalsWithYear[arrivalsWithYear.length - 1], year: arrivalsWithYear[arrivalsWithYear.length - 1].yearPublished! }
    : null;

  const arrivalsWithWeight = enteredGames.filter(g => g.weight && g.weight > 0).sort((a, b) => (a.weight || 0) - (b.weight || 0));
  const avgNewWeight = arrivalsWithWeight.length > 0
    ? Math.round((arrivalsWithWeight.reduce((acc, g) => acc + (g.weight || 0), 0) / arrivalsWithWeight.length) * 100) / 100
    : null;
  const lightestArrival = arrivalsWithWeight.length > 0 ? arrivalsWithWeight[0] : null;
  const heaviestArrival = arrivalsWithWeight.length > 0 ? arrivalsWithWeight[arrivalsWithWeight.length - 1] : null;

  // 3. Partidas do ano (Na mesa) - primeiro agrupamos todo histórico para detectar estreias reais e YoY
  const firstPlayDateByGameKey = new Map<string, string>();
  const resolveMatchGameKey = (jogo?: { id_jogo?: number; nm_jogo?: string }) => {
    if (!jogo) return 'unknown';
    if (jogo.id_jogo) return `id:${jogo.id_jogo}`;
    return `name:${normalizeGameName(jogo.nm_jogo || 'desconhecido')}`;
  };

  const sortedAllMatchesAsc = [...allMatches].sort((a, b) =>
    String(a.dt_partida || '').localeCompare(String(b.dt_partida || ''))
  );

  for (const m of sortedAllMatchesAsc) {
    if (!m.dt_partida) continue;
    const key = resolveMatchGameKey(m.jogo);
    if (!firstPlayDateByGameKey.has(key)) {
      firstPlayDateByGameKey.set(key, m.dt_partida);
    }
  }

  const yearMatches = allMatches.filter(m => {
    const y = extractYearFromIsoDate(m.dt_partida);
    if (!y) return false;
    return isAllYears ? true : y === year;
  });

  const prevYearTotalPlays = !isAllYears
    ? allMatches
        .filter(m => extractYearFromIsoDate(m.dt_partida) === year - 1)
        .reduce((acc, m) => acc + Math.max(1, Number(m.qt_partidas || 1)), 0)
    : null;

  let totalPlays = 0;
  let totalMinutes = 0;
  let presencialCount = 0;
  let digitalCount = 0;
  const presencialMatches: LudopediaMatch[] = [];
  const digitalMatches: LudopediaMatch[] = [];
  let longestMatch: LudopediaMatch | null = null;

  const uniqueDatesMap = new Map<string, { count: number; minutes: number; matches: LudopediaMatch[] }>();
  const playedGamesMap = new Map<string, PlayedGameStat>();
  const coPlayersMap = new Map<string, CoPlayerStat>();
  const groupsMap = new Map<string, { name: string; count: number; matches: LudopediaMatch[] }>();
  const expansionsMap = new Map<string, { name: string; count: number; thumb?: string; matches: LudopediaMatch[] }>();

  const monthlyStats: MonthlyMatchStat[] = MONTH_SHORT_PT.map((label, idx) => ({
    monthIndex: idx,
    label,
    fullName: MONTH_FULL_PT[idx],
    playCount: 0,
    minutes: 0,
    hours: 0,
    matches: [],
  }));

  const weekdayStats: WeekdayStat[] = WEEKDAY_SHORT_PT.map((shortLabel, idx) => ({
    dayIndex: idx,
    shortLabel,
    fullLabel: WEEKDAY_FULL_PT[idx],
    playCount: 0,
    percentage: 0,
    isTopDay: false,
    matches: [],
  }));

  let matchesWithWinnerCount = 0;
  let userWinsCount = 0;
  const wonMatches: LudopediaMatch[] = [];
  const otherMatches: LudopediaMatch[] = [];

  for (const m of yearMatches) {
    const pCount = Math.max(1, Number(m.qt_partidas || 1));
    const dur = Math.max(0, Number(m.duracao || 0));

    totalPlays += pCount;
    totalMinutes += dur;

    if (!longestMatch || dur > Number(longestMatch.duracao || 0)) {
      if (dur > 0) longestMatch = m;
    }

    if (m.fl_digital === 1) {
      digitalCount += pCount;
      digitalMatches.push(m);
    } else {
      presencialCount += pCount;
      presencialMatches.push(m);
    }

    // Por data e dia da semana e mês
    if (m.dt_partida) {
      const dayEntry = uniqueDatesMap.get(m.dt_partida) || { count: 0, minutes: 0, matches: [] };
      dayEntry.count += pCount;
      dayEntry.minutes += dur;
      dayEntry.matches.push(m);
      uniqueDatesMap.set(m.dt_partida, dayEntry);

      const parts = m.dt_partida.split('-').map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        const monthIdx = dt.getMonth();
        if (monthlyStats[monthIdx]) {
          monthlyStats[monthIdx].playCount += pCount;
          monthlyStats[monthIdx].minutes += dur;
          monthlyStats[monthIdx].matches.push(m);
        }
        // JS getDay(): 0=Dom..6=Sáb -> converter para 0=Seg..6=Dom
        const mondayFirstIdx = (dt.getDay() + 6) % 7;
        if (weekdayStats[mondayFirstIdx]) {
          weekdayStats[mondayFirstIdx].playCount += pCount;
          weekdayStats[mondayFirstIdx].matches.push(m);
        }
      }
    }

    // Por jogo
    const gKey = resolveMatchGameKey(m.jogo);
    const existingGame = playedGamesMap.get(gKey);
    if (existingGame) {
      existingGame.playCount += pCount;
      existingGame.totalMinutes += dur;
      existingGame.matches.push(m);
    } else {
      playedGamesMap.set(gKey, {
        gameKey: gKey,
        ludoId: m.jogo?.id_jogo ? String(m.jogo.id_jogo) : undefined,
        name: m.jogo?.nm_jogo || 'Jogo Desconhecido',
        thumb: m.jogo?.thumb,
        link: m.jogo?.link,
        playCount: pCount,
        totalMinutes: dur,
        matches: [m],
        collectionGame: findCollectionGameForMatch(m.jogo, games),
        firstPlayDate: firstPlayDateByGameKey.get(gKey),
      });
    }

    // Expansões usadas
    if (Array.isArray(m.expansoes)) {
      for (const exp of m.expansoes) {
        const eKey = exp.id_jogo ? `id:${exp.id_jogo}` : `name:${normalizeGameName(exp.nm_jogo || '')}`;
        const existingExp = expansionsMap.get(eKey);
        if (existingExp) {
          existingExp.count += pCount;
          existingExp.matches.push(m);
        } else {
          expansionsMap.set(eKey, {
            name: exp.nm_jogo || 'Expansão',
            count: pCount,
            thumb: exp.thumb,
            matches: [m],
          });
        }
      }
    }

    // Grupo
    if (m.grupo?.nm_grupo) {
      const grpName = m.grupo.nm_grupo.trim();
      const existingGrp = groupsMap.get(grpName);
      if (existingGrp) {
        existingGrp.count += pCount;
        existingGrp.matches.push(m);
      } else {
        groupsMap.set(grpName, { name: grpName, count: pCount, matches: [m] });
      }
    }

    // Vitórias
    const victoryEval = evaluateMatchUserVictory(m, me, fallbackUsername);
    if (victoryEval.hasMarkedWinner) {
      matchesWithWinnerCount += pCount;
      if (victoryEval.userWon) {
        userWinsCount += pCount;
        wonMatches.push(m);
      } else {
        otherMatches.push(m);
      }
    }

    // Co-jogadores (exclui o próprio usuário)
    const userPlayer = identifyUserPlayerInMatch(m, me, fallbackUsername);
    const players = Array.isArray(m.jogadores) ? m.jogadores : [];
    const seenPlayerKeysInMatch = new Set<string>();

    for (const p of players) {
      if (!p.nome) continue;
      const isSelf =
        (userPlayer && p.id_partida_jogador === userPlayer.id_partida_jogador) ||
        (me?.id_usuario && p.id_usuario && Number(p.id_usuario) === Number(me.id_usuario)) ||
        (me?.usuario && p.nome.trim().toLowerCase() === me.usuario.trim().toLowerCase());
      if (isSelf) continue;

      const pKey = p.id_usuario ? `u:${p.id_usuario}` : `n:${p.nome.trim().toLowerCase()}`;
      if (seenPlayerKeysInMatch.has(pKey)) continue;
      seenPlayerKeysInMatch.add(pKey);

      const entry = coPlayersMap.get(pKey) || {
        key: pKey,
        name: p.nome.trim(),
        thumb: p.thumb,
        playCount: 0,
        totalMinutes: 0,
        userWinsTogether: 0,
        playerWins: 0,
        matches: [],
        topGames: [],
      };

      entry.playCount += pCount;
      entry.totalMinutes += dur;
      if (!entry.thumb && p.thumb) entry.thumb = p.thumb;
      if (victoryEval.userWon) entry.userWinsTogether += pCount;
      if (Number(p.fl_vencedor) === 1) entry.playerWins += pCount;
      entry.matches.push(m);
      coPlayersMap.set(pKey, entry);
    }
  }

  // Pós-processar topGames de cada co-jogador
  for (const cp of coPlayersMap.values()) {
    const gm = new Map<string, { name: string; count: number; thumb?: string }>();
    for (const m of cp.matches) {
      const gn = m.jogo?.nm_jogo || 'Jogo';
      const cur = gm.get(gn) || { name: gn, count: 0, thumb: m.jogo?.thumb };
      cur.count += Math.max(1, Number(m.qt_partidas || 1));
      gm.set(gn, cur);
    }
    cp.topGames = Array.from(gm.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }

  // Chegou e foi para a mesa?
  const playedGameIdsInMatches = new Set(Array.from(playedGamesMap.values()).map(g => g.ludoId).filter(Boolean));
  const isArrivalPlayed = (g: GameData) => {
    if (isAllYears) return Boolean(g.isPlayed) || (g.ludoId ? playedGameIdsInMatches.has(g.ludoId) : false);
    // No ano específico: jogado se tem isPlayed=true (para jogos que entraram no ano) OU se aparece nas partidas
    return Boolean(g.isPlayed) || (g.ludoId ? playedGameIdsInMatches.has(g.ludoId) : false);
  };

  const arrivalsBasePlayed = enteredBaseGames.filter(isArrivalPlayed);
  const arrivalsBaseUnplayed = enteredBaseGames.filter(g => !isArrivalPlayed(g));
  const arrivalsAllPlayed = enteredGames.filter(isArrivalPlayed);
  const arrivalsAllUnplayed = enteredGames.filter(g => !isArrivalPlayed(g));
  const arrivalsSealed = enteredGames.filter(g => Boolean(g.isSealed));

  // Financeiro das novidades e vendas
  const investedGames = enteredGames.filter(g => parseNumericPrice(g.spend) > 0);
  const freeArrivals = enteredGames.filter(g => parseNumericPrice(g.spend) <= 0);
  const totalInvested = investedGames.reduce((acc, g) => acc + parseNumericPrice(g.spend), 0);
  const avgPaidPrice = investedGames.length > 0 ? totalInvested / investedGames.length : 0;
  let mostExpensiveArrival: { game: GameData; price: number } | null = null;
  for (const g of investedGames) {
    const p = parseNumericPrice(g.spend);
    if (!mostExpensiveArrival || p > mostExpensiveArrival.price) {
      mostExpensiveArrival = { game: g, price: p };
    }
  }
  const arrivalsMarketValue = enteredGames.reduce((acc, g) => acc + parseNumericPrice(g.value), 0);
  const soldRevenue = leftGames.reduce((acc, g) => acc + parseNumericPrice(g.soldValue), 0);
  const soldCostBasis = leftGames.reduce((acc, g) => acc + parseNumericPrice(g.spend), 0);
  const soldProfit = soldRevenue - soldCostBasis;

  // Crescimento YoY
  const yoyGrowthPct =
    prevYearTotalPlays !== null && prevYearTotalPlays > 0
      ? Math.round(((totalPlays - prevYearTotalPlays) / prevYearTotalPlays) * 100)
      : null;

  // Dias de jogo, streak, frequência
  const uniqueDaysSorted = Array.from(uniqueDatesMap.keys()).sort();
  const uniqueDaysCount = uniqueDaysSorted.length;

  let daysElapsedInScope = 365;
  if (!isAllYears) {
    if (year === currentSystemYear) {
      const startOfYear = new Date(year, 0, 1);
      daysElapsedInScope = Math.max(1, Math.floor((referenceDate.getTime() - startOfYear.getTime()) / 86400000) + 1);
    } else {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      daysElapsedInScope = isLeap ? 366 : 365;
    }
  } else if (uniqueDaysSorted.length >= 2) {
    const firstDt = new Date(uniqueDaysSorted[0]);
    const lastDt = new Date(uniqueDaysSorted[uniqueDaysSorted.length - 1]);
    daysElapsedInScope = Math.max(1, Math.floor((lastDt.getTime() - firstDt.getTime()) / 86400000) + 1);
  }
  const daysPerSession = uniqueDaysCount > 0 ? Math.max(1, Math.round(daysElapsedInScope / uniqueDaysCount)) : null;

  let longestStreakDays = 0;
  let currentStreak = 0;
  let prevDayMs: number | null = null;
  for (const ds of uniqueDaysSorted) {
    const [yy, mm, dd] = ds.split('-').map(Number);
    const ms = Date.UTC(yy, mm - 1, dd);
    if (prevDayMs !== null && ms - prevDayMs === 86400000) {
      currentStreak++;
    } else {
      currentStreak = 1;
    }
    if (currentStreak > longestStreakDays) longestStreakDays = currentStreak;
    prevDayMs = ms;
  }

  // Horas e médias
  const totalHours = totalMinutes / 60;
  const totalHoursRounded = Math.round(totalHours);
  const totalFullDays = Math.round((totalHours / 24) * 10) / 10;
  const matchesWithDuration = yearMatches.filter(m => Number(m.duracao || 0) > 0).length;
  const avgMatchMinutes = matchesWithDuration > 0 ? Math.round(totalMinutes / matchesWithDuration) : 0;

  // Mais jogados & H-index
  const uniqueGamesPlayedList = Array.from(playedGamesMap.values()).sort(
    (a, b) => b.playCount - a.playCount || b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name)
  );
  const mostPlayedByHours = [...uniqueGamesPlayedList].sort(
    (a, b) => b.totalMinutes - a.totalMinutes || b.playCount - a.playCount
  );
  const gamesOver5PlaysCount = uniqueGamesPlayedList.filter(g => g.playCount >= 5).length;

  let hIndex = 0;
  for (let i = 0; i < uniqueGamesPlayedList.length; i++) {
    if (uniqueGamesPlayedList[i].playCount >= i + 1) hIndex = i + 1;
    else break;
  }

  // Estreias do ano
  const debuts = uniqueGamesPlayedList
    .filter(g => {
      if (!g.firstPlayDate) return false;
      const firstYear = extractYearFromIsoDate(g.firstPlayDate);
      return isAllYears ? true : firstYear === year;
    })
    .sort((a, b) => b.playCount - a.playCount || String(a.firstPlayDate).localeCompare(String(b.firstPlayDate)));

  const debutRatePct = uniqueGamesPlayedList.length > 0
    ? Math.round((debuts.length / uniqueGamesPlayedList.length) * 100)
    : 0;

  // Mensal & Dia mais cheio
  for (const ms of monthlyStats) {
    ms.hours = Math.round((ms.minutes / 60) * 10) / 10;
  }
  const busiestMonth = monthlyStats.some(m => m.playCount > 0)
    ? [...monthlyStats].sort((a, b) => b.playCount - a.playCount || b.minutes - a.minutes)[0]
    : null;

  let busiestDay: { dateStr: string; formattedDate: string; count: number; matches: LudopediaMatch[] } | null = null;
  for (const [dateStr, info] of uniqueDatesMap.entries()) {
    if (!busiestDay || info.count > busiestDay.count || (info.count === busiestDay.count && info.minutes > (busiestDay.matches.reduce((s, m) => s + Number(m.duracao || 0), 0)))) {
      busiestDay = {
        dateStr,
        formattedDate: formatPtBrDayMonthLong(dateStr),
        count: info.count,
        matches: info.matches,
      };
    }
  }

  // Calendário Heatmap (Segunda=0 .. Domingo=6) para `calendarYear`
  const jan1 = new Date(calendarYear, 0, 1);
  const dec31 = new Date(calendarYear, 11, 31);
  const jan1Offset = (jan1.getDay() + 6) % 7;
  const gridStart = new Date(calendarYear, 0, 1 - jan1Offset);
  const dec31Offset = (dec31.getDay() + 6) % 7;
  const gridEnd = new Date(calendarYear, 11, 31 + (6 - dec31Offset));

  const maxDayCount = Math.max(1, ...Array.from(uniqueDatesMap.values()).map(v => v.count));
  const calendarWeeks: CalendarDayCell[][] = [];
  const calendarMonthMarkers: CalendarMonthMarker[] = [];
  const seenMonthMarker = new Set<number>();

  let cursor = new Date(gridStart);
  let weekIdx = 0;
  while (cursor <= gridEnd) {
    const week: CalendarDayCell[] = [];
    for (let row = 0; row < 7; row++) {
      const inYear = cursor.getFullYear() === calendarYear;
      const dateStr = toLocalIsoDate(cursor);
      const dayInfo = inYear ? uniqueDatesMap.get(dateStr) : undefined;
      const count = dayInfo?.count || 0;

      if (inYear && cursor.getDate() === 1 && !seenMonthMarker.has(cursor.getMonth())) {
        seenMonthMarker.add(cursor.getMonth());
        calendarMonthMarkers.push({
          monthIndex: cursor.getMonth(),
          label: MONTH_SHORT_PT[cursor.getMonth()],
          weekCol: weekIdx,
        });
      }

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count > 0) {
        const ratio = count / maxDayCount;
        if (count === 1 || ratio <= 0.25) level = 1;
        else if (ratio <= 0.5) level = 2;
        else if (ratio <= 0.75) level = 3;
        else level = 4;
      }

      week.push({
        dateStr,
        inYear,
        count,
        minutes: dayInfo?.minutes || 0,
        matches: dayInfo?.matches || [],
        level,
        isBusiestDay: Boolean(inYear && busiestDay && busiestDay.dateStr === dateStr && count > 0),
      });

      cursor.setDate(cursor.getDate() + 1);
    }
    calendarWeeks.push(week);
    weekIdx++;
  }

  // Dia da semana favorito
  for (const ws of weekdayStats) {
    ws.percentage = totalPlays > 0 ? Math.round((ws.playCount / totalPlays) * 100) : 0;
  }
  const topWeekday = totalPlays > 0
    ? [...weekdayStats].sort((a, b) => b.playCount - a.playCount)[0]
    : null;
  if (topWeekday) {
    const target = weekdayStats.find(w => w.dayIndex === topWeekday.dayIndex);
    if (target) target.isTopDay = true;
  }

  // Taxa de vitórias
  const winRatePct = matchesWithWinnerCount > 0
    ? Math.round((userWinsCount / matchesWithWinnerCount) * 100)
    : 0;

  // Co-jogadores, grupos e expansões
  const coPlayers = Array.from(coPlayersMap.values()).sort(
    (a, b) => b.playCount - a.playCount || b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name)
  );
  const topGroups = Array.from(groupsMap.values()).sort((a, b) => b.count - a.count);
  const topExpansionsPlayed = Array.from(expansionsMap.values()).sort((a, b) => b.count - a.count);

  // Cutoff label ("As partidas de 2026, até 27/11")
  let cutoffLabel = isAllYears ? 'Todo o histórico registrado' : `As partidas de ${year}`;
  if (!isAllYears && year === currentSystemYear) {
    const dStr = `${String(referenceDate.getDate()).padStart(2, '0')}/${String(referenceDate.getMonth() + 1).padStart(2, '0')}`;
    cutoffLabel = `As partidas de ${year}, até ${dStr}`;
  }

  // Capa para colagem do Hero
  const collagePool = [
    ...enteredGames.map(g => g.thumbnail || g.image),
    ...uniqueGamesPlayedList.map(g => g.thumb),
    ...games.map(g => g.thumbnail || g.image),
  ].filter((u): u is string => Boolean(u && u.trim()));
  const collageCovers = Array.from(new Set(collagePool)).slice(0, 24);

  // Títulos & Conquistas do Ano ("SEU ANO FOI DE...")
  const allBadges: RetrospectiveTitleBadge[] = [
    {
      id: 'estante_expansao',
      title: 'Estante em expansão',
      subtitle: `${enteredGames.length} ${enteredGames.length === 1 ? 'jogo novo' : 'jogos novos'} na coleção.`,
      reason: 'Concedido quando 15 ou mais jogos entram na coleção no ano.',
      accent: '#3b82f6',
      earned: enteredGames.length >= 15,
    },
    {
      id: 'novidade_na_mesa',
      title: 'Novidade na mesa',
      subtitle: `${debuts.length} estreias (${debutRatePct}% dos jogos jogados).`,
      reason: 'Concedido quando pelo menos 50% dos jogos jogados no ano foram estreias.',
      accent: '#10b981',
      earned: debuts.length >= 5 && debutRatePct >= 50,
    },
    {
      id: 'viciado_tabuleiro',
      title: 'Maratonista da Mesa',
      subtitle: `${totalPlays} partidas e ${totalHoursRounded}h jogadas.`,
      reason: 'Concedido ao atingir 50+ partidas ou 100+ horas jogadas no ano.',
      accent: '#8b5cf6',
      earned: totalPlays >= 50 || totalHoursRounded >= 100,
    },
    {
      id: 'estrategista',
      title: 'Estrategista Implacável',
      subtitle: `${winRatePct}% de taxa de vitória (${userWinsCount} vitórias).`,
      reason: 'Concedido quando sua taxa de vitória é igual ou superior a 40% (mín. 10 partidas).',
      accent: '#f59e0b',
      earned: matchesWithWinnerCount >= 10 && winRatePct >= 40,
    },
    {
      id: 'anfitriao',
      title: 'Anfitrião da Jogatina',
      subtitle: `${coPlayers.length} pessoas diferentes dividiram a mesa com você.`,
      reason: 'Concedido ao jogar com 10 ou mais pessoas diferentes no ano.',
      accent: '#ec4899',
      earned: coPlayers.length >= 10,
    },
    {
      id: 'curador',
      title: 'Curador da Estante',
      subtitle: `${leftGames.length} jogos saíram para abrir espaço na coleção.`,
      reason: 'Concedido quando 10 ou mais jogos saem da coleção no ano.',
      accent: '#06b6d4',
      earned: leftGames.length >= 10,
    },
    {
      id: 'peso_pesado',
      title: 'Clube do Euro Pesado',
      subtitle: `Peso médio BGG de ${avgNewWeight?.toFixed(2) || '—'} nas novidades.`,
      reason: 'Concedido quando os novos jogos têm complexidade média BGG >= 3.0.',
      accent: '#a855f7',
      earned: avgNewWeight !== null && avgNewWeight >= 3.0 && enteredGames.length >= 3,
    },
  ];

  const earnedBadges = allBadges.filter(b => b.earned);
  const primaryTitle: RetrospectiveTitleBadge = earnedBadges[0] || {
    id: 'explorador',
    title: totalPlays > 0 ? 'Ano de Boas Jogatinas' : 'Estante Catalogada',
    subtitle: totalPlays > 0
      ? `${totalPlays} partidas registradas em ${uniqueGamesPlayedList.length} jogos.`
      : `${shelfEndCount} jogos catalogados na estante.`,
    reason: 'Título padrão para celebrar sua jornada nos tabuleiros.',
    accent: '#6366f1',
    earned: true,
  };
  const secondaryTitle = earnedBadges.length > 1 ? earnedBadges[1] : null;

  return {
    year,
    calendarYear,
    cutoffLabel,
    isFallbackDateMode: !dateInfo.hasExplicitDates,

    primaryTitle,
    secondaryTitle,
    allBadges,
    collageCovers,

    enteredGames,
    enteredBaseGames,
    enteredExpGames,
    enteredOtherGames,
    leftGames,
    netBalance,
    shelfEndCount,
    wishlistNewGames,
    wishlistFulfilledGames,
    wishlistTotalCount,
    wishlistDisplayGames: mergedWishlistDisplay,

    topMechanics,
    topCategories,
    topDesigners,
    topArtists,
    oldestArrival,
    newestArrival,
    avgNewWeight,
    heaviestArrival,
    lightestArrival,
    missingDesignersCount,

    arrivalsBasePlayed,
    arrivalsBaseUnplayed,
    arrivalsAllPlayed,
    arrivalsAllUnplayed,
    arrivalsSealed,

    totalInvested,
    investedGames,
    freeArrivals,
    avgPaidPrice,
    mostExpensiveArrival,
    arrivalsMarketValue,
    soldRevenue,
    soldCostBasis,
    soldProfit,

    yearMatches,
    totalPlays,
    prevYearTotalPlays,
    yoyGrowthPct,
    uniqueDaysCount,
    daysPerSession,
    longestStreakDays,
    uniqueGamesPlayedCount: uniqueGamesPlayedList.length,
    uniqueGamesPlayedList,
    totalMinutes,
    totalHours,
    totalHoursRounded,
    totalFullDays,
    avgMatchMinutes,
    longestMatch,
    hIndex,

    presencialCount,
    digitalCount,
    presencialMatches,
    digitalMatches,

    busiestMonth,
    busiestDay,
    calendarWeeks,
    calendarMonthMarkers,
    monthlyStats,

    mostPlayedGames: uniqueGamesPlayedList,
    mostPlayedByHours,
    gamesOver5PlaysCount,

    debuts,
    debutRatePct,

    winStats: {
      matchesWithWinnerCount,
      userWinsCount,
      winRatePct,
      wonMatches,
      otherMatches,
    },

    weekdayStats,
    topWeekday,

    coPlayers,
    topGroups,
    topExpansionsPlayed,
  };
}
