import { memo, useCallback } from 'react';
import type { GameData } from '../types';
import { Users, Star, Package, Pencil, Brain, Trophy, Award, Loader2, Check, RefreshCw } from 'lucide-react';

interface GameCardProps {
  game: GameData;
  onEdit: (game: GameData) => void;
  onClickDetails?: (game: GameData) => void;
  onRefresh?: (game: GameData) => void;
  isSelected?: boolean;
  isUpdating?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const GameCard = memo(function GameCard({ 
  game, 
  onEdit, 
  onClickDetails,
  onRefresh,
  isSelected = false, 
  isUpdating = false,
  onToggleSelect 
}: GameCardProps) {
  // Cores de status
  const isOwned = String(game.status || '').toLowerCase().includes('coleção') || String(game.status || '').toLowerCase().includes('sim');
  const statusColor = isOwned ? 'var(--status-owned)' : 'var(--status-sold)';

  // Lógica financeira
  const spendNum = typeof game.spend === 'string' ? parseFloat(String(game.spend).replace(',', '.')) : Number(game.spend);
  const isGiftOrZero = isNaN(spendNum) || spendNum <= 0;

  // Lógica de visualização do tipo
  const rawType = String(game.type || 'Base');
  const lowerType = rawType.toLowerCase();
  const isExpansion = lowerType.includes('expans') || lowerType.includes('expansion');
  const isBase = lowerType.includes('base');
  const typeClass = isExpansion ? 'game-type expansion' : isBase ? 'game-type base' : 'game-type';

  // Handler isolado com stopPropagation para alternância de seleção individual
  const handleToggleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect) {
      onToggleSelect(game.id);
    }
  }, [onToggleSelect, game.id]);

  return (
    <div 
      className={`glass-panel game-card ${isSelected ? 'selected' : ''}`}
      style={{
        cursor: 'pointer',
        position: 'relative',
        ...(isSelected ? { outline: '2px solid #6366f1', transform: 'translateY(-4px)', boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)' } : {})
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if ((e.target as HTMLElement).closest('.card-checkbox-container')) return;
        if (onClickDetails) {
          onClickDetails(game);
        } else {
          onEdit(game);
        }
      }}
    >
      {/* Indicador de carregamento individual quando em atualização de lote */}
      {isUpdating && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(3px)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          borderRadius: 'var(--border-radius)',
        }}>
          <Loader2 size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Atualizando...</span>
        </div>
      )}

      {onToggleSelect && (
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Selecionar jogo ${game.name}`}
          className={`card-checkbox-container ${isSelected ? 'selected' : ''}`}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10,
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: isSelected ? '2px solid #6366f1' : '2px solid rgba(255, 255, 255, 0.85)',
            backgroundColor: isSelected ? '#6366f1' : '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
          }}
          onClick={handleToggleSelect}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              if (onToggleSelect) {
                onToggleSelect(game.id);
              }
            }
          }}
        >
          {isSelected && (
            <Check size={15} strokeWidth={3.5} color="#ffffff" style={{ pointerEvents: 'none' }} />
          )}
          <input 
            type="checkbox" 
            checked={isSelected} 
            readOnly 
            tabIndex={-1} 
            aria-hidden="true" 
            style={{ display: 'none' }} 
          />
        </button>
      )}

      <div className="game-card-image">
        {game.thumbnail ? (
          <img 
            src={game.thumbnail} 
            alt={game.name}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // Fallback gracioso se a URL da imagem falhar
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="placeholder-img">
            <Package size={48} opacity={0.2} />
          </div>
        )}
        <div 
          className="status-badge" 
          style={{ 
            backgroundColor: statusColor,
            right: onToggleSelect ? '44px' : '12px',
          }}
        >
          {game.status}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(game);
          }}
          title="Editar jogo"
          style={{
            position: 'absolute', top: '10px', left: '10px',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', borderRadius: '8px', padding: '5px 8px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '0.75rem', fontWeight: 500, transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.55)')}
        >
          <Pencil size={13} />
          Editar
        </button>
        {onRefresh && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRefresh(game);
            }}
            disabled={isUpdating}
            title="Atualizar dados e preço deste jogo via APIs"
            style={{
              position: 'absolute', top: '10px', left: '76px',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', borderRadius: '8px', padding: '5px 8px',
              cursor: isUpdating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '0.75rem', fontWeight: 500, transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.55)')}
          >
            <RefreshCw size={12} style={{ animation: isUpdating ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        )}
      </div>

      <div className="game-card-content">
        <h3 className="game-title" title={game.name}>{game.name}</h3>
        <div className="game-meta">
          <span className={typeClass}>{game.type || 'Base'}</span>
          {game.yearPublished && <span>({game.yearPublished})</span>}
          {game.honors && game.honors.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#fbbf24', fontSize: '0.75rem' }} title={`${game.honors.length} Prêmios`}>
              <Award size={13} /> {game.honors.length}
            </span>
          )}
        </div>

        <div className="game-stats">
          {(game.minPlayers || game.maxPlayers) && (
            <div className="stat-item" title={game.suggestedPlayers?.summary ? `Jogadores: ${game.minPlayers}-${game.maxPlayers} (${game.suggestedPlayers.summary})` : 'Jogadores'}>
              <Users size={14} />
              <span>
                {game.minPlayers === game.maxPlayers
                  ? game.minPlayers
                  : `${game.minPlayers || '?'} - ${game.maxPlayers || '?'}`}
              </span>
            </div>
          )}
          {game.weight && (
            <div className="stat-item" title="Complexidade (Peso BGG)">
              <Brain size={14} color="#a855f7" />
              <span>Peso: {Number(game.weight.toFixed(2)).toString()}</span>
            </div>
          )}
          {game.rank && (
            <div className="stat-item" title="Posição no Ranking">
              <Trophy size={14} color="#10b981" />
              <span>Rank: #{game.rank}</span>
            </div>
          )}
          {game.rating && (
            <div className="stat-item" title={game.geekRating ? `Nota Média: ${game.rating.toFixed(1)} | Geek Rating: ${game.geekRating.toFixed(2)}` : 'Nota BGG'}>
              <Star size={14} fill="currentColor" color="#fbbf24" />
              <span>BGG: {game.rating.toFixed(1)}</span>
            </div>
          )}
          {game.ludoRating && (
            <div className="stat-item" title="Nota Ludopedia">
              <Star size={14} fill="currentColor" color="#3b82f6" />
              <span>Ludo: {game.ludoRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        <div className="game-financials">
          <div className="financial-row">
            <span className="label">Custo:</span>
            <span className={`value ${isGiftOrZero ? 'gift' : ''}`}>
              {isGiftOrZero ? 'Presente/R$0' : Number(spendNum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="financial-row">
            <span className="label">Valor de Mercado:</span>
            <span className="value">{Number(game.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isUpdating === nextProps.isUpdating &&
    prevProps.game === nextProps.game &&
    prevProps.onToggleSelect === nextProps.onToggleSelect &&
    prevProps.onClickDetails === nextProps.onClickDetails &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onRefresh === nextProps.onRefresh
  );
});
