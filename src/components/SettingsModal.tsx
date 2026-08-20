import React, { useState, useEffect } from 'react';
import { X, Save, Info } from 'lucide-react';
import type { ColumnMapping } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapping: ColumnMapping;
  onSave: (mapping: ColumnMapping) => void;
  ludoToken: string;
  setLudoToken: (token: string) => void;
  onOpenHelp?: () => void;
}

export function SettingsModal({ isOpen, onClose, mapping, onSave, ludoToken, setLudoToken, onOpenHelp }: SettingsModalProps) {
  const [localMapping, setLocalMapping] = useState<ColumnMapping>(mapping);
  const [localToken, setLocalToken] = useState<string>(ludoToken);

  useEffect(() => {
    if (isOpen) {
      setLocalMapping(mapping);
      setLocalToken(ludoToken);
    }
  }, [isOpen, mapping, ludoToken]);

  if (!isOpen) return null;

  const handleChange = (field: keyof ColumnMapping, value: string) => {
    setLocalMapping(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localMapping);
    setLudoToken(localToken);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', 
          border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
        }}>
          <X size={24} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Configurações de Importação
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Defina o nome exato da coluna na sua planilha Excel correspondente a cada campo abaixo. 
            Deixe em branco para usar a detecção automática padrão.
          </p>

          <div className="form-group">
            <label>Coluna para "Nome do Jogo"</label>
            <input
              type="text"
              className="search-input"
              value={localMapping.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="Ex: Jogo, Nome, Título"
            />
          </div>

          <div className="form-group">
            <label>Coluna para "Status"</label>
            <input
              type="text"
              className="search-input"
              value={localMapping.status}
              onChange={e => handleChange('status', e.target.value)}
              placeholder="Ex: Status, Situação"
            />
          </div>

          <div className="form-group">
            <label>Coluna para "Valor Pago"</label>
            <input
              type="text"
              className="search-input"
              value={localMapping.spend}
              onChange={e => handleChange('spend', e.target.value)}
              placeholder="Ex: Valor, Preço Pago"
            />
          </div>

          <div className="form-group">
            <label>Coluna para "Tipo"</label>
            <input
              type="text"
              className="search-input"
              value={localMapping.type}
              onChange={e => handleChange('type', e.target.value)}
              placeholder="Ex: Tipo, Categoria"
            />
          </div>

          <div className="form-group">
            <label>Coluna para "Valor de Mercado"</label>
            <input
              type="text"
              className="search-input"
              value={localMapping.value}
              onChange={e => handleChange('value', e.target.value)}
              placeholder="Ex: Mercado, Valor Atual"
            />
          </div>

          <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Credenciais API</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Ludopedia Access Token (Usuário)
              <span title="Acesse ludopedia.com.br/aplicativos para solicitar o token de usuário" style={{ display: 'flex', alignItems: 'center', cursor: 'help' }}>
                <Info size={16} color="var(--text-muted)" />
              </span>
            </label>
            <input
              type="text"
              className="search-input"
              value={localToken}
              onChange={e => setLocalToken(e.target.value)}
              placeholder="Ex: 1b3c3e8def1c6983e5519bb310992707"
            />
          </div>

          <div className="modal-footer" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {onOpenHelp && (
              <button 
                type="button" 
                className="btn" 
                onClick={onOpenHelp}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--accent)', borderColor: 'var(--accent)' }}
              >
                Ver Tutorial Inicial
              </button>
            )}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                <Save size={18} />
                Salvar Mapeamento
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
