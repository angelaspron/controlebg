import React, { useState, useEffect } from 'react';
import { X, Users, Star, Brain, Trophy, Calendar, ExternalLink, Pencil, Tag, Clock, Award, ShieldCheck, RefreshCw, Loader2, Layers, Check, Plus, Trash2 } from 'lucide-react';
import type { GameData, CardSleeveSet, GameSleeveUsage } from '../types';
import { KNOWN_SLEEVE_BRANDS, POPULAR_SLEEVE_MODELS, SLEEVE_SUBTYPES, formatCardSleeveDimensions, parseModelDimensions, summarizeGameSleeves } from '../utils/sleeveUtils';
import '../components.css';

interface GameDetailsModalProps {
  game: GameData | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (game: GameData) => void;
  onRefresh?: (game: GameData) => Promise<void> | void;
  onSaveSleeveInfo?: (
    gameId: string, 
    info: { 
      isSleeved: boolean; 
      sleeveBrand?: string; 
      sleeveType?: string;
      cardSleeves?: { source?: string; sourceUrl?: string; sets: CardSleeveSet[]; noCards?: boolean };
      sleevesUsed?: GameSleeveUsage[];
      noCards?: boolean;
    }
  ) => void;
  isUpdating?: boolean;
}

interface LocalSleeveSetItem {
  id: string;
  name?: string;
  quantity: number;
  width: number;
  height: number;
  sizeName: string;
  sleeveProductName?: string;
  isSleeved: boolean;
  brand: string;
  isCustomBrand: boolean;
  customBrand: string;
  type: string;
  isCustomAdded?: boolean;
  isCustomModel?: boolean;
  customModel?: string;
}

