import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  Calendar,
  Dices,
  Clock,
  Trophy,
  Eye,
  EyeOff,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  Award,
  Pencil,
  Wallet,
  Monitor,
  Home,
  Flame,
  ChevronRight,
  AlertCircle,
  Wand2,
  BarChart3,
  Package,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  GameData,
  LudopediaMatch,
  LudopediaMeProfile,
  LudopediaWishlistItem,
  RetrospectiveDrilldownData,
} from '../types';
import {
  fetchAllLudopediaPlays,
  fetchLudopediaMe,
  fetchLudopediaWishlist,
  formatPlayDuration,
} from '../services/ludopediaService';
import {
  computeRetrospectiveData,
  getAvailableRetrospectiveYears,
  formatPtBrDayMonthShort,
  findCollectionGameForMatch,
  parseNumericPrice,
  type CoPlayerStat,
  type PlayedGameStat,
  type RankedEntityGroup,
} from '../utils/retrospectiveUtils';
import { normalizeGameName } from '../utils/nameMatcher';
import { RetrospectiveDrilldownModal } from './RetrospectiveDrilldownModal';
import { CollectionDatesModal } from './CollectionDatesModal';
import '../components.css';

interface RetrospectivaTabProps {
  userId?: string;
  username: string;
  games: GameData[];
  ludoToken: string;
  isBatchUpdating: boolean;
  batchProgress: {
    current: number;
    total: number;
    percentage: number;
    currentGameName: string;
    activeApi: string;
  } | null;
  onOpenSettings: () => void;
  onClickGameDetails: (game: GameData) => void;
  onSyncPlayCounts: (countsByLudoId: Record<string, number>, countsByName: Record<string, number>) => void;
  onPatchGamesBatch: (updatesById: Record<string, Partial<GameData>>) => void;
  onEnrichMetadata: (gamesToEnrich: GameData[]) => Promise<number>;
}

interface RetroCachePayload {
  updatedAt: string;
  me: LudopediaMeProfile | null;
  matches: LudopediaMatch[];
  wishlist: LudopediaWishlistItem[];
}

const getRetroCacheKey = (userId?: string) =>
  userId ? `boardgame_manager_retro_cache_${userId}` : 'boardgame_manager_retro_cache';

