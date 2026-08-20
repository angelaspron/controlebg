import React, { useState } from 'react';
import { X, DownloadCloud } from 'lucide-react';
import '../components.css';

interface BGGImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (username: string) => Promise<void>;
}

export function BGGImportModal({ isOpen, onClose, onImport }: BGGImportModalProps) {
  const [username, setUsername] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      setIsImporting(true);
      setError('');
      await onImport(username.trim());
      setUsername('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao importar. Verifique se o usuário existe.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', 
          border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
        }} disabled={isImporting}>
          <X size={24} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DownloadCloud size={24} color="#a5b4fc" />
          Importar do BGG
        </h2>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Digite o seu nome de usuário (Username) do BoardGameGeek. Se a sua coleção for muito grande, a importação pode levar alguns segundos.
          </p>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>BGG Username *</label>
            <input 
              required
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
              placeholder="Ex: jsmith"
              disabled={isImporting}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={isImporting}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={isImporting}>
              {isImporting ? 'Importando...' : 'Importar Coleção'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
