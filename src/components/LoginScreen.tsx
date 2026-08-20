import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import '../index.css';

interface LoginScreenProps {
  onLogin: (username: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-color)' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '3rem', maxWidth: '450px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          <img src="/logo.png" alt="Boardgame Manager Logo" style={{ width: '350px', maxWidth: '100%', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0px 0px 8px rgba(255,255,255,0.2))' }} />
        </div>
        
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#fff' }}>Board Game Manager</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Gerencie sua coleção de jogos de tabuleiro de forma simples.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label htmlFor="username" style={{ display: 'block', textAlign: 'left', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Usuário da Ludopedia / BGG
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário..."
              className="search-input"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px' }}
              autoFocus
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem' }} disabled={!username.trim()}>
            <LogIn size={18} />
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
