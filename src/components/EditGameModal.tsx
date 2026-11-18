import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, CheckCircle2, RefreshCw, Dices, ShieldCheck, Plus, Trash2, Layers } from 'lucide-react';
import type { GameData, CardSleeveSet, GameSleeveUsage } from '../types';
import '../components.css';
import { updateSingleGameParallel } from '../services/batchProcessor';
import { 
  KNOWN_SLEEVE_BRANDS, 
  POPULAR_SLEEVE_MODELS, 
  SLEEVE_SUBTYPES,
  parseModelDimensions, 
  formatCardSleeveDimensions, 
  summarizeGameSleeves 
} from '../utils/sleeveUtils';

interface EditSleeveItem {
  id: string;
  name: string;
  quantity: number;
  width: number;
  height: number;
  sizeName: string;
  isSleeved: boolean;
  brand: string;
  isCustomBrand: boolean;
  customBrand: string;
  type: string;
  isCustomAdded: boolean;
  isCustomModel?: boolean;
  customModel?: string;
}

interface EditGameModalProps {
  game: GameData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<GameData, 'id'>>) => void;
  onDelete: (id: string) => void;
  onRefreshBGG?: (game: GameData) => void;
  onRefreshLudo?: (game: GameData) => void;
  bggToken?: string;
  ludoToken?: string;
}

