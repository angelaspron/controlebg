import { useState, useMemo, useEffect } from 'react';
import { Gamepad2, Upload, Trash2, Search, Plus, Settings, DownloadCloud, FileSpreadsheet, PieChart, FileJson, Eye, EyeOff } from 'lucide-react';
import { useCollection } from './hooks/useCollection';
import { GameCard } from './components/GameCard';
import { AddGameModal } from './components/AddGameModal';
import { EditGameModal } from './components/EditGameModal';
import { SettingsModal } from './components/SettingsModal';
import { BGGImportModal } from './components/BGGImportModal';
import { LudoImportModal } from './components/LudoImportModal';
import { ReportsModal } from './components/ReportsModal';
import type { GameData } from './types';
import { LoginScreen } from './components/LoginScreen';
import './index.css';
import './components.css';

function App() {
  const { games, columnMapping, setColumnMapping, isLoading, ludoToken, setLudoToken, processExcelUpload, fetchBGGCollection, fetchLudoCollection, clearCollection, exportToExcel, exportToJson, addGame, editGame, deleteGame, fetchBGGDataForGames, fetchLudoDataForGames, fetchComparaDataForGames } = useCollection();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isBGGModalOpen, setIsBGGModalOpen] = useState(false);
  const [isLudoModalOpen, setIsLudoModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<GameData | null>(null);
  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
  const [showFinancials, setShowFinancials] = useState(true);
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem('boardgame_manager_username'));
  const [isUpdating, setIsUpdating] = useState(false);

  const handleLogin = (user: string) => {
    localStorage.setItem('boardgame_manager_username', user);
    setUsername(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('boardgame_manager_username');
    setUsername(null);
  };

  const toggleSelection = (id: string) => {
    setSelectedGameIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedGameIds(new Set(filteredGames.map(g => g.id)));
  };

  const deselectAll = () => {
    setSelectedGameIds(new Set());
  };

  const handleUpdateSelected = async (api: 'bgg' | 'ludo' | 'compara') => {
    if (selectedGameIds.size === 0) return;
    setIsUpdating(true);
    const selectedGames = games.filter(g => selectedGameIds.has(g.id));
    try {
      if (api === 'bgg') {
        await fetchBGGDataForGames(selectedGames);
      } else if (api === 'ludo') {
        await fetchLudoDataForGames(selectedGames);
      } else if (api === 'compara') {
        await fetchComparaDataForGames(selectedGames);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Reset input so the same file can be re-uploaded
      e.target.value = '';
      try {
        await processExcelUpload(file);
      } catch (error) {
        alert('Erro ao processar arquivo. Certifique-se de que é uma planilha válida.');
      }
    }
  };

  // Extrair lista de status únicos
  const availableStatuses = useMemo(() => {
    const statuses = new Set(games.map(g => g.status));
    return ['Todos', ...Array.from(statuses)];
  }, [games]);

  // Filtrar e ordenar jogos
  const filteredGames = useMemo(() => {
    const filtered = games.filter(game => {
      const matchesSearch = String(game.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' || game.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = String(a.name || '').localeCompare(String(b.name || ''));
          break;
        case 'added_date':
          // Extrair timestamp do ID (ex: bgg-123-171829123-0 ou local-0-171829123)
          const getTime = (id: string) => {
            const parts = id.split('-');
            const timestampPart = parts.length >= 3 ? parts[parts.length - 2] : '0';
            return parseInt(timestampPart) || 0;
          };
          comparison = getTime(a.id) - getTime(b.id);
          break;
        case 'weight':
          comparison = (a.weight || 0) - (b.weight || 0);
          break;
        case 'spend':
          const spendA = typeof a.spend === 'string' ? parseFloat(String(a.spend).replace(',', '.')) : Number(a.spend);
          const spendB = typeof b.spend === 'string' ? parseFloat(String(b.spend).replace(',', '.')) : Number(b.spend);
          comparison = (isNaN(spendA) ? 0 : spendA) - (isNaN(spendB) ? 0 : spendB);
          break;
        case 'value':
          const valA = typeof a.value === 'string' ? parseFloat(String(a.value).replace(',', '.')) : Number(a.value);
          const valB = typeof b.value === 'string' ? parseFloat(String(b.value).replace(',', '.')) : Number(b.value);
          comparison = (isNaN(valA) ? 0 : valA) - (isNaN(valB) ? 0 : valB);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [games, searchTerm, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    // Limpar seleção quando a lista muda
    setSelectedGameIds(new Set());
  }, [filteredGames]);

  // Totais financeiros
  const totals = useMemo(() => {
    return games.reduce((acc, game) => {
      const spendNum = typeof game.spend === 'string' ? parseFloat(String(game.spend).replace(',', '.')) : Number(game.spend);
      const valueNum = typeof game.value === 'string' ? parseFloat(String(game.value).replace(',', '.')) : Number(game.value);
      const soldNum = typeof game.soldValue === 'string' ? parseFloat(String(game.soldValue).replace(',', '.')) : Number(game.soldValue);

      const isOwned = String(game.status || '').toLowerCase().includes('coleção') || String(game.status || '').toLowerCase().includes('sim');
      const isSold = String(game.status || '').toLowerCase().includes('vendido');

      if (!isNaN(spendNum)) acc.totalGasto += spendNum;

      if (isOwned && !isNaN(valueNum)) {
        acc.valorColecao += valueNum;
      }
      
      if (isSold && !isNaN(soldNum)) {
        acc.totalVendido += soldNum;
      }
      return acc;
    }, { totalGasto: 0, valorColecao: 0, totalVendido: 0 });
  }, [games]);

  if (isLoading) {
    return <div className="app-container"><div className="glass-panel" style={{textAlign: 'center', padding: '2rem'}}>Carregando...</div></div>;
  }

  if (!username) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <>
    {isUpdating && (
      <div className="modal-overlay" style={{zIndex: 9999}}>
        <div className="glass-panel animate-scale-in" style={{textAlign: 'center', padding: '3rem', minWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <Gamepad2 size={48} color="var(--accent)" style={{marginBottom: '1rem', animation: 'pulse 2s infinite'}} />
          <h2 style={{margin: '0 0 1rem'}}>Atualizando Dados</h2>
          <p style={{color: 'var(--text-muted)', margin: 0}}>Por favor, aguarde. Isso pode levar alguns minutos...</p>
        </div>
      </div>
    )}
    <div className="app-container animate-fade-in">
      <header className="header glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Boardgame Manager Logo" style={{ width: '350px', maxWidth: '100%', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0px 0px 8px rgba(255,255,255,0.2))' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Olá, <strong>{username}</strong>
            </span>
            <button className="btn" onClick={handleLogout} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
              Sair
            </button>
          </div>
        </div>
        
        <div className="header-actions" style={{display: 'flex', gap: '1rem', width: '100%', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.1)', borderRadius: '12px'}}>
          {/* Ações Básicas */}
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)} title="Adicionar um novo jogo manualmente à coleção" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <Plus size={16} /> Novo Jogo
            </button>
            <button className="btn" onClick={() => setIsReportsModalOpen(true)} title="Visualizar gráficos e estatísticas da sua coleção" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>
              <PieChart size={16} /> Estatísticas
            </button>
            <button className="btn" onClick={() => setIsSettingsModalOpen(true)} title="Ajustar configurações e mapeamento de colunas" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <Settings size={16} /> Configurações
            </button>
          </div>

          <div style={{width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem'}} className="divider" />

          {/* Importações */}
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button className="btn" onClick={() => setIsBGGModalOpen(true)} title="Importar do BGG" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <DownloadCloud size={16} /> BGG
            </button>
            <button className="btn" onClick={() => setIsLudoModalOpen(true)} title="Importar da Ludopedia" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <DownloadCloud size={16} /> Ludopedia
            </button>
            <button className="btn" onClick={() => document.getElementById('excel-upload')?.click()} title="Importar do Excel" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <Upload size={16} /> Excel
            </button>
            <input id="excel-upload" type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{display: 'none'}} />
          </div>

          {games.length > 0 && (
            <>
              <div style={{width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem'}} className="divider" />
              
              {/* Exportações & Danger */}
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button className="btn" onClick={exportToExcel} title="Exportar para Excel" style={{padding: '0.5rem 0.75rem', fontSize: '0.85rem'}}>
                  <FileSpreadsheet size={16} />
                </button>
                <button className="btn" onClick={exportToJson} title="Exportar Backup JSON" style={{padding: '0.5rem 0.75rem', fontSize: '0.85rem'}}>
                  <FileJson size={16} />
                </button>
                <button className="btn" onClick={clearCollection} title="Limpar Coleção Local" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', marginLeft: '0.5rem' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main>
        {games.length === 0 ? (
          <div className="glass-panel" style={{textAlign: 'center', padding: '6rem 2rem'}}>
            <Gamepad2 size={64} color="var(--text-muted)" style={{opacity: 0.5, margin: '0 auto 1.5rem'}} />
            <h2 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Sua Coleção está Vazia</h2>
            <p style={{color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 2rem'}}>
              Faça o upload da sua planilha Excel contendo os dados da sua coleção para começar. As colunas esperadas são: <strong>jogos</strong>, <strong>status</strong>, <strong>tipo</strong>, <strong>valor</strong> (pago) e opcionalmente <strong>valor mercado</strong>.
            </p>
            <label className="btn btn-primary" style={{cursor: 'pointer', fontSize: '1.1rem', padding: '1rem 2rem'}}>
              <Upload size={20} />
              Selecione o Arquivo Excel
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{display: 'none'}} />
            </label>
          </div>
        ) : (
          <>
            <div className="glass-panel" style={{marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', position: 'relative', paddingTop: '2.5rem'}}>
              <button 
                onClick={() => setShowFinancials(!showFinancials)} 
                className="btn" 
                style={{position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem', background: 'transparent', border: 'none', boxShadow: 'none'}}
                title={showFinancials ? "Ocultar Totais Financeiros" : "Exibir Totais Financeiros"}
              >
                {showFinancials ? <EyeOff size={20} color="var(--text-muted)" /> : <Eye size={20} color="var(--text-muted)" />}
              </button>
              <div className="stat-box" style={{flex: 1}}>
                <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Total de Jogos (Entradas)</div>
                <div style={{fontSize: '2rem', fontWeight: 700}}>{games.length}</div>
              </div>
              <div className="stat-box" style={{flex: 1}}>
                <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Total Gasto</div>
                <div style={{fontSize: '2rem', fontWeight: 700, color: '#f87171'}}>
                  {showFinancials ? totals.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ •••••'}
                </div>
              </div>
              <div className="stat-box" style={{flex: 1}}>
                <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Valor Atual da Coleção</div>
                <div style={{fontSize: '2rem', fontWeight: 700, color: '#34d399'}}>
                  {showFinancials ? totals.valorColecao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ •••••'}
                </div>
              </div>
              <div className="stat-box" style={{flex: 1}}>
                <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Valor Vendido</div>
                <div style={{fontSize: '2rem', fontWeight: 700, color: '#60a5fa'}}>
                  {showFinancials ? totals.totalVendido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ •••••'}
                </div>
              </div>
            </div>

            {selectedGameIds.size > 0 && (
              <div className="glass-panel" style={{padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap'}}>
                <span style={{fontWeight: 'bold', marginRight: '1rem'}}>{selectedGameIds.size} jogos selecionados</span>
                <button className="btn btn-primary" onClick={() => handleUpdateSelected('ludo')}>
                  <DownloadCloud size={18} /> Atualizar via Ludopedia
                </button>
                <button className="btn btn-primary" onClick={() => handleUpdateSelected('bgg')}>
                  <DownloadCloud size={18} /> Atualizar via BGG
                </button>
                <button className="btn btn-primary" onClick={() => handleUpdateSelected('compara')} style={{ background: 'var(--accent)' }}>
                  <DownloadCloud size={18} /> Atualizar via Compara Jogos
                </button>
              </div>
            )}

            <div className="filters-bar glass-panel" style={{padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem'}}>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button className="btn" onClick={selectAll} style={{fontSize: '0.9rem'}}>Selecionar Todos</button>
                <button className="btn" onClick={deselectAll} style={{fontSize: '0.9rem'}}>Limpar Seleção</button>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flexGrow: 1, position: 'relative', minWidth: '200px'}}>
                <Search size={18} color="var(--text-muted)" style={{position: 'absolute', left: '1rem'}} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar jogo pelo nome..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{paddingLeft: '2.5rem', width: '100%'}}
                />
              </div>
              <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                <select
                  className="search-input"
                  style={{minWidth: '130px'}}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  {availableStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  className="search-input"
                  style={{minWidth: '150px'}}
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="name">Nome</option>
                  <option value="added_date">Data de Adição</option>
                  <option value="weight">Peso (Complexidade)</option>
                  <option value="spend">Preço Pago</option>
                  <option value="value">Valor Mercado</option>
                </select>
                <select
                  className="search-input"
                  style={{minWidth: '100px'}}
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                >
                  <option value="asc">Crescente</option>
                  <option value="desc">Decrescente</option>
                </select>
              </div>
            </div>

            <div className="games-grid">
              {filteredGames.map(game => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  onEdit={setEditingGame} 
                  isSelected={selectedGameIds.has(game.id)}
                  onToggleSelect={() => toggleSelection(game.id)}
                />
              ))}
            </div>

            {filteredGames.length === 0 && (
              <div className="glass-panel" style={{textAlign: 'center', padding: '3rem', color: 'var(--text-muted)'}}>
                Nenhum jogo encontrado com os filtros atuais.
              </div>
            )}
          </>
        )}
      </main>
    </div>

    {/* Modais fora do container animado para que position:fixed funcione em relação ao viewport */}
    <AddGameModal
      isOpen={isAddModalOpen}
      onClose={() => setIsAddModalOpen(false)}
      onAdd={addGame}
      ludoToken={ludoToken}
    />

    <EditGameModal
      game={editingGame}
      isOpen={editingGame !== null}
      onClose={() => setEditingGame(null)}
      onSave={editGame}
      onDelete={deleteGame}
      onRefreshBGG={(game) => fetchBGGDataForGames([game])}
      onRefreshLudo={(game) => fetchLudoDataForGames([game])}
    />

    <SettingsModal
      isOpen={isSettingsModalOpen}
      onClose={() => setIsSettingsModalOpen(false)}
      mapping={columnMapping}
      onSave={setColumnMapping}
      ludoToken={ludoToken}
      setLudoToken={setLudoToken}
    />

    <BGGImportModal
      isOpen={isBGGModalOpen}
      onClose={() => setIsBGGModalOpen(false)}
      onImport={fetchBGGCollection}
    />

    <LudoImportModal
      isOpen={isLudoModalOpen}
      onClose={() => setIsLudoModalOpen(false)}
      onImport={fetchLudoCollection}
      hasToken={!!ludoToken}
    />

    <ReportsModal
      isOpen={isReportsModalOpen}
      onClose={() => setIsReportsModalOpen(false)}
      games={games}
    />
  </>
  );
}


export default App;

