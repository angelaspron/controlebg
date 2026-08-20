import { X, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div className="glass-panel animate-scale-in" style={{ width: '100%', maxWidth: '600px', padding: '2rem', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', 
          border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
        }}>
          <X size={24} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
          <HelpCircle size={24} /> Bem-vindo ao Boardgame Manager!
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', lineHeight: '1.6' }}>
          <p>
            O <strong>Boardgame Manager</strong> é o seu painel definitivo para gerenciar e acompanhar sua coleção de jogos de tabuleiro. Aqui estão algumas dicas rápidas:
          </p>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📥 Importar Coleção
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-muted)' }}>
              <li><strong>Planilha Excel:</strong> Importe seu arquivo XLSX/CSV. Por padrão, tente usar colunas como "Nome", "Status", "Valor Pago", etc.</li>
              <li><strong>Ludopedia & BGG:</strong> Busque os jogos diretamente do seu perfil digitando o seu nome de usuário.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚙️ Configurações
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Acesse as <strong>Configurações</strong> para ajustar o nome exato das colunas do Excel que deseja mapear. Você também pode configurar Tokens de API lá.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📊 Gerenciamento Diário
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-muted)' }}>
              <li>Use os botões <strong>Atualizar</strong> após selecionar jogos para buscar notas, peso e ranking mais recentes.</li>
              <li>Visualize estatísticas consolidadas no botão <strong>Estatísticas</strong>.</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '2rem' }}>
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
            Entendi, vamos lá!
          </button>
        </div>
      </div>
    </div>
  );
}
