import { useState } from 'react';
import { X, DownloadCloud } from 'lucide-react';

interface LudoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => Promise<void>;
  hasToken: boolean;
}

export function LudoImportModal({ isOpen, onClose, onImport, hasToken }: LudoImportModalProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!hasToken) {
      setError('Token da Ludopedia não configurado. Por favor, adicione-o na tela de Configurações.');
      return;
    }
    
    setIsImporting(true);
    setError(null);
    try {
      await onImport();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Erro ao importar coleção.');
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
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', 
          border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
        }} disabled={isImporting}>
          <X size={24} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DownloadCloud size={24} color="#3b82f6" />
          Importar da Ludopedia
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            A importação utilizará o <strong>Access Token</strong> que você configurou para baixar a sua lista principal de jogos da Ludopedia.
          </p>

          {!hasToken && (
            <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171' }}>
              <strong>Atenção:</strong> Você ainda não configurou o token da Ludopedia. Vá em "Configurações" antes de importar.
            </div>
          )}

          {error && (
            <div className="error-message" style={{ color: '#ef4444', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={isImporting}>
              Cancelar
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleImport}
              disabled={isImporting || !hasToken}
            >
              <DownloadCloud size={18} />
              {isImporting ? 'Importando...' : 'Iniciar Importação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
