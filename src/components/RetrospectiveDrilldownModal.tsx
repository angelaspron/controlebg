import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Trophy,
  Clock,
  Calendar,
  Users,
  ExternalLink,
  Dices,
  Package,
  Monitor,
  Home,
  Star,
  Brain,
  Award,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import type { GameData, LudopediaMatch, RetrospectiveDrilldownData } from '../types';
import type { RetrospectiveTitleBadge } from '../utils/retrospectiveUtils';
import {
  findCollectionGameForMatch,
  parseNumericPrice,
  isGameExpansionType,
} from '../utils/retrospectiveUtils';
import { formatMatchDate, formatPlayDuration } from '../services/ludopediaService';
import '../components.css';

interface RetrospectiveDrilldownModalProps {
  data: RetrospectiveDrilldownData | null;
  allGames: GameData[];
  allBadges?: RetrospectiveTitleBadge[];
  showFinancials: boolean;
  onClose: () => void;
  onOpenGameDetails: (game: GameData) => void;
}

export function RetrospectiveDrilldownModal({
  data,
  allGames,
  allBadges = [],
  showFinancials,
  onClose,
  onOpenGameDetails,
}: RetrospectiveDrilldownModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState<'all' | 'base' | 'expansion'>('all');
  const [playedFilter, setPlayedFilter] = useState<'all' | 'played' | 'unplayed'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'rating' | 'weight' | 'spend' | 'year' | 'plays'>('default');
  const [modalityFilter, setModalityFilter] = useState<'all' | 'presencial' | 'digital'>('all');

  const filteredGames = useMemo(() => {
    if (!data || data.kind !== 'games' || !data.games) return [];
    const term = searchTerm.trim().toLowerCase();

    const list = data.games.filter(g => {
      if (term) {
        const nameMatch = (g.name || '').toLowerCase().includes(term) || (g.namePt || '').toLowerCase().includes(term);
        const designerMatch = (g.designers || []).some(d => d.toLowerCase().includes(term));
        if (!nameMatch && !designerMatch) return false;
      }
      if (gameTypeFilter === 'base' && isGameExpansionType(g)) return false;
      if (gameTypeFilter === 'expansion' && !isGameExpansionType(g)) return false;
      if (playedFilter === 'played' && !g.isPlayed) return false;
      if (playedFilter === 'unplayed' && g.isPlayed) return false;
      return true;
    });

    if (sortBy === 'default') return list;

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'rating':
          return (b.rating || b.ludoRating || 0) - (a.rating || a.ludoRating || 0);
        case 'weight':
          return (b.weight || 0) - (a.weight || 0);
        case 'spend':
          return parseNumericPrice(b.spend) - parseNumericPrice(a.spend);
        case 'year':
          return (b.yearPublished || 0) - (a.yearPublished || 0);
        case 'plays':
          return (b.playCount || 0) - (a.playCount || 0);
        default:
          return 0;
      }
    });
  }, [data, searchTerm, gameTypeFilter, playedFilter, sortBy]);

  const filteredMatches = useMemo(() => {
    if (!data || data.kind !== 'matches' || !data.matches) return [];
    const term = searchTerm.trim().toLowerCase();

    return [...data.matches]
      .filter(m => {
        if (modalityFilter === 'presencial' && m.fl_digital === 1) return false;
        if (modalityFilter === 'digital' && m.fl_digital !== 1) return false;
        if (term) {
          const gMatch = (m.jogo?.nm_jogo || '').toLowerCase().includes(term);
          const pMatch = (m.jogadores || []).some(j => (j.nome || '').toLowerCase().includes(term));
          const grpMatch = (m.grupo?.nm_grupo || '').toLowerCase().includes(term);
          const descMatch = (m.descricao || '').toLowerCase().includes(term);
          if (!gMatch && !pMatch && !grpMatch && !descMatch) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.dt_partida || '').localeCompare(String(a.dt_partida || '')));
  }, [data, searchTerm, modalityFilter]);

  if (!data) return null;

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const modalContent = (
    <div className="modal-overlay plays-modal-overlay retro-modal-overlay" onClick={onClose}>
      <div
        className="glass-panel plays-modal-container animate-fade-in"
        style={{ maxWidth: '1040px', height: '88vh', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="plays-modal-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                {data.title}
              </h2>
              {data.kind === 'games' && data.games && (
                <span className="retro-count-pill" style={{ background: data.accentColor || 'var(--accent)' }}>
                  {data.games.length} {data.games.length === 1 ? 'jogo' : 'jogos'}
                </span>
              )}
              {data.kind === 'matches' && data.matches && (
                <span className="retro-count-pill" style={{ background: data.accentColor || '#10b981' }}>
                  {data.matches.reduce((s, m) => s + Math.max(1, Number(m.qt_partidas || 1)), 0)} partidas
                </span>
              )}
            </div>
            {data.subtitle && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {data.subtitle}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {data.externalLinks?.map((lnk, idx) => (
              <a
                key={idx}
                href={lnk.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
              >
                <ExternalLink size={13} />
                {lnk.label}
              </a>
            ))}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Resumo de estatísticas extras / Cabeçalho do Jogador */}
        {(data.extraStats?.length || data.playerHeader) && (
          <div style={{
            padding: '0.85rem 1.5rem',
            background: 'rgba(0,0,0,0.22)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            flexShrink: 0,
          }}>
            {data.playerHeader && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  {data.playerHeader.thumb ? (
                    <img
                      src={data.playerHeader.thumb}
                      alt={data.playerHeader.name}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(99, 102, 241, 0.5)' }}
                    />
                  ) : (
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '1.15rem', color: '#fff',
                    }}>
                      {data.playerHeader.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{data.playerHeader.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {data.playerHeader.totalPlays} partidas juntos • {data.playerHeader.totalHours.toFixed(1).replace('.', ',')}h na mesa
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div className="retro-mini-pill">
                    <span>🏆 Suas vitórias juntos:</span>
                    <strong style={{ color: '#10b981' }}>{data.playerHeader.userWinsWithPlayer}</strong>
                  </div>
                  <div className="retro-mini-pill">
                    <span>👑 Vitórias de {data.playerHeader.name}:</span>
                    <strong style={{ color: '#fbbf24' }}>{data.playerHeader.playerWins}</strong>
                  </div>
                </div>
              </div>
            )}

            {data.extraStats && data.extraStats.length > 0 && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {data.extraStats.map((st, idx) => (
                  <div key={idx} className="retro-mini-pill">
                    <span>{st.label}:</span>
                    <strong style={{ color: st.color || '#f8fafc' }}>{st.value}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filtros de busca */}
        {data.kind !== 'titles' && (
          <div className="plays-filters-bar">
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="search-input"
                placeholder={data.kind === 'games' ? 'Filtrar por nome ou designer...' : 'Filtrar por jogo, jogador ou local...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.2rem', width: '100%', height: '34px', fontSize: '0.84rem' }}
              />
            </div>

            {data.kind === 'games' ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="search-input"
                  value={gameTypeFilter}
                  onChange={e => setGameTypeFilter(e.target.value as any)}
                  style={{ height: '34px', fontSize: '0.82rem', minWidth: '120px' }}
                >
                  <option value="all">Todos Tipos</option>
                  <option value="base">Apenas Base</option>
                  <option value="expansion">Apenas Expansões</option>
                </select>
                <select
                  className="search-input"
                  value={playedFilter}
                  onChange={e => setPlayedFilter(e.target.value as any)}
                  style={{ height: '34px', fontSize: '0.82rem', minWidth: '125px' }}
                >
                  <option value="all">Jogados e Não Jogados</option>
                  <option value="played">Já Jogados</option>
                  <option value="unplayed">Esperam Estreia</option>
                </select>
                <select
                  className="search-input"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  style={{ height: '34px', fontSize: '0.82rem', minWidth: '135px' }}
                >
                  <option value="default">Ordem Original</option>
                  <option value="name">Nome (A-Z)</option>
                  <option value="plays">Mais Partidas</option>
                  <option value="rating">Maior Nota</option>
                  <option value="weight">Maior Peso</option>
                  <option value="spend">Maior Valor Pago</option>
                  <option value="year">Ano de Lançamento</option>
                </select>
              </div>
            ) : (
              <select
                className="search-input"
                value={modalityFilter}
                onChange={e => setModalityFilter(e.target.value as any)}
                style={{ height: '34px', fontSize: '0.82rem', minWidth: '135px' }}
              >
                <option value="all">Presencial & Digital</option>
                <option value="presencial">Presencial</option>
                <option value="digital">Digital</option>
              </select>
            )}
          </div>
        )}

        {/* Conteúdo Scrollable */}
        <div className="plays-modal-scrollable" style={{ padding: '1.25rem 1.5rem' }}>
          {data.kind === 'titles' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                O <strong>Título do Ano</strong> resume o perfil da sua coleção e jogatinas no período selecionado. Cada conquista abaixo é calculada automaticamente a partir dos seus jogos e partidas registradas:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.9rem' }}>
                {allBadges.map(badge => (
                  <div
                    key={badge.id}
                    style={{
                      padding: '1rem 1.15rem',
                      borderRadius: '12px',
                      background: badge.earned ? `${badge.accent}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${badge.earned ? `${badge.accent}55` : 'rgba(255,255,255,0.08)'}`,
                      opacity: badge.earned ? 1 : 0.65,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: badge.earned ? '#fff' : 'var(--text-muted)' }}>
                        {badge.title}
                      </span>
                      {badge.earned ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: badge.accent, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> Conquistado
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                          Não atingido
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#e2e8f0' }}>{badge.subtitle}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Critério: {badge.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : data.kind === 'games' ? (
            filteredGames.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <Package size={40} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
                <p style={{ margin: 0 }}>Nenhum jogo encontrado para este filtro.</p>
              </div>
            ) : (
              <div className="retro-drilldown-games-grid">
                {filteredGames.map(game => {
                  const spendNum = parseNumericPrice(game.spend);
                  const isExp = isGameExpansionType(game);
                  const ratingVal = game.rating || game.ludoRating;
                  return (
                    <div
                      key={game.id}
                      onClick={() => onOpenGameDetails(game)}
                      className="retro-drilldown-game-card"
                      title="Clique para abrir a ficha completa do jogo"
                    >
                      <div className="retro-drilldown-thumb">
                        {(game.thumbnail || game.image) ? (
                          <img src={game.thumbnail || game.image} alt={game.name} loading="lazy" />
                        ) : (
                          <Dices size={24} color="var(--text-muted)" />
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.25 }}>
                            {game.name}
                          </h4>
                          <span className={`game-type ${isExp ? 'expansion' : 'base'}`} style={{ fontSize: '0.68rem', flexShrink: 0 }}>
                            {game.type || 'Base'}
                          </span>
                        </div>

                        {game.designers && game.designers.length > 0 && (
                          <div style={{ fontSize: '0.77rem', color: '#a5b4fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            ✏️ {game.designers.join(', ')}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                          {game.yearPublished && <span>📅 {game.yearPublished}</span>}
                          {ratingVal !== undefined && ratingVal > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#fbbf24' }}>
                              <Star size={11} fill="#fbbf24" /> {ratingVal.toFixed(1)}
                            </span>
                          )}
                          {game.weight !== undefined && game.weight > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#c084fc' }}>
                              <Brain size={11} /> {game.weight.toFixed(2)}
                            </span>
                          )}
                          {game.rank && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#34d399' }}>
                              <Award size={11} /> #{game.rank}
                            </span>
                          )}
                          {game.isPlayed ? (
                            <span style={{ color: '#34d399', fontWeight: 600 }}>
                              🎲 {game.playCount && game.playCount > 0 ? `${game.playCount}x` : 'Jogado'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>⏳ Não jogado</span>
                          )}
                          {showFinancials && spendNum > 0 && (
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                              {formatBRL(spendNum)}
                            </span>
                          )}
                          {game.acquiredAt && game.acquiredAt !== 'legacy' && (
                            <span>• Entrada: {game.acquiredAt.split('-').reverse().join('/')}</span>
                          )}
                          {game.soldAt && game.soldAt !== 'legacy' && (
                            <span style={{ color: '#fca5a5' }}>• Saída: {game.soldAt.split('-').reverse().join('/')}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ alignSelf: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                        <Eye size={16} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredMatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Dices size={40} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0 }}>Nenhuma partida encontrada para este filtro.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredMatches.map((match: LudopediaMatch) => {
                const collectionGame = findCollectionGameForMatch(match.jogo, allGames);
                const winners = (match.jogadores || []).filter(j => Number(j.fl_vencedor) === 1);
                return (
                  <div key={`drill-m-${match.id_partida}`} className="retro-drilldown-match-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 240px' }}>
                        {match.jogo?.thumb ? (
                          <img
                            src={match.jogo.thumb}
                            alt={match.jogo.nm_jogo}
                            style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: '46px', height: '46px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Dices size={20} color="var(--text-muted)" />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.96rem', color: '#f8fafc' }}>
                              {match.jogo?.nm_jogo || 'Jogo Desconhecido'}
                            </strong>
                            {match.qt_partidas > 1 && (
                              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '5px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontWeight: 700 }}>
                                {match.qt_partidas}x
                              </span>
                            )}
                          </div>
                          {Array.isArray(match.expansoes) && match.expansoes.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                              {match.expansoes.map(exp => (
                                <span key={exp.id_jogo} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(139,92,246,0.16)', color: '#c4b5fd' }}>
                                  + {exp.nm_jogo}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span className="retro-mini-pill">
                          <Calendar size={12} /> {formatMatchDate(match.dt_partida)}
                        </span>
                        <span className="retro-mini-pill" style={{ color: match.duracao ? '#38bdf8' : 'var(--text-muted)' }}>
                          <Clock size={12} /> {formatPlayDuration(match.duracao)}
                        </span>
                        <span className="retro-mini-pill" style={{ color: match.fl_digital === 1 ? '#ec4899' : '#10b981' }}>
                          {match.fl_digital === 1 ? <Monitor size={11} /> : <Home size={11} />}
                          {match.fl_digital === 1 ? 'Digital' : 'Presencial'}
                        </span>
                        {collectionGame && (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => onOpenGameDetails(collectionGame)}
                            style={{ padding: '0.28rem 0.6rem', fontSize: '0.74rem' }}
                          >
                            <Eye size={12} /> Ver na Coleção
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Jogadores e Vencedores */}
                    {Array.isArray(match.jogadores) && match.jogadores.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.65rem', paddingTop: '0.55rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <Users size={13} color="var(--text-muted)" />
                        {match.jogadores.map((j, idx) => {
                          const won = Number(j.fl_vencedor) === 1;
                          return (
                            <span
                              key={`${match.id_partida}-${j.id_partida_jogador}-${idx}`}
                              style={{
                                fontSize: '0.76rem',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                background: won ? 'rgba(245, 158, 11, 0.16)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${won ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                                color: won ? '#fcd34d' : '#cbd5e1',
                                fontWeight: won ? 700 : 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {won && <Trophy size={11} color="#f59e0b" />}
                              {j.nome}
                              {j.vl_pontos !== null && j.vl_pontos !== undefined ? ` (${j.vl_pontos})` : ''}
                            </span>
                          );
                        })}
                        {winners.length === 0 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            (sem vencedor marcado)
                          </span>
                        )}
                      </div>
                    )}

                    {match.descricao && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "{match.descricao}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
