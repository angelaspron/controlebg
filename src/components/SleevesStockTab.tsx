import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Sparkles,
  RefreshCw,
  ExternalLink,
  Gamepad2
} from 'lucide-react';
import type { GameData, SleeveStockItem, CardSleevesData, CardSleeveSet } from '../types';
import { 
  KNOWN_SLEEVE_BRANDS, 
  POPULAR_SLEEVE_MODELS, 
  computeCollectionSleeveDemands,
  matchStockToDemand,
  isGameInCollection,
  getCardSleeveSizeName,
  formatCardSleeveDimensions,
  parseModelDimensions,
} from '../utils/sleeveUtils';
import '../components.css';

interface ManualSleeveRow {
  id: string;
  name: string;
  quantity: number;
  selectedModel: string;
  customWidth: number;
  customHeight: number;
  isSleeved: boolean;
}

interface SleevesStockTabProps {
  games: GameData[];
  stock: SleeveStockItem[];
  onAddStockItem: (item: Omit<SleeveStockItem, 'id' | 'updatedAt'>) => void;
  onUpdateStockItem: (id: string, updates: Partial<Omit<SleeveStockItem, 'id'>>) => void;
  onDeleteStockItem: (id: string) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  onClickGameDetails?: (game: GameData) => void;
  onFetchSleeves?: (gamesToFetch: GameData[]) => Promise<void>;
  isFetchingSleeves?: boolean;
  fetchProgress?: {
    current: number;
    total: number;
    percentage: number;
    currentGameName: string;
    activeApi: string;
  } | null;
  onCancelFetchSleeves?: () => void;
  onUpdateGameSleeves?: (gameId: string, cardSleeves: CardSleevesData) => void;
}

