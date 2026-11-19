import { createClient } from '@supabase/supabase-js';
import type { GameData, SleeveStockItem, ColumnMapping } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tqiputdaguiaipvwciot.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxaXB1dGRhZ3VpYWlwdndjaW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwOTgxNDgsImV4cCI6MjExMDY3NDE0OH0.z4AWH0h53-IZ3lynje9qmfE3D9A_QAHoIls-MaEupUg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Resolve whether the input is an email or a username.
 * If it's a username, tries to look up the registered email or maps to local fallback.
 */
export async function resolveEmailFromIdentifier(identifier: string): Promise<string> {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  
  try {
    const { data, error } = await supabase.rpc('get_email_by_username', { p_username: trimmed });
    if (!error && data) {
      return data as string;
    }
  } catch (e) {
    console.warn('Não foi possível buscar email por username via RPC, tentando email padrão', e);
  }

  // Fallback para contas criadas usando formato username@controlebg.local
  return `${trimmed.toLowerCase()}@controlebg.local`;
}

// ==========================================
// COLEÇÃO DE JOGOS (GAMES)
// ==========================================

export async function fetchUserGames(userId: string): Promise<GameData[]> {
  const { data, error } = await supabase
    .from('games')
    .select('raw_data')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar jogos do Supabase:', error);
    throw error;
  }

  return (data || []).map(row => row.raw_data as GameData).filter(Boolean);
}

export async function upsertUserGame(userId: string, game: GameData): Promise<void> {
  const row = {
    id: String(game.id),
    user_id: userId,
    name: game.name || 'Sem Nome',
    status: game.status || null,
    type: game.type || null,
    spend: game.spend !== undefined && game.spend !== null ? String(game.spend) : null,
    value: game.value !== undefined && game.value !== null ? String(game.value) : null,
    sold_value: game.soldValue !== undefined && game.soldValue !== null ? String(game.soldValue) : null,
    is_played: Boolean(game.isPlayed),
    bgg_id: game.bggId ? String(game.bggId) : null,
    ludo_id: game.ludoId ? String(game.ludoId) : null,
    raw_data: game,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('games')
    .upsert(row, { onConflict: 'user_id,id' });

  if (error) {
    console.error('Erro ao salvar jogo no Supabase:', error);
    throw error;
  }
}

export async function upsertUserGamesBatch(userId: string, games: GameData[]): Promise<void> {
  if (!games.length) return;

  const now = new Date().toISOString();
  const rows = games.map(game => ({
    id: String(game.id),
    user_id: userId,
    name: game.name || 'Sem Nome',
    status: game.status || null,
    type: game.type || null,
    spend: game.spend !== undefined && game.spend !== null ? String(game.spend) : null,
    value: game.value !== undefined && game.value !== null ? String(game.value) : null,
    sold_value: game.soldValue !== undefined && game.soldValue !== null ? String(game.soldValue) : null,
    is_played: Boolean(game.isPlayed),
    bgg_id: game.bggId ? String(game.bggId) : null,
    ludo_id: game.ludoId ? String(game.ludoId) : null,
    raw_data: game,
    updated_at: now,
  }));

  // Chunk in batches of 100 to avoid payload limits
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('games')
      .upsert(chunk, { onConflict: 'user_id,id' });

    if (error) {
      console.error('Erro no lote de upsert de jogos:', error);
      throw error;
    }
  }
}

export async function deleteUserGame(userId: string, gameId: string): Promise<void> {
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('user_id', userId)
    .eq('id', String(gameId));

  if (error) {
    console.error('Erro ao excluir jogo do Supabase:', error);
    throw error;
  }
}

export async function clearUserGames(userId: string): Promise<void> {
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao limpar jogos do usuário no Supabase:', error);
    throw error;
  }
}

// ==========================================
// ESTOQUE DE SLEEVES (SLEEVE_STOCK)
// ==========================================

export async function fetchUserSleeveStock(userId: string): Promise<SleeveStockItem[]> {
  const { data, error } = await supabase
    .from('sleeve_stock')
    .select('raw_data')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar estoque de sleeves do Supabase:', error);
    throw error;
  }

  return (data || []).map(row => row.raw_data as SleeveStockItem).filter(Boolean);
}

export async function upsertUserSleeveStockBatch(userId: string, items: SleeveStockItem[]): Promise<void> {
  if (!items.length) return;

  const now = new Date().toISOString();
  const rows = items.map(item => ({
    id: String(item.id),
    user_id: userId,
    model: item.model || '',
    brand: item.brand || '',
    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
    type: item.type || null,
    notes: item.notes || null,
    raw_data: item,
    updated_at: item.updatedAt || now,
  }));

  const { error } = await supabase
    .from('sleeve_stock')
    .upsert(rows, { onConflict: 'user_id,id' });

  if (error) {
    console.error('Erro ao salvar lote de estoque de sleeves no Supabase:', error);
    throw error;
  }
}

export async function upsertUserSleeveStockItem(userId: string, item: SleeveStockItem): Promise<void> {
  const now = new Date().toISOString();
  const row = {
    id: String(item.id),
    user_id: userId,
    model: item.model || '',
    brand: item.brand || '',
    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
    type: item.type || null,
    notes: item.notes || null,
    raw_data: item,
    updated_at: item.updatedAt || now,
  };

  const { error } = await supabase
    .from('sleeve_stock')
    .upsert(row, { onConflict: 'user_id,id' });

  if (error) {
    console.error('Erro ao atualizar item do estoque no Supabase:', error);
    throw error;
  }
}

export async function deleteUserSleeveStockItem(userId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('sleeve_stock')
    .delete()
    .eq('user_id', userId)
    .eq('id', String(itemId));

  if (error) {
    console.error('Erro ao excluir item do estoque no Supabase:', error);
    throw error;
  }
}

export async function clearUserSleeveStock(userId: string): Promise<void> {
  const { error } = await supabase
    .from('sleeve_stock')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao limpar estoque de sleeves do Supabase:', error);
    throw error;
  }
}

// ==========================================
// CONFIGURAÇÕES DO USUÁRIO (USER_SETTINGS)
// ==========================================

export interface UserSettingsData {
  ludoToken?: string;
  bggToken?: string;
  columnMapping?: ColumnMapping;
}

export async function fetchUserSettings(userId: string): Promise<UserSettingsData | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('ludo_token, bgg_token, column_mapping')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Row not found, safe to return null
      return null;
    }
    console.error('Erro ao buscar configurações no Supabase:', error);
    return null;
  }

  return {
    ludoToken: data?.ludo_token || undefined,
    bggToken: data?.bgg_token || undefined,
    columnMapping: data?.column_mapping as ColumnMapping | undefined,
  };
}

export async function saveUserSettings(userId: string, settings: UserSettingsData): Promise<void> {
  const row = {
    user_id: userId,
    ludo_token: settings.ludoToken || null,
    bgg_token: settings.bggToken || null,
    column_mapping: settings.columnMapping || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_settings')
    .upsert(row, { onConflict: 'user_id' });

  if (error) {
    console.error('Erro ao salvar configurações no Supabase:', error);
    throw error;
  }
}
