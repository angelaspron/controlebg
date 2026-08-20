import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import type { GameData } from '../types';
import '../components.css';
import { XMLParser } from 'fast-xml-parser';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (game: Omit<GameData, 'id'>) => void;
  ludoToken?: string;
}

export function AddGameModal({ isOpen, onClose, onAdd, ludoToken }: AddGameModalProps) {
  const [name, setName] = useState('');
  const [bggId, setBggId] = useState<string | undefined>(undefined);
  const [ludoId, setLudoId] = useState<string | undefined>(undefined);
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

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchSource, setSearchSource] = useState<'bgg'|'ludo'>('bgg');

  if (!isOpen) return null;

  const handleSearchBGG = async () => {
    if (!name.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(name.trim())}&type=boardgame,boardgameexpansion`;
      const res = await fetch(url, { headers: { 'Authorization': 'Bearer cdbac8cf-91ac-4af7-9d1f-266544061d52' } });
      if (res.ok) {
        const text = await res.text();
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
        const obj = parser.parse(text);
        if (obj?.items?.item) {
          const items = Array.isArray(obj.items.item) ? obj.items.item : [obj.items.item];
          setSearchResults(items.slice(0, 5)); // show top 5
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchLudo = async () => {
    if (!name.trim()) return;
    if (!ludoToken) {
      alert("Token da Ludopedia não configurado. Vá em Configurações para adicionar.");
      return;
    }
    setIsSearching(true);
    setSearchSource('ludo');
    setSearchResults([]);
    try {
      const url = `/ludo-api/jogos?search=${encodeURIComponent(name.trim())}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${ludoToken}` } });
      if (res.ok) {
        const json = await res.json();
        if (json.jogos) {
          setSearchResults(json.jogos.slice(0, 5));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const selectItem = (item: any) => {
    if (searchSource === 'bgg') {
      let itemName = 'Jogo Desconhecido';
      if (item.name) {
        itemName = typeof item.name === 'string' ? item.name : (item.name['#text'] || item.name['@_value'] || 'Jogo Desconhecido');
      }
      setName(itemName);
      setBggId(item['@_id']);
    } else {
      setName(item.nm_jogo || 'Jogo Desconhecido');
      setLudoId(String(item.id_jogo));
    }
    setSearchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      bggId,
      ludoId,
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
    
    // Limpar form
    setName('');
    setBggId(undefined);
    setLudoId(undefined);
    setStatus('Na Coleção');
    setSpend('');
    setType('Base');
    setValue('');
    setSoldValue('');
    setMinPlayers('');
    setMaxPlayers('');
    setWeight('');
    setYearPublished('');
    setRating('');
    setLudoRating('');
    setSearchResults([]);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '640px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', 
          border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
        }}>
          <X size={24} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Adicionar Jogo Manualmente</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nome do Jogo *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                required
                type="text" 
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  setBggId(undefined);
                  setLudoId(undefined);
                }}
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ex: Catan"
              />
              <button 
                type="button" 
                className="btn" 
                onClick={handleSearchBGG}
                disabled={isSearching || !name.trim()}
                title="Buscar no BGG"
                style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.4)' }}
              >
                <Search size={16} /> BGG
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={handleSearchLudo}
                disabled={isSearching || !name.trim() || !ludoToken}
                title={!ludoToken ? "Configure o token nas Configurações" : "Buscar na Ludopedia"}
                style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.4)' }}
              >
                <Search size={16} /> Ludo
              </button>
            </div>
            
            {/* Search Results */}
            {isSearching && <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Buscando...</div>}
            {searchResults.length > 0 && (
              <div style={{ 
                marginTop: '0.5rem', 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: '0.5rem', 
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Sugestões {searchSource === 'bgg' ? 'do BGG' : 'da Ludopedia'}:</div>
                {searchResults.map((item, idx) => {
                  let itemName = 'Jogo';
                  let year = '';
                  if (searchSource === 'bgg') {
                    itemName = typeof item.name === 'string' ? item.name : (item.name?.['@_value'] || 'Jogo');
                    year = item.yearpublished?.['@_value'] ? `(${item.yearpublished['@_value']})` : '';
                  } else {
                    itemName = item.nm_jogo;
                    year = item.ano_publicacao ? `(${item.ano_publicacao})` : '';
                  }
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => selectItem(item)}
                      style={{ 
                        padding: '0.5rem', 
                        cursor: 'pointer', 
                        borderRadius: '0.25rem',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        fontSize: '0.9rem'
                      }}
                      onMouseOver={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                      onMouseOut={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                    >
                      {itemName} {year}
                    </div>
                  );
                })}
              </div>
            )}
            {bggId && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#a5b4fc' }}>✓ Vinculado ao BGG (ID: {bggId})</div>
            )}
            {ludoId && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#93c5fd' }}>✓ Vinculado à Ludopedia (ID: {ludoId})</div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Status</label>
              <select 
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
              >
                <option value="Na Coleção">Na Coleção</option>
                <option value="Vendido">Vendido</option>
                <option value="Desejo">Desejo</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Tipo</label>
              <select 
                value={type}
                onChange={e => setType(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
              >
                <option value="Base">Base</option>
                <option value="Expansão">Expansão</option>
                <option value="Acessório">Acessório</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Valor Gasto (R$)</label>
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
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Valor de Mercado (R$)</label>
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
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Valor Vendido (R$)</label>
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
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Mín. Jogadores</label>
              <input type="number" min="1" value={minPlayers} onChange={e => setMinPlayers(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Máx. Jogadores</label>
              <input type="number" min="1" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Peso (1-5)</label>
              <input type="number" step="0.01" min="1" max="5" value={weight} onChange={e => setWeight(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Ano</label>
              <input type="number" value={yearPublished} onChange={e => setYearPublished(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nota BGG</label>
              <input type="number" step="0.1" max="10" value={rating} onChange={e => setRating(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nota Ludo</label>
              <input type="number" step="0.1" max="10" value={ludoRating} onChange={e => setLudoRating(e.target.value)} className="search-input" style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Adicionar Jogo</button>
          </div>
        </form>
      </div>
    </div>
  );
}