export function EditGameModal({ game, isOpen, onClose, onSave, onDelete, onRefreshBGG, onRefreshLudo, bggToken, ludoToken }: EditGameModalProps) {
  const [name, setName] = useState('');
  const [bggIdInput, setBggIdInput] = useState('');
  const [status, setStatus] = useState('Na Coleção');
  const [isPlayed, setIsPlayed] = useState(false);
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
  const [noCards, setNoCards] = useState(false);
  const [isSleeved, setIsSleeved] = useState(false);
  const [sleeveBrand, setSleeveBrand] = useState('');
  const [sleeveType, setSleeveType] = useState('');
  const [editSleeveList, setEditSleeveList] = useState<EditSleeveItem[]>([]);
  const [currentThumbnail, setCurrentThumbnail] = useState<string | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (game) {
      setName(game.name || '');
      setBggIdInput(game.bggId || '');
      setStatus(game.status || 'Na Coleção');
      setIsPlayed(Boolean(game.isPlayed));
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
      setNoCards(Boolean(game.noCards));
      setIsSleeved(Boolean(game.isSleeved));
      setSleeveBrand(game.sleeveBrand || '');
      setSleeveType(game.sleeveType || '');
      setCurrentThumbnail(game.thumbnail);
      setStatusMsg(null);

      const items: EditSleeveItem[] = [];

      // 1. Carregar conjuntos de sleeves do Compara Jogos
      if (game.cardSleeves?.sets && game.cardSleeves.sets.length > 0) {
        game.cardSleeves.sets.forEach((set, idx) => {
          const setBrand = set.sleeveBrand || (game.isSleeved ? (game.sleeveBrand || '') : '');
          const isKnown = KNOWN_SLEEVE_BRANDS.some(b => b.toLowerCase() === setBrand.toLowerCase());
          const setSleeved = set.isSleeved !== undefined ? Boolean(set.isSleeved) : Boolean(game.isSleeved);

          const matchingPopularModel = POPULAR_SLEEVE_MODELS.find(m => {
            const parsed = parseModelDimensions(m);
            return (
              (set.sizeName && parsed.sizeName.toLowerCase() === set.sizeName.toLowerCase()) ||
              (Math.abs(set.width - parsed.width) <= 0.6 && Math.abs(set.height - parsed.height) <= 1.2)
            );
          });
          const isCustomModel = !matchingPopularModel;
          const customModel = isCustomModel
            ? (set.sizeName ? `${set.sizeName} (${formatCardSleeveDimensions(set.width, set.height)})` : formatCardSleeveDimensions(set.width, set.height))
            : '';

          items.push({
            id: `set-${idx}-${set.width}-${set.height}`,
            name: set.name || set.sizeName || `Cartas #${idx + 1}`,
            quantity: set.quantity,
            width: set.width,
            height: set.height,
            sizeName: set.sizeName || 'Padrão',
            isSleeved: setSleeved,
            brand: isKnown ? setBrand : (setBrand ? '__other__' : (KNOWN_SLEEVE_BRANDS[0] || 'Bucaneiros')),
            isCustomBrand: Boolean(setBrand && !isKnown),
            customBrand: isKnown ? '' : setBrand,
            type: set.sleeveType || (game.isSleeved ? (game.sleeveType || '') : ''),
            isCustomAdded: false,
            isCustomModel,
            customModel,
          });
        });
      }

      // 2. Carregar sleeves adicionais configurados manualmente pelo usuário
      if (game.sleevesUsed && game.sleevesUsed.length > 0) {
        game.sleevesUsed.forEach((su, idx) => {
          if (items.some(it => it.id === su.id)) return;
          const suBrand = su.sleeveBrand || '';
          const isKnown = KNOWN_SLEEVE_BRANDS.some(b => b.toLowerCase() === suBrand.toLowerCase());
          const parsedDim = parseModelDimensions(su.dimensions || su.sizeName);
          const finalWidth = su.width || parsedDim.width;
          const finalHeight = su.height || parsedDim.height;

          const matchingPopularModel = POPULAR_SLEEVE_MODELS.find(m => {
            const parsed = parseModelDimensions(m);
            return (
              (su.sizeName && parsed.sizeName.toLowerCase() === su.sizeName.toLowerCase()) ||
              (Math.abs(finalWidth - parsed.width) <= 0.6 && Math.abs(finalHeight - parsed.height) <= 1.2)
            );
          });
          const isCustomModel = !matchingPopularModel;
          const customModel = isCustomModel
            ? (su.dimensions || `${su.sizeName} (${formatCardSleeveDimensions(finalWidth, finalHeight)})`)
            : '';

          items.push({
            id: su.id || `custom-${idx}-${Date.now()}`,
            name: su.sizeName,
            quantity: su.quantity || 0,
            width: finalWidth,
            height: finalHeight,
            sizeName: su.sizeName,
            isSleeved: su.isSleeved !== undefined ? Boolean(su.isSleeved) : true,
            brand: isKnown ? suBrand : (suBrand ? '__other__' : (KNOWN_SLEEVE_BRANDS[0] || 'Bucaneiros')),
            isCustomBrand: Boolean(suBrand && !isKnown),
            customBrand: isKnown ? '' : suBrand,
            type: su.sleeveType || '',
            isCustomAdded: true,
            isCustomModel,
            customModel,
          });
        });
      }

      // 3. Fallback: se não há sets nem sleevesUsed mas o jogo está marcado como sleevado ou possui marca
      if (items.length === 0 && (game.isSleeved || game.sleeveBrand)) {
        const isKnown = KNOWN_SLEEVE_BRANDS.some(b => b.toLowerCase() === (game.sleeveBrand || '').toLowerCase());
        const parsedDim = parseModelDimensions(POPULAR_SLEEVE_MODELS[0]);
        items.push({
          id: `custom-0-${Date.now()}`,
          name: 'Cartas Principais',
          quantity: 100,
          width: parsedDim.width,
          height: parsedDim.height,
          sizeName: parsedDim.sizeName,
          isSleeved: Boolean(game.isSleeved),
          brand: isKnown ? (game.sleeveBrand || '') : (game.sleeveBrand ? '__other__' : KNOWN_SLEEVE_BRANDS[0]),
          isCustomBrand: Boolean(game.sleeveBrand && !isKnown),
          customBrand: isKnown ? '' : (game.sleeveBrand || ''),
          type: game.sleeveType || '',
          isCustomAdded: true,
          isCustomModel: false,
          customModel: '',
        });
      }

      setEditSleeveList(items);
    }
  }, [game]);

  const handleToggleGlobalSleeved = () => {
    const nextVal = !isSleeved;
    setIsSleeved(nextVal);
    if (editSleeveList.length === 0 && nextVal) {
      const parsedDim = parseModelDimensions(POPULAR_SLEEVE_MODELS[0]);
      setEditSleeveList([
        {
          id: `custom-${Date.now()}`,
          name: 'Cartas Principais',
          quantity: 100,
          width: parsedDim.width,
          height: parsedDim.height,
          sizeName: parsedDim.sizeName,
          isSleeved: true,
          brand: KNOWN_SLEEVE_BRANDS[0],
          isCustomBrand: false,
          customBrand: '',
          type: 'Padrão',
          isCustomAdded: true,
        }
      ]);
    } else {
      setEditSleeveList(prev => prev.map(item => ({ ...item, isSleeved: nextVal })));
    }
  };

  const handleToggleItemSleeved = (id: string) => {
    setEditSleeveList(prev => {
      const next = prev.map(item => item.id === id ? { ...item, isSleeved: !item.isSleeved } : item);
      setIsSleeved(next.some(item => item.isSleeved));
      return next;
    });
  };

  const handleItemBrandChange = (id: string, brandVal: string) => {
    setEditSleeveList(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (brandVal === '__other__') {
          return { ...item, brand: '__other__', isCustomBrand: true };
        }
        return { ...item, brand: brandVal, isCustomBrand: false, customBrand: '' };
      })
    );
  };

  const handleItemCustomBrandChange = (id: string, customVal: string) => {
    setEditSleeveList(prev =>
      prev.map(item => (item.id === id ? { ...item, customBrand: customVal } : item))
    );
  };

  const handleItemTypeChange = (id: string, typeVal: string) => {
    setEditSleeveList(prev =>
      prev.map(item => (item.id === id ? { ...item, type: typeVal } : item))
    );
  };

  const handleItemModelChange = (id: string, modelStr: string) => {
    if (modelStr === '__other__') {
      setEditSleeveList(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                isCustomModel: true,
                customModel: item.customModel || (item.sizeName ? `${item.sizeName} (${formatCardSleeveDimensions(item.width, item.height)})` : formatCardSleeveDimensions(item.width, item.height)),
              }
            : item
        )
      );
      return;
    }

    const dim = parseModelDimensions(modelStr);
    setEditSleeveList(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              sizeName: dim.sizeName,
              width: dim.width,
              height: dim.height,
              isCustomModel: false,
              customModel: '',
            }
          : item
      )
    );
  };

  const handleItemCustomModelChange = (id: string, customVal: string) => {
    const dim = parseModelDimensions(customVal);
    setEditSleeveList(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const hasNumbers = /(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)/.test(customVal);
        return {
          ...item,
          customModel: customVal,
          sizeName: dim.sizeName || customVal.trim() || 'Especial',
          width: hasNumbers ? dim.width : item.width,
          height: hasNumbers ? dim.height : item.height,
        };
      })
    );
  };

  const handleItemDimChange = (id: string, width: number, height: number) => {
    setEditSleeveList(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const formatted = formatCardSleeveDimensions(width, height);
        return {
          ...item,
          width,
          height,
          customModel: item.sizeName ? `${item.sizeName} (${formatted})` : formatted,
        };
      })
    );
  };

  const handleItemQtyChange = (id: string, qty: number) => {
    setEditSleeveList(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity: Math.max(0, qty) } : item))
    );
  };

  const handleAddSleeveRow = () => {
    const dim = parseModelDimensions(POPULAR_SLEEVE_MODELS[0]);
    const newRow: EditSleeveItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `Tipo de Carta #${editSleeveList.length + 1}`,
      quantity: 50,
      width: dim.width,
      height: dim.height,
      sizeName: dim.sizeName,
      isSleeved: true,
      brand: KNOWN_SLEEVE_BRANDS[0],
      isCustomBrand: false,
      customBrand: '',
      type: 'Normal',
      isCustomAdded: true,
      isCustomModel: false,
      customModel: '',
    };
    setIsSleeved(true);
    setEditSleeveList(prev => [...prev, newRow]);
  };

  const handleRemoveSleeveRow = (id: string) => {
    setEditSleeveList(prev => {
      const next = prev.filter(item => item.id !== id);
      setIsSleeved(next.some(item => item.isSleeved));
      return next;
    });
  };

  if (!isOpen || !game) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const weightVal = weight ? parseFloat(weight.replace(',', '.')) : undefined;
    const roundedWeight = (weightVal !== undefined && !isNaN(weightVal)) ? Math.round(weightVal * 100) / 100 : undefined;

    let updatedCardSleeves = game.cardSleeves;
    let updatedSleevesUsed: GameSleeveUsage[] | undefined = undefined;
    let finalIsSleeved = Boolean(isSleeved);
    let finalSleeveBrand = isSleeved ? sleeveBrand.trim() : undefined;
    let finalSleeveType = isSleeved ? sleeveType.trim() : undefined;

    if (noCards) {
      onSave(game.id, {
        name: name.trim(),
        bggId: bggIdInput.trim() || undefined,
        status: status.trim(),
        isPlayed: Boolean(isPlayed),
        spend: spend ? parseFloat(spend.replace(',', '.')) : 0,
        type: type.trim(),
        value: value ? parseFloat(value.replace(',', '.')) : 0,
        soldValue: soldValue ? parseFloat(soldValue.replace(',', '.')) : 0,
        minPlayers: minPlayers ? parseInt(minPlayers) : undefined,
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : undefined,
        weight: roundedWeight,
        yearPublished: yearPublished ? parseInt(yearPublished) : undefined,
        rating: rating ? parseFloat(rating.replace(',', '.')) : undefined,
        ludoRating: ludoRating ? parseFloat(ludoRating.replace(',', '.')) : undefined,
        noCards: true,
        isSleeved: false,
        sleeveBrand: undefined,
        sleeveType: undefined,
        cardSleeves: { source: 'Manual', sourceUrl: game.cardSleeves?.sourceUrl, sets: [], noCards: true },
        sleevesUsed: [],
        thumbnail: currentThumbnail || game.thumbnail,
      });
      onClose();
      return;
    }

    if (editSleeveList.length > 0) {
      const updatedSets: CardSleeveSet[] = editSleeveList.map(row => {
        const finalB = row.isCustomBrand ? row.customBrand.trim() : row.brand.trim();
        let finalSizeName = row.sizeName;
        let finalWidth = row.width;
        let finalHeight = row.height;
        if (row.isCustomModel && row.customModel) {
          const parsed = parseModelDimensions(row.customModel);
          finalSizeName = parsed.sizeName || row.sizeName;
          if (row.width) finalWidth = row.width;
          else finalWidth = parsed.width;
          if (row.height) finalHeight = row.height;
          else finalHeight = parsed.height;
        }

        return {
          name: row.name,
          quantity: row.quantity,
          width: finalWidth,
          height: finalHeight,
          sizeName: finalSizeName,
          isSleeved: row.isSleeved,
          sleeveBrand: finalB || undefined,
          sleeveType: row.type.trim() || undefined,
        };
      });

      const customSleeves: GameSleeveUsage[] = editSleeveList.map(row => {
        const finalB = row.isCustomBrand ? row.customBrand.trim() : row.brand.trim();
        let finalSizeName = row.sizeName;
        let finalWidth = row.width;
        let finalHeight = row.height;
        if (row.isCustomModel && row.customModel) {
          const parsed = parseModelDimensions(row.customModel);
          finalSizeName = parsed.sizeName || row.sizeName;
          if (row.width) finalWidth = row.width;
          else finalWidth = parsed.width;
          if (row.height) finalHeight = row.height;
          else finalHeight = parsed.height;
        }

        return {
          id: row.id,
          sizeName: finalSizeName,
          dimensions: formatCardSleeveDimensions(finalWidth, finalHeight),
          width: finalWidth,
          height: finalHeight,
          quantity: row.quantity,
          isSleeved: row.isSleeved,
          sleeveBrand: finalB || undefined,
          sleeveType: row.type.trim() || undefined,
        };
      });

      const summary = summarizeGameSleeves(updatedSets);
      finalIsSleeved = summary.isSleeved;
      finalSleeveBrand = summary.sleeveBrand;
      finalSleeveType = summary.sleeveType;

      updatedCardSleeves = {
        source: 'Manual',
        sourceUrl: game.cardSleeves?.sourceUrl,
        sets: updatedSets,
      };
      updatedSleevesUsed = customSleeves;
    }

    onSave(game.id, {
      name: name.trim(),
      bggId: bggIdInput.trim() || undefined,
      status: status.trim(),
      isPlayed: Boolean(isPlayed),
      spend: spend ? parseFloat(spend.replace(',', '.')) : 0,
      type: type.trim(),
      value: value ? parseFloat(value.replace(',', '.')) : 0,
      soldValue: soldValue ? parseFloat(soldValue.replace(',', '.')) : 0,
      minPlayers: minPlayers ? parseInt(minPlayers) : undefined,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : undefined,
      weight: roundedWeight,
      yearPublished: yearPublished ? parseInt(yearPublished) : undefined,
      rating: rating ? parseFloat(rating.replace(',', '.')) : undefined,
      ludoRating: ludoRating ? parseFloat(ludoRating.replace(',', '.')) : undefined,
      noCards: false,
      isSleeved: finalIsSleeved,
      sleeveBrand: finalSleeveBrand,
      sleeveType: finalSleeveType,
      cardSleeves: updatedCardSleeves,
      sleevesUsed: updatedSleevesUsed,
      thumbnail: currentThumbnail || game.thumbnail,
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
    setStatusMsg(null);
    try {
      const targetBggId = bggIdInput.trim() || game.bggId;
      const updated = await updateSingleGameParallel(
        { ...game, name: name.trim(), bggId: targetBggId },
        ludoToken,
        bggToken
      );

      if (updated) {
        setName(updated.name);
        if (updated.bggId) setBggIdInput(updated.bggId);
        if (updated.type) setType(updated.type);
        if (updated.yearPublished) setYearPublished(String(updated.yearPublished));
        if (updated.minPlayers) setMinPlayers(String(updated.minPlayers));
        if (updated.maxPlayers) setMaxPlayers(String(updated.maxPlayers));
        if (updated.weight) setWeight(String(Number(updated.weight.toFixed(2))));
        if (updated.rating) setRating(String(Number(updated.rating.toFixed(2))));
        if (updated.ludoRating) setLudoRating(String(Number(updated.ludoRating.toFixed(2))));
        if (updated.value) setValue(String(updated.value));
        if (updated.thumbnail) setCurrentThumbnail(updated.thumbnail);
        if (updated.isPlayed !== undefined) setIsPlayed(Boolean(updated.isPlayed));

        onSave(game.id, updated);
        if (onRefreshBGG) onRefreshBGG(updated);
        setStatusMsg({ text: 'Dados e preços atualizados com 100% de sucesso!', type: 'success' });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMsg({ text: 'Erro ao atualizar dados: ' + (e.message || 'Falha de conexão'), type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshLudo = async () => {
    if (onRefreshLudo) {
      setIsRefreshing(true);
      await onRefreshLudo({ ...game, name: name.trim(), ludoId: undefined });
      setIsRefreshing(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };

  const panelStyle: React.CSSProperties = {
    width: '100%', maxWidth: '640px', padding: '2rem', position: 'relative',
    maxHeight: '90vh', overflowY: 'auto'
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
        {statusMsg && (
          <div style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: statusMsg.type === 'success' ? '#34d399' : '#f87171'
          }}>
            {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

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

          {/* Campo de Status de Partidas (Jogado / Não Jogado) */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '0.85rem 1.1rem',
              background: isPlayed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isPlayed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '10px',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onClick={() => setIsPlayed(!isPlayed)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: isPlayed ? '#34d399' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Dices size={18} color={isPlayed ? '#10b981' : 'var(--text-muted)'} />
                Status de Partida: {isPlayed ? 'Jogado' : 'Não Jogado'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isPlayed ? 'Este jogo já viu mesa e possui partidas jogadas.' : 'Marcado como nunca jogado / na fila.'}
              </span>
            </div>

            <label 
              style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer', margin: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isPlayed}
                onChange={e => setIsPlayed(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: isPlayed ? '#10b981' : 'rgba(255,255,255,0.2)',
                transition: '0.3s',
                borderRadius: '34px',
                boxShadow: isPlayed ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '20px',
                  width: '20px',
                  left: isPlayed ? '24px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '0.3s',
                  borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>

          {/* Campo de Status de Sleeves (Sleevado / Não Sleevado e Multi-Sleeves) */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '0.75rem',
              padding: '0.85rem 1.1rem',
              background: noCards ? 'rgba(148, 163, 184, 0.08)' : (isSleeved ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)'),
              border: `1px solid ${noCards ? 'rgba(148, 163, 184, 0.25)' : (isSleeved ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)')}`,
              borderRadius: '10px',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Opção para marcar que o jogo não possui cartas */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.8rem',
                background: noCards ? 'rgba(148, 163, 184, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${noCards ? 'rgba(148, 163, 184, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => {
                const next = !noCards;
                setNoCards(next);
                if (next) setIsSleeved(false);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: noCards ? '#f1f5f9' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  🚫 Este jogo não possui cartas
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Marque se o jogo utiliza apenas dados, blocos, peças ou miniaturas, sem cartas.
                </span>
              </div>
              <input
                type="checkbox"
                checked={noCards}
                onChange={e => {
                  setNoCards(e.target.checked);
                  if (e.target.checked) setIsSleeved(false);
                }}
                onClick={e => e.stopPropagation()}
                style={{ width: '17px', height: '17px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>

            {noCards ? (
              <div style={{
                padding: '0.75rem',
                background: 'rgba(148, 163, 184, 0.05)',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                Jogo configurado como sem cartas. Não requer sleeves protetores nem gera pendências na coleção.
              </div>
            ) : (
              <>
            <div 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={handleToggleGlobalSleeved}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: isSleeved ? '#a5b4fc' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color={isSleeved ? '#818cf8' : 'var(--text-muted)'} />
                  Status de Sleeve: {isSleeved ? 'Jogo Sleevado' : 'Sem Sleeve'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {isSleeved ? 'Um ou mais tipos de cartas protegidas com sleeves.' : 'Cartas sem sleeves protetores.'}
                </span>
              </div>

              <label 
                style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer', margin: 0 }}
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSleeved}
                  onChange={handleToggleGlobalSleeved}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: isSleeved ? '#6366f1' : 'rgba(255,255,255,0.2)',
                  transition: '0.3s',
                  borderRadius: '34px',
                  boxShadow: isSleeved ? '0 0 10px rgba(99, 102, 241, 0.4)' : 'none'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: isSleeved ? '24px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%'
                  }} />
                </span>
              </label>
            </div>

            {/* Lista de Tipos e Marcas de Sleeves do Jogo */}
            {editSleeveList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Layers size={14} /> Tipos de Sleeves do Jogo ({editSleeveList.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSleeveRow}
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: '#c7d2fe',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 500,
                    }}
                  >
                    <Plus size={13} /> Adicionar Tipo
                  </button>
                </div>

                {editSleeveList.map(item => (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: item.isSleeved ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${item.isSleeved ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: item.isSleeved ? '#a5b4fc' : '#94a3b8' }}>
                        <input
                          type="checkbox"
                          checked={item.isSleeved}
                          onChange={() => handleToggleItemSleeved(item.id)}
                          style={{ accentColor: '#6366f1' }}
                        />
                        <span>{item.isSleeved ? 'Sleevado' : 'Sem Sleeve'}</span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <span>Qtd:</span>
                          <input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={e => handleItemQtyChange(item.id, parseInt(e.target.value) || 0)}
                            className="search-input"
                            style={{ width: '65px', padding: '3px 6px', fontSize: '0.8rem' }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSleeveRow(item.id)}
                          title="Remover este tipo de sleeve"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(239, 68, 68, 0.7)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                      <div>
                        <label style={{ ...labelStyle, marginBottom: '2px', fontSize: '0.75rem' }}>Modelo / Tamanho</label>
                        <select
                          value={item.isCustomModel ? '__other__' : (POPULAR_SLEEVE_MODELS.find(m => {
                            const parsed = parseModelDimensions(m);
                            return (
                              (item.sizeName && parsed.sizeName.toLowerCase() === item.sizeName.toLowerCase()) ||
                              (Math.abs(item.width - parsed.width) <= 0.6 && Math.abs(item.height - parsed.height) <= 1.2)
                            );
                          }) || '__other__')}
                          onChange={e => handleItemModelChange(item.id, e.target.value)}
                          className="search-input"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                        >
                          {POPULAR_SLEEVE_MODELS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value="__other__">Outro / Inserir Manualmente...</option>
                        </select>

                        {item.isCustomModel && (
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <input
                              type="text"
                              value={item.customModel || ''}
                              onChange={e => handleItemCustomModelChange(item.id, e.target.value)}
                              placeholder="Nome ou formato (ex: 70x70)"
                              className="search-input"
                              style={{ width: '100%', fontSize: '0.8rem', padding: '3px 6px' }}
                            />
                            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                              <input
                                type="number"
                                step="0.5"
                                min="20"
                                max="300"
                                value={item.width || ''}
                                onChange={e => handleItemDimChange(item.id, parseFloat(e.target.value) || 0, item.height)}
                                placeholder="Largura"
                                title="Largura em mm"
                                className="search-input"
                                style={{ width: '45%', fontSize: '0.75rem', padding: '2px 4px' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>×</span>
                              <input
                                type="number"
                                step="0.5"
                                min="20"
                                max="300"
                                value={item.height || ''}
                                onChange={e => handleItemDimChange(item.id, item.width, parseFloat(e.target.value) || 0)}
                                placeholder="Altura"
                                title="Altura em mm"
                                className="search-input"
                                style={{ width: '45%', fontSize: '0.75rem', padding: '2px 4px' }}
                              />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>mm</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ ...labelStyle, marginBottom: '2px', fontSize: '0.75rem' }}>Marca do Sleeve</label>
                        <select
                          value={item.isCustomBrand ? '__other__' : (item.brand || '')}
                          onChange={e => handleItemBrandChange(item.id, e.target.value)}
                          className="search-input"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                        >
                          <option value="">(Selecione)</option>
                          {KNOWN_SLEEVE_BRANDS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                          <option value="__other__">Outra marca...</option>
                        </select>
                        {item.isCustomBrand && (
                          <input
                            type="text"
                            value={item.customBrand}
                            onChange={e => handleItemCustomBrandChange(item.id, e.target.value)}
                            placeholder="Nome da marca"
                            className="search-input"
                            style={{ width: '100%', fontSize: '0.8rem', padding: '3px 6px', marginTop: '3px' }}
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ ...labelStyle, marginBottom: '2px', fontSize: '0.75rem' }}>Subtipo do Sleeve</label>
                        <select
                          value={SLEEVE_SUBTYPES.includes(item.type as any) ? item.type : (item.type ? '__other__' : 'Normal')}
                          onChange={e => {
                            if (e.target.value === '__other__') {
                              handleItemTypeChange(item.id, item.type && !SLEEVE_SUBTYPES.includes(item.type as any) ? item.type : '');
                            } else {
                              handleItemTypeChange(item.id, e.target.value);
                            }
                          }}
                          className="search-input"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                        >
                          {SLEEVE_SUBTYPES.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                          <option value="__other__">Outro subtipo...</option>
                        </select>
                        {(!SLEEVE_SUBTYPES.includes(item.type as any) && item.type !== undefined) && (
                          <input
                            type="text"
                            value={item.type}
                            onChange={e => handleItemTypeChange(item.id, e.target.value)}
                            placeholder="Digite o subtipo (ex: Matte, Fit)"
                            className="search-input"
                            style={{ width: '100%', fontSize: '0.8rem', padding: '3px 6px', marginTop: '3px' }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Caso isSleeved esteja ativo mas editSleeveList esteja vazia */}
            {isSleeved && editSleeveList.length === 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  onClick={handleAddSleeveRow}
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#c7d2fe',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                  }}
                >
                  <Plus size={15} /> Adicionar Tipos e Marcas de Sleeves
                </button>
              </div>
            )}
              </>
            )}
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
          {(currentThumbnail || game.thumbnail) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <img src={currentThumbnail || game.thumbnail} alt={name} style={{ width: '60px', height: '60px', objectFit: 'contain', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }} />
              <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {rating && <div>⭐ BGG: {parseFloat(rating).toFixed(1)}</div>}
                {yearPublished && <div>📅 Ano: {yearPublished}</div>}
                {(minPlayers || maxPlayers) && <div>👥 {minPlayers}–{maxPlayers} jogadores</div>}
                {value && <div style={{ color: '#38bdf8' }}>🏷 Valor de Mercado: R$ {parseFloat(value.replace(',', '.')).toFixed(2)}</div>}
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
                title="Sincronizar com BGG e buscar preço no Compara Jogos"
                style={{ background: 'rgba(99, 102, 241, 0.25)', border: '1px solid rgba(99, 102, 241, 0.5)', color: '#c7d2fe', padding: '0.65rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {isRefreshing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
                {isRefreshing ? 'Sincronizando...' : 'Sincronizar BGG e Preços'}
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
