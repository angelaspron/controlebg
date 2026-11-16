import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Search, 
  Trash2, 
  Pencil, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Package, 
  X,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import type { GameData, SleeveStockItem } from '../types';
import { 
  KNOWN_SLEEVE_BRANDS, 
  POPULAR_SLEEVE_MODELS, 
  computeCollectionSleeveDemands,
  matchStockToDemand,
} from '../utils/sleeveUtils';
import '../components.css';

interface SleevesStockTabProps {
  games: GameData[];
  stock: SleeveStockItem[];
  onAddStockItem: (item: Omit<SleeveStockItem, 'id' | 'updatedAt'>) => void;
  onUpdateStockItem: (id: string, updates: Partial<Omit<SleeveStockItem, 'id'>>) => void;
  onDeleteStockItem: (id: string) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  onClickGameDetails?: (game: GameData) => void;
}

export function SleevesStockTab({
  games,
  stock,
  onAddStockItem,
  onUpdateStockItem,
  onDeleteStockItem,
  onAdjustQuantity,
  onClickGameDetails,
}: SleevesStockTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('Todas');
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'demands'>('stock');

  // Estado do Modal de Adicionar/Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SleeveStockItem | null>(null);

  // Form states
  const [formModelSelect, setFormModelSelect] = useState(POPULAR_SLEEVE_MODELS[0]);
  const [formCustomModel, setFormCustomModel] = useState('');
  const [formBrandSelect, setFormBrandSelect] = useState(KNOWN_SLEEVE_BRANDS[0]);
  const [formCustomBrand, setFormCustomBrand] = useState('');
  const [formQuantity, setFormQuantity] = useState(100);
  const [formType, setFormType] = useState('Padrão');
  const [formNotes, setFormNotes] = useState('');

  // Expandir jogos de uma demanda
  const [expandedDemandKeys, setExpandedDemandKeys] = useState<Set<string>>(new Set());

  const toggleDemandExpand = (key: string) => {
    setExpandedDemandKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Demanda calculada a partir dos dados do Compara Jogos da coleção
  const collectionDemands = useMemo(() => computeCollectionSleeveDemands(games), [games]);

  // Estatísticas do topo
  const stats = useMemo(() => {
    const totalSleeves = stock.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const uniqueModels = new Set(stock.map(item => item.model.trim())).size;
    const uniqueBrands = new Set(stock.map(item => item.brand.trim())).size;

    const totalCardsInCollection = collectionDemands.reduce((sum, d) => sum + d.totalCards, 0);
    const neededCardsInCollection = collectionDemands.reduce((sum, d) => sum + d.neededCards, 0);

    const ownedGames = games.filter(g => {
      const s = String(g.status || '').toLowerCase();
      return s.includes('coleção') || s.includes('sim') || !s.includes('vendido');
    });

    const sleevedGamesCount = ownedGames.filter(g => Boolean(g.isSleeved)).length;

    return {
      totalSleeves,
      uniqueModels,
      uniqueBrands,
      totalCardsInCollection,
      neededCardsInCollection,
      totalOwnedGames: ownedGames.length,
      sleevedGamesCount,
    };
  }, [stock, collectionDemands, games]);

  // Marcas únicas presentes no estoque
  const stockBrands = useMemo(() => {
    const brands = new Set(stock.map(item => item.brand.trim()).filter(Boolean));
    return ['Todas', ...Array.from(brands).sort((a, b) => a.localeCompare(b))];
  }, [stock]);

  // Filtro de itens no estoque
  const filteredStock = useMemo(() => {
    return stock.filter(item => {
      const matchesSearch = 
        item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.type && item.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesBrand = brandFilter === 'Todas' || item.brand === brandFilter;

      return matchesSearch && matchesBrand;
    });
  }, [stock, searchTerm, brandFilter]);

  // Abrir modal para novo item
  const handleOpenAdd = (defaultModel?: string) => {
    setEditingItem(null);
    if (defaultModel && POPULAR_SLEEVE_MODELS.includes(defaultModel)) {
      setFormModelSelect(defaultModel);
      setFormCustomModel('');
    } else if (defaultModel) {
      setFormModelSelect('__other__');
      setFormCustomModel(defaultModel);
    } else {
      setFormModelSelect(POPULAR_SLEEVE_MODELS[0]);
      setFormCustomModel('');
    }
    setFormBrandSelect(KNOWN_SLEEVE_BRANDS[0]);
    setFormCustomBrand('');
    setFormQuantity(100);
    setFormType('Padrão');
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Abrir modal para editar item
  const handleOpenEdit = (item: SleeveStockItem) => {
    setEditingItem(item);
    if (POPULAR_SLEEVE_MODELS.includes(item.model)) {
      setFormModelSelect(item.model);
      setFormCustomModel('');
    } else {
      setFormModelSelect('__other__');
      setFormCustomModel(item.model);
    }

    if (KNOWN_SLEEVE_BRANDS.includes(item.brand)) {
      setFormBrandSelect(item.brand);
      setFormCustomBrand('');
    } else {
      setFormBrandSelect('__other__');
      setFormCustomBrand(item.brand);
    }

    setFormQuantity(item.quantity);
    setFormType(item.type || 'Padrão');
    setFormNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const finalModel = formModelSelect === '__other__' ? formCustomModel.trim() : formModelSelect.trim();
    const finalBrand = formBrandSelect === '__other__' ? formCustomBrand.trim() : formBrandSelect.trim();

    if (!finalModel) {
      alert('Por favor, informe o modelo do sleeve.');
      return;
    }
    if (!finalBrand) {
      alert('Por favor, informe a marca do sleeve.');
      return;
    }

    if (editingItem) {
      onUpdateStockItem(editingItem.id, {
        model: finalModel,
        brand: finalBrand,
        quantity: Math.max(0, Number(formQuantity) || 0),
        type: formType.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      onAddStockItem({
        model: finalModel,
        brand: finalBrand,
        quantity: Math.max(0, Number(formQuantity) || 0),
        type: formType.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (item: SleeveStockItem) => {
    if (window.confirm(`Tem certeza que deseja remover ${item.model} (${item.brand}) do estoque?`)) {
      onDeleteStockItem(item.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Cards de Resumo do Estoque & Demanda */}
      <div className="glass-panel financial-summary-grid">
        <div className="stat-box">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Total no Estoque
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#38bdf8' }}>
            {stats.totalSleeves.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            sleeves disponíveis
          </div>
        </div>

        <div className="stat-box">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Variedade no Estoque
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#a78bfa' }}>
            {stats.uniqueModels}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            modelos em {stats.uniqueBrands} marcas
          </div>
        </div>

        <div className="stat-box">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Cartas da Coleção
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#fbbf24' }}>
            {stats.totalCardsInCollection.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {stats.neededCardsInCollection} em jogos s/ sleeve
          </div>
        </div>

        <div className="stat-box">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Jogos Sleevados
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#34d399' }}>
            {stats.sleevedGamesCount} / {stats.totalOwnedGames}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {stats.totalOwnedGames > 0 
              ? `${Math.round((stats.sleevedGamesCount / stats.totalOwnedGames) * 100)}% da coleção protegida` 
              : '0% protegido'}
          </div>
        </div>

        <div className="stat-box">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Balanço Geral
          </div>
          <div style={{ 
            fontSize: '1.9rem', 
            fontWeight: 700, 
            color: (stats.totalSleeves - stats.neededCardsInCollection) >= 0 ? '#10b981' : '#f87171' 
          }}>
            {(stats.totalSleeves - stats.neededCardsInCollection) >= 0 ? '+' : ''}
            {(stats.totalSleeves - stats.neededCardsInCollection).toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {(stats.totalSleeves - stats.neededCardsInCollection) >= 0 ? 'Suficiente p/ pendentes' : 'Faltam sleeves'}
          </div>
        </div>
      </div>

      {/* Seletor de Sub-Visão: Meu Estoque vs Cruzamento */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveSubTab('stock')}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.88rem',
              fontWeight: activeSubTab === 'stock' ? 600 : 400,
              background: activeSubTab === 'stock' ? 'var(--accent)' : 'transparent',
              color: activeSubTab === 'stock' ? '#fff' : 'var(--text-muted)',
              borderColor: 'transparent',
            }}
          >
            <Package size={15} />
            Meu Estoque ({stock.length})
          </button>
          <button
            onClick={() => setActiveSubTab('demands')}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.88rem',
              fontWeight: activeSubTab === 'demands' ? 600 : 400,
              background: activeSubTab === 'demands' ? 'var(--accent)' : 'transparent',
              color: activeSubTab === 'demands' ? '#fff' : 'var(--text-muted)',
              borderColor: 'transparent',
            }}
          >
            <ShieldCheck size={15} />
            Necessidades da Coleção ({collectionDemands.length})
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => handleOpenAdd()}
          style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          Adicionar ao Estoque
        </button>
      </div>

      {/* Conteúdo da Sub-Aba: MEU ESTOQUE */}
      {activeSubTab === 'stock' && (
        <>
          {/* Barra de Filtros */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexGrow: 1, position: 'relative', minWidth: '220px' }}>
              <Search size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem' }} />
              <input
                type="text"
                className="search-input"
                placeholder="Buscar por modelo, marca ou tipo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.5rem', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Marca:</span>
              <select
                className="search-input"
                style={{ minWidth: '150px' }}
                value={brandFilter}
                onChange={e => setBrandFilter(e.target.value)}
              >
                {stockBrands.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista do Estoque */}
          {filteredStock.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Package size={52} color="var(--text-muted)" style={{ opacity: 0.4, margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                {stock.length === 0 ? 'Nenhum sleeve cadastrado no estoque' : 'Nenhum item corresponde aos filtros'}
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
                {stock.length === 0 
                  ? 'Cadastre os protetores de cartas que você possui para controlar a quantidade disponível e comparar com o que seus jogos precisam.'
                  : 'Tente alterar os termos de busca ou remover os filtros de marca.'}
              </p>
              {stock.length === 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => handleOpenAdd('Padrão (63,5 × 88 mm)')}>
                    <Plus size={15} /> Cadastrar Sleeve Padrão
                  </button>
                  <button className="btn" onClick={() => handleOpenAdd('Mini Euro (45 × 68 mm)')}>
                    <Plus size={15} /> Cadastrar Mini Euro
                  </button>
                  <button className="btn" onClick={() => handleOpenAdd('Tarot (70 × 120 mm)')}>
                    <Plus size={15} /> Cadastrar Tarot
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {filteredStock.map(item => {
                const matchedDemand = matchStockToDemand(item, collectionDemands);
                return (
                  <div 
                    key={item.id} 
                    className="glass-panel" 
                    style={{ 
                      padding: '1.25rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.85rem',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'border-color 0.2s ease, transform 0.2s ease',
                    }}
                  >
                    {/* Header do Card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>
                          {item.model}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ 
                            background: 'rgba(99, 102, 241, 0.18)', 
                            color: '#a5b4fc', 
                            border: '1px solid rgba(99, 102, 241, 0.35)', 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.75rem', 
                            fontWeight: 600 
                          }}>
                            {item.brand}
                          </span>
                          {item.type && (
                            <span style={{ 
                              background: 'rgba(255, 255, 255, 0.06)', 
                              color: 'var(--text-muted)', 
                              border: '1px solid rgba(255, 255, 255, 0.1)', 
                              padding: '2px 7px', 
                              borderRadius: '6px', 
                              fontSize: '0.75rem' 
                            }}>
                              {item.type}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          className="btn"
                          title="Editar item do estoque"
                          style={{ padding: '0.4rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil size={14} color="#a5b4fc" />
                        </button>
                        <button
                          className="btn"
                          title="Excluir item do estoque"
                          style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 size={14} color="#f87171" />
                        </button>
                      </div>
                    </div>

                    {/* Quantidade & Ajustes Rápidos */}
                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.25)', 
                      padding: '0.75rem 1rem', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Quantidade em Estoque</span>
                        <strong style={{ fontSize: '1.6rem', color: item.quantity > 0 ? '#38bdf8' : '#f87171', fontWeight: 700 }}>
                          {item.quantity.toLocaleString('pt-BR')}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>unidades</span>
                      </div>

                      <div className="qty-adjust-group">
                        <button 
                          className="qty-btn negative" 
                          onClick={() => onAdjustQuantity(item.id, -50)} 
                          title="Diminuir 50"
                          disabled={item.quantity <= 0}
                        >
                          -50
                        </button>
                        <button 
                          className="qty-btn negative" 
                          onClick={() => onAdjustQuantity(item.id, -10)} 
                          title="Diminuir 10"
                          disabled={item.quantity <= 0}
                        >
                          -10
                        </button>
                        <button 
                          className="qty-btn" 
                          onClick={() => onAdjustQuantity(item.id, +10)} 
                          title="Adicionar 10"
                        >
                          +10
                        </button>
                        <button 
                          className="qty-btn" 
                          onClick={() => onAdjustQuantity(item.id, +50)} 
                          title="Adicionar 50"
                        >
                          +50
                        </button>
                        <button 
                          className="qty-btn" 
                          onClick={() => onAdjustQuantity(item.id, +100)} 
                          title="Adicionar 1 pacote (+100)"
                          style={{ background: 'rgba(99, 102, 241, 0.25)', borderColor: 'rgba(99, 102, 241, 0.45)' }}
                        >
                          +100
                        </button>
                      </div>
                    </div>

                    {/* Comparativo de Cobertura com a Coleção */}
                    {matchedDemand && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span>Demanda da Coleção:</span>
                          <strong style={{ color: '#fff' }}>{matchedDemand.neededCards} cartas pendentes</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Saldo p/ pendentes:</span>
                          <span style={{ 
                            fontWeight: 600, 
                            color: (item.quantity - matchedDemand.neededCards) >= 0 ? '#34d399' : '#f87171' 
                          }}>
                            {(item.quantity - matchedDemand.neededCards) >= 0 
                              ? `+${item.quantity - matchedDemand.neededCards} sobrando` 
                              : `Faltam ${matchedDemand.neededCards - item.quantity}`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Observações */}
                    {item.notes && (
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Nota: {item.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Conteúdo da Sub-Aba: CRUZAMENTO COM A COLEÇÃO */}
      {activeSubTab === 'demands' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#818cf8" />
              Cruzamento Automático: Cartas da Coleção vs Estoque de Sleeves
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Esta tabela lista todos os tamanhos de sleeves cadastrados na API do Compara Jogos para os títulos da sua estante, comparando as cartas necessárias com os protetores que você tem no estoque.
            </p>
          </div>

          {collectionDemands.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
              <Layers size={48} style={{ opacity: 0.3, margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Nenhum dado de sleeve encontrado na coleção</h3>
              <p style={{ fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
                Selecione seus jogos na aba Coleção e utilize o botão <strong>Compara Jogos</strong> ou <strong>Atualização Paralela</strong> para importar as contagens oficiais de cartas.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {collectionDemands.map(demand => {
                // Calcular quanto temos em estoque para este modelo
                const stockForDemand = stock.filter(item => {
                  const matched = matchStockToDemand(item, [demand]);
                  return matched !== undefined;
                });
                const totalStockAvailable = stockForDemand.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                const isExpanded = expandedDemandKeys.has(demand.key);
                const balance = totalStockAvailable - demand.neededCards;
                const isFullySleeved = demand.neededCards === 0;

                return (
                  <div
                    key={demand.key}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                            {demand.modelName}
                          </h4>
                          <span style={{ 
                            background: 'rgba(255,255,255,0.06)', 
                            border: '1px solid rgba(255,255,255,0.12)', 
                            color: '#94a3b8', 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.78rem' 
                          }}>
                            {demand.dimensions}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Usado em <strong>{demand.games.length}</strong> jogo(s) da coleção
                        </div>
                      </div>

                      {/* Status de Saldo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Cartas Pendentes / Total</span>
                          <strong style={{ fontSize: '1.05rem', color: '#fff' }}>
                            {demand.neededCards} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {demand.totalCards}</span>
                          </strong>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>No Estoque</span>
                          <strong style={{ fontSize: '1.05rem', color: totalStockAvailable > 0 ? '#38bdf8' : '#f87171' }}>
                            {totalStockAvailable}
                          </strong>
                        </div>

                        <div>
                          {isFullySleeved ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.18)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.4)'
                            }}>
                              <CheckCircle2 size={14} /> 100% Sleevado
                            </span>
                          ) : balance >= 0 ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.18)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.4)'
                            }}>
                              <CheckCircle2 size={14} /> Suficiente (+{balance})
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.35)'
                            }}>
                              <AlertCircle size={14} /> Faltam {Math.abs(balance)}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn"
                            title="Cadastrar compra/pacote deste modelo no estoque"
                            onClick={() => handleOpenAdd(`${demand.modelName} (${demand.dimensions})`)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#c7d2fe' }}
                          >
                            <Plus size={13} /> +Estoque
                          </button>

                          <button
                            className="btn"
                            onClick={() => toggleDemandExpand(demand.key)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                            title="Ver jogos que usam este tamanho"
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Lista Expandida de Jogos */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '0.5rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Jogos da Coleção que utilizam este modelo:
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
                          {demand.games.map((g, idx) => (
                            <div
                              key={`${g.id}-${idx}`}
                              style={{
                                background: 'rgba(0, 0, 0, 0.25)',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                cursor: onClickGameDetails ? 'pointer' : 'default',
                              }}
                              onClick={() => {
                                if (onClickGameDetails) {
                                  const targetGame = games.find(gm => gm.id === g.id);
                                  if (targetGame) onClickGameDetails(targetGame);
                                }
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {g.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {g.quantity} cartas
                                </div>
                              </div>

                              <span style={{
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: g.isSleeved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.07)',
                                color: g.isSleeved ? '#34d399' : 'var(--text-muted)',
                                border: `1px solid ${g.isSleeved ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`
                              }}>
                                {g.isSleeved ? '✔ Sleevado' : 'Sem Sleeve'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Adicionar / Editar Item de Estoque */}
      {isModalOpen && (
        <div 
          className="modal-overlay" 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '1rem'
          }} 
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="glass-panel animate-fade-in" 
            style={{ width: '100%', maxWidth: '520px', borderRadius: '16px' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={20} color="var(--accent)" />
                {editingItem ? 'Editar Sleeve no Estoque' : 'Novo Sleeve no Estoque'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn"
                style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Modelo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Modelo / Tamanho:
                </label>
                <select
                  className="search-input"
                  style={{ width: '100%' }}
                  value={formModelSelect}
                  onChange={e => setFormModelSelect(e.target.value)}
                >
                  {POPULAR_SLEEVE_MODELS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__other__">Outro / Inserir Manualmente...</option>
                </select>
                {formModelSelect === '__other__' && (
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%', marginTop: '0.4rem' }}
                    placeholder="Ex: Quadrado (70 × 70 mm) ou 75x105"
                    value={formCustomModel}
                    onChange={e => setFormCustomModel(e.target.value)}
                    required
                  />
                )}
              </div>

              {/* Marca */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Marca do Sleeve:
                </label>
                <select
                  className="search-input"
                  style={{ width: '100%' }}
                  value={formBrandSelect}
                  onChange={e => setFormBrandSelect(e.target.value)}
                >
                  {KNOWN_SLEEVE_BRANDS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="__other__">Outra (digitar marca)</option>
                </select>
                {formBrandSelect === '__other__' && (
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%', marginTop: '0.4rem' }}
                    placeholder="Ex: Minha Marca de Sleeve"
                    value={formCustomBrand}
                    onChange={e => setFormCustomBrand(e.target.value)}
                    required
                  />
                )}
              </div>

              {/* Quantidade */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Quantidade Total (unidades de sleeves):
                  </label>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button 
                      type="button" 
                      className="qty-btn" 
                      onClick={() => setFormQuantity(prev => prev + 50)}
                      title="Adicionar 50 unidades"
                    >
                      +50
                    </button>
                    <button 
                      type="button" 
                      className="qty-btn" 
                      onClick={() => setFormQuantity(prev => prev + 100)}
                      title="Adicionar 1 pacote de 100"
                    >
                      +100
                    </button>
                    <button 
                      type="button" 
                      className="qty-btn" 
                      onClick={() => setFormQuantity(prev => prev + 110)}
                      title="Adicionar 1 pacote de 110 (padrão Bucaneiros)"
                    >
                      +110
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="search-input"
                  style={{ width: '100%', fontSize: '1.05rem', fontWeight: 600 }}
                  value={formQuantity}
                  onChange={e => setFormQuantity(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>

              {/* Tipo / Espessura */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Tipo / Espessura (opcional):
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  {['Padrão', 'Premium', 'Slim', 'Matte', 'Extra Premium'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      style={{
                        background: formType === t ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${formType === t ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                        color: formType === t ? '#fff' : 'var(--text-muted)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%' }}
                  placeholder="Ex: Premium, Slim, Matte"
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                />
              </div>

              {/* Observações */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Observações (opcional):
                </label>
                <textarea
                  className="search-input"
                  style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
                  placeholder="Ex: Guardado na gaveta 2, pacote lacrado comprado na Bravo Jogos"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1.25rem' }}
                >
                  {editingItem ? 'Salvar Alterações' : 'Adicionar ao Estoque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
