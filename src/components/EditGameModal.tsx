import React, { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import type { GameData } from '../types';
import '../components.css';

interface EditGameModalProps {
  game: GameData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<GameData, 'id'>>) => void;
  onDelete: (id: string) => void;
  onRefreshBGG: (game: GameData) => void;
  onRefreshLudo: (game: GameData) => void;
}

export function EditGameModal({ game, isOpen, onClose, onSave, onDelete, onRefreshBGG, onRefreshLudo }: EditGameModalProps) {
  const [name, setName] = useState('');
  const [bggIdInput, setBggIdInput] = useState('');
  const [status, setStatus] = useState('Na Coleção');
  const [spend, setSpend] = useState('');
  const [type, setType] = useState('Base');
  const [value, setValue] = useState('');
  const [soldValue, setSoldValue] = useState('');
  const [minPlayers, setMinPlayers] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [weight, setWeight] = useState('');
  const [yearPublished, setYearPublished] = useState('');
  const [rating, setRating] = useState('');
  const [ludoRating, setLudoRating] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (game) {
      setName(game.name || '');
      setBggIdInput(game.bggId || '');
      setStatus(game.status || 'Na Coleção');
      setSpend(game.spend !== undefined && game.spend !== 0 ? String(game.spend) : '');
      setType(game.type || 'Base');
      setValue(game.value !== undefined && game.value !== 0 ? String(game.value) : '');
      setSoldValue(game.soldValue !== undefined && game.soldValue !== 0 ? String(game.soldValue) : '');
      setMinPlayers(game.minPlayers ? String(game.minPlayers) : '');
      setMaxPlayers(game.maxPlayers ? String(game.maxPlayers) : '');
      setWeight(game.weight ? String(game.weight) : '');
      setYearPublished(game.yearPublished ? String(game.yearPublished) : '');
      setRating(game.rating ? String(game.rating) : '');
      setLudoRating(game.ludoRating ? String(game.ludoRating) : '');
    }
  }, [game]);

  if (!isOpen || !game) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(game.id, {
      name: name.trim(),
      bggId: bggIdInput.trim() || undefined,
      status: status.trim(),
      spend: spend ? parseFloat(spend.replace(',', '.')) : 0,
      type: type.trim(),
      value: value ? parseFloat(value.replace(',', '.')) : 0,
      soldValue: soldValue ? parseFloat(soldValue.replace(',', '.')) : 0,
      minPlayers: minPlayers ? parseInt(minPlayers) : undefined,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : undefined,
      weight: weight ? parseFloat(weight.replace(',', '.')) : undefined,
      yearPublished: yearPublished ? parseInt(yearPublished) : undefined,
      rating: rating ? parseFloat(rating.replace(',', '.')) : undefined,
      ludoRating: ludoRating ? parseFloat(ludoRating.replace(',', '.')) : undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja remover "${game.name}"?`)) {
      onDelete(game.id);
      onClose();
    }
  };

  const handleRefreshBGG = async () => {
    setIsRefreshing(true);
    // Chama refresh com bggId definido pelo usuário ou undefined para buscar por nome
    onRefreshBGG({ ...game, name: name.trim(), bggId: bggIdInput.trim() || undefined });
    setIsRefreshing(false);
    onClose();
  };

  const handleRefreshLudo = async () => {
    setIsRefreshing(true);
    onRefreshLudo({ ...game, name: name.trim(), ludoId: undefined });
    setIsRefreshing(false);
    onClose();
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };

  const panelStyle: React.CSSProperties = {
    width: '100%', maxWidth: '640px', padding: '2rem', position: 'relative',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem',
  };

  return (
    <div className="modal-overlay" style={overlayStyle}>
      <div className="glass-panel animate-fade-in" style={panelStyle}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={24} />
        </button>

        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.4rem' }}>Editar Jogo</h2>
        {game.bggId && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            BGG ID: <a href={`https://boardgamegeek.com/boardgame/${game.bggId}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>#{game.bggId}</a>
          </p>
        )}
        {!game.bggId && <div style={{ marginBottom: '1.5rem' }} />}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Nome do Jogo *</label>
              <input
                required
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ex: Catan"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>BGG ID (Opcional)</label>
              <input
                type="text"
                value={bggIdInput}
                onChange={e => setBggIdInput(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ex: 13"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="search-input" style={{ width: '100%' }}>
                <option value="Na Coleção">Na Coleção</option>
                <option value="Vendido">Vendido</option>
                <option value="Desejo">Desejo</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Tipo</label>
              <select value={type} onChange={e => setType(e.target.value)} className="search-input" style={{ width: '100%' }}>
                <option value="Base">Base</option>
                <option value="Expansão">Expansão</option>
                <option value="Acessório">Acessório</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Valor Gasto (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={spend}
                onChange={e => setSpend(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ex: 150.00"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Valor de Mercado (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ex: 200.00"
              />
            </div>
          </div>

          {status === 'Vendido' && (
            <div>
              <label style={labelStyle}>Valor Vendido (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={soldValue}
                onChange={e => setSoldValue(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ex: 180.00"
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Mín. Jogadores</label>
              <input type="number" min="1" value={minPlayers} onChange={e => setMinPlayers(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Máx. Jogadores</label>
              <input type="number" min="1" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Peso (1-5)</label>
              <input type="number" step="0.01" min="1" max="5" value={weight} onChange={e => setWeight(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ano</label>
              <input type="number" value={yearPublished} onChange={e => setYearPublished(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Nota BGG</label>
              <input type="number" step="0.1" max="10" value={rating} onChange={e => setRating(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Nota Ludo</label>
              <input type="number" step="0.1" max="10" value={ludoRating} onChange={e => setLudoRating(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
          </div>

          {/* BGG Thumbnail preview */}
          {game.thumbnail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <img src={game.thumbnail} alt={game.name} style={{ width: '60px', height: '60px', objectFit: 'contain', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }} />
              <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {game.rating && <div>⭐ BGG: {game.rating.toFixed(1)}</div>}
                {game.yearPublished && <div>📅 {game.yearPublished}</div>}
                {(game.minPlayers || game.maxPlayers) && <div>👥 {game.minPlayers}–{game.maxPlayers} jogadores</div>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleDelete}
              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '0.65rem 1rem', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Remover Jogo
            </button>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
              <button
                type="button"
                onClick={handleRefreshLudo}
                disabled={isRefreshing}
                style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#93c5fd', padding: '0.65rem 1rem', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {isRefreshing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                Re-buscar Ludo
              </button>
              <button
                type="button"
                onClick={handleRefreshBGG}
                disabled={isRefreshing}
                style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#a5b4fc', padding: '0.65rem 1rem', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {isRefreshing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                Re-buscar BGG
              </button>
              <button type="button" className="btn" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Salvar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
