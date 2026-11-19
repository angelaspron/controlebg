import { useState, useEffect, useRef } from 'react';
import type { SleeveStockItem } from '../types';
import type { User } from '@supabase/supabase-js';
import { 
  fetchUserSleeveStock, 
  upsertUserSleeveStockBatch, 
  upsertUserSleeveStockItem, 
  deleteUserSleeveStockItem, 
  clearUserSleeveStock 
} from '../lib/supabase';

const getSleeveStorageKey = (userId?: string | null) => userId ? `boardgame_manager_sleeve_stock_${userId}` : 'boardgame_manager_sleeve_stock';

export function useSleeveStock(user?: User | null) {
  const [stock, setStockState] = useState<SleeveStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoadRef = useRef(true);

  // Carregar do Supabase ou migrar do localStorage quando o usuário logar
  useEffect(() => {
    let isCancelled = false;

    async function loadStock() {
      if (!user?.id) {
        setStockState([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const storageKey = getSleeveStorageKey(user.id);
      try {
        const cloudStock = await fetchUserSleeveStock(user.id);
        if (isCancelled) return;

        if (cloudStock && cloudStock.length > 0) {
          setStockState(cloudStock);
          try {
            localStorage.setItem(storageKey, JSON.stringify(cloudStock));
          } catch {}
        } else {
          // Se na nuvem estiver vazio mas houver dados locais deste usuário, migra automaticamente
          const localSaved = localStorage.getItem(storageKey);
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setStockState(parsed);
                await upsertUserSleeveStockBatch(user.id, parsed);
              }
            } catch {}
          } else {
            setStockState([]);
          }
        }
      } catch (e) {
        console.error('Erro ao sincronizar estoque de sleeves com Supabase:', e);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          isInitialLoadRef.current = false;
        }
      }
    }

    loadStock();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  // Salvar no localStorage específico do usuário sempre que o estoque mudar
  useEffect(() => {
    if (!isLoading && user?.id) {
      try {
        localStorage.setItem(getSleeveStorageKey(user.id), JSON.stringify(stock));
      } catch (e) {
        console.error('Erro ao salvar estoque de sleeves no localStorage:', e);
      }
    }
  }, [stock, isLoading, user?.id]);

  // Debounced auto-sync com Supabase para garantir integridade
  useEffect(() => {
    if (!user?.id || isLoading || isInitialLoadRef.current) return;

    const timer = setTimeout(() => {
      upsertUserSleeveStockBatch(user.id, stock).catch(err => {
        console.error('Erro ao sincronizar lote de sleeves com Supabase:', err);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [stock, user?.id, isLoading]);

  const addStockItem = (item: Omit<SleeveStockItem, 'id' | 'updatedAt'>) => {
    const newItem: SleeveStockItem = {
      ...item,
      id: `sleeve-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      updatedAt: new Date().toISOString(),
    };
    setStockState(prev => [newItem, ...prev]);

    if (user?.id) {
      upsertUserSleeveStockItem(user.id, newItem).catch(e => {
        console.error('Erro ao adicionar sleeve no Supabase:', e);
      });
    }

    return newItem;
  };

  const updateStockItem = (id: string, updates: Partial<Omit<SleeveStockItem, 'id'>>) => {
    let updatedItem: SleeveStockItem | null = null;
    setStockState(prev =>
      prev.map(item => {
        if (item.id === id) {
          updatedItem = { ...item, ...updates, updatedAt: new Date().toISOString() };
          return updatedItem;
        }
        return item;
      })
    );

    if (user?.id && updatedItem) {
      upsertUserSleeveStockItem(user.id, updatedItem).catch(e => {
        console.error('Erro ao atualizar sleeve no Supabase:', e);
      });
    }
  };

  const deleteStockItem = (id: string) => {
    setStockState(prev => prev.filter(item => item.id !== id));
    if (user?.id) {
      deleteUserSleeveStockItem(user.id, id).catch(e => {
        console.error('Erro ao remover sleeve do Supabase:', e);
      });
    }
  };

  const adjustQuantity = (id: string, delta: number) => {
    let updatedItem: SleeveStockItem | null = null;
    setStockState(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const newQty = Math.max(0, (item.quantity || 0) + delta);
        updatedItem = {
          ...item,
          quantity: newQty,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      })
    );

    if (user?.id && updatedItem) {
      upsertUserSleeveStockItem(user.id, updatedItem).catch(e => {
        console.error('Erro ao ajustar quantidade de sleeve no Supabase:', e);
      });
    }
  };

  const deductStockBatch = (deductions: { stockItemId: string; quantity: number }[]) => {
    if (!deductions || deductions.length === 0) return;

    const deductionMap = new Map<string, number>();
    for (const d of deductions) {
      if (d.stockItemId && d.quantity > 0) {
        deductionMap.set(d.stockItemId, (deductionMap.get(d.stockItemId) || 0) + d.quantity);
      }
    }

    if (deductionMap.size === 0) return;

    const updatedItems: SleeveStockItem[] = [];
    setStockState(prev =>
      prev.map(item => {
        const deductQty = deductionMap.get(item.id);
        if (!deductQty) return item;
        const newQty = Math.max(0, (item.quantity || 0) - deductQty);
        const updated = {
          ...item,
          quantity: newQty,
          updatedAt: new Date().toISOString(),
        };
        updatedItems.push(updated);
        return updated;
      })
    );

    if (user?.id && updatedItems.length > 0) {
      upsertUserSleeveStockBatch(user.id, updatedItems).catch(e => {
        console.error('Erro ao salvar lote de sleeves descontados no Supabase:', e);
      });
    }
  };

  const clearStock = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o seu estoque de sleeves?')) {
      setStockState([]);
      try {
        localStorage.removeItem(getSleeveStorageKey(user?.id));
      } catch {}

      if (user?.id) {
        clearUserSleeveStock(user.id).catch(e => {
          console.error('Erro ao limpar estoque no Supabase:', e);
        });
      }
    }
  };

  const setStock = (newStock: SleeveStockItem[]) => {
    setStockState(newStock);
    if (user?.id) {
      upsertUserSleeveStockBatch(user.id, newStock).catch(e => {
        console.error('Erro ao atualizar todo estoque no Supabase:', e);
      });
    }
  };

  return {
    stock,
    isLoading,
    addStockItem,
    updateStockItem,
    deleteStockItem,
    adjustQuantity,
    deductStockBatch,
    clearStock,
    setStock,
  };
}
