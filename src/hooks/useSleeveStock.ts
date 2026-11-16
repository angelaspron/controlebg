import { useState, useEffect } from 'react';
import type { SleeveStockItem } from '../types';

const SLEEVE_STOCK_STORAGE_KEY = 'boardgame_manager_sleeve_stock';

export function useSleeveStock() {
  const [stock, setStockState] = useState<SleeveStockItem[]>(() => {
    try {
      const saved = localStorage.getItem(SLEEVE_STOCK_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Erro ao ler estoque de sleeves do localStorage:', e);
    }
    return [];
  });

  // Salvar no localStorage sempre que o estoque mudar
  useEffect(() => {
    try {
      localStorage.setItem(SLEEVE_STOCK_STORAGE_KEY, JSON.stringify(stock));
    } catch (e) {
      console.error('Erro ao salvar estoque de sleeves no localStorage:', e);
    }
  }, [stock]);

  const addStockItem = (item: Omit<SleeveStockItem, 'id' | 'updatedAt'>) => {
    const newItem: SleeveStockItem = {
      ...item,
      id: `sleeve-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      updatedAt: new Date().toISOString(),
    };
    setStockState(prev => [newItem, ...prev]);
    return newItem;
  };

  const updateStockItem = (id: string, updates: Partial<Omit<SleeveStockItem, 'id'>>) => {
    setStockState(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const deleteStockItem = (id: string) => {
    setStockState(prev => prev.filter(item => item.id !== id));
  };

  const adjustQuantity = (id: string, delta: number) => {
    setStockState(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const newQty = Math.max(0, (item.quantity || 0) + delta);
        return {
          ...item,
          quantity: newQty,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const clearStock = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o seu estoque de sleeves?')) {
      setStockState([]);
      try {
        localStorage.removeItem(SLEEVE_STOCK_STORAGE_KEY);
      } catch (e) {}
    }
  };

  const setStock = (newStock: SleeveStockItem[]) => {
    setStockState(newStock);
  };

  return {
    stock,
    addStockItem,
    updateStockItem,
    deleteStockItem,
    adjustQuantity,
    clearStock,
    setStock,
  };
}

