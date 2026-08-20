import type { GameData } from '../types';
import { Users, Star, Package, Pencil, Brain, Trophy } from 'lucide-react';

interface GameCardProps {
  game: GameData;
  onEdit: (game: GameData) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function GameCard({ game, onEdit, isSelected, onToggleSelect }: GameCardProps) {
  // Cores de status
  const isOwned = String(game.status || '').toLowerCase().includes('coleção') || String(game.status || '').toLowerCase().includes('sim');
  const statusColor = isOwned ? 'var(--status-owned)' : 'var(--status-sold)';

  // Lógica financeira
  const spendNum = typeof game.spend === 'string' ? parseFloat(String(game.spend).replace(',', '.')) : Number(game.spend);
  const isGiftOrZero = isNaN(spendNum) || spendNum <= 0;

  return (
    <div 
      className={`glass-panel game-card ${isSelected ? 'selected' : ''}`}
      style={isSelected ? { outline: '2px solid #6366f1', transform: 'translateY(-4px)', boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)' } : {}}
      onClick={(e) => {
        // Prevent click if clicking buttons inside
        if ((e.target as HTMLElement).closest('button')) return;
        if (onToggleSelect) onToggleSelect();
      }}
    >
      {onToggleSelect && (
        <div style={{position: 'absolute', top: '10px', right: '10px', zIndex: 10}}>
          <input 
            type="checkbox" 
            checked={isSelected} 
            readOnly
            style={{width: '20px', height: '20px', cursor: 'pointer', accentColor: '#6366f1'}}
          />
        </div>
      )}
      <div className="game-card-image">
        {game.thumbnail ? (
          <img src={game.thumbnail} alt={game.name} />
        ) : (
          <div className="placeholder-img">
            <Package size={48} opacity={0.2} />
          </div>
        )}
        <div className="status-badge" style={{ backgroundColor: statusColor }}>
          {game.status}
        </div>
        <button
          onClick={() => onEdit(game)}
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
      </div>

      <div className="game-card-content">
        <h3 className="game-title" title={game.name}>{game.name}</h3>
        <div className="game-meta">
          <span className="game-type">{game.type}</span>
          {game.yearPublished && <span>({game.yearPublished})</span>}
        </div>

        <div className="game-stats">
          {(game.minPlayers || game.maxPlayers) && (
            <div className="stat-item" title="Jogadores Recomendados">
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
            <div className="stat-item" title="Nota BGG">
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
}