export function GameDetailsModal({ game, isOpen, onClose, onEdit, onRefresh, onSaveSleeveInfo, isUpdating }: GameDetailsModalProps) {
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);

  // Estados locais para controle de múltiplos tipos de sleeves deste jogo
  const [localSets, setLocalSets] = useState<LocalSleeveSetItem[]>([]);
  const [noCards, setNoCards] = useState(false);
  const [hasSleeveChanges, setHasSleeveChanges] = useState(false);
  const [sleeveSavedFeedback, setSleeveSavedFeedback] = useState(false);

  useEffect(() => {
    if (!game) return;

    const items: LocalSleeveSetItem[] = [];

    // 1. Carregar conjuntos do Compara Jogos
    if (game.cardSleeves?.sets && game.cardSleeves.sets.length > 0) {
      game.cardSleeves.sets.forEach((set, idx) => {
        const setBrand = set.sleeveBrand || (game.isSleeved ? (game.sleeveBrand || '') : '');
        const isKnown = KNOWN_SLEEVE_BRANDS.some(b => b.toLowerCase() === setBrand.toLowerCase());
        const setSleeved = set.isSleeved !== undefined ? Boolean(set.isSleeved) : Boolean(game.isSleeved);

        const matchingPopularModel = POPULAR_SLEEVE_MODELS.find(m => {
          const parsed = parseModelDimensions(m);
          return (
            (set.sizeName && parsed.sizeName.toLowerCase() === set.sizeName.toLowerCase()) ||
            (Math.abs(set.width - parsed.width) <= 0.6 && Math.abs(set.height - parsed.height) <= 1.2)
          );
        });
        const isCustomModel = !matchingPopularModel;
        const customModel = isCustomModel
          ? (set.sizeName ? `${set.sizeName} (${formatCardSleeveDimensions(set.width, set.height)})` : formatCardSleeveDimensions(set.width, set.height))
          : '';

        items.push({
          id: `set-${idx}-${set.width}-${set.height}`,
          name: set.name,
          quantity: set.quantity,
          width: set.width,
          height: set.height,
          sizeName: set.sizeName || 'Padrão',
          sleeveProductName: set.sleeveProductName,
          isSleeved: setSleeved,
          brand: isKnown ? setBrand : (setBrand ? '__other__' : ''),
          isCustomBrand: Boolean(setBrand && !isKnown),
          customBrand: isKnown ? '' : setBrand,
          type: set.sleeveType || (game.isSleeved ? (game.sleeveType || '') : ''),
          isCustomAdded: false,
          isCustomModel,
          customModel,
        });
      });
    }

    // 2. Carregar sleeves adicionais configurados manualmente pelo usuário
    if (game.sleevesUsed && game.sleevesUsed.length > 0) {
      game.sleevesUsed.forEach((su, idx) => {
        // Evitar duplicar caso o ID já coincida com um set existente
        if (items.some(it => it.id === su.id)) return;

        const suBrand = su.sleeveBrand || '';
        const isKnown = KNOWN_SLEEVE_BRANDS.some(b => b.toLowerCase() === suBrand.toLowerCase());
        const parsedDim = parseModelDimensions(su.dimensions || su.sizeName);
        const finalWidth = su.width || parsedDim.width;
        const finalHeight = su.height || parsedDim.height;

        const matchingPopularModel = POPULAR_SLEEVE_MODELS.find(m => {
          const parsed = parseModelDimensions(m);
          return (
            (su.sizeName && parsed.sizeName.toLowerCase() === su.sizeName.toLowerCase()) ||
            (Math.abs(finalWidth - parsed.width) <= 0.6 && Math.abs(finalHeight - parsed.height) <= 1.2)
          );
        });
        const isCustomModel = !matchingPopularModel;
        const customModel = isCustomModel
          ? (su.dimensions || `${su.sizeName} (${formatCardSleeveDimensions(finalWidth, finalHeight)})`)
          : '';

        items.push({
          id: su.id || `custom-${idx}-${Date.now()}`,
          name: su.sizeName,
          quantity: su.quantity || 0,
          width: finalWidth,
          height: finalHeight,
          sizeName: su.sizeName,
          isSleeved: Boolean(su.isSleeved),
          brand: isKnown ? suBrand : (suBrand ? '__other__' : ''),
          isCustomBrand: Boolean(suBrand && !isKnown),
          customBrand: isKnown ? '' : suBrand,
          type: su.sleeveType || '',
          isCustomAdded: true,
          isCustomModel,
          customModel,
        });
      });
    }

    setLocalSets(items);
    setNoCards(Boolean(game.noCards));
    setHasSleeveChanges(false);
    setSleeveSavedFeedback(false);
  }, [game]);

  if (!isOpen || !game) return null;

  const handleToggleSetSleeved = (id: string) => {
    setLocalSets(prev =>
      prev.map(item => (item.id === id ? { ...item, isSleeved: !item.isSleeved } : item))
    );
    setHasSleeveChanges(true);
  };

  const handleChangeBrand = (id: string, brandVal: string) => {
    setLocalSets(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (brandVal === '__other__') {
          return { ...item, brand: '__other__', isCustomBrand: true };
        }
        return { ...item, brand: brandVal, isCustomBrand: false, customBrand: '' };
      })
    );
    setHasSleeveChanges(true);
  };

  const handleChangeCustomBrand = (id: string, customVal: string) => {
    setLocalSets(prev =>
      prev.map(item => (item.id === id ? { ...item, customBrand: customVal } : item))
    );
    setHasSleeveChanges(true);
  };

  const handleChangeType = (id: string, typeVal: string) => {
    setLocalSets(prev =>
      prev.map(item => (item.id === id ? { ...item, type: typeVal } : item))
    );
    setHasSleeveChanges(true);
  };

  const handleChangeModel = (id: string, modelStr: string) => {
    if (modelStr === '__other__') {
      setLocalSets(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                isCustomModel: true,
                customModel: item.customModel || (item.sizeName ? `${item.sizeName} (${formatCardSleeveDimensions(item.width, item.height)})` : formatCardSleeveDimensions(item.width, item.height)),
              }
            : item
        )
      );
      setHasSleeveChanges(true);
      return;
    }

    const dim = parseModelDimensions(modelStr);
    setLocalSets(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              sizeName: dim.sizeName,
              width: dim.width,
              height: dim.height,
              isCustomModel: false,
              customModel: '',
            }
          : item
      )
    );
    setHasSleeveChanges(true);
  };

  const handleChangeCustomModel = (id: string, customVal: string) => {
    const dim = parseModelDimensions(customVal);
    setLocalSets(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const hasNumbers = /(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)/.test(customVal);
        return {
          ...item,
          customModel: customVal,
          sizeName: dim.sizeName || customVal.trim() || 'Especial',
          width: hasNumbers ? dim.width : item.width,
          height: hasNumbers ? dim.height : item.height,
        };
      })
    );
    setHasSleeveChanges(true);
  };

  const handleChangeDimensions = (id: string, width: number, height: number) => {
    setLocalSets(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const formatted = formatCardSleeveDimensions(width, height);
        return {
          ...item,
          width,
          height,
          customModel: item.sizeName ? `${item.sizeName} (${formatted})` : formatted,
        };
      })
    );
    setHasSleeveChanges(true);
  };

  const handleChangeQuantity = (id: string, qty: number) => {
    setLocalSets(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity: Math.max(0, qty) } : item))
    );
    setHasSleeveChanges(true);
  };

  const handleAddNewSleeveRow = () => {
    const defaultModel = POPULAR_SLEEVE_MODELS[0];
    const dim = parseModelDimensions(defaultModel);
    const newRow: LocalSleeveSetItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: 'Cartas adicionais',
      quantity: 50,
      width: dim.width,
      height: dim.height,
      sizeName: dim.sizeName,
      isSleeved: true,
      brand: KNOWN_SLEEVE_BRANDS[0],
      isCustomBrand: false,
      customBrand: '',
      type: 'Normal',
      isCustomAdded: true,
      isCustomModel: false,
      customModel: '',
    };
    setLocalSets(prev => [...prev, newRow]);
    setHasSleeveChanges(true);
  };

  const handleRemoveSleeveRow = (id: string) => {
    setLocalSets(prev => prev.filter(item => item.id !== id));
    setHasSleeveChanges(true);
  };

  const handleSaveSleeve = () => {
    if (!game || !onSaveSleeveInfo) return;

    const updatedSets: CardSleeveSet[] = localSets.map(row => {
      const finalBrand = row.isCustomBrand ? row.customBrand.trim() : row.brand.trim();
      let finalSizeName = row.sizeName;
      let finalWidth = row.width;
      let finalHeight = row.height;
      if (row.isCustomModel && row.customModel) {
        const parsed = parseModelDimensions(row.customModel);
        finalSizeName = parsed.sizeName || row.sizeName;
        if (row.width) finalWidth = row.width;
        else finalWidth = parsed.width;
        if (row.height) finalHeight = row.height;
        else finalHeight = parsed.height;
      }

      return {
        name: row.name,
        quantity: row.quantity,
        width: finalWidth,
        height: finalHeight,
        sizeName: finalSizeName,
        sleeveProductName: row.sleeveProductName,
        isSleeved: row.isSleeved,
        sleeveBrand: finalBrand || undefined,
        sleeveType: row.type.trim() || undefined,
      };
    });

    const sleevesUsed: GameSleeveUsage[] = localSets.map(row => {
      const finalBrand = row.isCustomBrand ? row.customBrand.trim() : row.brand.trim();
      let finalSizeName = row.sizeName;
      let finalWidth = row.width;
      let finalHeight = row.height;
      if (row.isCustomModel && row.customModel) {
        const parsed = parseModelDimensions(row.customModel);
        finalSizeName = parsed.sizeName || row.sizeName;
        if (row.width) finalWidth = row.width;
        else finalWidth = parsed.width;
        if (row.height) finalHeight = row.height;
        else finalHeight = parsed.height;
      }

      return {
        id: row.id,
        sizeName: finalSizeName,
        dimensions: formatCardSleeveDimensions(finalWidth, finalHeight),
        width: finalWidth,
        height: finalHeight,
        quantity: row.quantity,
        isSleeved: row.isSleeved,
        sleeveBrand: finalBrand || undefined,
        sleeveType: row.type.trim() || undefined,
      };
    });

    const summary = summarizeGameSleeves(updatedSets);

    onSaveSleeveInfo(game.id, {
      isSleeved: summary.isSleeved,
      sleeveBrand: summary.sleeveBrand,
      sleeveType: summary.sleeveType,
      cardSleeves: {
        source: game.cardSleeves?.source || 'Compara Jogos',
        sourceUrl: game.cardSleeves?.sourceUrl,
        sets: updatedSets,
        noCards: false,
      },
      sleevesUsed,
      noCards: false,
    });

    setNoCards(false);
    setHasSleeveChanges(false);
    setSleeveSavedFeedback(true);
    setTimeout(() => setSleeveSavedFeedback(false), 3000);
  };

  const handleToggleNoCards = () => {
    if (!game || !onSaveSleeveInfo) return;
    const nextNoCards = !noCards;
    setNoCards(nextNoCards);
    if (nextNoCards) {
      onSaveSleeveInfo(game.id, {
        isSleeved: false,
        sleeveBrand: undefined,
        sleeveType: undefined,
        cardSleeves: {
          source: 'Manual',
          sourceUrl: game.cardSleeves?.sourceUrl,
          sets: [],
          noCards: true,
        },
        sleevesUsed: [],
        noCards: true,
      });
      setLocalSets([]);
    } else {
      onSaveSleeveInfo(game.id, {
        isSleeved: false,
        noCards: false,
      });
    }
    setHasSleeveChanges(false);
    setSleeveSavedFeedback(true);
    setTimeout(() => setSleeveSavedFeedback(false), 3000);
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshingLocal(true);
    try {
      await onRefresh(game);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshingLocal(false);
    }
  };

  const isOwned = String(game.status || '').toLowerCase().includes('coleção') || String(game.status || '').toLowerCase().includes('sim');
  const statusColor = isOwned ? 'var(--status-owned)' : 'var(--status-sold)';

  const spendNum = typeof game.spend === 'string' ? parseFloat(String(game.spend).replace(',', '.')) : Number(game.spend);
  const isGiftOrZero = isNaN(spendNum) || spendNum <= 0;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    padding: '1rem'
  };

  const panelStyle: React.CSSProperties = {
    width: '100%', maxWidth: '750px', padding: '0', position: 'relative',
    maxHeight: '92vh', overflowY: 'auto', overflowX: 'hidden',
    borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)'
  };

  const cleanDescription = (htmlStr?: string) => {
    if (!htmlStr) return null;
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
    return doc.body.textContent || "";
  };

  // Preferir descrição em português (Ludopedia), caso disponível
  const descriptionPtText = cleanDescription(game.descriptionPt);
  const descriptionEnText = cleanDescription(game.description);
  const mainDescription = descriptionPtText || descriptionEnText;

  return (
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div className="glass-panel animate-fade-in" style={panelStyle} onClick={e => e.stopPropagation()}>
        
        {/* Banner / Header Image */}
        <div style={{ position: 'relative', height: '260px', width: '100%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {(game.image || game.thumbnail) ? (
            <img 
              src={game.image || game.thumbnail} 
              alt={game.name}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'contain', backdropFilter: 'blur(10px)', padding: '1rem' }} 
            />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Sem Imagem</div>
          )}
          
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ 
              position: 'absolute', top: '1rem', right: '1rem', 
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', 
              color: '#fff', borderRadius: '50%', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'all 0.2s' 
            }}
          >
            <X size={20} />
          </button>

          <div className="status-badge" style={{ backgroundColor: statusColor, position: 'absolute', top: '1rem', left: '1rem' }}>
            {game.status}
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#fff' }}>{game.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <span className={`game-type ${String(game.type || '').toLowerCase().includes('expans') ? 'expansion' : 'base'}`}>
                  {game.type || 'Base'}
                </span>
                {game.yearPublished && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={14} /> {game.yearPublished}
                  </span>
                )}
                {game.isPlayed !== undefined && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: game.isPlayed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                      color: game.isPlayed ? '#34d399' : '#94a3b8',
                      border: `1px solid ${game.isPlayed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`
                    }}
                  >
                    {game.isPlayed ? '✔ Jogado' : 'Não Jogado'}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {onRefresh && (
                <button
                  className="btn"
                  onClick={handleRefresh}
                  disabled={isRefreshingLocal || isUpdating}
                  title="Atualizar dados do BGG, Ludopedia e Compara Jogos"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                    padding: '0.6rem 1.1rem', fontSize: '0.88rem',
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.5)',
                    color: '#c7d2fe', cursor: (isRefreshingLocal || isUpdating) ? 'wait' : 'pointer'
                  }}
                >
                  {(isRefreshingLocal || isUpdating) ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {(isRefreshingLocal || isUpdating) ? 'Atualizando...' : 'Atualizar Dados'}
                </button>
              )}

              <button
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onEdit(game);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
              >
                <Pencil size={16} />
                Editar Jogo
              </button>
            </div>
          </div>

          {/* Key Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {/* Jogadores Suportados + Votação Ideal Comunitária */}
            {(game.minPlayers || game.maxPlayers || game.suggestedPlayers) && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Users size={13} color="#6366f1" /> Jogadores
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {game.minPlayers === game.maxPlayers ? game.minPlayers : `${game.minPlayers || '?'} - ${game.maxPlayers || '?'}`}
                </div>
                {game.suggestedPlayers?.summary && (
                  <div style={{ fontSize: '0.72rem', color: '#a5b4fc', marginTop: '4px', fontWeight: 500 }}>
                    ★ {game.suggestedPlayers.summary}
                  </div>
                )}
              </div>
            )}

            {game.weight !== undefined && game.weight > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Brain size={13} color="#a855f7" /> Peso / Dificuldade
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {Number(game.weight.toFixed(2))} / 5
                </div>
              </div>
            )}

            {game.rank !== undefined && game.rank > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Trophy size={13} color="#10b981" /> Ranking BGG
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  #{game.rank}
                </div>
              </div>
            )}

            {game.rating !== undefined && game.rating > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Star size={13} color="#fbbf24" fill="#fbbf24" /> Nota BGG
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {game.rating.toFixed(1)} / 10
                </div>
                {game.geekRating !== undefined && game.geekRating > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '4px' }}>
                    Geek: {game.geekRating.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {game.ludoRating !== undefined && game.ludoRating > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Star size={13} color="#3b82f6" fill="#3b82f6" /> Nota Ludopedia
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {game.ludoRating.toFixed(1)} / 10
                </div>
              </div>
            )}

            {game.playtime !== undefined && game.playtime > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Clock size={13} color="#ec4899" /> Tempo de Jogo
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {game.playtime} min
                </div>
              </div>
            )}
          </div>

          {/* Prêmios e Distinções (boardgamehonor) */}
          {game.honors && game.honors.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Award size={15} color="#fbbf24" /> Prêmios & Distinções ({game.honors.length})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '4px 0' }}>
                {game.honors.map((honor, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#fcd34d',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '3px 10px',
                      borderRadius: '16px',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🏆 {honor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Resumo / Descrição */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Resumo do Jogo
              </h3>
              {game.descriptionPt && (
                <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <ShieldCheck size={12} /> Sinopse em Português
                </span>
              )}
            </div>
            <div style={{ 
              background: 'rgba(0,0,0,0.2)', padding: '1rem 1.25rem', borderRadius: '12px', 
              fontSize: '0.92rem', lineHeight: '1.6', color: '#e2e8f0', 
              maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {mainDescription ? (
                mainDescription
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', color: 'var(--text-muted)' }}>
                  <span>Nenhum resumo disponível no momento. Clique no botão abaixo para buscar dados completos do BGG e preços de mercado.</span>
                  {onRefresh && (
                    <button
                      className="btn"
                      onClick={handleRefresh}
                      disabled={isRefreshingLocal || isUpdating}
                      style={{
                        alignSelf: 'flex-start',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        fontSize: '0.82rem', padding: '0.45rem 0.9rem',
                        background: 'rgba(99, 102, 241, 0.25)', border: '1px solid rgba(99, 102, 241, 0.4)',
                        color: '#c7d2fe', cursor: (isRefreshingLocal || isUpdating) ? 'wait' : 'pointer'
                      }}
                    >
                      {(isRefreshingLocal || isUpdating) ? (
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      {(isRefreshingLocal || isUpdating) ? 'Atualizando...' : 'Sincronizar Dados Agora'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cartas e Sleeves do Jogo (Multi-Sleeve & Compara Jogos) */}
          <section className="board-card-sleeve-section" aria-label="Informações das cartas e sleeves">
            <div className="board-card-sleeve-header">
              <h3 className="board-card-sleeve-title">
                <Layers size={17} color="#818cf8" />
                Cartas e Tamanhos de Sleeves
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                {onSaveSleeveInfo && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleToggleNoCards}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.3rem 0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: noCards ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      borderColor: noCards ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.12)',
                      color: noCards ? '#f1f5f9' : 'var(--text-muted)',
                    }}
                    title={noCards ? "Desmarcar 'Sem cartas' (o jogo possui cartas)" : "Marcar que este jogo não possui cartas"}
                  >
                    🚫 {noCards ? 'Jogo sem cartas' : 'Não possui cartas'}
                  </button>
                )}
                {game.cardSleeves?.sourceUrl && !noCards && (
                  <a
                    href={game.cardSleeves.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: '0.78rem',
                      color: '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={13} /> Ver no Compara Jogos
                  </a>
                )}
              </div>
            </div>

            {noCards ? (
              <div style={{
                background: 'rgba(148, 163, 184, 0.08)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🚫</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#f1f5f9', fontWeight: 600 }}>
                      Este jogo não possui cartas
                    </h4>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Cadastrado como jogo sem componentes de cartas ou baralhos (ex: peças de madeira, dados, miniaturas). Nenhum sleeve é requerido.
                    </p>
                  </div>
                </div>
                {onSaveSleeveInfo && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleToggleNoCards}
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
                    >
                      Desmarcar (Jogo possui cartas)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setNoCards(false);
                        handleAddNewSleeveRow();
                      }}
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={13} /> Adicionar Tipo de Sleeve
                    </button>
                  </div>
                )}
              </div>
            ) : localSets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px' }}>
                <p style={{ margin: '0 0 0.75rem 0' }}>
                  Ainda não há contagem de cartas cadastrada para este jogo.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {onRefresh && (
                    <button
                      className="btn"
                      onClick={handleRefresh}
                      disabled={isRefreshingLocal || isUpdating}
                      style={{
                        fontSize: '0.78rem',
                        padding: '0.4rem 0.8rem',
                        background: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        color: '#c7d2fe'
                      }}
                    >
                      <RefreshCw size={13} /> Consultar Compara Jogos
                    </button>
                  )}
                  {onSaveSleeveInfo && (
                    <button
                      className="btn btn-primary"
                      onClick={handleAddNewSleeveRow}
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={13} /> Adicionar Tipo de Sleeve
                    </button>
                  )}
                  {onSaveSleeveInfo && (
                    <button
                      type="button"
                      className="btn"
                      onClick={handleToggleNoCards}
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(148, 163, 184, 0.35)', color: '#cbd5e1' }}
                      title="Marcar que este jogo não possui cartas"
                    >
                      🚫 Não Possui Cartas
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
                {localSets.map((set) => {
                  const dimText = formatCardSleeveDimensions(set.width, set.height);
                  return (
                    <div 
                      key={set.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: `1px solid ${set.isSleeved ? 'rgba(99, 102, 241, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      {/* Cabeçalho do tipo de sleeve */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ flexGrow: 1 }}>
                          {set.isCustomAdded ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <select
                                  className="search-input"
                                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', fontWeight: 600 }}
                                  value={set.isCustomModel ? '__other__' : (POPULAR_SLEEVE_MODELS.find(m => {
                                    const parsed = parseModelDimensions(m);
                                    return (
                                      (set.sizeName && parsed.sizeName.toLowerCase() === set.sizeName.toLowerCase()) ||
                                      (Math.abs(set.width - parsed.width) <= 0.6 && Math.abs(set.height - parsed.height) <= 1.2)
                                    );
                                  }) || '__other__')}
                                  onChange={e => handleChangeModel(set.id, e.target.value)}
                                >
                                  {POPULAR_SLEEVE_MODELS.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                  <option value="__other__">Outro / Inserir Manualmente...</option>
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    className="search-input"
                                    style={{ width: '70px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                                    value={set.quantity}
                                    onChange={e => handleChangeQuantity(set.id, parseInt(e.target.value, 10) || 0)}
                                    title="Quantidade de cartas"
                                  />
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>cartas</span>
                                </div>
                              </div>

                              {set.isCustomModel && (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input
                                    type="text"
                                    className="search-input"
                                    style={{ flex: 1, minWidth: '150px', padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
                                    placeholder="Nome ou formato (ex: Quadrado ou 70x70)"
                                    value={set.customModel || ''}
                                    onChange={e => handleChangeCustomModel(set.id, e.target.value)}
                                  />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="20"
                                      max="300"
                                      className="search-input"
                                      style={{ width: '55px', padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}
                                      value={set.width || ''}
                                      onChange={e => handleChangeDimensions(set.id, parseFloat(e.target.value) || 0, set.height)}
                                      placeholder="Largura"
                                      title="Largura em mm"
                                    />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>×</span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="20"
                                      max="300"
                                      className="search-input"
                                      style={{ width: '55px', padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}
                                      value={set.height || ''}
                                      onChange={e => handleChangeDimensions(set.id, set.width, parseFloat(e.target.value) || 0)}
                                      placeholder="Altura"
                                      title="Altura em mm"
                                    />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mm</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '1.25rem', color: '#38bdf8' }}>{set.quantity}</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {set.name || 'cartas'}
                              </span>
                              <strong style={{ fontSize: '0.95rem', color: '#fff', marginLeft: '0.4rem' }}>{dimText}</strong>
                              <span className="board-card-sleeve-badge">{set.sizeName || 'Padrão'}</span>
                            </div>
                          )}

                          {set.sleeveProductName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              {set.sleeveProductName}
                            </div>
                          )}
                        </div>

                        {set.isCustomAdded && (
                          <button
                            className="btn"
                            title="Remover este tipo de sleeve"
                            onClick={() => handleRemoveSleeveRow(set.id)}
                            style={{ padding: '0.35rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Configuração de marca e tipo para este sleeve */}
                      {onSaveSleeveInfo && (
                        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem 0.85rem', borderRadius: '8px' }}>
                          <label className="board-sleeve-checkbox" style={{ fontSize: '0.88rem' }}>
                            <input
                              type="checkbox"
                              checked={set.isSleeved}
                              onChange={() => handleToggleSetSleeved(set.id)}
                            />
                            <span>
                              <ShieldCheck size={15} color={set.isSleeved ? '#34d399' : 'var(--text-muted)'} />
                              Este tamanho está sleevado
                            </span>
                          </label>

                          <div className="board-sleeve-fields" style={{ marginTop: '0.6rem' }}>
                            <label>
                              Marca do Sleeve:
                              <select
                                className="search-input"
                                style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
                                value={set.isCustomBrand ? '__other__' : set.brand}
                                onChange={e => handleChangeBrand(set.id, e.target.value)}
                              >
                                <option value="">(Selecione a marca)</option>
                                {KNOWN_SLEEVE_BRANDS.map(b => (
                                  <option key={b} value={b}>{b}</option>
                                ))}
                                <option value="__other__">Outra marca (digitar)</option>
                              </select>
                              {set.isCustomBrand && (
                                <input
                                  type="text"
                                  className="search-input"
                                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', marginTop: '0.25rem' }}
                                  placeholder="Digite a marca..."
                                  value={set.customBrand}
                                  maxLength={60}
                                  onChange={e => handleChangeCustomBrand(set.id, e.target.value)}
                                />
                              )}
                            </label>

                            <label>
                              Subtipo do Sleeve:
                              <select
                                className="search-input"
                                style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
                                value={SLEEVE_SUBTYPES.includes(set.type as any) ? set.type : (set.type ? '__other__' : 'Normal')}
                                onChange={e => {
                                  if (e.target.value === '__other__') {
                                    handleChangeType(set.id, set.type && !SLEEVE_SUBTYPES.includes(set.type as any) ? set.type : '');
                                  } else {
                                    handleChangeType(set.id, e.target.value);
                                  }
                                }}
                              >
                                {SLEEVE_SUBTYPES.map(st => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                                <option value="__other__">Outro subtipo...</option>
                              </select>
                              {(!SLEEVE_SUBTYPES.includes(set.type as any) && set.type !== undefined) && (
                                <input
                                  type="text"
                                  className="search-input"
                                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', marginTop: '0.25rem' }}
                                  placeholder="Digite o subtipo (ex: Matte, Fit)"
                                  value={set.type}
                                  maxLength={50}
                                  onChange={e => handleChangeType(set.id, e.target.value)}
                                />
                              )}
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Botões de Ação: Adicionar outro sleeve e Salvar */}
                {onSaveSleeveInfo && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn"
                      onClick={handleAddNewSleeveRow}
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'rgba(255, 255, 255, 0.15)'
                      }}
                    >
                      <Plus size={14} color="#a5b4fc" /> Adicionar Outro Tipo de Sleeve
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {hasSleeveChanges && !sleeveSavedFeedback && (
                        <span style={{ fontSize: '0.78rem', color: '#fbbf24' }}>
                          * Alterações pendentes
                        </span>
                      )}
                      {sleeveSavedFeedback && (
                        <span style={{ fontSize: '0.82rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <Check size={15} /> Salvo com sucesso!
                        </span>
                      )}

                      <button
                        className="btn btn-primary"
                        onClick={handleSaveSleeve}
                        style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Check size={15} /> Salvar Informações de Sleeves
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Categorias / Mecânicas */}
          {((game.domains && game.domains.length > 0) || (game.mechanics && game.mechanics.length > 0)) && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag size={14} /> Categorias e Mecânicas
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {Array.from(new Set([...(game.mechanics || []), ...(game.domains || [])])).map((domain, idx) => (
                  <span 
                    key={idx}
                    style={{ 
                      background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', 
                      border: '1px solid rgba(99, 102, 241, 0.3)', 
                      padding: '3px 10px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 500 
                    }}
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Informações Financeiras & Links Externos */}
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            paddingTop: '1rem', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '1rem' 
          }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Valor Pago:</span>
                <strong style={{ fontSize: '1.1rem', color: isGiftOrZero ? '#34d399' : '#fff' }}>
                  {isGiftOrZero ? 'Presente/R$0' : Number(spendNum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Valor de Mercado:</span>
                <strong style={{ fontSize: '1.1rem', color: '#fff' }}>
                  {Number(game.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
              {game.retailPrice !== undefined && game.retailPrice > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Menor Varejo:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
                    {Number(game.retailPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>
              )}
              {game.usedPrice !== undefined && game.usedPrice > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Mercado Usados:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#fb923c' }}>
                    {Number(game.usedPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>
              )}
              {String(game.status).toLowerCase().includes('vendido') && game.soldValue && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Vendido Por:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#60a5fa' }}>
                    {Number(game.soldValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {game.bggId && (
                <a
                  href={`https://boardgamegeek.com/boardgame/${game.bggId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ExternalLink size={14} /> BGG
                </a>
              )}
              {game.ludoId && (
                <a
                  href={`https://ludopedia.com.br/jogo/${game.ludoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ExternalLink size={14} /> Ludopedia
                </a>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