export function SleevesStockTab({
  games,
  stock,
  onAddStockItem,
  onUpdateStockItem,
  onDeleteStockItem,
  onAdjustQuantity,
  onClickGameDetails,
  onFetchSleeves,
  isFetchingSleeves = false,
  fetchProgress,
  onCancelFetchSleeves,
  onUpdateGameSleeves,
}: SleevesStockTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('Todas');
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'demands'>('stock');

  // Controle de Visualização das Necessidades da Coleção: Por Modelo vs Por Jogo
  const [demandsViewMode, setDemandsViewMode] = useState<'byModel' | 'byGame'>('byModel');
  const [demandSearchTerm, setDemandSearchTerm] = useState('');
  const [demandFilterStatus, setDemandFilterStatus] = useState<'all' | 'pending' | 'sleeved' | 'missing_data'>('all');

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

  // Jogos da coleção (possuídos apenas - exclui estritamente jogos vendidos)
  const ownedGames = useMemo(() => {
    return games.filter(isGameInCollection);
  }, [games]);

  // Demanda calculada exclusivamente para os jogos da coleção
  const collectionDemands = useMemo(() => computeCollectionSleeveDemands(ownedGames), [ownedGames]);

  // Estado do Modal de Inserção/Edição Manual de Sleeves por Jogo
  const [editingSleevesGame, setEditingSleevesGame] = useState<GameData | null>(null);
  const [manualRows, setManualRows] = useState<ManualSleeveRow[]>([]);

  // Trava a rolagem do corpo da página enquanto um modal estiver aberto
  useEffect(() => {
    if (editingSleevesGame || isModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [editingSleevesGame, isModalOpen]);

  const handleOpenEditSleeves = (game: GameData) => {
    setEditingSleevesGame(game);
    const existingSets = (game.cardSleeves?.sets && game.cardSleeves.sets.length > 0)
      ? game.cardSleeves.sets
      : (game.sleevesUsed || []);

    if (existingSets && existingSets.length > 0) {
      setManualRows(existingSets.map((s, idx) => {
        const w = Number(s.width) || 63.5;
        const h = Number(s.height) || 88;
        const matched = POPULAR_SLEEVE_MODELS.find(m => {
          const parsed = parseModelDimensions(m);
          return Math.abs(parsed.width - w) <= 0.8 && Math.abs(parsed.height - h) <= 1.5;
        });

        return {
          id: `row-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: (s as any).name || (s.sizeName && s.sizeName !== 'Especial' ? s.sizeName : ''),
          quantity: Math.max(1, Number(s.quantity) || 1),
          selectedModel: matched || '__custom__',
          customWidth: w,
          customHeight: h,
          isSleeved: s.isSleeved !== undefined ? Boolean(s.isSleeved) : Boolean(game.isSleeved),
        };
      }));
    } else {
      setManualRows([
        {
          id: `row-0-${Date.now()}`,
          name: 'Cartas Principais',
          quantity: 100,
          selectedModel: POPULAR_SLEEVE_MODELS[0],
          customWidth: 63.5,
          customHeight: 88,
          isSleeved: Boolean(game.isSleeved),
        }
      ]);
    }
  };

  const handleCloseEditSleeves = () => {
    setEditingSleevesGame(null);
    setManualRows([]);
  };

  const handleAddManualRow = () => {
    const defaultDim = parseModelDimensions(POPULAR_SLEEVE_MODELS[0]);
    setManualRows(prev => [
      ...prev,
      {
        id: `row-${prev.length}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: `Cartas #${prev.length + 1}`,
        quantity: 50,
        selectedModel: POPULAR_SLEEVE_MODELS[0],
        customWidth: defaultDim.width,
        customHeight: defaultDim.height,
        isSleeved: false,
      }
    ]);
  };

  const handleRemoveManualRow = (id: string) => {
    setManualRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRowModel = (id: string, modelStr: string) => {
    setManualRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      if (modelStr === '__custom__') {
        return { ...row, selectedModel: '__custom__' };
      }
      const parsed = parseModelDimensions(modelStr);
      return {
        ...row,
        selectedModel: modelStr,
        customWidth: parsed.width,
        customHeight: parsed.height,
      };
    }));
  };

  const handleUpdateRowQty = (id: string, qty: number) => {
    setManualRows(prev => prev.map(row => (row.id === id ? { ...row, quantity: Math.max(1, qty) } : row)));
  };

  const handleUpdateRowName = (id: string, name: string) => {
    setManualRows(prev => prev.map(row => (row.id === id ? { ...row, name } : row)));
  };

  const handleUpdateRowCustomWidth = (id: string, width: number) => {
    setManualRows(prev => prev.map(row => (row.id === id ? { ...row, customWidth: width } : row)));
  };

  const handleUpdateRowCustomHeight = (id: string, height: number) => {
    setManualRows(prev => prev.map(row => (row.id === id ? { ...row, customHeight: height } : row)));
  };

  const handleUpdateRowSleeved = (id: string, isSleeved: boolean) => {
    setManualRows(prev => prev.map(row => (row.id === id ? { ...row, isSleeved } : row)));
  };

  const handleSaveManualSleeves = () => {
    if (!editingSleevesGame) return;

    if (manualRows.length === 0) {
      if (onUpdateGameSleeves) {
        onUpdateGameSleeves(editingSleevesGame.id, {
          source: 'Manual',
          sets: []
        });
      }
      handleCloseEditSleeves();
      return;
    }

    const sets: CardSleeveSet[] = manualRows.map(row => {
      let width = row.customWidth;
      let height = row.customHeight;
      let sizeName = 'Especial';

      if (row.selectedModel !== '__custom__') {
        const parsed = parseModelDimensions(row.selectedModel);
        width = parsed.width;
        height = parsed.height;
        sizeName = parsed.sizeName;
      } else {
        sizeName = getCardSleeveSizeName(width, height);
      }

      return {
        name: row.name.trim() || undefined,
        quantity: Math.max(1, Number(row.quantity) || 1),
        width,
        height,
        sizeName: sizeName !== 'Especial' ? sizeName : formatCardSleeveDimensions(width, height),
        isSleeved: Boolean(row.isSleeved),
      };
    });

    const newCardSleeves: CardSleevesData = {
      source: 'Manual',
      sourceUrl: editingSleevesGame.bggId 
        ? `https://boardgamegeek.com/boardgame/${editingSleevesGame.bggId}` 
        : editingSleevesGame.cardSleeves?.sourceUrl,
      sets,
    };

    if (onUpdateGameSleeves) {
      onUpdateGameSleeves(editingSleevesGame.id, newCardSleeves);
    }

    handleCloseEditSleeves();
  };

  // Jogos com e sem dados de sleeves
  const gamesWithSleeves = useMemo(() => {
    return ownedGames.filter(g => 
      (g.cardSleeves?.sets && g.cardSleeves.sets.length > 0) || 
      (g.sleevesUsed && g.sleevesUsed.length > 0)
    );
  }, [ownedGames]);

  const gamesWithoutSleeves = useMemo(() => {
    return ownedGames.filter(g => 
      (!g.cardSleeves?.sets || g.cardSleeves.sets.length === 0) && 
      (!g.sleevesUsed || g.sleevesUsed.length === 0)
    );
  }, [ownedGames]);

  // Ações de busca via API
  const handleFetchAllSleeves = () => {
    if (!onFetchSleeves || isFetchingSleeves) return;
    onFetchSleeves(ownedGames);
  };

  const handleFetchMissingSleeves = () => {
    if (!onFetchSleeves || isFetchingSleeves) return;
    if (gamesWithoutSleeves.length > 0) {
      onFetchSleeves(gamesWithoutSleeves);
    } else {
      onFetchSleeves(ownedGames);
    }
  };

  const handleFetchSingleGame = (game: GameData) => {
    if (!onFetchSleeves || isFetchingSleeves) return;
    onFetchSleeves([game]);
  };

  // Filtros da aba de demandas por modelo
  const filteredDemands = useMemo(() => {
    return collectionDemands.filter(d => {
      const term = demandSearchTerm.toLowerCase().trim();
      const matchesSearch = !term ||
        d.modelName.toLowerCase().includes(term) ||
        d.dimensions.toLowerCase().includes(term) ||
        d.games.some(g => g.name.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      const isFullySleeved = d.neededCards === 0;
      if (demandFilterStatus === 'pending') return !isFullySleeved;
      if (demandFilterStatus === 'sleeved') return isFullySleeved;

      return true;
    });
  }, [collectionDemands, demandSearchTerm, demandFilterStatus]);

  // Filtros da aba de demandas por jogo
  const filteredGamesForDemands = useMemo(() => {
    return ownedGames.filter(g => {
      const term = demandSearchTerm.toLowerCase().trim();
      const matchesSearch = !term ||
        g.name.toLowerCase().includes(term) ||
        (g.cardSleeves?.sets && g.cardSleeves.sets.some(s => 
          (s.sizeName && s.sizeName.toLowerCase().includes(term)) ||
          (s.name && s.name.toLowerCase().includes(term))
        ));

      if (!matchesSearch) return false;

      const hasSleevesData = Boolean(
        (g.cardSleeves?.sets && g.cardSleeves.sets.length > 0) ||
        (g.sleevesUsed && g.sleevesUsed.length > 0)
      );

      if (demandFilterStatus === 'missing_data') return !hasSleevesData;
      if (demandFilterStatus === 'pending') return hasSleevesData && !g.isSleeved;
      if (demandFilterStatus === 'sleeved') return hasSleevesData && Boolean(g.isSleeved);

      return true;
    });
  }, [ownedGames, demandSearchTerm, demandFilterStatus]);

  // Estatísticas do topo
  const stats = useMemo(() => {
    const totalSleeves = stock.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const uniqueModels = new Set(stock.map(item => item.model.trim())).size;
    const uniqueBrands = new Set(stock.map(item => item.brand.trim())).size;

    const totalCardsInCollection = collectionDemands.reduce((sum, d) => sum + d.totalCards, 0);
    const neededCardsInCollection = collectionDemands.reduce((sum, d) => sum + d.neededCards, 0);

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
  }, [stock, collectionDemands, ownedGames]);

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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={15} />
            Necessidades da Coleção ({collectionDemands.length})
            {gamesWithoutSleeves.length > 0 && (
              <span 
                title={`${gamesWithoutSleeves.length} jogo(s) da coleção ainda sem contagem de sleeves puxada via API`}
                style={{
                  background: 'rgba(245, 158, 11, 0.25)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  fontSize: '0.7rem',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  marginLeft: '2px',
                  fontWeight: 600
                }}
              >
                {gamesWithoutSleeves.length} pendentes
              </span>
            )}
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
          {/* Painel Informativo & Sincronização via API */}
          <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ maxWidth: '620px' }}>
                <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="#818cf8" />
                  Necessidades da Coleção: Cruzamento com Estoque & Sleeves por Tipo
                </h4>
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  Puxa e calcula automaticamente via API do Compara Jogos / Ludopedia / BGG a quantidade exata de cartas e modelos de sleeves para cada jogo da sua estante, comparando as necessidades com o seu estoque.
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', padding: '3px 9px', borderRadius: '6px', color: '#cbd5e1' }}>
                    🎮 <strong>{ownedGames.length}</strong> jogos na coleção
                  </span>
                  <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', padding: '3px 9px', borderRadius: '6px', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    ✔ <strong>{gamesWithSleeves.length}</strong> com dados de sleeves
                  </span>
                  {gamesWithoutSleeves.length > 0 ? (
                    <span style={{ fontSize: '0.78rem', background: 'rgba(245, 158, 11, 0.15)', padding: '3px 9px', borderRadius: '6px', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      ⏳ <strong>{gamesWithoutSleeves.length}</strong> pendentes de consulta
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', background: 'rgba(99, 102, 241, 0.15)', padding: '3px 9px', borderRadius: '6px', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                      ✨ 100% da coleção sincronizada
                    </span>
                  )}
                </div>
              </div>

              {/* Botões de Ação de Puxar via API */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {gamesWithoutSleeves.length > 0 ? (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={handleFetchMissingSleeves}
                      disabled={isFetchingSleeves}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.55rem 1rem' }}
                      title="Puxar quantidade de sleeves por tipo dos jogos que ainda não possuem dados cadastrados"
                    >
                      <RefreshCw size={15} className={isFetchingSleeves ? "animate-spin" : ""} />
                      Puxar Sleeves Pendentes ({gamesWithoutSleeves.length})
                    </button>
                    <button
                      className="btn"
                      onClick={handleFetchAllSleeves}
                      disabled={isFetchingSleeves}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.55rem 0.9rem', borderColor: 'rgba(255,255,255,0.15)' }}
                      title="Consultar novamente a API para todos os jogos da coleção"
                    >
                      Atualizar Toda a Coleção
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={handleFetchAllSleeves}
                    disabled={isFetchingSleeves}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.55rem 1.1rem' }}
                    title="Atualizar dados de sleeves de todos os jogos da coleção via API"
                  >
                    <RefreshCw size={15} className={isFetchingSleeves ? "animate-spin" : ""} />
                    Atualizar Sleeves via API ({ownedGames.length} Jogos)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Progresso em Tempo Real */}
          {isFetchingSleeves && (
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: 'rgba(99, 102, 241, 0.14)', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={16} color="#818cf8" className="animate-spin" />
                  <strong style={{ color: '#fff', fontSize: '0.92rem' }}>
                    Consultando API (Compara Jogos / Ludopedia / BGG)...
                  </strong>
                </div>
                {onCancelFetchSleeves && (
                  <button 
                    className="btn" 
                    onClick={onCancelFetchSleeves}
                    style={{ padding: '0.25rem 0.7rem', fontSize: '0.78rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: '6px', overflow: 'hidden', height: '8px', marginBottom: '0.45rem' }}>
                <div 
                  style={{ 
                    background: 'linear-gradient(90deg, #6366f1, #38bdf8)', 
                    height: '100%', 
                    width: `${fetchProgress?.percentage || 0}%`,
                    transition: 'width 0.3s ease'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>
                  {fetchProgress?.currentGameName ? `Jogo: ${fetchProgress.currentGameName}` : 'Processando...'}
                </span>
                <span>
                  {fetchProgress ? `${fetchProgress.current} de ${fetchProgress.total} (${fetchProgress.percentage}%)` : ''}
                </span>
              </div>
            </div>
          )}

          {/* Barra de Seleção de Visão (Por Modelo vs Por Jogo) e Filtros */}
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setDemandsViewMode('byModel')}
                className="btn"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: demandsViewMode === 'byModel' ? 600 : 400,
                  background: demandsViewMode === 'byModel' ? 'var(--accent)' : 'transparent',
                  color: demandsViewMode === 'byModel' ? '#fff' : 'var(--text-muted)',
                  borderColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Layers size={14} /> Por Modelo de Sleeve ({collectionDemands.length})
              </button>
              <button
                onClick={() => setDemandsViewMode('byGame')}
                className="btn"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: demandsViewMode === 'byGame' ? 600 : 400,
                  background: demandsViewMode === 'byGame' ? 'var(--accent)' : 'transparent',
                  color: demandsViewMode === 'byGame' ? '#fff' : 'var(--text-muted)',
                  borderColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Gamepad2 size={14} /> Por Jogo da Coleção ({ownedGames.length})
              </button>
            </div>

            {/* Barra de Busca e Filtro de Status */}
            <div style={{ display: 'flex', gap: '0.5rem', flexGrow: 1, maxWidth: '460px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="search-input"
                  placeholder={demandsViewMode === 'byModel' ? "Filtrar por modelo ou jogo..." : "Buscar jogo na coleção..."}
                  value={demandSearchTerm}
                  onChange={e => setDemandSearchTerm(e.target.value)}
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', fontSize: '0.85rem', width: '100%' }}
                />
              </div>

              <select
                className="search-input"
                style={{ fontSize: '0.82rem', minWidth: '140px' }}
                value={demandFilterStatus}
                onChange={e => setDemandFilterStatus(e.target.value as any)}
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Faltam Sleeves</option>
                <option value="sleeved">100% Sleevados</option>
                {demandsViewMode === 'byGame' && (
                  <option value="missing_data">Sem Dados na API</option>
                )}
              </select>
            </div>
          </div>

          {/* Estado Vazio de Demandas */}
          {collectionDemands.length === 0 && !isFetchingSleeves ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <ShieldCheck size={56} color="#818cf8" style={{ opacity: 0.8, margin: '0 auto 1.25rem auto' }} />
              <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', color: '#fff' }}>
                Nenhum dado de sleeve encontrado na coleção
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.75rem auto', fontSize: '0.92rem', lineHeight: '1.5' }}>
                Puxe automaticamente via API do Compara Jogos / Ludopedia / BGG a quantidade exata de cartas e os tamanhos de sleeves para cada um dos seus <strong>{ownedGames.length} jogos</strong> da coleção.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleFetchMissingSleeves}
                disabled={isFetchingSleeves}
                style={{ padding: '0.75rem 1.8rem', fontSize: '1rem', fontWeight: 600, margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
              >
                <Sparkles size={18} />
                Puxar Sleeves da Coleção via API ({ownedGames.length} Jogos)
              </button>
            </div>
          ) : demandsViewMode === 'byModel' ? (
            /* VISÃO POR MODELO DE SLEEVE */
            filteredDemands.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
                <Layers size={40} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
                <h4>Nenhum modelo corresponde aos filtros</h4>
                <p style={{ fontSize: '0.85rem' }}>Tente alterar os termos de busca ou o filtro de status.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredDemands.map(demand => {
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
            )
          ) : (
            /* VISÃO POR JOGO DA COLEÇÃO */
            filteredGamesForDemands.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
                <Gamepad2 size={40} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
                <h4>Nenhum jogo corresponde aos filtros selecionados</h4>
                <p style={{ fontSize: '0.85rem' }}>Tente alterar a busca ou filtro de status.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                {filteredGamesForDemands.map(game => {
                  const sets = (game.cardSleeves?.sets && game.cardSleeves.sets.length > 0)
                    ? game.cardSleeves.sets
                    : (game.sleevesUsed || []);
                  const hasSleeves = sets.length > 0;
                  const totalCards = sets.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

                  return (
                    <div
                      key={game.id}
                      className="glass-panel"
                      style={{
                        padding: '1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {/* Cabeçalho do Jogo */}
                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                        {game.thumbnail ? (
                          <img
                            src={game.thumbnail}
                            alt={game.name}
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        ) : (
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)'
                          }}>
                            <Gamepad2 size={22} />
                          </div>
                        )}

                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {game.name}
                          </h4>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                              {game.yearPublished || 'Ano N/D'}
                            </span>
                            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px', color: '#94a3b8' }}>
                              {game.type || 'Base'}
                            </span>
                            {hasSleeves && (
                              <>
                                <span style={{ fontSize: '0.7rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  🃏 {totalCards} cartas
                                </span>
                                {game.cardSleeves?.source && (() => {
                                  const src = game.cardSleeves.source;
                                  const isManual = src === 'Manual';
                                  const isBgg = src === 'BoardGameGeek' || src === 'BGG';
                                  const isLudo = src === 'Ludopedia';
                                  const bg = isManual 
                                    ? 'rgba(16, 185, 129, 0.15)' 
                                    : isBgg 
                                      ? 'rgba(239, 68, 68, 0.15)' 
                                      : isLudo 
                                        ? 'rgba(249, 115, 22, 0.15)' 
                                        : 'rgba(99, 102, 241, 0.15)';
                                  const color = isManual ? '#34d399' : isBgg ? '#f87171' : isLudo ? '#fb923c' : '#a5b4fc';
                                  const border = isManual 
                                    ? 'rgba(16, 185, 129, 0.35)' 
                                    : isBgg 
                                      ? 'rgba(239, 68, 68, 0.35)' 
                                      : isLudo 
                                        ? 'rgba(249, 115, 22, 0.35)' 
                                        : 'rgba(99, 102, 241, 0.35)';

                                  return (
                                    <span 
                                      style={{ 
                                        fontSize: '0.68rem', 
                                        background: bg, 
                                        color, 
                                        border: `1px solid ${border}`, 
                                        padding: '1px 6px', 
                                        borderRadius: '4px', 
                                        fontWeight: 600 
                                      }}
                                      title={isManual ? 'Sleeves definidos manualmente pelo usuário' : `Dados de sleeves obtidos via ${src}`}
                                    >
                                      {src}
                                    </span>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button
                            className="btn"
                            title="Inserir ou editar sleeves manualmente neste jogo"
                            onClick={() => handleOpenEditSleeves(game)}
                            style={{ padding: '0.35rem 0.5rem', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)', color: '#6ee7b7' }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="btn"
                            title="Buscar ou atualizar sleeves deste jogo via API"
                            disabled={isFetchingSleeves}
                            onClick={() => handleFetchSingleGame(game)}
                            style={{ padding: '0.35rem 0.5rem', background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.35)', color: '#c7d2fe' }}
                          >
                            <RefreshCw size={13} className={isFetchingSleeves ? "animate-spin" : ""} />
                          </button>
                          {onClickGameDetails && (
                            <button
                              className="btn"
                              title="Ver ficha completa do jogo"
                              onClick={() => onClickGameDetails(game)}
                              style={{ padding: '0.35rem 0.5rem' }}
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lista de Sleeves por Tipo do Jogo */}
                      {hasSleeves ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Tipos de Sleeves Necessários:
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {sets.map((set, sIdx) => {
                              const sName = set.sizeName || `${set.width} × ${set.height} mm`;
                              const isSetSleeved = set.isSleeved !== undefined ? Boolean(set.isSleeved) : Boolean(game.isSleeved);

                              return (
                                <div
                                  key={sIdx}
                                  style={{
                                    background: 'rgba(0,0,0,0.22)',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    gap: '0.5rem'
                                  }}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ color: '#38bdf8' }}>{set.quantity}x</span>
                                      <span>{sName}</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', marginTop: '1px' }}>
                                      <span>{set.width} × {set.height} mm</span>
                                      {(set as any).name && <span>• {(set as any).name}</span>}
                                      {(set as any).sleeveProductName && <span>• {(set as any).sleeveProductName}</span>}
                                    </div>
                                  </div>

                                  <span style={{
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    background: isSetSleeved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.07)',
                                    color: isSetSleeved ? '#34d399' : 'var(--text-muted)',
                                    border: `1px solid ${isSetSleeved ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`
                                  }}>
                                    {isSetSleeved ? '✔ Sleevado' : 'Sem Sleeve'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px dashed rgba(245, 158, 11, 0.3)',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ fontSize: '0.78rem', color: '#fcd34d' }}>
                            Sem dados de sleeves na API ainda
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleOpenEditSleeves(game)}
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Inserir tipos e tamanhos de sleeves manualmente para este jogo"
                            >
                              <Pencil size={12} />
                              Inserir Manualmente
                            </button>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleFetchSingleGame(game)}
                              disabled={isFetchingSleeves}
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Sparkles size={12} />
                              Buscar Sleeves
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* Modal de Adicionar / Editar Item de Estoque */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-overlay" 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            padding: '1rem', boxSizing: 'border-box'
          }} 
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="glass-panel animate-fade-in" 
            style={{ width: '100%', maxWidth: '520px', borderRadius: '16px', margin: 'auto' }} 
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
        </div>,
        document.body
      )}

      {/* Modal de Inserção / Edição Manual de Sleeves de um Jogo */}
      {editingSleevesGame && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-overlay" 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            padding: '1rem', boxSizing: 'border-box'
          }} 
          onClick={handleCloseEditSleeves}
        >
          <div 
            className="glass-panel animate-fade-in" 
            style={{ 
              width: '100%', 
              maxWidth: '680px', 
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              margin: 'auto'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={22} color="#10b981" />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>
                    Sleeves: {editingSleevesGame.name}
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Defina ou ajuste manualmente os tipos de sleeves, medidas e quantidades para este jogo da coleção.
                </p>
              </div>
              <button 
                onClick={handleCloseEditSleeves}
                className="btn"
                style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Origem e aviso */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: '#a7f3d0'
            }}>
              <span>
                ✍️ <strong>Edição Manual:</strong> Ao salvar, estes dados terão preferência e indicarão origem <strong>Manual</strong>.
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                Manual
              </span>
            </div>

            {/* Lista de Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Tipos e Tamanhos de Cartas ({manualRows.length})
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddManualRow}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Plus size={14} />
                  Adicionar Tipo de Sleeve
                </button>
              </div>

              {manualRows.length === 0 ? (
                <div style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '10px'
                }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Nenhum tipo de sleeve cadastrado para este jogo.
                  </p>
                  <p style={{ margin: '0.35rem 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Clique no botão abaixo para adicionar as medidas e quantidades de cartas.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddManualRow}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} />
                    Adicionar Primeiro Tipo
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {manualRows.map((row, idx) => (
                    <div
                      key={row.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>
                          #{idx + 1} Tipo de Sleeve
                        </span>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => handleRemoveManualRow(row.id)}
                          title="Remover este tipo"
                          style={{
                            padding: '0.25rem 0.5rem',
                            color: 'var(--danger)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Trash2 size={13} />
                          Remover
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                        {/* Descrição / Nome do set */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            Identificação / Tipo de Carta:
                          </label>
                          <input
                            type="text"
                            className="search-input"
                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                            placeholder="Ex: Cartas Principais, Monstros"
                            value={row.name}
                            onChange={e => handleUpdateRowName(row.id, e.target.value)}
                          />
                        </div>

                        {/* Quantidade */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            Quantidade de Cartas:
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="search-input"
                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                            value={row.quantity}
                            onChange={e => handleUpdateRowQty(row.id, parseInt(e.target.value, 10) || 1)}
                          />
                        </div>

                        {/* Tamanho / Modelo */}
                        <div style={{ gridColumn: row.selectedModel === '__custom__' ? 'auto' : 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            Tamanho / Modelo Padrão:
                          </label>
                          <select
                            className="search-input"
                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                            value={row.selectedModel}
                            onChange={e => handleUpdateRowModel(row.id, e.target.value)}
                          >
                            {POPULAR_SLEEVE_MODELS.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                            <option value="__custom__">Outro / Medida Personalizada (mm)...</option>
                          </select>
                        </div>

                        {/* Se custom: Largura e Altura */}
                        {row.selectedModel === '__custom__' && (
                          <>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                Largura (mm):
                              </label>
                              <input
                                type="number"
                                min="20"
                                max="200"
                                className="search-input"
                                style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                                value={row.customWidth}
                                onChange={e => handleUpdateRowCustomWidth(row.id, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                Altura (mm):
                              </label>
                              <input
                                type="number"
                                min="20"
                                max="300"
                                className="search-input"
                                style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                                value={row.customHeight}
                                onChange={e => handleUpdateRowCustomHeight(row.id, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Status de Sleevado */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={row.isSleeved}
                            onChange={e => handleUpdateRowSleeved(row.id, e.target.checked)}
                            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                          />
                          <span>Este tipo de carta já está sleevado no meu jogo</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações do Footer */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderTop: '1px solid var(--border-color)', 
              paddingTop: '1rem',
              marginTop: '0.5rem',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div>
                {manualRows.length > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setManualRows([])}
                    style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                    title="Remove todos os tipos de sleeves deste jogo"
                  >
                    Limpar todos os sleeves
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleCloseEditSleeves}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveManualSleeves}
                  style={{ padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={16} />
                  Salvar Sleeves (Manual)
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