export function RetrospectivaTab({
  userId,
  username,
  games,
  ludoToken,
  isBatchUpdating,
  batchProgress,
  onOpenSettings,
  onClickGameDetails,
  onSyncPlayCounts,
  onPatchGamesBatch,
  onEnrichMetadata,
}: RetrospectivaTabProps) {
  const [matches, setMatches] = useState<LudopediaMatch[]>([]);
  const [meProfile, setMeProfile] = useState<LudopediaMeProfile | null>(null);
  const [wishlistItems, setWishlistItems] = useState<LudopediaWishlistItem[]>([]);
  const [isLoadingPlays, setIsLoadingPlays] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [playsError, setPlaysError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState<number | 'all'>(() => new Date().getFullYear());
  const [showFinancials, setShowFinancials] = useState(true);
  const [showPlayersPrivacy, setShowPlayersPrivacy] = useState(true);
  const [traitMode, setTraitMode] = useState<'mechanics' | 'categories'>('mechanics');
  const [tableCheckScope, setTableCheckScope] = useState<'base' | 'all'>('base');
  const [mostPlayedSort, setMostPlayedSort] = useState<'plays' | 'hours'>('plays');
  const [showAllMostPlayed, setShowAllMostPlayed] = useState(false);
  const [showAllDebuts, setShowAllDebuts] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [monthlyMetric, setMonthlyMetric] = useState<'plays' | 'hours'>('plays');

  const [drilldown, setDrilldown] = useState<RetrospectiveDrilldownData | null>(null);
  const [isDatesModalOpen, setIsDatesModalOpen] = useState(false);

  // Carregar cache local ao montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(getRetroCacheKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as RetroCachePayload;
        if (Array.isArray(parsed.matches)) setMatches(parsed.matches);
        if (parsed.me) setMeProfile(parsed.me);
        if (Array.isArray(parsed.wishlist)) setWishlistItems(parsed.wishlist);
        if (parsed.updatedAt) setLastSyncedAt(parsed.updatedAt);
      }
    } catch {}
  }, [userId]);

  const syncLudopediaRetrospective = useCallback(async (force = false) => {
    if (!ludoToken) return;
    if (!force && matches.length > 0 && meProfile) return;

    setIsLoadingPlays(true);
    setPlaysError(null);
    setLoadingProgress(null);

    try {
      const [meRes, playsRes, wishlistRes] = await Promise.all([
        fetchLudopediaMe(ludoToken).catch(() => null),
        fetchAllLudopediaPlays(ludoToken, (loaded, total) => {
          setLoadingProgress({ loaded, total });
        }),
        fetchLudopediaWishlist(ludoToken).catch(() => []),
      ]);

      const fetchedMatches = playsRes.partidas || [];
      setMeProfile(meRes);
      setMatches(fetchedMatches);
      setWishlistItems(wishlistRes);

      const nowIso = new Date().toISOString();
      setLastSyncedAt(nowIso);

      try {
        const payload: RetroCachePayload = {
          updatedAt: nowIso,
          me: meRes,
          matches: fetchedMatches,
          wishlist: wishlistRes,
        };
        localStorage.setItem(getRetroCacheKey(userId), JSON.stringify(payload));
      } catch {}

      // Sincronizar contagens de partidas com a coleção principal
      if (fetchedMatches.length > 0) {
        const countsByLudoId: Record<string, number> = {};
        const countsByName: Record<string, number> = {};
        for (const m of fetchedMatches) {
          const pCount = Math.max(1, Number(m.qt_partidas || 1));
          if (m.jogo?.id_jogo) {
            const gid = String(m.jogo.id_jogo);
            countsByLudoId[gid] = (countsByLudoId[gid] || 0) + pCount;
          }
          if (m.jogo?.nm_jogo) {
            const norm = normalizeGameName(m.jogo.nm_jogo);
            if (norm) countsByName[norm] = (countsByName[norm] || 0) + pCount;
          }
          if (Array.isArray(m.expansoes)) {
            for (const exp of m.expansoes) {
              if (exp.id_jogo) countsByLudoId[String(exp.id_jogo)] = (countsByLudoId[String(exp.id_jogo)] || 0) + pCount;
              if (exp.nm_jogo) {
                const eNorm = normalizeGameName(exp.nm_jogo);
                if (eNorm) countsByName[eNorm] = (countsByName[eNorm] || 0) + pCount;
              }
            }
          }
        }
        onSyncPlayCounts(countsByLudoId, countsByName);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados da Retrospectiva:', err);
      setPlaysError(err?.message || 'Erro ao sincronizar partidas da Ludopedia.');
    } finally {
      setIsLoadingPlays(false);
      setLoadingProgress(null);
    }
  }, [ludoToken, matches.length, meProfile, onSyncPlayCounts, userId]);

  useEffect(() => {
    if (ludoToken && matches.length === 0 && !isLoadingPlays && !playsError) {
      syncLudopediaRetrospective(false);
    }
  }, [ludoToken, matches.length, isLoadingPlays, playsError, syncLudopediaRetrospective]);

  const availableYears = useMemo(
    () => getAvailableRetrospectiveYears(games, matches),
    [games, matches]
  );

  // Garantir que selectedYear exista na lista ou seja 'all'
  useEffect(() => {
    if (selectedYear !== 'all' && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const summary = useMemo(
    () =>
      computeRetrospectiveData({
        year: selectedYear,
        games,
        allMatches: matches,
        me: meProfile,
        fallbackUsername: username,
        wishlistItems,
      }),
    [selectedYear, games, matches, meProfile, username, wishlistItems]
  );

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const formatBRLFull = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const displayName = meProfile?.usuario || username || 'Jogador';
  const earliestYear = availableYears[availableYears.length - 1] || new Date().getFullYear();
  const yearLabel = selectedYear === 'all' ? 'GERAL' : String(selectedYear);

  // Handlers de Drill-Down Dinâmicos
  const openGamesDrilldown = (
    title: string,
    subtitle: string,
    list: GameData[],
    accentColor = '#6366f1',
    extraStats?: RetrospectiveDrilldownData['extraStats'],
    externalLinks?: RetrospectiveDrilldownData['externalLinks']
  ) => {
    setDrilldown({
      kind: 'games',
      title,
      subtitle,
      games: list,
      accentColor,
      extraStats,
      externalLinks,
    });
  };

  const openMatchesDrilldown = (
    title: string,
    subtitle: string,
    list: LudopediaMatch[],
    accentColor = '#10b981',
    extraStats?: RetrospectiveDrilldownData['extraStats'],
    playerHeader?: RetrospectiveDrilldownData['playerHeader']
  ) => {
    setDrilldown({
      kind: 'matches',
      title,
      subtitle,
      matches: list,
      accentColor,
      extraStats,
      playerHeader,
    });
  };

  const handleClickDesignerOrArtist = (group: RankedEntityGroup, role: 'Designer' | 'Artista') => {
    const encoded = encodeURIComponent(group.name);
    const totalInCollection = group.allCollectionGames.length;
    openGamesDrilldown(
      `${role}: ${group.name}`,
      `${group.count} ${group.count === 1 ? 'jogo entrou' : 'jogos entraram'} na coleção em ${yearLabel} • ${totalInCollection} no total da sua estante`,
      group.games,
      '#6366f1',
      [
        { label: `Novos em ${yearLabel}`, value: String(group.count), color: '#60a5fa' },
        { label: 'Total na sua coleção', value: String(totalInCollection), color: '#a5b4fc' },
      ],
      [
        { label: 'Buscar na Ludopedia', url: `https://ludopedia.com.br/search?search=${encoded}` },
        { label: 'Buscar no BGG', url: `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgameperson&q=${encoded}` },
      ]
    );
  };

  const handleClickPlayedGame = (stat: PlayedGameStat) => {
    const colGame = stat.collectionGame || findCollectionGameForMatch({ id_jogo: stat.ludoId ? Number(stat.ludoId) : undefined, nm_jogo: stat.name }, games);
    openMatchesDrilldown(
      stat.name,
      `${stat.playCount} ${stat.playCount === 1 ? 'partida' : 'partidas'} em ${yearLabel} • ${formatPlayDuration(stat.totalMinutes)}`,
      stat.matches,
      '#f59e0b',
      [
        { label: 'Partidas', value: String(stat.playCount), color: '#fbbf24' },
        { label: 'Tempo Total', value: formatPlayDuration(stat.totalMinutes), color: '#38bdf8' },
        ...(stat.firstPlayDate ? [{ label: '1ª partida registrada', value: stat.firstPlayDate.split('-').reverse().join('/'), color: '#34d399' }] : []),
        ...(colGame ? [{ label: 'Status na Estante', value: colGame.status, color: '#a5b4fc' }] : []),
      ]
    );
  };

  const handleClickCoPlayer = (player: CoPlayerStat) => {
    openMatchesDrilldown(
      `Partidas com ${player.name}`,
      `${player.playCount} ${player.playCount === 1 ? 'partida juntos' : 'partidas juntos'} em ${yearLabel}`,
      player.matches,
      '#6366f1',
      undefined,
      {
        name: player.name,
        thumb: player.thumb,
        totalPlays: player.playCount,
        totalHours: player.totalMinutes / 60,
        userWinsWithPlayer: player.userWinsTogether,
        playerWins: player.playerWins,
        topGames: player.topGames,
      }
    );
  };

  const handleClickAllDesignerCollection = (group: RankedEntityGroup, role: 'Designer' | 'Artista') => {
    const encoded = encodeURIComponent(group.name);
    openGamesDrilldown(
      `${role}: ${group.name} (Coleção Completa)`,
      `Todos os ${group.allCollectionGames.length} jogos de ${group.name} cadastrados na sua estante`,
      group.allCollectionGames,
      '#8b5cf6',
      [
        { label: `Novos em ${yearLabel}`, value: String(group.count), color: '#60a5fa' },
        { label: 'Total na estante', value: String(group.allCollectionGames.length), color: '#c4b5fd' },
      ],
      [
        { label: 'Buscar na Ludopedia', url: `https://ludopedia.com.br/search?search=${encoded}` },
        { label: 'Buscar no BGG', url: `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgameperson&q=${encoded}` },
      ]
    );
  };

  const tablePlayedList = tableCheckScope === 'base' ? summary.arrivalsBasePlayed : summary.arrivalsAllPlayed;
  const tableUnplayedList = tableCheckScope === 'base' ? summary.arrivalsBaseUnplayed : summary.arrivalsAllUnplayed;
  const tableScopeTotal = tablePlayedList.length + tableUnplayedList.length;
  const tableScopePct = tableScopeTotal > 0 ? Math.round((tablePlayedList.length / tableScopeTotal) * 100) : 0;

  const activeTraitsList = traitMode === 'mechanics' ? summary.topMechanics : summary.topCategories;
  const rankedPlayedSource = mostPlayedSort === 'plays' ? summary.mostPlayedGames : summary.mostPlayedByHours;
  const podiumFirst = rankedPlayedSource[0] || null;
  const podiumSecond = rankedPlayedSource[1] || null;
  const podiumThird = rankedPlayedSource[2] || null;
  const remainingPlayed = showAllMostPlayed ? rankedPlayedSource.slice(3) : rankedPlayedSource.slice(3, 8);
  const visibleDebuts = showAllDebuts ? summary.debuts : summary.debuts.slice(0, 18);
  const visibleCoPlayers = showAllPlayers ? summary.coPlayers : summary.coPlayers.slice(0, 5);
  const maxCoPlayerPlays = Math.max(1, summary.coPlayers[0]?.playCount || 1);

  const winChartData = [
    { name: 'Vitórias', value: summary.winStats.userWinsCount, color: '#f59e0b' },
    {
      name: 'Demais Partidas',
      value: Math.max(0, summary.winStats.matchesWithWinnerCount - summary.winStats.userWinsCount),
      color: 'rgba(148, 163, 184, 0.25)',
    },
  ];

  const handleEnrichClick = async () => {
    const targets = summary.enteredGames.length > 0 ? summary.enteredGames : games;
    const missingInTargets = targets.filter(g => (!g.designers || g.designers.length === 0) && (g.bggId || g.ludoId));
    // Se todos do ano já têm ou há outros sem designer na coleção inteira, enriquece os faltantes
    const listToEnrich = missingInTargets.length > 0
      ? missingInTargets
      : games.filter(g => (!g.designers || g.designers.length === 0) && (g.bggId || g.ludoId));
    await onEnrichMetadata(listToEnrich);
  };

  return (
    <div className="retro-container animate-fade-in">
      {/* Barra Superior: Seletor de Ano + Ações Dinâmicas */}
      <div className="glass-panel retro-topbar">
        <div className="retro-year-pills">
          {availableYears.map(y => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`retro-year-pill ${selectedYear === y ? 'active' : ''}`}
            >
              {y}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedYear('all')}
            className={`retro-year-pill ${selectedYear === 'all' ? 'active' : ''}`}
          >
            Todos
          </button>
        </div>

        <div className="retro-toolbar-actions">
          {ludoToken && (
            <button
              type="button"
              className="btn retro-action-btn"
              onClick={() => syncLudopediaRetrospective(true)}
              disabled={isLoadingPlays}
              title={lastSyncedAt ? `Última sincronização: ${new Date(lastSyncedAt).toLocaleString('pt-BR')}` : 'Sincronizar partidas e perfil da Ludopedia'}
            >
              <RefreshCw size={14} className={isLoadingPlays ? 'animate-spin' : ''} />
              <span>{isLoadingPlays ? 'Sincronizando...' : 'Sincronizar Partidas'}</span>
            </button>
          )}

          {summary.missingDesignersCount > 0 && (
            <button
              type="button"
              className="btn retro-action-btn retro-enrich-btn"
              onClick={handleEnrichClick}
              disabled={isBatchUpdating}
              title="Buscar designers, artistas, mecânicas e tempo de jogo em lote via BGG/Ludopedia"
            >
              <Wand2 size={14} />
              <span>
                {isBatchUpdating && batchProgress
                  ? `${batchProgress.percentage}%`
                  : `Buscar Designers (${summary.missingDesignersCount})`}
              </span>
            </button>
          )}

          <button
            type="button"
            className="btn retro-action-btn"
            onClick={() => setIsDatesModalOpen(true)}
            title="Definir ou importar em lote as datas de entrada e saída dos jogos"
          >
            <Calendar size={14} />
            <span>Organizar Datas</span>
          </button>

          <button
            type="button"
            className="btn retro-action-btn"
            onClick={() => setShowFinancials(v => !v)}
            title={showFinancials ? 'Ocultar valores financeiros' : 'Mostrar valores financeiros'}
          >
            {showFinancials ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showFinancials ? 'Ocultar Valores' : 'Mostrar Valores'}</span>
          </button>
        </div>
      </div>

      {/* Hero Banner */}
      <section className="retro-hero-wrapper">
        <div className="retro-hero-card">
          {/* Colagem de capas ao fundo */}
          <div className="retro-hero-collage" aria-hidden="true">
            {summary.collageCovers.map((src, idx) => (
              <img key={idx} src={src} alt="" loading="lazy" />
            ))}
          </div>
          <div className="retro-hero-overlay" />

          <div className="retro-hero-content">
            {/* Lado Esquerdo: Título + Perfil + Título do Ano */}
            <div className="retro-hero-left">
              <div className="retro-hero-kicker">RETROSPECTIVA</div>
              <h1 className="retro-hero-year">{yearLabel}</h1>

              <div className="retro-hero-user">
                {meProfile?.thumb ? (
                  <img src={meProfile.thumb} alt={displayName} className="retro-hero-avatar" />
                ) : (
                  <div className="retro-hero-avatar-fallback">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="retro-hero-username">{displayName}</div>
                  <div className="retro-hero-since">na coleção desde {earliestYear}</div>
                </div>
              </div>

              <button
                type="button"
                className="retro-title-showcase"
                onClick={() =>
                  setDrilldown({
                    kind: 'titles',
                    title: `Títulos e Conquistas — ${yearLabel}`,
                    subtitle: `Você desbloqueou ${summary.allBadges.filter(b => b.earned).length} de ${summary.allBadges.length} títulos neste período`,
                    accentColor: summary.primaryTitle.accent,
                  })
                }
                title="Clique para ver todos os títulos e critérios do ano"
              >
                <div className="retro-title-showcase-top">
                  <span
                    className="retro-title-icon-box"
                    style={{ background: summary.primaryTitle.accent }}
                  >
                    <Sparkles size={20} color="#fff" />
                  </span>
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div className="retro-title-eyebrow">SEU ANO FOI DE</div>
                    <div className="retro-title-main">{summary.primaryTitle.title}</div>
                  </div>
                </div>
                <div className="retro-title-showcase-bottom">
                  <span>{summary.primaryTitle.subtitle}</span>
                  <ChevronRight size={15} opacity={0.6} />
                </div>
              </button>

              {summary.secondaryTitle && (
                <button
                  type="button"
                  className="retro-secondary-tag"
                  onClick={() =>
                    setDrilldown({
                      kind: 'titles',
                      title: `Títulos e Conquistas — ${yearLabel}`,
                      subtitle: summary.secondaryTitle?.subtitle,
                      accentColor: summary.secondaryTitle?.accent,
                    })
                  }
                >
                  também: <strong>{summary.secondaryTitle.title.toLowerCase()}</strong>
                </button>
              )}
            </div>

            {/* Lado Direito: 4 Cards KPI Clicáveis */}
            <div className="retro-hero-kpis">
              <button
                type="button"
                className="retro-hero-kpi blue"
                onClick={() =>
                  openGamesDrilldown(
                    `Novos na Estante (${yearLabel})`,
                    `${summary.enteredBaseGames.length} jogos base e ${summary.enteredExpGames.length} expansões entraram neste período`,
                    summary.enteredGames,
                    '#3b82f6'
                  )
                }
              >
                <span className="retro-hero-kpi-icon blue">
                  <Package size={18} />
                </span>
                <div>
                  <div className="retro-hero-kpi-val">{summary.enteredGames.length}</div>
                  <div className="retro-hero-kpi-lbl">novos na estante</div>
                </div>
              </button>

              <button
                type="button"
                className="retro-hero-kpi green"
                onClick={() =>
                  openMatchesDrilldown(
                    `Todas as Partidas (${yearLabel})`,
                    summary.cutoffLabel,
                    summary.yearMatches,
                    '#10b981'
                  )
                }
              >
                <span className="retro-hero-kpi-icon green">
                  <Dices size={18} />
                </span>
                <div>
                  <div className="retro-hero-kpi-val">{summary.totalPlays}</div>
                  <div className="retro-hero-kpi-lbl">partidas</div>
                </div>
              </button>

              <button
                type="button"
                className="retro-hero-kpi emerald"
                onClick={() =>
                  openGamesDrilldown(
                    `Jogos Diferentes Jogados (${yearLabel})`,
                    `${summary.uniqueGamesPlayedCount} títulos distintos foram para a mesa`,
                    summary.uniqueGamesPlayedList
                      .map(s => s.collectionGame || ({
                        id: `played-${s.gameKey}`,
                        ludoId: s.ludoId,
                        name: s.name,
                        status: 'Jogado na Mesa',
                        spend: 0,
                        type: 'Base',
                        value: 0,
                        thumbnail: s.thumb,
                        isPlayed: true,
                        playCount: s.playCount,
                      } as GameData)),
                    '#10b981'
                  )
                }
              >
                <span className="retro-hero-kpi-icon emerald">
                  <Layers size={18} />
                </span>
                <div>
                  <div className="retro-hero-kpi-val">{summary.uniqueGamesPlayedCount}</div>
                  <div className="retro-hero-kpi-lbl">jogos diferentes</div>
                </div>
              </button>

              <button
                type="button"
                className="retro-hero-kpi teal"
                onClick={() =>
                  openMatchesDrilldown(
                    `Horas de Jogo (${yearLabel})`,
                    `${summary.totalHoursRounded}h acumuladas (${summary.totalFullDays} dias inteiros na mesa)`,
                    summary.yearMatches,
                    '#14b8a6'
                  )
                }
              >
                <span className="retro-hero-kpi-icon teal">
                  <Clock size={18} />
                </span>
                <div>
                  <div className="retro-hero-kpi-val">{summary.totalHoursRounded}</div>
                  <div className="retro-hero-kpi-lbl">horas de jogo</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="retro-title-explainer-link"
          onClick={() =>
            setDrilldown({
              kind: 'titles',
              title: `Como o título "${summary.primaryTitle.title}" é escolhido`,
              subtitle: 'Critérios transparentes baseados em sua coleção e partidas registradas',
              accentColor: summary.primaryTitle.accent,
            })
          }
        >
          <HelpCircle size={14} />
          <span>O que é "{summary.primaryTitle.title.toLowerCase()}"? Veja como o título do ano é escolhido</span>
        </button>
      </section>

      {/* ======================================================
          SEÇÃO 1: NA ESTANTE
          ====================================================== */}
      <section className="retro-section">
        <div className="retro-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="retro-section-badge blue">
              <Package size={20} />
            </div>
            <div>
              <h2 className="retro-section-title">Na estante</h2>
              <p className="retro-section-subtitle">
                {selectedYear === 'all'
                  ? 'Panorama geral de toda a sua coleção'
                  : `O que mudou na coleção em ${selectedYear}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn retro-action-btn"
            onClick={() => setIsDatesModalOpen(true)}
          >
            <Calendar size={14} /> Ajustar Datas da Estante
          </button>
        </div>

        {summary.isFallbackDateMode && (
          <div className="retro-info-banner">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1 }}>
              <AlertCircle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.84rem', lineHeight: 1.45 }}>
                <strong>Datas de aquisição/saída usando a data de importação no sistema:</strong> a API pública da Ludopedia não fornece o histórico antigo de quando cada jogo entrou ou saiu da estante. Clique ao lado para marcar rapidamente os jogos que realmente entraram/saíram em {selectedYear === 'all' ? 'cada ano' : selectedYear} (por seleção ou colando uma lista).
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsDatesModalOpen(true)}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', flexShrink: 0 }}
            >
              Definir Datas Agora
            </button>
          </div>
        )}

        {/* 4 KPI Cards Clicáveis da Estante */}
        <div className="retro-kpi-grid-4">
          <button
            type="button"
            className="glass-panel retro-kpi-card clickable"
            onClick={() =>
              openGamesDrilldown(
                `Jogos que Entraram (${yearLabel})`,
                `${summary.enteredBaseGames.length} jogos base e ${summary.enteredExpGames.length} expansões`,
                summary.enteredGames,
                '#3b82f6'
              )
            }
          >
            <div className="retro-kpi-card-top">
              <span className="retro-kpi-number">{summary.enteredGames.length}</span>
              <ChevronRight size={16} className="retro-kpi-arrow" />
            </div>
            <div className="retro-kpi-label">jogos entraram</div>
            <div className="retro-kpi-sub">
              {summary.enteredBaseGames.length} jogos base e {summary.enteredExpGames.length} expansões
            </div>
          </button>

          <button
            type="button"
            className="glass-panel retro-kpi-card clickable"
            onClick={() =>
              openGamesDrilldown(
                `Saíram da Coleção (${yearLabel})`,
                `Saldo líquido no período: ${summary.netBalance >= 0 ? '+' : ''}${summary.netBalance}`,
                summary.leftGames,
                '#ef4444'
              )
            }
          >
            <div className="retro-kpi-card-top">
              <span className="retro-kpi-number">{summary.leftGames.length}</span>
              <ChevronRight size={16} className="retro-kpi-arrow" />
            </div>
            <div className="retro-kpi-label">saíram da coleção</div>
            <div className="retro-kpi-sub" style={{ color: summary.netBalance >= 0 ? '#34d399' : '#f87171' }}>
              saldo do ano: {summary.netBalance >= 0 ? `+${summary.netBalance}` : summary.netBalance}
            </div>
          </button>

          <button
            type="button"
            className="glass-panel retro-kpi-card clickable"
            onClick={() =>
              openGamesDrilldown(
                `Jogos na Estante (${yearLabel})`,
                `Coleção atual: ${games.filter(g => String(g.status || '').toLowerCase().includes('coleção')).length} itens ativos`,
                games.filter(g => String(g.status || '').toLowerCase().includes('coleção')),
                '#6366f1'
              )
            }
          >
            <div className="retro-kpi-card-top">
              <span className="retro-kpi-number">{summary.shelfEndCount}</span>
              <ChevronRight size={16} className="retro-kpi-arrow" />
            </div>
            <div className="retro-kpi-label">jogos na estante</div>
            <div className="retro-kpi-sub">
              {selectedYear === 'all' ? 'total atual na coleção' : `no fim de ${selectedYear}`}
            </div>
          </button>

          <button
            type="button"
            className="glass-panel retro-kpi-card clickable"
            onClick={() =>
              openGamesDrilldown(
                `Lista de Desejos (${yearLabel})`,
                `${summary.wishlistTotalCount} desejos ativos • ${summary.wishlistFulfilledGames.length} realizados em ${yearLabel}`,
                summary.wishlistDisplayGames,
                '#10b981'
              )
            }
          >
            <div className="retro-kpi-card-top">
              <span className="retro-kpi-number">
                {summary.wishlistNewGames.length > 0 ? summary.wishlistNewGames.length : summary.wishlistTotalCount}
              </span>
              <ChevronRight size={16} className="retro-kpi-arrow" />
            </div>
            <div className="retro-kpi-label">
              {summary.wishlistNewGames.length > 0 ? 'novos desejos' : 'jogos nos desejos'}
            </div>
            <div className="retro-kpi-sub" style={{ color: '#10b981' }}>
              {summary.wishlistFulfilledGames.length > 0
                ? `${summary.wishlistFulfilledGames.length} desejos realizados`
                : ludoToken
                  ? `${wishlistItems.length} na Ludopedia`
                  : 'clique para visualizar'}
            </div>
          </button>
        </div>

        {/* Faixa de Capas dos Jogos que Entraram */}
        {summary.enteredGames.length > 0 && (
          <div className="glass-panel retro-cover-strip-panel">
            <div className="retro-cover-strip">
              {summary.enteredGames.map(game => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => onClickGameDetails(game)}
                  className="retro-cover-strip-item"
                  title={`${game.name}${game.designers?.length ? ` • ${game.designers.join(', ')}` : ''}`}
                >
                  {(game.thumbnail || game.image) ? (
                    <img src={game.thumbnail || game.image} alt={game.name} loading="lazy" />
                  ) : (
                    <div className="retro-cover-placeholder">
                      <Dices size={20} />
                      <span>{game.name}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="retro-strip-view-all"
              onClick={() =>
                openGamesDrilldown(
                  `Todos os ${summary.enteredGames.length} Jogos que Entraram (${yearLabel})`,
                  `${summary.enteredBaseGames.length} base e ${summary.enteredExpGames.length} expansões`,
                  summary.enteredGames,
                  '#3b82f6'
                )
              }
            >
              Ver todos ({summary.enteredGames.length}) <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Bento Grid: A cara das novidades | Chegou e foi para a mesa + Investimento */}
        <div className="retro-bento-shelf">
          {/* Esquerda: A cara das novidades */}
          <div className="glass-panel retro-card">
            <div className="retro-card-header-row">
              <div>
                <h3 className="retro-card-title">A cara das novidades</h3>
                <p className="retro-card-subtitle">
                  As {traitMode === 'mechanics' ? 'mecânicas' : 'categorias'} e designers que mais apareceram nos jogos que chegaram.
                </p>
              </div>
              <div className="retro-mini-toggle">
                <button
                  type="button"
                  className={traitMode === 'mechanics' ? 'active' : ''}
                  onClick={() => setTraitMode('mechanics')}
                >
                  Mecânicas
                </button>
                <button
                  type="button"
                  className={traitMode === 'categories' ? 'active' : ''}
                  onClick={() => setTraitMode('categories')}
                >
                  Categorias
                </button>
              </div>
            </div>

            {activeTraitsList.length === 0 ? (
              <div className="retro-empty-inline">
                Sem dados suficientes de {traitMode === 'mechanics' ? 'mecânicas' : 'categorias'} para os jogos deste período.
              </div>
            ) : (
              <div className="retro-traits-cloud">
                {activeTraitsList.slice(0, 7).map((trait, idx) => (
                  <button
                    key={trait.name}
                    type="button"
                    onClick={() =>
                      openGamesDrilldown(
                        `${traitMode === 'mechanics' ? 'Mecânica' : 'Categoria'}: ${trait.name}`,
                        `${trait.count} ${trait.count === 1 ? 'jogo novo' : 'jogos novos'} em ${yearLabel} • ${trait.allCollectionGames.length} na coleção completa`,
                        trait.games,
                        '#2563eb',
                        [
                          { label: `Nos novos de ${yearLabel}`, value: String(trait.count), color: '#60a5fa' },
                          { label: 'Total na coleção', value: String(trait.allCollectionGames.length), color: '#a5b4fc' },
                        ]
                      )
                    }
                    className={`retro-trait-pill ${idx === 0 ? 'primary' : ''}`}
                    title={`Clique para ver os ${trait.count} jogos com "${trait.name}"`}
                  >
                    <span>{trait.name}</span>
                    <strong>{trait.count}</strong>
                  </button>
                ))}
              </div>
            )}

            {/* Designer do Ano + Top Designers (Clicáveis!) */}
            <div className="retro-feature-divider">
              <div className="retro-feature-row">
                <div className="retro-feature-icon">
                  <Pencil size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="retro-feature-kicker">DESIGNER DO ANO</div>
                  {summary.topDesigners.length > 0 ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="retro-clickable-entity-btn"
                          onClick={() => handleClickDesignerOrArtist(summary.topDesigners[0], 'Designer')}
                          title={`Clique para ver os ${summary.topDesigners[0].count} jogos de ${summary.topDesigners[0].name}`}
                        >
                          <strong>{summary.topDesigners[0].name}</strong>
                          <span>· {summary.topDesigners[0].count} {summary.topDesigners[0].count === 1 ? 'jogo' : 'jogos'}</span>
                          <ChevronRight size={14} />
                        </button>

                        {summary.topDesigners[0].allCollectionGames.length > summary.topDesigners[0].count && (
                          <button
                            type="button"
                            className="retro-subtle-link"
                            onClick={() => handleClickAllDesignerCollection(summary.topDesigners[0], 'Designer')}
                          >
                            ({summary.topDesigners[0].allCollectionGames.length} na coleção)
                          </button>
                        )}
                      </div>

                      {summary.topDesigners.length > 1 && (
                        <div className="retro-other-designers">
                          {summary.topDesigners.slice(1, 6).map(d => (
                            <button
                              key={d.name}
                              type="button"
                              className="retro-designer-chip"
                              onClick={() => handleClickDesignerOrArtist(d, 'Designer')}
                              title={`Ver jogos de ${d.name}`}
                            >
                              {d.name} <strong>{d.count}</strong>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        Designers ainda não carregados nas fichas dos jogos.
                      </span>
                      {summary.missingDesignersCount > 0 && (
                        <button
                          type="button"
                          className="btn retro-inline-enrich"
                          onClick={handleEnrichClick}
                          disabled={isBatchUpdating}
                        >
                          <Wand2 size={13} /> Buscar Designers Agora ({summary.missingDesignersCount})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {summary.topArtists.length > 0 && (
                <div className="retro-feature-row" style={{ marginTop: '0.75rem' }}>
                  <div className="retro-feature-icon" style={{ color: '#c084fc', background: 'rgba(168, 85, 247, 0.14)' }}>
                    <Sparkles size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="retro-feature-kicker">ARTISTA EM DESTAQUE</div>
                    <button
                      type="button"
                      className="retro-clickable-entity-btn"
                      onClick={() => handleClickDesignerOrArtist(summary.topArtists[0], 'Artista')}
                    >
                      <strong>{summary.topArtists[0].name}</strong>
                      <span>· {summary.topArtists[0].count} {summary.topArtists[0].count === 1 ? 'jogo' : 'jogos'}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* O mais antigo + Mais novo + Peso Médio */}
              <div className="retro-milestones-grid">
                {summary.oldestArrival && (
                  <button
                    type="button"
                    className="retro-feature-row clickable-row"
                    onClick={() => onClickGameDetails(summary.oldestArrival!.game)}
                    title="Clique para abrir detalhes deste jogo"
                  >
                    <div className="retro-feature-icon">
                      <Calendar size={15} />
                    </div>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div className="retro-feature-kicker">O MAIS ANTIGO A CHEGAR</div>
                      <div className="retro-feature-val">
                        <strong>{summary.oldestArrival.game.name}</strong> · {summary.oldestArrival.year}
                      </div>
                    </div>
                  </button>
                )}

                {summary.newestArrival && summary.newestArrival.game.id !== summary.oldestArrival?.game.id && (
                  <button
                    type="button"
                    className="retro-feature-row clickable-row"
                    onClick={() => onClickGameDetails(summary.newestArrival!.game)}
                    title="Clique para abrir detalhes deste lançamento"
                  >
                    <div className="retro-feature-icon" style={{ color: '#34d399', background: 'rgba(16,185,129,0.14)' }}>
                      <Sparkles size={15} />
                    </div>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div className="retro-feature-kicker">LANÇAMENTO MAIS RECENTE</div>
                      <div className="retro-feature-val">
                        <strong>{summary.newestArrival.game.name}</strong> · {summary.newestArrival.year}
                      </div>
                    </div>
                  </button>
                )}

                {summary.avgNewWeight !== null && (
                  <button
                    type="button"
                    className="retro-feature-row clickable-row"
                    onClick={() =>
                      openGamesDrilldown(
                        `Complexidade das Novidades (${yearLabel})`,
                        `Peso BGG médio: ${summary.avgNewWeight?.toFixed(2)} • Mais pesado: ${summary.heaviestArrival?.name || '—'}`,
                        [...summary.enteredGames].sort((a, b) => (b.weight || 0) - (a.weight || 0)),
                        '#a855f7',
                        [
                          { label: 'Peso Médio BGG', value: (summary.avgNewWeight ?? 0).toFixed(2), color: '#c084fc' },
                          ...(summary.heaviestArrival ? [{ label: 'Mais Pesado', value: `${summary.heaviestArrival.name} (${summary.heaviestArrival.weight?.toFixed(2)})`, color: '#f472b6' }] : []),
                          ...(summary.lightestArrival ? [{ label: 'Mais Leve', value: `${summary.lightestArrival.name} (${summary.lightestArrival.weight?.toFixed(2)})`, color: '#38bdf8' }] : []),
                        ]
                      )
                    }
                  >
                    <div className="retro-feature-icon" style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.14)' }}>
                      <Award size={15} />
                    </div>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div className="retro-feature-kicker">PESO MÉDIO (BGG)</div>
                      <div className="retro-feature-val">
                        <strong>{summary.avgNewWeight.toFixed(2)} / 5</strong>
                        {summary.heaviestArrival ? ` · topo: ${summary.heaviestArrival.name}` : ''}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Direita: Chegou e foi para a mesa? + Investimento do ano */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="glass-panel retro-card">
              <div className="retro-card-header-row">
                <div>
                  <h3 className="retro-card-title">Chegou e foi para a mesa?</h3>
                  <p className="retro-card-subtitle">
                    {tableCheckScope === 'base' ? 'Dos jogos base que entraram no período.' : 'Todos os jogos e expansões que entraram.'}
                  </p>
                </div>
                <div className="retro-mini-toggle">
                  <button
                    type="button"
                    className={tableCheckScope === 'base' ? 'active' : ''}
                    onClick={() => setTableCheckScope('base')}
                  >
                    Base
                  </button>
                  <button
                    type="button"
                    className={tableCheckScope === 'all' ? 'active' : ''}
                    onClick={() => setTableCheckScope('all')}
                  >
                    Todos
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="retro-progress-clickable"
                onClick={() =>
                  openGamesDrilldown(
                    `Novidades Já Jogadas (${yearLabel})`,
                    `${tablePlayedList.length} de ${tableScopeTotal} (${tableScopePct}%) já foram para a mesa`,
                    tablePlayedList,
                    '#3b82f6'
                  )
                }
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', marginBottom: '0.45rem' }}>
                  <span>
                    <strong>{tablePlayedList.length}</strong> de <strong>{tableScopeTotal}</strong> já têm partida registrada.
                  </span>
                  <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.82rem' }}>{tableScopePct}% →</span>
                </div>
                <div className="retro-progress-track">
                  <div className="retro-progress-fill" style={{ width: `${tableScopePct}%` }} />
                </div>
              </button>

              {tableUnplayedList.length > 0 && (
                <div style={{ marginTop: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <button
                      type="button"
                      className="retro-subtle-link"
                      onClick={() =>
                        openGamesDrilldown(
                          `Ainda Esperam a Estreia (${yearLabel})`,
                          `${tableUnplayedList.length} jogos novos ainda sem partida registrada`,
                          tableUnplayedList,
                          '#f59e0b'
                        )
                      }
                    >
                      {tableUnplayedList.length} ainda esperam a estreia →
                    </button>
                    {summary.arrivalsSealed.length > 0 && (
                      <button
                        type="button"
                        className="retro-sealed-badge"
                        onClick={() =>
                          openGamesDrilldown(
                            `Novidades Lacradas (${yearLabel})`,
                            `${summary.arrivalsSealed.length} jogos ainda lacrados`,
                            summary.arrivalsSealed,
                            '#a855f7'
                          )
                        }
                      >
                        📦 {summary.arrivalsSealed.length} lacrados
                      </button>
                    )}
                  </div>
                  <div className="retro-mini-thumbs-row">
                    {tableUnplayedList.slice(0, 12).map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => onClickGameDetails(g)}
                        className="retro-mini-thumb-btn"
                        title={`${g.name} (clique para detalhes)`}
                      >
                        {(g.thumbnail || g.image) ? (
                          <img src={g.thumbnail || g.image} alt={g.name} loading="lazy" />
                        ) : (
                          <span>{g.name.slice(0, 2)}</span>
                        )}
                      </button>
                    ))}
                    {tableUnplayedList.length > 12 && (
                      <button
                        type="button"
                        className="retro-mini-thumb-more"
                        onClick={() =>
                          openGamesDrilldown(
                            `Ainda Esperam a Estreia (${yearLabel})`,
                            `${tableUnplayedList.length} jogos aguardando a primeira jogatina`,
                            tableUnplayedList,
                            '#f59e0b'
                          )
                        }
                      >
                        +{tableUnplayedList.length - 12}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Investimento do Ano */}
            <div className="glass-panel retro-card retro-investment-card">
              <div className="retro-card-header-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 className="retro-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wallet size={17} color="#10b981" /> Investimento do ano
                  </h3>
                  <span className="retro-private-pill">🔒 só você vê</span>
                </div>
                <button
                  type="button"
                  className="btn retro-hide-val-btn"
                  onClick={() => setShowFinancials(v => !v)}
                >
                  {showFinancials ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showFinancials ? 'Esconder valor' : 'Mostrar valor'}</span>
                </button>
              </div>

              <button
                type="button"
                className="retro-investment-hero-btn"
                onClick={() =>
                  openGamesDrilldown(
                    `Investimento do Ano (${yearLabel})`,
                    `Soma dos valores informados em ${summary.investedGames.length} jogos de ${summary.enteredGames.length}`,
                    [...summary.enteredGames].sort((a, b) => parseNumericPrice(b.spend) - parseNumericPrice(a.spend)),
                    '#10b981',
                    showFinancials
                      ? [
                          { label: 'Total Investido', value: formatBRLFull(summary.totalInvested), color: '#10b981' },
                          { label: 'Média por Jogo Pago', value: formatBRLFull(summary.avgPaidPrice), color: '#38bdf8' },
                          { label: 'Valor de Mercado Atual', value: formatBRLFull(summary.arrivalsMarketValue), color: '#a5b4fc' },
                          { label: 'Presentes / Sem Custo', value: `${summary.freeArrivals.length}`, color: '#fbbf24' },
                        ]
                      : undefined
                  )
                }
              >
                <div className="retro-investment-amount">
                  {showFinancials ? formatBRL(summary.totalInvested) : 'R$ •••••'}
                </div>
                <div className="retro-investment-caption">
                  Soma do valor que você informou em <strong>{summary.investedGames.length} jogos</strong> (de {summary.enteredGames.length}). Clique para detalhar →
                </div>
              </button>

              {showFinancials && (
                <div className="retro-investment-subgrid">
                  <div className="retro-inv-mini">
                    <span>Média / pago</span>
                    <strong>{formatBRL(summary.avgPaidPrice)}</strong>
                  </div>
                  <div className="retro-inv-mini">
                    <span>Mercado atual</span>
                    <strong style={{ color: '#38bdf8' }}>{formatBRL(summary.arrivalsMarketValue)}</strong>
                  </div>
                  {summary.soldRevenue > 0 ? (
                    <div className="retro-inv-mini">
                      <span>Vendas no ano</span>
                      <strong style={{ color: '#60a5fa' }}>{formatBRL(summary.soldRevenue)}</strong>
                    </div>
                  ) : summary.mostExpensiveArrival ? (
                    <div className="retro-inv-mini" title={summary.mostExpensiveArrival.game.name}>
                      <span>Maior compra</span>
                      <strong style={{ color: '#fbbf24' }}>{formatBRL(summary.mostExpensiveArrival.price)}</strong>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          SEÇÃO 2: NA MESA
          ====================================================== */}
      <section className="retro-section">
        <div className="retro-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="retro-section-badge indigo">
              <Dices size={20} />
            </div>
            <div>
              <h2 className="retro-section-title">Na mesa</h2>
              <p className="retro-section-subtitle">{summary.cutoffLabel}</p>
            </div>
          </div>
        </div>

        {!ludoToken ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <Dices size={42} color="#818cf8" style={{ opacity: 0.7, marginBottom: '0.75rem' }} />
            <h3 style={{ margin: '0 0 0.5rem' }}>Conecte sua conta da Ludopedia para ver suas partidas</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 1.25rem', fontSize: '0.9rem' }}>
              Com o Access Token configurado, puxamos automaticamente seu calendário dia a dia, pódio dos mais jogados, estreias do ano, taxa de vitórias e com quem você jogou.
            </p>
            <button type="button" className="btn btn-primary" onClick={onOpenSettings}>
              Configurar Token da Ludopedia
            </button>
          </div>
        ) : isLoadingPlays && matches.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <Dices size={42} color="#10b981" className="animate-spin" style={{ marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 0.4rem' }}>Construindo sua Retrospectiva na Mesa...</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.88rem' }}>
              {loadingProgress && loadingProgress.total > 0
                ? `Baixando histórico completo: ${loadingProgress.loaded} de ${loadingProgress.total} partidas`
                : 'Consultando seu perfil e partidas na Ludopedia API...'}
            </p>
          </div>
        ) : playsError && matches.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <AlertCircle size={40} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
            <h3 style={{ margin: '0 0 0.4rem', color: '#f87171' }}>Não foi possível carregar as partidas</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem', fontSize: '0.88rem' }}>{playsError}</p>
            <button type="button" className="btn btn-primary" onClick={() => syncLudopediaRetrospective(true)}>
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            {/* 4 KPI Cards Clicáveis da Mesa */}
            <div className="retro-kpi-grid-4">
              <button
                type="button"
                className="glass-panel retro-kpi-card clickable"
                onClick={() =>
                  openMatchesDrilldown(
                    `Partidas em ${yearLabel}`,
                    `${summary.totalPlays} partidas registradas (${summary.yearMatches.length} registros)`,
                    summary.yearMatches,
                    '#10b981'
                  )
                }
              >
                <div className="retro-kpi-card-top">
                  <span className="retro-kpi-number">{summary.totalPlays}</span>
                  <ChevronRight size={16} className="retro-kpi-arrow" />
                </div>
                <div className="retro-kpi-label">partidas</div>
                <div className="retro-kpi-sub">
                  {summary.yoyGrowthPct !== null ? (
                    <span style={{ color: summary.yoyGrowthPct >= 0 ? '#10b981' : '#f87171', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                      {summary.yoyGrowthPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {summary.yoyGrowthPct >= 0 ? `▲ ${summary.yoyGrowthPct}%` : `▼ ${Math.abs(summary.yoyGrowthPct)}%`} sobre {Number(selectedYear) - 1}
                    </span>
                  ) : (
                    <span>{summary.yearMatches.length} registros detalhados</span>
                  )}
                </div>
              </button>

              <button
                type="button"
                className="glass-panel retro-kpi-card clickable"
                onClick={() =>
                  openMatchesDrilldown(
                    `Dias de Jogo (${yearLabel})`,
                    `${summary.uniqueDaysCount} dias com jogatina • Maior sequência: ${summary.longestStreakDays} dia(s) seguido(s)`,
                    summary.yearMatches,
                    '#38bdf8'
                  )
                }
              >
                <div className="retro-kpi-card-top">
                  <span className="retro-kpi-number">{summary.uniqueDaysCount}</span>
                  <ChevronRight size={16} className="retro-kpi-arrow" />
                </div>
                <div className="retro-kpi-label">dias de jogo</div>
                <div className="retro-kpi-sub">
                  {summary.daysPerSession ? `um a cada ${summary.daysPerSession} ${summary.daysPerSession === 1 ? 'dia' : 'dias'}` : 'nenhum dia registrado'}
                </div>
              </button>

              <button
                type="button"
                className="glass-panel retro-kpi-card clickable"
                onClick={() =>
                  openGamesDrilldown(
                    `Jogos Diferentes Jogados (${yearLabel})`,
                    `${summary.uniqueGamesPlayedCount} títulos distintos (${summary.debuts.length} estreias)`,
                    summary.uniqueGamesPlayedList.map(s => s.collectionGame || ({
                      id: `played-${s.gameKey}`,
                      ludoId: s.ludoId,
                      name: s.name,
                      status: 'Jogado',
                      spend: 0,
                      type: 'Base',
                      value: 0,
                      thumbnail: s.thumb,
                      isPlayed: true,
                      playCount: s.playCount,
                    } as GameData)),
                    '#8b5cf6'
                  )
                }
              >
                <div className="retro-kpi-card-top">
                  <span className="retro-kpi-number">{summary.uniqueGamesPlayedCount}</span>
                  <ChevronRight size={16} className="retro-kpi-arrow" />
                </div>
                <div className="retro-kpi-label">jogos diferentes</div>
                <div className="retro-kpi-sub">{summary.debuts.length} estreias</div>
              </button>

              <button
                type="button"
                className="glass-panel retro-kpi-card clickable"
                onClick={() =>
                  openMatchesDrilldown(
                    `Horas na Mesa (${yearLabel})`,
                    `${summary.totalHoursRounded}h (${summary.totalFullDays} dias inteiros) • Média de ${summary.avgMatchMinutes} min/partida`,
                    [...summary.yearMatches].sort((a, b) => Number(b.duracao || 0) - Number(a.duracao || 0)),
                    '#14b8a6'
                  )
                }
              >
                <div className="retro-kpi-card-top">
                  <span className="retro-kpi-number">{summary.totalHoursRounded}</span>
                  <ChevronRight size={16} className="retro-kpi-arrow" />
                </div>
                <div className="retro-kpi-label">horas na mesa</div>
                <div className="retro-kpi-sub">{String(summary.totalFullDays).replace('.', ',')} dias inteiros</div>
              </button>
            </div>

            {/* Faixa de Insights Extras (H-index, Presencial/Digital, Streak, Maior Partida) */}
            <div className="retro-insights-strip">
              <div className="retro-insight-chip" title="H-index: X jogos jogados pelo menos X vezes no período">
                <Flame size={15} color="#f59e0b" />
                <span>H-index do ano: <strong>{summary.hIndex}</strong></span>
              </div>

              <button
                type="button"
                className="retro-insight-chip clickable"
                onClick={() =>
                  openMatchesDrilldown(
                    `Partidas Presenciais (${yearLabel})`,
                    `${summary.presencialCount} partidas presenciais`,
                    summary.presencialMatches,
                    '#10b981'
                  )
                }
              >
                <Home size={15} color="#10b981" />
                <span>Presenciais: <strong>{summary.presencialCount}</strong></span>
              </button>

              <button
                type="button"
                className="retro-insight-chip clickable"
                onClick={() =>
                  openMatchesDrilldown(
                    `Partidas Digitais (${yearLabel})`,
                    `${summary.digitalCount} partidas digitais`,
                    summary.digitalMatches,
                    '#ec4899'
                  )
                }
              >
                <Monitor size={15} color="#ec4899" />
                <span>Digitais: <strong>{summary.digitalCount}</strong></span>
              </button>

              <div className="retro-insight-chip">
                <Clock size={15} color="#38bdf8" />
                <span>Média: <strong>{summary.avgMatchMinutes > 0 ? `${summary.avgMatchMinutes} min` : '—'}</strong></span>
              </div>

              {summary.longestStreakDays > 1 && (
                <div className="retro-insight-chip">
                  <Calendar size={15} color="#a855f7" />
                  <span>Maior sequência: <strong>{summary.longestStreakDays} dias seguidos</strong></span>
                </div>
              )}

              {summary.longestMatch && (
                <button
                  type="button"
                  className="retro-insight-chip clickable"
                  onClick={() =>
                    openMatchesDrilldown(
                      `Partida Mais Longa (${yearLabel})`,
                      `${summary.longestMatch!.jogo?.nm_jogo} — ${formatPlayDuration(summary.longestMatch!.duracao)}`,
                      [summary.longestMatch!],
                      '#6366f1'
                    )
                  }
                >
                  <Trophy size={15} color="#fbbf24" />
                  <span>
                    Mais longa: <strong>{summary.longestMatch.jogo?.nm_jogo}</strong> ({formatPlayDuration(summary.longestMatch.duracao)})
                  </span>
                </button>
              )}
            </div>

            {/* O ano, dia a dia (Heatmap estilo GitHub clicável!) */}
            <div className="glass-panel retro-card">
              <div className="retro-card-header-row">
                <div>
                  <h3 className="retro-card-title">O ano, dia a dia ({summary.calendarYear})</h3>
                  <p className="retro-card-subtitle">
                    {summary.busiestMonth ? (
                      <>
                        Mês mais cheio:{' '}
                        <button
                          type="button"
                          className="retro-inline-link"
                          onClick={() =>
                            openMatchesDrilldown(
                              `Partidas de ${summary.busiestMonth!.fullName} de ${summary.calendarYear}`,
                              `${summary.busiestMonth!.playCount} partidas (${summary.busiestMonth!.hours}h)`,
                              summary.busiestMonth!.matches,
                              '#3b82f6'
                            )
                          }
                        >
                          {summary.busiestMonth.fullName} ({summary.busiestMonth.playCount} {summary.busiestMonth.playCount === 1 ? 'partida' : 'partidas'})
                        </button>
                        {summary.busiestDay && (
                          <>
                            . Dia mais cheio:{' '}
                            <button
                              type="button"
                              className="retro-inline-link"
                              onClick={() =>
                                openMatchesDrilldown(
                                  `Dia mais cheio: ${summary.busiestDay!.formattedDate}`,
                                  `${summary.busiestDay!.count} ${summary.busiestDay!.count === 1 ? 'partida registrada' : 'partidas registradas'}`,
                                  summary.busiestDay!.matches,
                                  '#f59e0b'
                                )
                              }
                            >
                              {summary.busiestDay.formattedDate}, com {summary.busiestDay.count} {summary.busiestDay.count === 1 ? 'partida' : 'partidas'}
                            </button>
                            .
                          </>
                        )}
                      </>
                    ) : (
                      'Nenhuma partida registrada no calendário deste ano.'
                    )}
                  </p>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  💡 Clique em qualquer dia colorido para ver as partidas
                </span>
              </div>

              <div className="retro-heatmap-scroll">
                <div className="retro-heatmap-inner">
                  {/* Rótulos dos meses */}
                  <div className="retro-heatmap-months" style={{ gridTemplateColumns: `repeat(${summary.calendarWeeks.length}, 14px)` }}>
                    {summary.calendarMonthMarkers.map(m => (
                      <button
                        key={m.monthIndex}
                        type="button"
                        className="retro-heatmap-month-btn"
                        style={{ gridColumnStart: m.weekCol + 1 }}
                        onClick={() => {
                          const ms = summary.monthlyStats[m.monthIndex];
                          if (ms && ms.matches.length > 0) {
                            openMatchesDrilldown(
                              `Partidas de ${ms.fullName} de ${summary.calendarYear}`,
                              `${ms.playCount} partidas registradas`,
                              ms.matches,
                              '#3b82f6'
                            );
                          }
                        }}
                        title={`Ver partidas de ${summary.monthlyStats[m.monthIndex]?.fullName || m.label}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Grade 7 x 53 */}
                  <div className="retro-heatmap-grid">
                    {summary.calendarWeeks.map((week, wIdx) => (
                      <div key={wIdx} className="retro-heatmap-col">
                        {week.map(cell => {
                          const tooltipText = cell.inYear
                            ? cell.count > 0
                              ? `${cell.dateStr.split('-').reverse().join('/')}: ${cell.count} ${cell.count === 1 ? 'partida' : 'partidas'} (${formatPlayDuration(cell.minutes)})`
                              : `${cell.dateStr.split('-').reverse().join('/')}: sem partidas`
                            : '';

                          return (
                            <button
                              key={cell.dateStr}
                              type="button"
                              disabled={!cell.inYear || cell.count === 0}
                              title={tooltipText}
                              onClick={() => {
                                if (cell.inYear && cell.count > 0) {
                                  openMatchesDrilldown(
                                    `Partidas em ${cell.dateStr.split('-').reverse().join('/')}`,
                                    `${cell.count} ${cell.count === 1 ? 'partida' : 'partidas'} • ${formatPlayDuration(cell.minutes)}`,
                                    cell.matches,
                                    cell.isBusiestDay ? '#f59e0b' : '#3b82f6'
                                  );
                                }
                              }}
                              className={`retro-heatmap-cell level-${cell.inYear ? cell.level : 'out'} ${cell.isBusiestDay ? 'busiest' : ''}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Legenda */}
                  <div className="retro-heatmap-legend">
                    <span>menos</span>
                    <span className="retro-heatmap-cell level-0 static" />
                    <span className="retro-heatmap-cell level-1 static" />
                    <span className="retro-heatmap-cell level-2 static" />
                    <span className="retro-heatmap-cell level-3 static" />
                    <span className="retro-heatmap-cell level-4 static" />
                    <span>mais</span>
                    <span className="retro-heatmap-cell level-4 busiest static" style={{ marginLeft: '0.6rem' }} />
                    <span>dia mais cheio</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico Mensal Interativo (Mês a Mês) */}
            {summary.totalPlays > 0 && (
              <div className="glass-panel retro-card">
                <div className="retro-card-header-row">
                  <div>
                    <h3 className="retro-card-title" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <BarChart3 size={17} color="#6366f1" />
                      Ritmo Mês a Mês
                    </h3>
                    <p className="retro-card-subtitle">Clique em qualquer mês para abrir as partidas daquele mês.</p>
                  </div>
                  <div className="retro-mini-toggle">
                    <button
                      type="button"
                      className={monthlyMetric === 'plays' ? 'active' : ''}
                      onClick={() => setMonthlyMetric('plays')}
                    >
                      Partidas
                    </button>
                    <button
                      type="button"
                      className={monthlyMetric === 'hours' ? 'active' : ''}
                      onClick={() => setMonthlyMetric('hours')}
                    >
                      Horas
                    </button>
                  </div>
                </div>

                <div style={{ width: '100%', height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.monthlyStats}
                      margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                      <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="var(--text-muted)" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(val: any, _name: any, item: any) => {
                          const row = item?.payload;
                          return monthlyMetric === 'plays'
                            ? [`${val} partidas (${row?.hours || 0}h)`, row?.fullName]
                            : [`${val} horas (${row?.playCount || 0} partidas)`, row?.fullName];
                        }}
                        contentStyle={{
                          backgroundColor: 'rgba(15,23,42,0.95)',
                          borderColor: 'rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Bar
                        dataKey={monthlyMetric === 'plays' ? 'playCount' : 'hours'}
                        radius={[6, 6, 0, 0]}
                        cursor="pointer"
                        onClick={(barData: any) => {
                          const ms = barData?.payload || barData;
                          if (ms && Array.isArray(ms.matches) && ms.matches.length > 0) {
                            openMatchesDrilldown(
                              `Partidas de ${ms.fullName} (${yearLabel})`,
                              `${ms.playCount} partidas • ${ms.hours}h na mesa`,
                              ms.matches,
                              '#6366f1'
                            );
                          }
                        }}
                      >
                        {summary.monthlyStats.map(ms => (
                          <Cell
                            key={ms.monthIndex}
                            fill={
                              summary.busiestMonth && ms.monthIndex === summary.busiestMonth.monthIndex
                                ? '#f59e0b'
                                : '#6366f1'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Os mais jogados (Pódio) + Estreias do ano */}
            <div className="retro-two-col-grid">
              {/* Os mais jogados */}
              <div className="glass-panel retro-card">
                <div className="retro-card-header-row">
                  <div>
                    <h3 className="retro-card-title">Os mais jogados</h3>
                    <p className="retro-card-subtitle">
                      {summary.gamesOver5PlaysCount > 0
                        ? `${summary.gamesOver5PlaysCount} ${summary.gamesOver5PlaysCount === 1 ? 'jogo chegou' : 'jogos chegaram'} a 5+ partidas.`
                        : 'Ranking dos títulos que mais viram mesa.'}
                    </p>
                  </div>
                  <div className="retro-mini-toggle">
                    <button
                      type="button"
                      className={mostPlayedSort === 'plays' ? 'active' : ''}
                      onClick={() => setMostPlayedSort('plays')}
                    >
                      Partidas
                    </button>
                    <button
                      type="button"
                      className={mostPlayedSort === 'hours' ? 'active' : ''}
                      onClick={() => setMostPlayedSort('hours')}
                    >
                      Horas
                    </button>
                  </div>
                </div>

                {rankedPlayedSource.length === 0 ? (
                  <div className="retro-empty-inline">Nenhuma partida registrada neste período.</div>
                ) : (
                  <>
                    {/* Pódio #2, #1, #3 */}
                    <div className="retro-podium">
                      {/* #2 */}
                      <div className="retro-podium-slot">
                        {podiumSecond && (
                          <button
                            type="button"
                            className="retro-podium-card"
                            onClick={() => handleClickPlayedGame(podiumSecond)}
                          >
                            {podiumSecond.thumb ? (
                              <img src={podiumSecond.thumb} alt={podiumSecond.name} className="retro-podium-thumb" />
                            ) : (
                              <div className="retro-podium-thumb-ph"><Dices size={20} /></div>
                            )}
                            <div className="retro-podium-name">{podiumSecond.name}</div>
                            <div className="retro-podium-meta">
                              {podiumSecond.playCount} {podiumSecond.playCount === 1 ? 'partida' : 'partidas'} · {(podiumSecond.totalMinutes / 60).toFixed(1).replace('.', ',')} h
                            </div>
                            <div className="retro-podium-pedestal silver">2</div>
                          </button>
                        )}
                      </div>

                      {/* #1 */}
                      <div className="retro-podium-slot">
                        {podiumFirst && (
                          <button
                            type="button"
                            className="retro-podium-card"
                            onClick={() => handleClickPlayedGame(podiumFirst)}
                          >
                            {podiumFirst.thumb ? (
                              <img src={podiumFirst.thumb} alt={podiumFirst.name} className="retro-podium-thumb first" />
                            ) : (
                              <div className="retro-podium-thumb-ph first"><Dices size={24} /></div>
                            )}
                            <div className="retro-podium-name">{podiumFirst.name}</div>
                            <div className="retro-podium-meta">
                              {podiumFirst.playCount} {podiumFirst.playCount === 1 ? 'partida' : 'partidas'} · {(podiumFirst.totalMinutes / 60).toFixed(1).replace('.', ',')} h
                            </div>
                            <div className="retro-podium-pedestal gold">1</div>
                          </button>
                        )}
                      </div>

                      {/* #3 */}
                      <div className="retro-podium-slot">
                        {podiumThird && (
                          <button
                            type="button"
                            className="retro-podium-card"
                            onClick={() => handleClickPlayedGame(podiumThird)}
                          >
                            {podiumThird.thumb ? (
                              <img src={podiumThird.thumb} alt={podiumThird.name} className="retro-podium-thumb" />
                            ) : (
                              <div className="retro-podium-thumb-ph"><Dices size={20} /></div>
                            )}
                            <div className="retro-podium-name">{podiumThird.name}</div>
                            <div className="retro-podium-meta">
                              {podiumThird.playCount} {podiumThird.playCount === 1 ? 'partida' : 'partidas'} · {(podiumThird.totalMinutes / 60).toFixed(1).replace('.', ',')} h
                            </div>
                            <div className="retro-podium-pedestal bronze">3</div>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lista #4.. */}
                    {remainingPlayed.length > 0 && (
                      <div className="retro-ranked-list">
                        {remainingPlayed.map((item, idx) => (
                          <button
                            key={item.gameKey}
                            type="button"
                            className="retro-ranked-row"
                            onClick={() => handleClickPlayedGame(item)}
                          >
                            <span className="retro-ranked-pos">{idx + 4}</span>
                            <span className="retro-ranked-name">{item.name}</span>
                            <span className="retro-ranked-val">
                              {mostPlayedSort === 'plays'
                                ? item.playCount
                                : `${(item.totalMinutes / 60).toFixed(1).replace('.', ',')}h`}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {rankedPlayedSource.length > 8 && (
                      <button
                        type="button"
                        className="retro-expand-link"
                        onClick={() => setShowAllMostPlayed(v => !v)}
                      >
                        {showAllMostPlayed ? 'Mostrar top 8' : `Ver todos os ${rankedPlayedSource.length} jogos jogados`}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Estreias do ano */}
              <div className="glass-panel retro-card">
                <div className="retro-card-header-row">
                  <div>
                    <h3 className="retro-card-title">Estreias do ano</h3>
                    <p className="retro-card-subtitle">
                      <strong>{summary.debuts.length}</strong> {summary.debuts.length === 1 ? 'jogo foi' : 'jogos foram'} para a mesa pela primeira vez ({summary.debutRatePct}% dos jogos do ano).
                    </p>
                  </div>
                  {summary.debuts.length > 0 && (
                    <button
                      type="button"
                      className="retro-subtle-link"
                      onClick={() =>
                        openMatchesDrilldown(
                          `Partidas de Estreias (${yearLabel})`,
                          `${summary.debuts.length} jogos estrearam na mesa`,
                          summary.debuts.flatMap(d => d.matches),
                          '#8b5cf6'
                        )
                      }
                    >
                      Ver partidas →
                    </button>
                  )}
                </div>

                {summary.debuts.length === 0 ? (
                  <div className="retro-empty-inline">Nenhuma estreia registrada neste período.</div>
                ) : (
                  <>
                    <div className="retro-debuts-grid">
                      {visibleDebuts.map(d => (
                        <button
                          key={d.gameKey}
                          type="button"
                          className="retro-debut-card"
                          onClick={() => handleClickPlayedGame(d)}
                          title={`${d.name} • Estreia: ${formatPtBrDayMonthShort(d.firstPlayDate)} (${d.playCount}x)`}
                        >
                          <div className="retro-debut-thumb">
                            {d.thumb ? (
                              <img src={d.thumb} alt={d.name} loading="lazy" />
                            ) : (
                              <Dices size={20} color="var(--text-muted)" />
                            )}
                          </div>
                          <div className="retro-debut-name">{d.name}</div>
                          <div className="retro-debut-date">{formatPtBrDayMonthShort(d.firstPlayDate)}</div>
                        </button>
                      ))}
                    </div>
                    {summary.debuts.length > 18 && (
                      <button
                        type="button"
                        className="retro-expand-link"
                        onClick={() => setShowAllDebuts(v => !v)}
                      >
                        {showAllDebuts ? 'Mostrar menos' : `Ver todas as ${summary.debuts.length} estreias`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 3 Cards Inferiores: Vitórias | Dia de Jogo | Com quem você jogou */}
            <div className="retro-three-col-grid">
              {/* Vitórias */}
              <div className="glass-panel retro-card">
                <h3 className="retro-card-title">Vitórias</h3>
                <p className="retro-card-subtitle">Entre as partidas com vencedor marcado.</p>

                {summary.winStats.matchesWithWinnerCount === 0 ? (
                  <div className="retro-empty-inline">Nenhuma partida com vencedor marcado neste período.</div>
                ) : (
                  <div
                    className="retro-wins-body"
                    onClick={() =>
                      openMatchesDrilldown(
                        `Suas Vitórias em ${yearLabel}`,
                        `${summary.winStats.userWinsCount} vitórias em ${summary.winStats.matchesWithWinnerCount} partidas com vencedor (${summary.winStats.winRatePct}%)`,
                        summary.winStats.wonMatches,
                        '#f59e0b',
                        [
                          { label: 'Vitórias', value: String(summary.winStats.userWinsCount), color: '#fbbf24' },
                          { label: 'Com Vencedor Marcado', value: String(summary.winStats.matchesWithWinnerCount), color: '#e2e8f0' },
                          { label: 'Aproveitamento', value: `${summary.winStats.winRatePct}%`, color: '#10b981' },
                        ]
                      )
                    }
                    title="Clique para ver todas as partidas que você venceu"
                  >
                    <div style={{ width: 112, height: 112, position: 'relative', flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={winChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={36}
                            outerRadius={50}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                          >
                            {winChartData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="retro-donut-center">
                        <strong>{summary.winStats.winRatePct}%</strong>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      <strong>{summary.winStats.userWinsCount}</strong> vitórias em{' '}
                      <strong>{summary.winStats.matchesWithWinnerCount}</strong> partidas.
                      <div style={{ fontSize: '0.76rem', color: '#fbbf24', marginTop: '0.35rem' }}>
                        Ver vitórias →
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dia de jogo favorito */}
              <div className="glass-panel retro-card">
                <h3 className="retro-card-title">
                  Dia de jogo: {summary.topWeekday ? summary.topWeekday.fullLabel.replace('-feira', '') : '—'}
                </h3>
                <p className="retro-card-subtitle">
                  {summary.topWeekday
                    ? `${summary.topWeekday.percentage}% das partidas caíram nesse dia. Clique em qualquer barra:`
                    : 'Distribuição semanal das partidas.'}
                </p>

                <div className="retro-weekday-bars">
                  {(() => {
                    const maxW = Math.max(1, ...summary.weekdayStats.map(w => w.playCount));
                    return summary.weekdayStats.map(w => {
                      const heightPct = w.playCount > 0 ? Math.max(10, Math.round((w.playCount / maxW) * 100)) : 4;
                      return (
                        <button
                          key={w.dayIndex}
                          type="button"
                          disabled={w.playCount === 0}
                          className="retro-weekday-col"
                          title={`${w.fullLabel}: ${w.playCount} partidas (${w.percentage}%)`}
                          onClick={() => {
                            if (w.matches.length > 0) {
                              openMatchesDrilldown(
                                `Partidas de ${w.fullLabel} (${yearLabel})`,
                                `${w.playCount} partidas (${w.percentage}% do total)`,
                                w.matches,
                                w.isTopDay ? '#f59e0b' : '#3b82f6'
                              );
                            }
                          }}
                        >
                          <div className="retro-weekday-track">
                            <div
                              className={`retro-weekday-bar ${w.isTopDay ? 'top' : ''} ${w.playCount === 0 ? 'empty' : ''}`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className={`retro-weekday-lbl ${w.isTopDay ? 'top' : ''}`}>
                            {w.shortLabel}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Com quem você jogou */}
              <div className="glass-panel retro-card">
                <div className="retro-card-header-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <h3 className="retro-card-title">Com quem você jogou</h3>
                      <span className="retro-private-pill">🔒 só você vê</span>
                    </div>
                    <p className="retro-card-subtitle">
                      {summary.coPlayers.length} {summary.coPlayers.length === 1 ? 'pessoa diferente' : 'pessoas diferentes'} na mesa.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn retro-hide-val-btn"
                    onClick={() => setShowPlayersPrivacy(v => !v)}
                    title={showPlayersPrivacy ? 'Ocultar nomes' : 'Mostrar nomes'}
                  >
                    {showPlayersPrivacy ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                {summary.coPlayers.length === 0 ? (
                  <div className="retro-empty-inline">Nenhum outro jogador registrado nas partidas deste ano.</div>
                ) : (
                  <>
                    <div className="retro-players-bars">
                      {visibleCoPlayers.map((p, idx) => {
                        const widthPct = Math.max(6, Math.round((p.playCount / maxCoPlayerPlays) * 100));
                        return (
                          <button
                            key={p.key}
                            type="button"
                            className="retro-player-bar-row"
                            onClick={() => handleClickCoPlayer(p)}
                            title={`Clique para ver todas as ${p.playCount} partidas com ${p.name}`}
                          >
                            <span className="retro-player-bar-name">
                              {showPlayersPrivacy ? p.name : `Jogador #${idx + 1}`}
                            </span>
                            <div className="retro-player-bar-track">
                              <div
                                className={`retro-player-bar-fill ${idx === 0 ? 'top' : ''}`}
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                            <strong className="retro-player-bar-count">{p.playCount}</strong>
                          </button>
                        );
                      })}
                    </div>

                    {summary.coPlayers.length > 5 && (
                      <button
                        type="button"
                        className="retro-expand-link"
                        onClick={() => setShowAllPlayers(v => !v)}
                      >
                        {showAllPlayers ? 'Mostrar top 5' : `Ver todas as ${summary.coPlayers.length} pessoas`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Bônus: Expansões Mais Usadas & Grupos de Jogo */}
            {(summary.topExpansionsPlayed.length > 0 || summary.topGroups.length > 0) && (
              <div className="retro-two-col-grid">
                {summary.topExpansionsPlayed.length > 0 && (
                  <div className="glass-panel retro-card">
                    <h3 className="retro-card-title">Expansões mais jogadas na mesa</h3>
                    <p className="retro-card-subtitle">Clique em qualquer expansão para ver as partidas em que ela entrou.</p>
                    <div className="retro-traits-cloud" style={{ marginTop: '0.75rem' }}>
                      {summary.topExpansionsPlayed.slice(0, 12).map(exp => (
                        <button
                          key={exp.name}
                          type="button"
                          className="retro-trait-pill"
                          onClick={() =>
                            openMatchesDrilldown(
                              `Expansão: ${exp.name}`,
                              `${exp.count} ${exp.count === 1 ? 'partida' : 'partidas'} em ${yearLabel}`,
                              exp.matches,
                              '#8b5cf6'
                            )
                          }
                        >
                          <span>+ {exp.name}</span>
                          <strong>{exp.count}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {summary.topGroups.length > 0 && (
                  <div className="glass-panel retro-card">
                    <h3 className="retro-card-title">Grupos e locais de jogatina</h3>
                    <p className="retro-card-subtitle">Grupos registrados nas suas partidas de {yearLabel}.</p>
                    <div className="retro-players-bars" style={{ marginTop: '0.75rem' }}>
                      {summary.topGroups.slice(0, 6).map((grp, idx) => {
                        const maxG = Math.max(1, summary.topGroups[0].count);
                        return (
                          <button
                            key={grp.name}
                            type="button"
                            className="retro-player-bar-row"
                            onClick={() =>
                              openMatchesDrilldown(
                                `Grupo: ${grp.name}`,
                                `${grp.count} partidas neste grupo em ${yearLabel}`,
                                grp.matches,
                                '#10b981'
                              )
                            }
                          >
                            <span className="retro-player-bar-name">{grp.name}</span>
                            <div className="retro-player-bar-track">
                              <div
                                className={`retro-player-bar-fill ${idx === 0 ? 'top' : ''}`}
                                style={{ width: `${Math.max(8, Math.round((grp.count / maxG) * 100))}%` }}
                              />
                            </div>
                            <strong className="retro-player-bar-count">{grp.count}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Modal de Drill-Down Dinâmico */}
      <RetrospectiveDrilldownModal
        data={drilldown}
        allGames={games}
        allBadges={summary.allBadges}
        showFinancials={showFinancials}
        onClose={() => setDrilldown(null)}
        onOpenGameDetails={game => onClickGameDetails(game)}
      />

      {/* Modal de Organização Rápida de Datas */}
      <CollectionDatesModal
        isOpen={isDatesModalOpen}
        onClose={() => setIsDatesModalOpen(false)}
        games={games}
        defaultYear={selectedYear === 'all' ? new Date().getFullYear() : selectedYear}
        onApplyBatchPatches={onPatchGamesBatch}
      />
    </div>
  );
}
