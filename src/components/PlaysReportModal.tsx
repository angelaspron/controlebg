import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, Dices, Clock, Trophy, Calendar, Users, Search, 
  RefreshCw, Sparkles, Monitor, Home, ExternalLink,
  ChevronDown, ChevronUp, AlertCircle, BarChart3, ListFilter,
  FileSpreadsheet
} from 'lucide-react';
import type { GameData, LudopediaMatch, LudopediaPlaysSummary } from '../types';
import { 
  fetchAllLudopediaPlays, 
  formatPlayDuration,
  formatMatchDate 
} from '../services/ludopediaService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import '../components.css';

interface PlaysReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  ludoToken: string;
  onOpenSettings?: () => void;
  games?: GameData[];
  onSyncPlayCounts?: (countsByLudoId: Record<string, number>, countsByName: Record<string, number>) => void;
}

export function PlaysReportModal({
  isOpen,
  onClose,
  ludoToken,
  onOpenSettings,
  games: _games = [],
  onSyncPlayCounts
}: PlaysReportModalProps) {
  const [matches, setMatches] = useState<LudopediaMatch[]>([]);
  const [summary, setSummary] = useState<LudopediaPlaysSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'stats'>('matches');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string>('todos');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'presencial' | 'digital'>('todos');
  const [victoryFilter, setVictoryFilter] = useState<'todos' | 'vitorias'>('todos');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'duration_desc' | 'game_name'>('date_desc');
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);

  // Carregar dados da Ludopedia ao abrir o modal
  const loadPlaysData = useCallback(async (force = false) => {
    if (!ludoToken) return;
    
    // Se já carregou dados e não é forçado, reutiliza
    if (!force && matches.length > 0) return;

    setIsLoading(true);
    setError(null);
    setLoadingProgress(null);

    try {
      const result = await fetchAllLudopediaPlays(ludoToken, (loaded, total) => {
        setLoadingProgress({ loaded, total });
      });

      setMatches(result.partidas);
      setSummary(result.summary);

      // Sincronizar playCounts com a coleção de jogos se callback fornecido
      if (onSyncPlayCounts && result.partidas.length > 0) {
        const countsByLudoId: Record<string, number> = {};
        const countsByName: Record<string, number> = {};

        for (const m of result.partidas) {
          const gameId = String(m.jogo?.id_jogo || '');
          const gameName = (m.jogo?.nm_jogo || '').trim().toLowerCase();
          const matchCount = Number(m.qt_partidas || 1);

          if (gameId) {
            countsByLudoId[gameId] = (countsByLudoId[gameId] || 0) + matchCount;
          }
          if (gameName) {
            countsByName[gameName] = (countsByName[gameName] || 0) + matchCount;
          }

          // Expansões incluídas na partida também contam
          if (Array.isArray(m.expansoes)) {
            for (const exp of m.expansoes) {
              const expId = String(exp.id_jogo || '');
              const expName = (exp.nm_jogo || '').trim().toLowerCase();
              if (expId) countsByLudoId[expId] = (countsByLudoId[expId] || 0) + matchCount;
              if (expName) countsByName[expName] = (countsByName[expName] || 0) + matchCount;
            }
          }
        }

        onSyncPlayCounts(countsByLudoId, countsByName);
      }
    } catch (err: any) {
      console.error('Erro ao carregar partidas da Ludopedia:', err);
      setError(err.message || 'Falha ao buscar histórico de partidas na API da Ludopedia.');
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
    }
  }, [ludoToken, matches.length, onSyncPlayCounts]);

  useEffect(() => {
    if (isOpen) {
      loadPlaysData();
    }
  }, [isOpen, loadPlaysData]);

  // Lista de jogos únicos presentes nas partidas para o filtro
  const availableGames = useMemo(() => {
    const map = new Map<string, string>();
    matches.forEach(m => {
      if (m.jogo?.id_jogo && m.jogo.nm_jogo) {
        map.set(String(m.jogo.id_jogo), m.jogo.nm_jogo);
      }
      if (Array.isArray(m.expansoes)) {
        m.expansoes.forEach(exp => {
          if (exp.id_jogo && exp.nm_jogo) {
            map.set(String(exp.id_jogo), `${exp.nm_jogo} (Expansão)`);
          }
        });
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);

  // Lista de jogadores únicos presentes nas partidas
  const availablePlayers = useMemo(() => {
    const playerNames = new Set<string>();
    matches.forEach(m => {
      if (Array.isArray(m.jogadores)) {
        m.jogadores.forEach(j => {
          if (j.nome) playerNames.add(j.nome.trim());
        });
      }
    });
    return Array.from(playerNames).sort((a, b) => a.localeCompare(b));
  }, [matches]);

  // Filtragem e ordenação das partidas
  const filteredMatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = matches.filter(m => {
      // 1. Busca textual (nome do jogo, jogadores ou observações)
      if (term) {
        const gameMatch = (m.jogo?.nm_jogo || '').toLowerCase().includes(term) ||
          (m.jogo?.nm_original || '').toLowerCase().includes(term);
        const expMatch = Array.isArray(m.expansoes) && m.expansoes.some(exp =>
          (exp.nm_jogo || '').toLowerCase().includes(term)
        );
        const playerMatch = Array.isArray(m.jogadores) && m.jogadores.some(j =>
          (j.nome || '').toLowerCase().includes(term) || (j.observacao || '').toLowerCase().includes(term)
        );
        const descMatch = (m.descricao || '').toLowerCase().includes(term);
        const groupMatch = (m.grupo?.nm_grupo || '').toLowerCase().includes(term);

        if (!gameMatch && !expMatch && !playerMatch && !descMatch && !groupMatch) {
          return false;
        }
      }

      // 2. Filtro por jogo
      if (selectedGameId !== 'todos') {
        const isBase = String(m.jogo?.id_jogo) === selectedGameId;
        const isExp = Array.isArray(m.expansoes) && m.expansoes.some(e => String(e.id_jogo) === selectedGameId);
        if (!isBase && !isExp) return false;
      }

      // 3. Filtro por jogador
      if (selectedPlayer !== 'todos') {
        const hasPlayer = Array.isArray(m.jogadores) && m.jogadores.some(j => 
          (j.nome || '').trim().toLowerCase() === selectedPlayer.toLowerCase()
        );
        if (!hasPlayer) return false;
      }

      // 4. Filtro por modalidade (presencial vs digital)
      if (typeFilter === 'presencial' && m.fl_digital === 1) return false;
      if (typeFilter === 'digital' && m.fl_digital !== 1) return false;

      // 5. Filtro por vitórias (vitória de qualquer jogador marcado como vencedor ou usuário)
      if (victoryFilter === 'vitorias') {
        const userWon = Array.isArray(m.jogadores) && m.jogadores.some(j => 
          Boolean(j.fl_vencedor === 1 || j.fl_vencedor === ('1' as any))
        );
        if (!userWon) return false;
      }

      // 6. Filtro por intervalo de datas
      if (dateStart && m.dt_partida && m.dt_partida < dateStart) return false;
      if (dateEnd && m.dt_partida && m.dt_partida > dateEnd) return false;

      return true;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return String(b.dt_partida || '').localeCompare(String(a.dt_partida || ''));
        case 'date_asc':
          return String(a.dt_partida || '').localeCompare(String(b.dt_partida || ''));
        case 'duration_desc':
          return (Number(b.duracao) || 0) - (Number(a.duracao) || 0);
        case 'game_name':
          return String(a.jogo?.nm_jogo || '').localeCompare(String(b.jogo?.nm_jogo || ''));
        default:
          return 0;
      }
    });
  }, [matches, searchTerm, selectedGameId, selectedPlayer, typeFilter, victoryFilter, dateStart, dateEnd, sortBy]);

  // Estatísticas agregadas calculadas dinamicamente
  const calculatedStats = useMemo(() => {
    let totalPartidasCount = 0;
    let totalMinutes = 0;
    let matchesWithDuration = 0;
    let totalWins = 0;
    const uniqueGames = new Set<string>();
    const uniquePlayers = new Set<string>();
    const gamePlayCounts: Record<string, { count: number; name: string; thumb?: string; minutes: number }> = {};
    const playerWinCounts: Record<string, { wins: number; plays: number }> = {};
    const dayOfWeekCounts: Record<string, number> = {
      'Dom': 0, 'Seg': 0, 'Ter': 0, 'Qua': 0, 'Qui': 0, 'Sex': 0, 'Sáb': 0
    };
    let presencialCount = 0;
    let digitalCount = 0;

    const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    filteredMatches.forEach(m => {
      const pCount = Number(m.qt_partidas || 1);
      totalPartidasCount += pCount;

      const dur = Number(m.duracao || 0);
      if (dur > 0) {
        totalMinutes += dur;
        matchesWithDuration++;
      }

      if (m.fl_digital === 1) digitalCount += pCount;
      else presencialCount += pCount;

      if (m.jogo?.id_jogo) {
        const gKey = String(m.jogo.id_jogo);
        uniqueGames.add(gKey);
        if (!gamePlayCounts[gKey]) {
          gamePlayCounts[gKey] = {
            count: 0,
            name: m.jogo.nm_jogo || 'Jogo Desconhecido',
            thumb: m.jogo.thumb,
            minutes: 0
          };
        }
        gamePlayCounts[gKey].count += pCount;
        gamePlayCounts[gKey].minutes += dur;
      }

      if (m.dt_partida) {
        try {
          const [y, mo, d] = m.dt_partida.split('-').map(Number);
          const dt = new Date(y, mo - 1, d);
          const dow = daysMap[dt.getDay()];
          if (dow) dayOfWeekCounts[dow] = (dayOfWeekCounts[dow] || 0) + pCount;
        } catch {}
      }

      if (Array.isArray(m.jogadores)) {
        m.jogadores.forEach(j => {
          if (j.nome) {
            const pName = j.nome.trim();
            uniquePlayers.add(pName);
            if (!playerWinCounts[pName]) {
              playerWinCounts[pName] = { wins: 0, plays: 0 };
            }
            playerWinCounts[pName].plays += pCount;
            if (j.fl_vencedor === 1 || j.fl_vencedor === ('1' as any)) {
              playerWinCounts[pName].wins += pCount;
              totalWins++;
            }
          }
        });
      }
    });

    const topGames = Object.values(gamePlayCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topPlayers = Object.entries(playerWinCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    const dayData = Object.entries(dayOfWeekCounts).map(([day, count]) => ({ day, count }));

    const avgMinutes = matchesWithDuration > 0 ? Math.round(totalMinutes / matchesWithDuration) : 0;

    return {
      totalPartidasCount,
      totalMinutes,
      avgMinutes,
      matchesWithDuration,
      totalWins,
      uniqueGamesCount: uniqueGames.size,
      uniquePlayersCount: uniquePlayers.size,
      presencialCount,
      digitalCount,
      topGames,
      topPlayers,
      dayData
    };
  }, [filteredMatches]);

  // Exportar histórico completo para planilha Excel
  const handleExportExcel = () => {
    if (filteredMatches.length === 0) {
      alert('Nenhuma partida disponível para exportação.');
      return;
    }

    const rows = filteredMatches.map(m => {
      const expNames = Array.isArray(m.expansoes) ? m.expansoes.map(e => e.nm_jogo).filter(Boolean).join(', ') : '';
      const jogadoresStr = Array.isArray(m.jogadores)
        ? m.jogadores.map(j => {
            const pts = j.vl_pontos !== null && j.vl_pontos !== undefined ? ` (${j.vl_pontos} pts)` : '';
            const won = j.fl_vencedor === 1 ? ' 🏆' : '';
            const obs = j.observacao ? ` [${j.observacao}]` : '';
            return `${j.nome}${pts}${won}${obs}`;
          }).join('; ')
        : '';
      const vencedores = Array.isArray(m.jogadores)
        ? m.jogadores.filter(j => j.fl_vencedor === 1).map(j => j.nome).join(', ')
        : '';

      return {
        'ID Partida': m.id_partida,
        'Data': m.dt_partida || '',
        'Jogo': m.jogo?.nm_jogo || '',
        'Expansões': expNames,
        'Quantidade': m.qt_partidas || 1,
        'Duração (Minutos)': m.duracao || '',
        'Duração Formatada': formatPlayDuration(m.duracao),
        'Modalidade': m.fl_digital === 1 ? 'Digital' : 'Presencial',
        'Grupo / Local': m.grupo?.nm_grupo || '',
        'Vencedores': vencedores,
        'Jogadores & Placar': jogadoresStr,
        'Descrição / Observações': m.descricao || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Partidas Ludopedia');
    XLSX.writeFile(workbook, `partidas_ludopedia_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 10, 24, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '1280px',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: 'rgba(15, 23, 42, 0.96)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        {/* Header Superior */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #10b981, #6366f1)',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)'
            }}>
              <Dices size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Relatório Completo de Partidas
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}>
                  Ludopedia API v1
                </span>
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                Histórico detalhado com datas, tempos de partida, placares e estatísticas puxados exclusivamente da Ludopedia
              </p>
            </div>
          </div>

          {/* Botões de Ação do Topo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {ludoToken && (
              <>
                <button
                  type="button"
                  onClick={() => loadPlaysData(true)}
                  disabled={isLoading}
                  className="btn"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Recarregar partidas da API da Ludopedia"
                >
                  <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                  {isLoading ? 'Sincronizando...' : 'Sincronizar'}
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filteredMatches.length === 0}
                  className="btn"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Exportar partidas filtradas para Excel"
                >
                  <FileSpreadsheet size={14} color="#10b981" />
                  Excel
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'color 0.2s'
              }}
              aria-label="Fechar"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        {!ludoToken ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <AlertCircle size={56} color="#f59e0b" style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.3rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
              Token da Ludopedia Não Configurado
            </h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '520px', lineHeight: 1.5, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Para visualizar o relatório completo de partidas, é necessário configurar o seu <strong>Access Token</strong> da Ludopedia.
              Conforme a regra do sistema, as informações de partidas são consultadas <strong>exclusivamente</strong> da sua conta da Ludopedia.
            </p>
            {onOpenSettings && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onOpenSettings}
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
              >
                Ir para Configurações
              </button>
            )}
          </div>
        ) : isLoading && matches.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem'
          }}>
            <Dices size={48} color="#10b981" style={{ animation: 'spin 2s linear infinite', marginBottom: '1.25rem' }} />
            <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>Buscando partidas da Ludopedia...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
              {loadingProgress && loadingProgress.total > 0
                ? `Baixando histórico: ${loadingProgress.loaded} de ${loadingProgress.total} partidas carregadas...`
                : 'Conectando à API v1 da Ludopedia...'}
            </p>
          </div>
        ) : error && matches.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: '#f87171', marginBottom: '0.5rem' }}>Erro ao consultar partidas</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '480px', marginBottom: '1.25rem' }}>{error}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => loadPlaysData(true)}
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* Banner de Métricas Rápidas do Topo */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.85rem',
              padding: '1rem 1.75rem',
              background: 'rgba(0, 0, 0, 0.25)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              {/* Total de Partidas */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem'
              }}>
                <div style={{ fontSize: '0.74rem', color: '#6ee7b7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Dices size={14} /> Total de Partidas
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                  {calculatedStats.totalPartidasCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {summary?.qt_partidas ? `${summary.qt_partidas} registradas no site` : `${filteredMatches.length} registros`}
                </div>
              </div>

              {/* Tempo Total */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem'
              }}>
                <div style={{ fontSize: '0.74rem', color: '#7dd3fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> Tempo Total Jogado
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                  {formatPlayDuration(calculatedStats.totalMinutes)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {calculatedStats.avgMinutes > 0 ? `Média: ${calculatedStats.avgMinutes} min / partida` : 'Sem durações cadastradas'}
                </div>
              </div>

              {/* Jogos Únicos */}
              <div style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem'
              }}>
                <div style={{ fontSize: '0.74rem', color: '#c4b5fd', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={14} /> Jogos Únicos
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6', marginTop: '2px' }}>
                  {calculatedStats.uniqueGamesCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Títulos distintos jogados
                </div>
              </div>

              {/* Total de Vitórias */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem'
              }}>
                <div style={{ fontSize: '0.74rem', color: '#fcd34d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trophy size={14} /> Vitórias Registradas
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                  {summary?.qt_vitorias !== undefined ? summary.qt_vitorias : calculatedStats.totalWins}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {calculatedStats.totalPartidasCount > 0 
                    ? `${Math.round(((summary?.qt_vitorias || calculatedStats.totalWins) / calculatedStats.totalPartidasCount) * 100)}% de taxa`
                    : '0% vitórias'}
                </div>
              </div>

              {/* Modalidade */}
              <div style={{
                background: 'rgba(236, 72, 153, 0.08)',
                border: '1px solid rgba(236, 72, 153, 0.2)',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem'
              }}>
                <div style={{ fontSize: '0.74rem', color: '#f472b6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Home size={14} /> Presencial vs Digital
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ec4899', marginTop: '4px' }}>
                  {calculatedStats.presencialCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>mesa</span> / {calculatedStats.digitalCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>online</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {calculatedStats.uniquePlayersCount} participantes distintos
                </div>
              </div>
            </div>

            {/* Alternador de Abas */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 1.75rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(15, 23, 42, 0.7)'
            }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className="btn"
                  style={{
                    padding: '0.4rem 0.9rem',
                    fontSize: '0.84rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'matches' ? 'var(--accent)' : 'transparent',
                    color: activeTab === 'matches' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ListFilter size={15} />
                  Lista de Partidas ({filteredMatches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className="btn"
                  style={{
                    padding: '0.4rem 0.9rem',
                    fontSize: '0.84rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'stats' ? 'var(--accent)' : 'transparent',
                    color: activeTab === 'stats' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <BarChart3 size={15} />
                  Rankings & Gráficos
                </button>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Mostrando <strong>{filteredMatches.length}</strong> de <strong>{matches.length}</strong> partidas
              </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div style={{
              padding: '0.85rem 1.75rem',
              background: 'rgba(30, 41, 59, 0.4)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.65rem',
              alignItems: 'center'
            }}>
              {/* Input de Busca */}
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar por jogo, jogador ou nota..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', width: '100%', fontSize: '0.82rem', height: '34px' }}
                />
              </div>

              {/* Filtro por Jogo */}
              <select
                className="search-input"
                style={{ minWidth: '160px', height: '34px', fontSize: '0.82rem' }}
                value={selectedGameId}
                onChange={e => setSelectedGameId(e.target.value)}
              >
                <option value="todos">Todos os Jogos ({availableGames.length})</option>
                {availableGames.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              {/* Filtro por Jogador */}
              <select
                className="search-input"
                style={{ minWidth: '140px', height: '34px', fontSize: '0.82rem' }}
                value={selectedPlayer}
                onChange={e => setSelectedPlayer(e.target.value)}
              >
                <option value="todos">Todos os Jogadores ({availablePlayers.length})</option>
                {availablePlayers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {/* Filtro Modalidade */}
              <select
                className="search-input"
                style={{ minWidth: '120px', height: '34px', fontSize: '0.82rem' }}
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
              >
                <option value="todos">Mesa & Online</option>
                <option value="presencial">🏠 Presencial</option>
                <option value="digital">💻 Digital</option>
              </select>

              {/* Filtro de Vitórias */}
              <select
                className="search-input"
                style={{ minWidth: '120px', height: '34px', fontSize: '0.82rem' }}
                value={victoryFilter}
                onChange={e => setVictoryFilter(e.target.value as any)}
              >
                <option value="todos">Todos Resultados</option>
                <option value="vitorias">🏆 Com Vencedor</option>
              </select>

              {/* Ordenação */}
              <select
                className="search-input"
                style={{ minWidth: '140px', height: '34px', fontSize: '0.82rem' }}
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
              >
                <option value="date_desc">Mais Recentes</option>
                <option value="date_asc">Mais Antigas</option>
                <option value="duration_desc">Maior Duração</option>
                <option value="game_name">Nome do Jogo (A-Z)</option>
              </select>

              {(searchTerm || selectedGameId !== 'todos' || selectedPlayer !== 'todos' || typeFilter !== 'todos' || victoryFilter !== 'todos' || dateStart || dateEnd) && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedGameId('todos');
                    setSelectedPlayer('todos');
                    setTypeFilter('todos');
                    setVictoryFilter('todos');
                    setDateStart('');
                    setDateEnd('');
                  }}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: '#f87171' }}
                >
                  Limpar Filtros
                </button>
              )}
            </div>

            {/* Conteúdo com Scroll */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem' }}>
              {activeTab === 'matches' ? (
                filteredMatches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                    <Dices size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p style={{ fontSize: '1rem', margin: 0 }}>Nenhuma partida encontrada com os filtros selecionados.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {filteredMatches.map(match => {
                      const isExpanded = expandedMatchId === match.id_partida;
                      const hasExpansions = Array.isArray(match.expansoes) && match.expansoes.length > 0;
                      const playersCount = Array.isArray(match.jogadores) ? match.jogadores.length : 0;
                      const winners = Array.isArray(match.jogadores) ? match.jogadores.filter(j => j.fl_vencedor === 1 || j.fl_vencedor === ('1' as any)) : [];

                      return (
                        <div
                          key={`match-${match.id_partida}`}
                          className="glass-panel"
                          style={{
                            padding: '1rem 1.25rem',
                            borderRadius: '12px',
                            background: 'rgba(30, 41, 59, 0.55)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            transition: 'var(--transition)',
                            position: 'relative'
                          }}
                        >
                          {/* Linha Principal da Partida */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '1rem'
                          }}>
                            {/* Bloco do Jogo: Thumb + Nome + Expansões */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '240px', flex: '1 1 300px' }}>
                              {match.jogo?.thumb ? (
                                <img
                                  src={match.jogo.thumb}
                                  alt={match.jogo.nm_jogo}
                                  loading="lazy"
                                  style={{
                                    width: '54px',
                                    height: '54px',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    flexShrink: 0
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: '54px',
                                  height: '54px',
                                  borderRadius: '8px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <Dices size={24} color="var(--text-muted)" />
                                </div>
                              )}

                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                                    {match.jogo?.nm_jogo || 'Jogo Desconhecido'}
                                  </h4>
                                  {match.jogo?.link && (
                                    <a
                                      href={match.jogo.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Abrir na Ludopedia"
                                      style={{ color: 'var(--text-muted)', display: 'inline-flex' }}
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  )}
                                  {match.qt_partidas > 1 && (
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      background: 'rgba(99, 102, 241, 0.2)',
                                      color: '#a5b4fc',
                                      border: '1px solid rgba(99, 102, 241, 0.35)'
                                    }}>
                                      {match.qt_partidas}x partidas
                                    </span>
                                  )}
                                </div>

                                {hasExpansions && (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                                    {match.expansoes!.map(exp => (
                                      <span
                                        key={`exp-${exp.id_jogo}`}
                                        style={{
                                          fontSize: '0.7rem',
                                          fontWeight: 500,
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          background: 'rgba(139, 92, 246, 0.15)',
                                          color: '#c4b5fd',
                                          border: '1px solid rgba(139, 92, 246, 0.25)'
                                        }}
                                      >
                                        + {exp.nm_jogo}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Badges de Metadados: Data, Duração, Modalidade e Grupo */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              {/* Data */}
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.8rem',
                                color: '#e2e8f0',
                                background: 'rgba(255, 255, 255, 0.06)',
                                padding: '4px 8px',
                                borderRadius: '6px'
                              }}>
                                <Calendar size={13} color="#94a3b8" />
                                {formatMatchDate(match.dt_partida)}
                              </span>

                              {/* Duração */}
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.8rem',
                                color: match.duracao ? '#38bdf8' : '#94a3b8',
                                background: match.duracao ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                                border: `1px solid ${match.duracao ? 'rgba(56, 189, 248, 0.25)' : 'transparent'}`,
                                padding: '4px 8px',
                                borderRadius: '6px'
                              }}>
                                <Clock size={13} />
                                {formatPlayDuration(match.duracao)}
                              </span>

                              {/* Modalidade */}
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.78rem',
                                color: match.fl_digital === 1 ? '#ec4899' : '#10b981',
                                background: match.fl_digital === 1 ? 'rgba(236, 72, 153, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                border: `1px solid ${match.fl_digital === 1 ? 'rgba(236, 72, 153, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                                padding: '4px 8px',
                                borderRadius: '6px'
                              }}>
                                {match.fl_digital === 1 ? <Monitor size={12} /> : <Home size={12} />}
                                {match.fl_digital === 1 ? 'Digital' : 'Presencial'}
                              </span>

                              {/* Grupo */}
                              {match.grupo?.nm_grupo && (
                                <span style={{
                                  fontSize: '0.78rem',
                                  color: '#e2e8f0',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  padding: '4px 8px',
                                  borderRadius: '6px'
                                }}>
                                  🏷️ {match.grupo.nm_grupo}
                                </span>
                              )}

                              {/* Botão de Expandir / Detalhes dos Jogadores */}
                              <button
                                type="button"
                                onClick={() => setExpandedMatchId(isExpanded ? null : match.id_partida)}
                                className="btn"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Users size={13} />
                                {playersCount} {playersCount === 1 ? 'jogador' : 'jogadores'}
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* Vencedores em destaque na linha compacta */}
                          {winners.length > 0 && !isExpanded && (
                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#fcd34d' }}>
                              <Trophy size={13} color="#f59e0b" />
                              <span>Vencedor(es): <strong>{winners.map(w => w.nome).join(', ')}</strong></span>
                            </div>
                          )}

                          {/* Seção Expandida: Placar e Descrição Completa */}
                          {isExpanded && (
                            <div style={{
                              marginTop: '1rem',
                              paddingTop: '0.85rem',
                              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem'
                            }}>
                              {match.descricao && (
                                <div style={{
                                  background: 'rgba(0, 0, 0, 0.25)',
                                  padding: '0.65rem 0.85rem',
                                  borderRadius: '8px',
                                  fontSize: '0.82rem',
                                  color: '#cbd5e1',
                                  fontStyle: 'italic',
                                  borderLeft: '3px solid var(--accent)'
                                }}>
                                  "{match.descricao}"
                                </div>
                              )}

                              <div>
                                <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Jogadores & Pontuação
                                </h5>

                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                  gap: '0.65rem'
                                }}>
                                  {match.jogadores?.map(jogador => {
                                    const isWinner = jogador.fl_vencedor === 1 || jogador.fl_vencedor === ('1' as any);
                                    return (
                                      <div
                                        key={`jog-${match.id_partida}-${jogador.id_partida_jogador}-${jogador.nome}`}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '0.5rem 0.75rem',
                                          borderRadius: '8px',
                                          background: isWinner ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                          border: `1px solid ${isWinner ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.06)'}`
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                          {jogador.thumb ? (
                                            <img
                                              src={jogador.thumb}
                                              alt={jogador.nome}
                                              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                                            />
                                          ) : (
                                            <div style={{
                                              width: '28px',
                                              height: '28px',
                                              borderRadius: '50%',
                                              background: isWinner ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '0.75rem',
                                              fontWeight: 700,
                                              color: isWinner ? '#fcd34d' : '#fff'
                                            }}>
                                              {jogador.nome ? jogador.nome.charAt(0).toUpperCase() : '?'}
                                            </div>
                                          )}

                                          <div style={{ minWidth: 0 }}>
                                            <div style={{
                                              fontSize: '0.85rem',
                                              fontWeight: isWinner ? 700 : 500,
                                              color: isWinner ? '#fcd34d' : '#fff',
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis'
                                            }}>
                                              {jogador.nome}
                                            </div>
                                            {jogador.observacao && (
                                              <div style={{
                                                fontSize: '0.72rem',
                                                color: 'var(--text-muted)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                              }}>
                                                {jogador.observacao}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {jogador.vl_pontos !== null && jogador.vl_pontos !== undefined && (
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>
                                              {jogador.vl_pontos} pts
                                            </span>
                                          )}
                                          {isWinner && (
                                            <span title="Vencedor da partida" style={{ display: 'inline-flex' }}>
                                              <Trophy size={16} color="#f59e0b" />
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* Aba de Rankings & Gráficos */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
                  {/* Top 10 Jogos Mais Jogados */}
                  <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Trophy size={18} color="#10b981" />
                      Top 10 Jogos Mais Jogados
                    </h3>
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={calculatedStats.topGames} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={true} vertical={false} />
                          <XAxis type="number" stroke="rgba(255,255,255,0.5)" allowDecimals={false} />
                          <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.8)" width={120} tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value: any, _name: any, item: any) => [
                              `${value} partida(s) • ${formatPlayDuration(item.payload.minutes)}`,
                              item.payload.name
                            ]}
                            contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
                          />
                          <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Partidas por Dia da Semana */}
                  <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} color="#38bdf8" />
                      Partidas por Dia da Semana
                    </h3>
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={calculatedStats.dayData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis dataKey="day" stroke="rgba(255,255,255,0.6)" tick={{ fontSize: 12 }} />
                          <YAxis stroke="rgba(255,255,255,0.6)" allowDecimals={false} />
                          <Tooltip
                            formatter={(value: any) => [`${value} partidas`, 'Quantidade']}
                            contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
                          />
                          <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Jogadores Mais Frequentes */}
                  <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={18} color="#8b5cf6" />
                      Jogadores Mais Frequentes & Vitórias
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: '0.85rem'
                    }}>
                      {calculatedStats.topPlayers.map((player, idx) => {
                        const winRate = player.plays > 0 ? Math.round((player.wins / player.plays) * 100) : 0;
                        return (
                          <div
                            key={`top-player-${player.name}`}
                            style={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '10px',
                              padding: '0.85rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'rgba(255, 255, 255, 0.1)',
                                color: idx < 3 ? '#000' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800
                              }}>
                                {idx + 1}
                              </span>
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>{player.name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {player.plays} {player.plays === 1 ? 'partida' : 'partidas'}
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Trophy size={13} color="#f59e0b" />
                                {player.wins}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {winRate}% vitórias
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
