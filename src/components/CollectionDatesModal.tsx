import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Calendar, Check, ClipboardList, CheckCircle2, AlertCircle } from 'lucide-react';
import type { GameData } from '../types';
import { matchesGameName, normalizeGameName } from '../utils/nameMatcher';
import { isGameSoldStatus } from '../utils/retrospectiveUtils';
import '../components.css';

interface CollectionDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: GameData[];
  defaultYear: number;
  onApplyBatchPatches: (updatesById: Record<string, Partial<GameData>>) => void;
}

export function CollectionDatesModal({
  isOpen,
  onClose,
  games,
  defaultYear,
  onApplyBatchPatches,
}: CollectionDatesModalProps) {
  const [activeTab, setActiveTab] = useState<'select' | 'paste'>('select');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'owned' | 'sold' | 'undated'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estado para ação em lote
  const [bulkYear, setBulkYear] = useState<string>(String(defaultYear));
  const [bulkAction, setBulkAction] = useState<'acquired' | 'sold'>('acquired');

  // Estado para colar lista
  const [pastedText, setPastedText] = useState('');
  const [pasteTargetYear, setPasteTargetYear] = useState<string>(String(defaultYear));
  const [pasteTargetField, setPasteTargetField] = useState<'acquired' | 'sold'>('acquired');
  const [markRemainingLegacy, setMarkRemainingLegacy] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const filteredGames = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return games
      .filter(g => {
        if (term && !g.name.toLowerCase().includes(term) && !(g.namePt || '').toLowerCase().includes(term)) {
          return false;
        }
        if (statusFilter === 'owned' && isGameSoldStatus(g)) return false;
        if (statusFilter === 'sold' && !isGameSoldStatus(g)) return false;
        if (statusFilter === 'undated' && (g.acquiredAt || g.soldAt)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [games, searchTerm, statusFilter]);

  // Pré-visualização do parser de lista colada
  const pastePreview = useMemo(() => {
    const lines = pastedText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const matched: { line: string; game: GameData }[] = [];
    const unmatched: string[] = [];
    const matchedIds = new Set<string>();

    for (const line of lines) {
      const norm = normalizeGameName(line);
      if (!norm) continue;

      const found =
        games.find(g => normalizeGameName(g.name) === norm || (g.namePt && normalizeGameName(g.namePt) === norm)) ||
        games.find(g => matchesGameName(g.name, line) || (g.namePt && matchesGameName(g.namePt, line))) ||
        games.find(g => normalizeGameName(g.name).includes(norm) && norm.length >= 4);

      if (found) {
        if (!matchedIds.has(found.id)) {
          matchedIds.add(found.id);
          matched.push({ line, game: found });
        }
      } else {
        unmatched.push(line);
      }
    }

    return { matched, unmatched, totalLines: lines.length };
  }, [pastedText, games]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplySelectedBulk = () => {
    if (selectedIds.size === 0) return;
    const dateVal = bulkYear === 'legacy' ? 'legacy' : `${bulkYear}-01-01`;
    const patches: Record<string, Partial<GameData>> = {};

    selectedIds.forEach(id => {
      patches[id] = bulkAction === 'acquired' ? { acquiredAt: dateVal } : { soldAt: dateVal };
    });

    onApplyBatchPatches(patches);
    setFeedbackMsg(`${selectedIds.size} jogo(s) atualizado(s)!`);
    setSelectedIds(new Set());
  };

  const handleMarkUndatedAsLegacy = () => {
    const patches: Record<string, Partial<GameData>> = {};
    let count = 0;
    for (const g of games) {
      if (!g.acquiredAt && !isGameSoldStatus(g)) {
        patches[g.id] = { acquiredAt: 'legacy' };
        count++;
      } else if (isGameSoldStatus(g) && !g.soldAt) {
        patches[g.id] = { ...(g.acquiredAt ? {} : { acquiredAt: 'legacy' }), soldAt: 'legacy' };
        count++;
      }
    }
    if (count > 0) {
      onApplyBatchPatches(patches);
      setFeedbackMsg(`${count} jogo(s) sem data marcado(s) como Anterior (Legacy).`);
    } else {
      setFeedbackMsg('Todos os jogos já possuem data ou classificação definida.');
    }
  };

  const handleApplyPaste = () => {
    if (pastePreview.matched.length === 0) return;
    const dateVal = `${pasteTargetYear}-01-01`;
    const patches: Record<string, Partial<GameData>> = {};
    const matchedIds = new Set(pastePreview.matched.map(m => m.game.id));

    for (const m of pastePreview.matched) {
      patches[m.game.id] = pasteTargetField === 'acquired' ? { acquiredAt: dateVal } : { soldAt: dateVal };
    }

    if (markRemainingLegacy) {
      for (const g of games) {
        if (matchedIds.has(g.id)) continue;
        if (pasteTargetField === 'acquired' && !g.acquiredAt) {
          patches[g.id] = { acquiredAt: 'legacy' };
        } else if (pasteTargetField === 'sold' && isGameSoldStatus(g) && !g.soldAt) {
          patches[g.id] = { soldAt: 'legacy' };
        }
      }
    }

    onApplyBatchPatches(patches);
    setFeedbackMsg(
      `${pastePreview.matched.length} jogo(s) marcado(s) como ${
        pasteTargetField === 'acquired' ? `entrada em ${pasteTargetYear}` : `saída em ${pasteTargetYear}`
      }!`
    );
    setPastedText('');
  };

  const handleInlineDateChange = (game: GameData, field: 'acquiredAt' | 'soldAt', val: string) => {
    onApplyBatchPatches({
      [game.id]: { [field]: val || undefined },
    });
  };

  const yearOptions = [
    String(defaultYear),
    String(defaultYear - 1),
    String(defaultYear - 2),
    String(defaultYear - 3),
    String(defaultYear - 4),
  ];

  const modalContent = (
    <div className="modal-overlay plays-modal-overlay retro-modal-overlay" onClick={onClose}>
      <div
        className="glass-panel plays-modal-container animate-fade-in"
        style={{ maxWidth: '980px', height: '88vh', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="plays-modal-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} color="#818cf8" />
              Organizar Datas de Entrada e Saída da Coleção
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Defina rapidamente em qual ano cada jogo entrou ou saiu da sua estante para deixar a Retrospectiva 100% fiel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Abas */}
        <div className="plays-tabs-bar">
          <div className="tabs-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => { setActiveTab('select'); setFeedbackMsg(null); }}
              className="btn"
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.84rem',
                border: 'none',
                background: activeTab === 'select' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'select' ? '#fff' : 'var(--text-muted)',
              }}
            >
              <Check size={15} /> Seleção Rápida & Datas Individuais
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('paste'); setFeedbackMsg(null); }}
              className="btn"
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.84rem',
                border: 'none',
                background: activeTab === 'paste' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'paste' ? '#fff' : 'var(--text-muted)',
              }}
            >
              <ClipboardList size={15} /> Colar Lista de Jogos
            </button>
          </div>

          <button
            type="button"
            className="btn"
            onClick={handleMarkUndatedAsLegacy}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fcd34d' }}
            title="Classifica jogos ainda sem data como anteriores ao período atual, evitando que apareçam no ano corrente"
          >
            Marcar sem data como Anteriores
          </button>
        </div>

        {feedbackMsg && (
          <div style={{
            margin: '0.75rem 1.5rem 0',
            padding: '0.65rem 1rem',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <CheckCircle2 size={16} />
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="plays-modal-scrollable" style={{ padding: '1rem 1.5rem' }}>
          {activeTab === 'select' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Barra de filtro e ações em lote */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Buscar jogo..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '2.2rem', width: '100%', height: '36px', fontSize: '0.84rem' }}
                  />
                </div>
                <select
                  className="search-input"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  style={{ height: '36px', fontSize: '0.82rem', minWidth: '150px' }}
                >
                  <option value="all">Todos ({games.length})</option>
                  <option value="owned">Na Coleção</option>
                  <option value="sold">Vendidos / Saíram</option>
                  <option value="undated">Sem Data Definida</option>
                </select>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSelectedIds(new Set(filteredGames.map(g => g.id)))}
                  style={{ height: '36px', fontSize: '0.8rem', padding: '0 0.75rem' }}
                >
                  Selecionar visíveis
                </button>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedIds(new Set())}
                    style={{ height: '36px', fontSize: '0.8rem', padding: '0 0.75rem' }}
                  >
                    Limpar ({selectedIds.size})
                  </button>
                )}
              </div>

              {selectedIds.size > 0 && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.14)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}>
                  <strong style={{ fontSize: '0.86rem', color: '#c7d2fe' }}>
                    {selectedIds.size} jogo(s) selecionado(s):
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select
                      className="search-input"
                      value={bulkAction}
                      onChange={e => setBulkAction(e.target.value as any)}
                      style={{ height: '34px', fontSize: '0.82rem' }}
                    >
                      <option value="acquired">Entrou na coleção em</option>
                      <option value="sold">Saiu da coleção em</option>
                    </select>
                    <select
                      className="search-input"
                      value={bulkYear}
                      onChange={e => setBulkYear(e.target.value)}
                      style={{ height: '34px', fontSize: '0.82rem' }}
                    >
                      {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                      <option value="legacy">Anterior / Legacy</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleApplySelectedBulk}
                      style={{ height: '34px', fontSize: '0.82rem', padding: '0 0.9rem' }}
                    >
                      Aplicar em Lote
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de jogos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {filteredGames.map(game => {
                  const isSel = selectedIds.has(game.id);
                  const isSold = isGameSoldStatus(game);
                  return (
                    <div
                      key={game.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '10px',
                        background: isSel ? 'rgba(99, 102, 241, 0.14)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSel ? 'rgba(99, 102, 241, 0.45)' : 'rgba(255,255,255,0.07)'}`,
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', flex: '1 1 240px', minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(game.id)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                        />
                        {game.thumbnail && (
                          <img src={game.thumbnail} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {game.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {game.status} • {game.type || 'Base'}
                            {game.acquiredAt === 'legacy' && ' • Anterior (Legacy)'}
                          </div>
                        </div>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Entrada:</span>
                          <input
                            type="date"
                            value={game.acquiredAt && game.acquiredAt !== 'legacy' ? game.acquiredAt : ''}
                            onChange={e => handleInlineDateChange(game, 'acquiredAt', e.target.value)}
                            className="search-input"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.76rem', width: '132px' }}
                          />
                        </label>
                        {isSold && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#fca5a5' }}>
                            <span>Saída:</span>
                            <input
                              type="date"
                              value={game.soldAt && game.soldAt !== 'legacy' ? game.soldAt : ''}
                              onChange={e => handleInlineDateChange(game, 'soldAt', e.target.value)}
                              className="search-input"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.76rem', width: '132px' }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Tab 2: Colar Lista de Jogos */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Cole os nomes dos jogos que <strong>entraram</strong> ou <strong>saíram</strong> da sua coleção em determinado ano (um por linha ou separados por vírgula). O sistema faz a correspondência automática com sua coleção!
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="search-input"
                  value={pasteTargetField}
                  onChange={e => setPasteTargetField(e.target.value as any)}
                  style={{ height: '38px', fontSize: '0.85rem' }}
                >
                  <option value="acquired">Entraram na coleção em:</option>
                  <option value="sold">Saíram da coleção em:</option>
                </select>
                <select
                  className="search-input"
                  value={pasteTargetYear}
                  onChange={e => setPasteTargetYear(e.target.value)}
                  style={{ height: '38px', fontSize: '0.85rem' }}
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={markRemainingLegacy}
                    onChange={e => setMarkRemainingLegacy(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Marcar demais jogos sem data como anteriores a {pasteTargetYear}
                </label>
              </div>

              <textarea
                rows={7}
                className="search-input"
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder={'Twilight Struggle\nAnachrony\nThe White Castle\nShackleton Base\n...'}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.5, resize: 'vertical' }}
              />

              {pastePreview.totalLines > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#34d399', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={15} /> Encontrados na coleção ({pastePreview.matched.length})
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#e2e8f0' }}>
                      {pastePreview.matched.map(m => (
                        <div key={m.game.id}>• {m.game.name}</div>
                      ))}
                    </div>
                  </div>

                  {pastePreview.unmatched.length > 0 && (
                    <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#fcd34d', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={15} /> Não encontrados ({pastePreview.unmatched.length})
                      </div>
                      <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#fde68a' }}>
                        {pastePreview.unmatched.map((u, idx) => (
                          <div key={idx}>• {u}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={pastePreview.matched.length === 0}
                  onClick={handleApplyPaste}
                >
                  Aplicar em {pastePreview.matched.length} Jogo(s)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
