import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameData, ColumnMapping, SleeveStockItem } from '../types';
import type { User } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { XMLParser } from 'fast-xml-parser';
import { 
  fetchUserGames, 
  upsertUserGame, 
  upsertUserGamesBatch, 
  deleteUserGame, 
  clearUserGames, 
  fetchUserSettings, 
  saveUserSettings 
} from '../lib/supabase';
import { 
  batchUpdateGamesParallel, 
  processBatchWithConcurrency, 
  type BatchProgress 
} from '../services/batchProcessor';
import { fetchBGGThingWithRetry, fetchBGGThingsBatch, searchBGGId, DEFAULT_BGG_TOKEN, fetchBGGSleeves } from '../services/bggService';
import { fetchLudopediaData, fetchLudopediaGameMetadata, parseIsPlayedFromLudo, parsePlayCountFromLudo, isOwnedInLudopedia } from '../services/ludopediaService';
import { fetchComparaJogosData, searchBggIdViaCompara } from '../services/comparaService';
import { matchesGameName, normalizeGameName } from '../utils/nameMatcher';
import { isGameInCollection, getGameSleeveStatus } from '../utils/sleeveUtils';

const getStorageKey = (userId?: string | null) => userId ? `boardgame_manager_data_${userId}` : 'boardgame_manager_data';
const getMappingStorageKey = (userId?: string | null) => userId ? `boardgame_manager_mapping_${userId}` : 'boardgame_manager_mapping';
const getLudoTokenStorageKey = (userId?: string | null) => userId ? `boardgame_manager_ludo_token_${userId}` : 'boardgame_manager_ludo_token';
const getBggTokenStorageKey = (userId?: string | null) => userId ? `boardgame_manager_bgg_token_${userId}` : 'boardgame_manager_bgg_token';

const defaultMapping: ColumnMapping = {
  name: '',
  status: '',
  spend: '',
  type: '',
  value: ''
};

function bggUrl(path: string) {
  return `https://boardgamegeek.com/xmlapi2/${path}`;
}

export function useCollection(user?: User | null) {
  const [games, setGames] = useState<GameData[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(defaultMapping);
  const [ludoToken, setLudoToken] = useState<string>('');
  const [bggToken, setBggToken] = useState<string>(DEFAULT_BGG_TOKEN);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de processamento em lote
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [updatingGameIds, setUpdatingGameIds] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialLoadRef = useRef(true);

  // Carregar dados (do Supabase se autenticado, ou localStorage como fallback)
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);

      if (!user?.id) {
        if (!isCancelled) {
          setGames([]);
          setColumnMapping(defaultMapping);
          setLudoToken('');
          setBggToken(DEFAULT_BGG_TOKEN);
          setIsLoading(false);
          isInitialLoadRef.current = false;
        }
        return;
      }

      // Ler dados do localStorage como ponto de partida específico deste usuário
      const storageKey = getStorageKey(user.id);
      let initialGames: GameData[] = [];
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            initialGames = parsed.filter(g => g && typeof g === 'object');
          }
        }
      } catch (e) {}

      let initialMapping = defaultMapping;
      try {
        const savedMapping = localStorage.getItem(getMappingStorageKey(user.id));
        if (savedMapping) initialMapping = JSON.parse(savedMapping);
      } catch (e) {}

      let initialLudo = '';
      try {
        const savedLudo = localStorage.getItem(getLudoTokenStorageKey(user.id));
        if (savedLudo) initialLudo = savedLudo;
      } catch (e) {}

      let initialBgg = DEFAULT_BGG_TOKEN;
      try {
        const savedBgg = localStorage.getItem(getBggTokenStorageKey(user.id));
        if (savedBgg) initialBgg = savedBgg;
      } catch (e) {}

      // Usuário autenticado: sincronizar com Supabase
      try {
        const [cloudGames, cloudSettings] = await Promise.all([
          fetchUserGames(user.id).catch(() => null),
          fetchUserSettings(user.id).catch(() => null)
        ]);

        if (isCancelled) return;

        // Tratar jogos
        if (cloudGames && cloudGames.length > 0) {
          setGames(cloudGames);
          try {
            localStorage.setItem(storageKey, JSON.stringify(cloudGames));
          } catch {}
        } else if (initialGames.length > 0) {
          // Migração dos dados locais específicos deste usuário para a nuvem
          setGames(initialGames);
          await upsertUserGamesBatch(user.id, initialGames).catch(e => console.warn('Erro ao migrar jogos locais para Supabase:', e));
        } else {
          setGames([]);
        }

        // Tratar configurações (tokens e mapeamento)
        if (cloudSettings) {
          if (cloudSettings.columnMapping) setColumnMapping(cloudSettings.columnMapping);
          if (cloudSettings.ludoToken !== undefined) setLudoToken(cloudSettings.ludoToken || '');
          if (cloudSettings.bggToken !== undefined) setBggToken(cloudSettings.bggToken || DEFAULT_BGG_TOKEN);
        } else if (initialLudo || initialMapping.name) {
          setColumnMapping(initialMapping);
          setLudoToken(initialLudo);
          setBggToken(initialBgg);
          await saveUserSettings(user.id, {
            ludoToken: initialLudo,
            bggToken: initialBgg,
            columnMapping: initialMapping
          }).catch(e => console.warn('Erro ao salvar settings no Supabase:', e));
        } else {
          setColumnMapping(initialMapping);
          setLudoToken(initialLudo);
          setBggToken(initialBgg);
        }
      } catch (err) {
        console.error('Erro ao conectar ao Supabase:', err);
        setGames(initialGames);
        setColumnMapping(initialMapping);
        setLudoToken(initialLudo);
        setBggToken(initialBgg);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          isInitialLoadRef.current = false;
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  // Salvar no Local Storage sempre que games mudar (cache offline específico do usuário)
  useEffect(() => {
    if (!isLoading && user?.id) {
      try {
        localStorage.setItem(getStorageKey(user.id), JSON.stringify(games));
      } catch {}
    }
  }, [games, isLoading, user?.id]);

  // Salvar mapping e tokens no Local Storage específico do usuário
  useEffect(() => {
    if (!isLoading && user?.id) {
      try {
        localStorage.setItem(getMappingStorageKey(user.id), JSON.stringify(columnMapping));
        localStorage.setItem(getLudoTokenStorageKey(user.id), ludoToken);
        localStorage.setItem(getBggTokenStorageKey(user.id), bggToken);
      } catch {}
    }
  }, [columnMapping, ludoToken, bggToken, isLoading, user?.id]);

  // Debounced auto-sync de games com Supabase
  useEffect(() => {
    if (!user?.id || isLoading || isInitialLoadRef.current) return;

    const timer = setTimeout(() => {
      upsertUserGamesBatch(user.id, games).catch(err => {
        console.error('Erro no auto-sync de jogos com Supabase:', err);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [games, user?.id, isLoading]);

  // Salvar configurações no Supabase
  useEffect(() => {
    if (!user?.id || isLoading || isInitialLoadRef.current) return;

    const timer = setTimeout(() => {
      saveUserSettings(user.id, {
        ludoToken,
        bggToken,
        columnMapping
      }).catch(err => {
        console.error('Erro ao persistir settings no Supabase:', err);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [columnMapping, ludoToken, bggToken, user?.id, isLoading]);

  const cancelBatchUpdate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsBatchUpdating(false);
    setBatchProgress(null);
    setUpdatingGameIds(new Set());
  };

  const processExcelUpload = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet) as any[];

          const normalize = (s: string) =>
            s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          const getVal = (row: any, possibleKeys: string[]) => {
            const normalizedPossible = possibleKeys.map(normalize);
            const keys = Object.keys(row);
            const foundKey = keys.find(k => normalizedPossible.includes(normalize(k)));
            return foundKey !== undefined ? row[foundKey] : undefined;
          };

          const toNumber = (v: any): number => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const cleaned = String(v).replace(/[^\d,.-]/g, '').replace(',', '.');
            const n = parseFloat(cleaned);
            return isNaN(n) ? 0 : n;
          };

          const parsedGames: GameData[] = json.map((row, index) => {
            const mappedName = columnMapping.name ? getVal(row, [columnMapping.name]) : undefined;
            const mappedStatus = columnMapping.status ? getVal(row, [columnMapping.status]) : undefined;
            const mappedSpend = columnMapping.spend ? getVal(row, [columnMapping.spend]) : undefined;
            const mappedType = columnMapping.type ? getVal(row, [columnMapping.type]) : undefined;
            const mappedValue = columnMapping.value ? getVal(row, [columnMapping.value]) : undefined;
            const mappedSoldValue = columnMapping.soldValue ? getVal(row, [columnMapping.soldValue]) : undefined;

            const name = mappedName || getVal(row, ['jogos', 'jogo', 'nome', 'name', 'titulo', 'título']) || 'Jogo Desconhecido';
            const rawType = mappedType || getVal(row, ['tipo', 'categoria', 'type']) || 'Base';
            
            // Correção estrutural na importação inicial
            let detectedType = rawType;
            const lowerName = name.toLowerCase();
            const lowerType = String(rawType).toLowerCase();
            if (lowerType.includes('expans') || lowerType.includes('expansion') || lowerName.includes('expans') || lowerName.includes('expansion')) {
              detectedType = 'Expansão';
            } else if (lowerType.includes('promo') || lowerName.includes('promo')) {
              detectedType = 'Promo';
            } else if (lowerType.includes('acess') || lowerName.includes('acess')) {
              detectedType = 'Acessório';
            }

            const rawPlayed = getVal(row, ['jogado', 'jogados', 'jogou', 'isplayed', 'is_played', 'played', 'partidas']);
            let detectedIsPlayed: boolean | undefined = undefined;
            if (rawPlayed !== undefined && rawPlayed !== null && rawPlayed !== '') {
              const normP = String(rawPlayed).toLowerCase().trim();
              if (normP === 'sim' || normP === 'true' || normP === '1' || normP === 's' || normP === 'yes' || normP === 'y') {
                detectedIsPlayed = true;
              } else if (normP === 'não' || normP === 'nao' || normP === 'false' || normP === '0' || normP === 'n' || normP === 'no') {
                detectedIsPlayed = false;
              } else if (!isNaN(Number(normP)) && Number(normP) > 0) {
                detectedIsPlayed = true;
              }
            }

            const parseSpreadsheetDate = (raw: any): string | undefined => {
              if (raw === undefined || raw === null || raw === '') return undefined;
              if (typeof raw === 'number' && raw > 20000 && raw < 90000) {
                const utcDays = Math.floor(raw - 25569);
                const d = new Date(utcDays * 86400 * 1000);
                if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
              }
              const s = String(raw).trim();
              const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
              const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
              if (br) return `${br[3]}-${br[2]}-${br[1]}`;
              return undefined;
            };

            const acquiredAt = parseSpreadsheetDate(getVal(row, ['data entrada', 'data de entrada', 'data aquisicao', 'data de aquisicao', 'data compra', 'acquired', 'acquiredat']));
            const soldAt = parseSpreadsheetDate(getVal(row, ['data saida', 'data de saida', 'data venda', 'data de venda', 'soldat', 'sold date']));
            const wishlistAt = parseSpreadsheetDate(getVal(row, ['data desejo', 'wishlistat']));

            return {
              id: `local-${index}-${Date.now()}`,
              name,
              status: mappedStatus || getVal(row, ['status', 'estado', 'situacao', 'situação', 'tag', 'tags']) || 'Desconhecido',
              spend: toNumber(mappedSpend !== undefined ? mappedSpend : getVal(row, ['valor', 'grana', 'gasto', 'custo', 'valor pago', 'spend', 'preco', 'preço', 'price'])),
              type: detectedType,
              value: toNumber(mappedValue !== undefined ? mappedValue : getVal(row, ['valor mercado', 'valor de mercado', 'mercado', 'market value', 'market'])),
              soldValue: toNumber(mappedSoldValue !== undefined ? mappedSoldValue : getVal(row, ['valor vendido', 'venda', 'sold'])),
              isPlayed: detectedIsPlayed,
              acquiredAt,
              soldAt,
              wishlistAt,
            };
          });

          setGames(prevGames => {
            const newGames = [...prevGames];

            for (const parsedGame of parsedGames) {
              const existingIndex = newGames.findIndex(g => 
                g.name.toLowerCase() === parsedGame.name.toLowerCase() ||
                matchesGameName(g.name, parsedGame.name)
              );
              
              if (existingIndex !== -1) {
                const existing = newGames[existingIndex];
                newGames[existingIndex] = {
                  ...existing,
                  status: (parsedGame.status !== 'Desconhecido' && parsedGame.status) ? parsedGame.status : existing.status,
                  spend: parsedGame.spend ? parsedGame.spend : existing.spend,
                  type: (parsedGame.type !== 'Base' && parsedGame.type) ? parsedGame.type : existing.type,
                  value: parsedGame.value ? parsedGame.value : existing.value,
                  soldValue: parsedGame.soldValue ? parsedGame.soldValue : existing.soldValue,
                  isPlayed: (parsedGame.isPlayed !== undefined || existing.isPlayed !== undefined)
                    ? Boolean(parsedGame.isPlayed || existing.isPlayed)
                    : undefined,
                };
              } else {
                newGames.push(parsedGame);
              }
            }

            return newGames;
          });
          resolve();
        } catch (error) {
          console.error(error);
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  /**
   * 1. Atualização Completa em Paralelo (BGG + Ludopedia + Compara Jogos simultâneos por jogo)
   * Processada em blocos concorrentes de 5 jogos por vez.
   */
  const updateGamesParallel = async (gameList: GameData[]) => {
    if (gameList.length === 0) return;

    abortControllerRef.current = new AbortController();
    setIsBatchUpdating(true);
    setUpdatingGameIds(new Set());

    try {
      await batchUpdateGamesParallel(gameList, {
        concurrencyLimit: 5,
        ludoToken,
        bggToken,
        signal: abortControllerRef.current.signal,
        onGameStart: (id) => {
          setUpdatingGameIds(prev => new Set(prev).add(id));
        },
        onGameComplete: (updatedGame) => {
          setGames(prev => prev.map(g => (g.id === updatedGame.id ? updatedGame : g)));
          setUpdatingGameIds(prev => {
            const next = new Set(prev);
            next.delete(updatedGame.id);
            return next;
          });
        },
        onProgress: (progress) => {
          setBatchProgress(progress);
        },
      });
    } catch (e: any) {
      if (e.message !== 'Operação cancelada pelo usuário') {
        console.error('Erro na atualização paralela em lote:', e);
      }
    } finally {
      setIsBatchUpdating(false);
      setBatchProgress(null);
      setUpdatingGameIds(new Set());
      abortControllerRef.current = null;
    }
  };

  /**
   * 2. Atualização em Lote BGG Otimizada com Concorrência (5 itens) e Backoff Exponencial
   */
  const fetchBGGDataForGames = async (gameList: GameData[]) => {
    if (gameList.length === 0) return;

    abortControllerRef.current = new AbortController();
    setIsBatchUpdating(true);
    setUpdatingGameIds(new Set());
    const total = gameList.length;
    let completed = 0;

    try {
      await processBatchWithConcurrency(
        gameList,
        5,
        async (game) => {
          setUpdatingGameIds(prev => new Set(prev).add(game.id));
          setBatchProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentGameName: game.name,
            activeApi: 'BGG (XML API2)',
          });

          let bggId = game.bggId;
          if (!bggId) {
            bggId = (await searchBGGId(game.name, { token: bggToken })) || undefined;
          }

          if (bggId) {
            const bggData = await fetchBGGThingWithRetry(bggId, { token: bggToken });
            let fallbackRank: number | undefined;
            if (!bggData?.rank) {
              const comparaData = await fetchComparaJogosData(game.name, bggId);
              fallbackRank = comparaData?.bggRank;
            }
            if (bggData || fallbackRank) {
              setGames(prev => prev.map(g => {
                if (g.id !== game.id) return g;
                return {
                  ...g,
                  bggId,
                  ...(bggData ? {
                    thumbnail: bggData.thumbnail || g.thumbnail,
                    image: bggData.image || g.image,
                    minPlayers: bggData.minPlayers || g.minPlayers,
                    maxPlayers: bggData.maxPlayers || g.maxPlayers,
                    yearPublished: bggData.yearPublished || g.yearPublished,
                    playtime: bggData.playtime || g.playtime,
                    rating: bggData.rating || g.rating,
                    geekRating: bggData.geekRating || g.geekRating,
                    weight: bggData.weight !== undefined 
                      ? Math.round(bggData.weight * 100) / 100 
                      : (g.weight !== undefined ? Math.round(Number(g.weight) * 100) / 100 : undefined),
                    domains: bggData.domains || g.domains,
                    mechanics: bggData.mechanics || g.mechanics,
                    categories: bggData.categories || g.categories,
                    designers: bggData.designers || g.designers,
                    artists: bggData.artists || g.artists,
                    honors: bggData.honors || g.honors,
                    suggestedPlayers: bggData.suggestedPlayers || g.suggestedPlayers,
                    description: bggData.description || g.description,
                  } : {}),
                  rank: bggData?.rank || fallbackRank || g.rank,
                };
              }));
            }
          }

          completed++;
          setUpdatingGameIds(prev => {
            const next = new Set(prev);
            next.delete(game.id);
            return next;
          });
          setBatchProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentGameName: game.name,
            activeApi: 'BGG (XML API2)',
          });
        },
        abortControllerRef.current.signal
      );
    } catch (e: any) {
      if (e.message !== 'Operação cancelada pelo usuário') {
        console.error('Erro na atualização em lote BGG:', e);
      }
    } finally {
      setIsBatchUpdating(false);
      setBatchProgress(null);
      setUpdatingGameIds(new Set());
      abortControllerRef.current = null;
    }
  };

  /**
   * 3. Atualização em Lote Ludopedia Otimizada com Concorrência (5 itens) e Backoff Exponencial
   */
  const fetchLudoDataForGames = async (gameList: GameData[]) => {
    if (!ludoToken) {
      alert("Token da Ludopedia não configurado. Vá em Configurações para adicionar.");
      return;
    }
    if (gameList.length === 0) return;

    abortControllerRef.current = new AbortController();
    setIsBatchUpdating(true);
    setUpdatingGameIds(new Set());
    const total = gameList.length;
    let completed = 0;

    try {
      await processBatchWithConcurrency(
        gameList,
        5,
        async (game) => {
          setUpdatingGameIds(prev => new Set(prev).add(game.id));
          setBatchProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentGameName: game.name,
            activeApi: 'Ludopedia (v1)',
          });

          const ludoData = await fetchLudopediaData(game.name, ludoToken, game.ludoId);
          if (ludoData) {
            setGames(prev => prev.map(g => {
              if (g.id !== game.id) return g;
              const gSpendNum = typeof g.spend === 'string' ? parseFloat(String(g.spend).replace(',', '.')) : Number(g.spend);
              const updatedSpend = (ludoData.spend !== undefined && ludoData.spend > 0)
                ? ludoData.spend
                : ((isNaN(gSpendNum) || gSpendNum <= 0) && ludoData.spend !== undefined
                    ? ludoData.spend
                    : g.spend);
              return {
                ...g,
                namePt: ludoData.namePt || g.namePt,
                spend: updatedSpend,
                ludoId: ludoData.ludoId || g.ludoId,
                bggId: ludoData.bggId || g.bggId,
                type: ludoData.type !== 'Base' ? ludoData.type : g.type,
                thumbnail: ludoData.thumbnail || g.thumbnail,
                image: ludoData.image || g.image,
                yearPublished: ludoData.yearPublished || g.yearPublished,
                minPlayers: ludoData.minPlayers || g.minPlayers,
                maxPlayers: ludoData.maxPlayers || g.maxPlayers,
                playtime: ludoData.playtime || g.playtime,
                ludoRating: ludoData.ludoRating || g.ludoRating,
                rank: ludoData.rank || g.rank,
                domains: ludoData.domains || g.domains,
                mechanicsPt: ludoData.mechanicsPt || g.mechanicsPt,
                categories: ludoData.categories || g.categories,
                themes: ludoData.themes || g.themes,
                designers: (ludoData.designers?.length ? ludoData.designers : g.designers),
                artists: (ludoData.artists?.length ? ludoData.artists : g.artists),
                descriptionPt: ludoData.descriptionPt || g.descriptionPt,
                acquiredAt: g.acquiredAt || ludoData.acquiredAt,
                isPlayed: (g.isPlayed !== undefined || ludoData.isPlayed !== undefined)
                  ? ((ludoData.isExpansion || g.type === 'Expansão' || (g as any).isExpansion) && ludoData.isPlayed !== undefined
                      ? ludoData.isPlayed
                      : Boolean(g.isPlayed || ludoData.isPlayed))
                  : undefined,
                playCount: ludoData.playCount !== undefined ? ludoData.playCount : g.playCount,
              };
            }));
          }

          completed++;
          setUpdatingGameIds(prev => {
            const next = new Set(prev);
            next.delete(game.id);
            return next;
          });
          setBatchProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentGameName: game.name,
            activeApi: 'Ludopedia (v1)',
          });
        },
        abortControllerRef.current.signal
      );
    } catch (e: any) {
      if (e.message !== 'Operação cancelada pelo usuário') {
        console.error('Erro na atualização em lote Ludopedia:', e);
      }
    } finally {
      setIsBatchUpdating(false);
      setBatchProgress(null);
      setUpdatingGameIds(new Set());
      abortControllerRef.current = null;
    }
  };

  /**
   * 4. Atualização em Lote Compara Jogos: Restrita estritamente a Preço de Varejo e Usados
   */
  const fetchComparaDataForGames = async (gameList: GameData[]) => {
    if (gameList.length === 0) return;

    abortControllerRef.current = new AbortController();
    setIsBatchUpdating(true);
    setUpdatingGameIds(new Set());
    const total = gameList.length;
    let completed = 0;

    try {
      await processBatchWithConcurrency(
        gameList,
        5,
        async (game) => {
          setUpdatingGameIds(prev => new Set(prev).add(game.id));
          setBatchProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentGameName: game.name,
            activeApi: 'Compara Jogos (Preços e Sleeves)',
          });

          const priceData = await fetchComparaJogosData(game.name, game.bggId);
          if (priceData) {
            setGames(prev => prev.map(g => {
              if (g.id !== game.id) return g;
              let marketValue = g.value;
              if (priceData.retailPrice !== undefined && priceData.retailPrice > 0) {
                marketValue = priceData.retailPrice;
              } else if (priceData.usedPrice !== undefined && priceData.usedPrice > 0) {
                marketValue = priceData.usedPrice;
              }

              return {
                ...g,
                retailPrice: priceData.retailPrice || g.retailPrice,
                usedPrice: priceData.usedPrice || g.usedPrice,
                cardSleeves: priceData.cardSleeves?.sets?.length ? priceData.cardSleeves : g.cardSleeves,
                rank: g.rank || priceData.bggRank,
                value: marketValue,
              };
            }));
          }

          completed++;
          setUpdatingGameIds(prev => {
            const next = new Set(prev);
            next.delete(game.id);
            return next;
          });
          setBatchProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentGameName: game.name,
            activeApi: 'Compara Jogos (Preços e Sleeves)',
          });
        },
        abortControllerRef.current.signal
      );
    } catch (e: any) {
      if (e.message !== 'Operação cancelada pelo usuário') {
        console.error('Erro na atualização em lote Compara Jogos:', e);
      }
    } finally {
      setIsBatchUpdating(false);
      setBatchProgress(null);
      setUpdatingGameIds(new Set());
      abortControllerRef.current = null;
    }
  };

  /**
   * 4.1 Busca e sincronização dedicada de quantidade de sleeves por tipo via API (Compara Jogos / Ludopedia)
   * Filtra estritamente apenas jogos pertencentes à coleção ativa (exclui jogos vendidos ou com tag VENDIDOS)
   */
  const fetchSleevesForGames = async (gameList: GameData[]) => {
    const validGames = gameList.filter(g => isGameInCollection(g) && !g.noCards);
    if (validGames.length === 0) return;

    abortControllerRef.current = new AbortController();
    setIsBatchUpdating(true);
    setUpdatingGameIds(new Set());
    const total = validGames.length;
    let completed = 0;

    try {
      await processBatchWithConcurrency(
        validGames,
        5,
        async (game) => {
          setUpdatingGameIds(prev => new Set(prev).add(game.id));
          setBatchProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentGameName: game.name,
            activeApi: 'Compara Jogos / Ludopedia / BGG (Sleeves por Tipo)',
          });

          // 1. Resolução de BGG ID se ausente
          let bggId = game.bggId;
          if (!bggId && game.name) {
            bggId = (await searchBggIdViaCompara(game.name)) || (await searchBGGId(game.name, { token: bggToken })) || undefined;
          }

          // 2. Consulta PRIMÁRIA de sleeves via Compara Jogos
          let priceData = await fetchComparaJogosData(game.name, bggId);

          // 2.1 Fallback Compara Jogos com nome alternativo em português se disponível
          if ((!priceData?.cardSleeves?.sets?.length) && (game as any).namePt && (game as any).namePt !== game.name) {
            const fallbackData = await fetchComparaJogosData((game as any).namePt, bggId);
            if (fallbackData?.cardSleeves?.sets?.length) {
              priceData = { ...priceData, ...fallbackData };
            }
          }

          let cardSleeves = priceData?.cardSleeves?.sets?.length ? priceData.cardSleeves : game.cardSleeves;
          let resolvedLudoId = game.ludoId;

          // 3. CONSULTA SECUNDÁRIA (Fallback): Se o Compara Jogos não encontrou sleeves, busca na API da Ludopedia
          if (!cardSleeves?.sets?.length) {
            setBatchProgress({
              current: completed,
              total,
              percentage: Math.round((completed / total) * 100),
              currentGameName: game.name,
              activeApi: 'Ludopedia API (Fallback Secundário de Sleeves)',
            });

            const ludoData = await fetchLudopediaData(game.name, ludoToken, game.ludoId);

            if (ludoData) {
              if (ludoData.ludoId) resolvedLudoId = ludoData.ludoId;

              // 3.1 Se a Ludopedia retornou dados de sleeves diretamente
              if (ludoData.cardSleeves?.sets?.length) {
                cardSleeves = ludoData.cardSleeves;
              } else if (ludoData.bggId && ludoData.bggId !== bggId) {
                // 3.2 Se a Ludopedia descobriu um BGG ID vinculado (ex: link_bgg) que o jogo não tinha,
                // re-consulta o Compara Jogos com o BGG ID resolvido pela Ludopedia
                bggId = ludoData.bggId;
                const reCompara = await fetchComparaJogosData(ludoData.namePt || game.name, bggId);
                if (reCompara?.cardSleeves?.sets?.length) {
                  cardSleeves = reCompara.cardSleeves;
                  priceData = { ...priceData, ...reCompara };
                }
              } else if (ludoData.namePt && ludoData.namePt !== game.name) {
                // 3.3 Tenta Compara Jogos com o nome nacional oficial resolvido pela Ludopedia
                const reComparaName = await fetchComparaJogosData(ludoData.namePt, bggId);
                if (reComparaName?.cardSleeves?.sets?.length) {
                  cardSleeves = reComparaName.cardSleeves;
                  priceData = { ...priceData, ...reComparaName };
                }
              }
            }
          }

          // 4. CONSULTA TERCIÁRIA (Fallback): Se Compara Jogos e Ludopedia não encontraram sleeves, consulta BGG
          if (!cardSleeves?.sets?.length) {
            setBatchProgress({
              current: completed,
              total,
              percentage: Math.round((completed / total) * 100),
              currentGameName: game.name,
              activeApi: 'BGG API (Fallback Terciário de Sleeves)',
            });

            const bggSleeves = await fetchBGGSleeves(bggId, game.name, bggToken);
            if (bggSleeves?.sets?.length) {
              cardSleeves = bggSleeves;
            }
          }

          if (priceData || cardSleeves) {
            setGames(prev => prev.map(g => {
              if (g.id !== game.id) return g;
              let marketValue = g.value;
              if (priceData?.retailPrice !== undefined && priceData.retailPrice > 0) {
                marketValue = priceData.retailPrice;
              } else if (priceData?.usedPrice !== undefined && priceData.usedPrice > 0) {
                marketValue = priceData.usedPrice;
              }

              return {
                ...g,
                bggId: g.bggId || priceData?.bggId || bggId,
                ludoId: g.ludoId || resolvedLudoId,
                retailPrice: priceData?.retailPrice || g.retailPrice,
                usedPrice: priceData?.usedPrice || g.usedPrice,
                cardSleeves: g.noCards ? g.cardSleeves : (cardSleeves?.sets?.length ? cardSleeves : g.cardSleeves),
                value: marketValue,
              };
            }));
          }

          completed++;
          setUpdatingGameIds(prev => {
            const next = new Set(prev);
            next.delete(game.id);
            return next;
          });
          setBatchProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentGameName: game.name,
            activeApi: 'Compara Jogos / Ludopedia / BGG (Sleeves por Tipo)',
          });
        },
        abortControllerRef.current.signal
      );
    } catch (e: any) {
      if (e.message !== 'Operação cancelada pelo usuário') {
        console.error('Erro na busca de sleeves por tipo:', e);
      }
    } finally {
      setIsBatchUpdating(false);
      setBatchProgress(null);
      setUpdatingGameIds(new Set());
      abortControllerRef.current = null;
    }
  };

  const fetchLudoCollection = async () => {
    if (!ludoToken) {
      alert("Token da Ludopedia não configurado. Vá em Configurações para adicionar.");
      throw new Error("Token não configurado");
    }
    
    try {
      setIsLoading(true);
      let allItems: any[] = [];

      // Diretriz 1: Endpoints consultados restritos exclusivamente à estante pessoal ('colecao' e 'teve')
      // Não consulta listas gerais de jogados/partidas como fonte de novos itens para a estante
      const listasParaBuscar = ['colecao', 'teve'];

      for (const lista of listasParaBuscar) {
        let currentPage = 1;
        let hasMore = true;

        while (hasMore) {
          const url = `/ludo-api/colecao?lista=${lista}&rows=100&page=${currentPage}`;
          
          let res = await fetch(url, { headers: { 'Authorization': `Bearer ${ludoToken}` } });
          let attempts = 0;
          while (res.status === 429 && attempts < 5) {
            await new Promise(r => setTimeout(r, 3000 * Math.pow(1.5, attempts)));
            res = await fetch(url, { headers: { 'Authorization': `Bearer ${ludoToken}` } });
            attempts++;
          }
          
          if (!res.ok) {
            throw new Error(`Falha ao buscar lista ${lista} na Ludopedia.`);
          }

          const json = await res.json();
          
          if (json.colecao) {
            const items = Array.isArray(json.colecao) ? json.colecao : [json.colecao];
            items.forEach((it: any) => {
              it._source_lista = lista;
            });
            // Filtro estrito: apenas itens que comprovadamente pertencem à coleção (ou foram vendidos no caso de 'teve')
            // Jogos que apenas foram jogados mas não são possuídos são descartados da importação
            const validItems = items.filter((it: any) => isOwnedInLudopedia(it));
            allItems = [...allItems, ...validItems];
            if (currentPage * 100 >= json.total) {
              hasMore = false;
            } else {
              currentPage++;
              await new Promise(r => setTimeout(r, 500));
            }
          } else {
            hasMore = false;
          }
        }
      }

      // Buscar histórico de partidas da Ludopedia exclusivamente para correlacionar
      // o status isPlayed dos jogos que comprovadamente pertencem à coleção
      const playedGameIds = new Set<string>();
      const playedGameNames = new Set<string>();
      const playedGameCounts = new Map<string, number>();
      try {
        const partRes = await fetch('/ludo-api/partidas/group?groupby=jogos&rows=100', {
          headers: { 'Authorization': `Bearer ${ludoToken}` }
        });
        if (partRes.ok) {
          const partJson = await partRes.json();
          const groupItems = Array.isArray(partJson.jogos) ? partJson.jogos : (Array.isArray(partJson) ? partJson : []);
          for (const pj of groupItems) {
            const pCount = Number(pj.qtde || pj.qt_partidas || pj.total_partidas || pj.total || pj.count || 1);
            if (pj.id_jogo) {
              playedGameIds.add(String(pj.id_jogo));
              playedGameCounts.set(String(pj.id_jogo), pCount);
            }
            if (pj.jogo?.id_jogo) {
              playedGameIds.add(String(pj.jogo.id_jogo));
              playedGameCounts.set(String(pj.jogo.id_jogo), pCount);
            }
            if (pj.nm_jogo) {
              playedGameNames.add(normalizeGameName(pj.nm_jogo));
              playedGameCounts.set(normalizeGameName(pj.nm_jogo), pCount);
            }
            if (pj.jogo?.nm_jogo) {
              playedGameNames.add(normalizeGameName(pj.jogo.nm_jogo));
              playedGameCounts.set(normalizeGameName(pj.jogo.nm_jogo), pCount);
            }
          }
        }
      } catch {
        // Ignora se o endpoint não estiver disponível ou usuário não tiver partidas registradas
      }
      
      if (allItems.length > 0 || playedGameIds.size > 0) {
        const uniqueItemsMap = new Map();
        for (const item of allItems) {
          const idKey = String(item.id_jogo);
          const existing = uniqueItemsMap.get(idKey);
          if (existing) {
            uniqueItemsMap.set(idKey, {
              ...existing,
              ...item,
              fl_tem: (existing.fl_tem || item.fl_tem),
              fl_jogou: (existing.fl_jogou || item.fl_jogou) ? 1 : 0,
              qt_partidas: Math.max(Number(existing.qt_partidas || 0), Number(item.qt_partidas || 0)),
              isPlayed: Boolean(existing.isPlayed || item.isPlayed || parseIsPlayedFromLudo(item)),
            });
          } else {
            uniqueItemsMap.set(idKey, item);
          }
        }
        const uniqueItems = Array.from(uniqueItemsMap.values());

        const newGames: GameData[] = uniqueItems.map((item: any, idx: number) => {
          let inferredType = 'Base';
          const lName = (item.nm_jogo || '').toLowerCase();
          if (item.tp_jogo === 'e' || item.tp_jogo === 'E' || lName.includes('expans') || lName.includes('expansion')) {
            inferredType = 'Expansão';
          } else if (item.tp_jogo === 'p' || item.tp_jogo === 'P' || lName.includes('promo')) {
            inferredType = 'Promo';
          } else if (item.tp_jogo === 'a' || item.tp_jogo === 'A' || lName.includes('acess')) {
            inferredType = 'Acessório';
          } else if (item.nm_tipo_jogo) {
            inferredType = item.nm_tipo_jogo;
          } else if (item.tipo_jogo) {
            inferredType = item.tipo_jogo;
          }

          // Diretriz 1: Filtro Estrito de Coleção (Ownership Check)
          const isOwned = isOwnedInLudopedia(item);

          // Atualizar o status isPlayed (Jogado/Não Jogado) APENAS para os itens que possuam a flag
          // ou validação de que pertencem à coleção do usuário
          const isPlayedInLudo = isOwned && Boolean(
            parseIsPlayedFromLudo(item) ||
            item.fl_jogou === 1 ||
            item.isPlayed === true ||
            playedGameIds.has(String(item.id_jogo)) ||
            playedGameNames.has(normalizeGameName(item.nm_jogo))
          );

          const ludoPlayCount = (item.id_jogo && playedGameCounts.get(String(item.id_jogo))) ||
            playedGameCounts.get(normalizeGameName(item.nm_jogo)) ||
            parsePlayCountFromLudo(item);
          const resolvedPlayCount = isOwned && isPlayedInLudo
            ? (ludoPlayCount && ludoPlayCount > 0 ? ludoPlayCount : 1)
            : undefined;

          let mappedStatus = 'Desconhecido';
          if (item.fl_tem) mappedStatus = 'Na Coleção';
          else if (item.fl_teve) mappedStatus = 'Vendido';
          else if (item.fl_quer) mappedStatus = 'Desejo';
          else if (isOwned) mappedStatus = 'Na Coleção';

          return {
            id: `ludo-${item.id_jogo}-${Date.now()}-${idx}`,
            ludoId: String(item.id_jogo),
            name: item.nm_jogo || 'Jogo Desconhecido',
            status: mappedStatus,
            spend: (item.vl_custo !== undefined && item.vl_custo !== null && item.vl_custo !== '') ? (typeof item.vl_custo === 'number' ? item.vl_custo : parseFloat(String(item.vl_custo).replace(',', '.'))) : 0,
            type: inferredType,
            value: 0,
            yearPublished: item.ano_publicacao ? parseInt(item.ano_publicacao, 10) : undefined,
            thumbnail: item.thumb,
            ludoRating: item.vl_nota ? parseFloat(item.vl_nota) : undefined,
            isPlayed: isPlayedInLudo,
            playCount: resolvedPlayCount,
            _isOwned: isOwned,
          } as GameData;
        });

        setGames(prev => {
          const newPrev = [...prev];
          const hadExistingGames = prev.length > 0;
          const todayIso = new Date().toISOString().split('T')[0];
          
          for (const ng of newGames) {
            const isNgExp = ng.type === 'Expansão';
            const existingIndex = newPrev.findIndex(g => {
              if (g.ludoId && ng.ludoId) return g.ludoId === ng.ludoId;
              const isGExp = g.type === 'Expansão';
              // Jogo Base e Expansão NUNCA podem ser fundidos por correspondência de nome
              if (isGExp !== isNgExp) return false;
              return (
                g.name.toLowerCase() === ng.name.toLowerCase() ||
                matchesGameName(g.name, ng.name)
              );
            });
            
            if (existingIndex !== -1) {
              const prevG = newPrev[existingIndex];
              const isExpTarget = prevG.type === 'Expansão' || ng.type === 'Expansão';
              const prevSpendNum = typeof prevG.spend === 'string' ? parseFloat(String(prevG.spend).replace(',', '.')) : Number(prevG.spend);
              const ngSpendNum = typeof ng.spend === 'string' ? parseFloat(String(ng.spend).replace(',', '.')) : Number(ng.spend);
              const resolvedSpend = (ngSpendNum > 0) ? ngSpendNum : (isNaN(prevSpendNum) || prevSpendNum <= 0 ? (ngSpendNum || 0) : prevG.spend);
              const nextStatus = prevG.status === 'Desconhecido' ? ng.status : prevG.status;
              const becameSold = prevG.status !== 'Vendido' && ng.status === 'Vendido';

              newPrev[existingIndex] = {
                ...prevG,
                ludoId: prevG.ludoId || ng.ludoId,
                thumbnail: prevG.thumbnail || ng.thumbnail,
                ludoRating: prevG.ludoRating || ng.ludoRating,
                status: nextStatus,
                spend: resolvedSpend,
                yearPublished: prevG.yearPublished || ng.yearPublished,
                type: ng.type || prevG.type,
                soldAt: prevG.soldAt || (becameSold ? todayIso : undefined),
                // Para expansão: o status isPlayed deve refletir diretamente a API da Ludopedia.
                // Se na API não constar JOGADO, vem como NÃO JOGADO (sem herdar do jogo base ou do cache).
                isPlayed: isExpTarget ? ng.isPlayed : Boolean(prevG.isPlayed || ng.isPlayed),
                playCount: ng.playCount !== undefined ? ng.playCount : prevG.playCount,
              };
            } else {
              // Diretriz 2: Bloqueio de Inserção Indevida
              // Se o jogo vier da API marcado como "jogado" mas não houver confirmação de que o usuário o possui,
              // o item deve ser ignorado e descartado do merge final, impedindo que ele apareça na lista de jogos do sistema.
              const isConfirmedOwned = isOwnedInLudopedia(ng) && (ng.status === 'Na Coleção' || ng.status === 'Vendido');
              if (!isConfirmedOwned) {
                // Descarta o item do merge final
                continue;
              }
              newPrev.push({
                ...ng,
                acquiredAt: ng.acquiredAt || (hadExistingGames && ng.status === 'Na Coleção' ? todayIso : undefined),
                soldAt: ng.soldAt || (hadExistingGames && ng.status === 'Vendido' ? todayIso : undefined),
              });
            }
          }

          // Se houver jogos em partidas da Ludopedia que já existem localmente, garantir isPlayed = true e playCount correto
          if (playedGameIds.size > 0 || playedGameNames.size > 0) {
            for (let i = 0; i < newPrev.length; i++) {
              const g = newPrev[i];
              const isGExp = g.type === 'Expansão' || (g as any).isExpansion === true;
              const isMatchedInPlayed = isGExp
                ? ((g.ludoId && playedGameIds.has(g.ludoId)) || playedGameNames.has(normalizeGameName(g.name)))
                : ((g.ludoId && playedGameIds.has(g.ludoId)) || playedGameNames.has(normalizeGameName(g.name)) || Array.from(playedGameNames).some(pn => matchesGameName(g.name, pn)));

              if (isMatchedInPlayed) {
                const pCount = (g.ludoId && playedGameCounts.get(g.ludoId)) || playedGameCounts.get(normalizeGameName(g.name));
                newPrev[i] = {
                  ...g,
                  isPlayed: true,
                  playCount: pCount !== undefined ? pCount : (g.playCount && g.playCount > 0 ? g.playCount : 1),
                };
              }
            }
          }
          
          return newPrev;
        });
      }
    } catch (error) {
      console.error('Erro no Ludopedia Collection:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBGGCollection = async (username: string) => {
    try {
      setIsLoading(true);
      const url = bggUrl(`collection?username=${encodeURIComponent(username)}&stats=1`);
      const activeBggToken = bggToken || DEFAULT_BGG_TOKEN;
      const fetchOpts = activeBggToken ? { headers: { 'Authorization': `Bearer ${activeBggToken}` } } : {};
      
      let res = await fetch(url, fetchOpts);
      
      let attempts = 0;
      while (res.status === 202 && attempts < 5) {
        await new Promise(r => setTimeout(r, 2000));
        res = await fetch(url, fetchOpts);
        attempts++;
      }
      
      if (!res.ok) {
        throw new Error('Falha ao buscar coleção. Verifique o usuário.');
      }

      const text = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const obj = parser.parse(text);

      if (obj?.errors?.error) {
        throw new Error(obj.errors.error?.message || 'Erro do BGG');
      }

      if (obj?.items?.item) {
        const items = Array.isArray(obj.items.item) ? obj.items.item : [obj.items.item];
        
        const newGames: GameData[] = items.map((item: any, idx: number) => {
          const statusNode = item.status || {};
          let mappedStatus = 'Na Coleção';
          if (statusNode['@_own'] === '1') mappedStatus = 'Na Coleção';
          else if (statusNode['@_prevowned'] === '1') mappedStatus = 'Vendido';
          else if (statusNode['@_wishlist'] === '1') mappedStatus = 'Desejo';
          
          let name = 'Jogo Desconhecido';
          if (item.name) {
            name = typeof item.name === 'string' ? item.name : (item.name['#text'] || item.name['@_value'] || 'Jogo Desconhecido');
          }

          let bggType = 'Base';
          const bggName = name.toLowerCase();
          if (item['@_subtype'] === 'boardgameexpansion' || bggName.includes('expans') || bggName.includes('expansion')) {
            bggType = 'Expansão';
          } else if (bggName.includes('promo')) {
            bggType = 'Promo';
          } else if (item['@_subtype'] === 'boardgameaccessory' || bggName.includes('acess')) {
            bggType = 'Acessório';
          }

          let bggRank: number | undefined = undefined;
          const ranksObj = item.stats?.rating?.ranks?.rank;
          if (ranksObj) {
            const bgRankItem = Array.isArray(ranksObj) 
              ? ranksObj.find((r: any) => r['@_name'] === 'boardgame') 
              : ranksObj;
            if (bgRankItem && bgRankItem['@_value'] && bgRankItem['@_value'] !== 'Not Ranked') {
              bggRank = parseInt(bgRankItem['@_value'], 10);
            }
          }

          const bayesRating = item.stats?.rating?.bayesaverage?.['@_value']
            ? parseFloat(item.stats.rating.bayesaverage['@_value'])
            : undefined;

          const rawNumPlays = item.numplays ?? item['@_numplays'] ?? item.stats?.['@_numplays'];
          const numPlays = rawNumPlays !== undefined ? parseInt(String(rawNumPlays), 10) : 0;
          const isPlayedFromBgg = !isNaN(numPlays) && numPlays > 0;

          const rawAcqDate = item.privateinfo?.['@_acquisitiondate'] || statusNode['@_lastmodified'];
          let bggDateIso: string | undefined;
          if (typeof rawAcqDate === 'string') {
            const m = rawAcqDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) bggDateIso = `${m[1]}-${m[2]}-${m[3]}`;
          }

          return {
            id: `bgg-${item['@_objectid']}-${Date.now()}-${idx}`,
            bggId: item['@_objectid'],
            name,
            status: mappedStatus,
            spend: 0,
            type: bggType,
            value: 0,
            thumbnail: item.thumbnail,
            image: item.image,
            yearPublished: item.yearpublished ? parseInt(item.yearpublished, 10) : undefined,
            minPlayers: item.stats?.['@_minplayers'] ? parseInt(item.stats['@_minplayers'], 10) : undefined,
            maxPlayers: item.stats?.['@_maxplayers'] ? parseInt(item.stats['@_maxplayers'], 10) : undefined,
            rating: item.stats?.rating?.average?.['@_value'] ? parseFloat(item.stats.rating.average['@_value']) : undefined,
            geekRating: bayesRating,
            rank: !isNaN(bggRank as number) ? bggRank : undefined,
            isPlayed: isPlayedFromBgg ? true : undefined,
            acquiredAt: mappedStatus === 'Na Coleção' ? bggDateIso : undefined,
            soldAt: mappedStatus === 'Vendido' ? bggDateIso : undefined,
            wishlistAt: mappedStatus === 'Desejo' ? bggDateIso : undefined,
          };
        });

        setGames(prev => {
          const newPrev = [...prev];
          const toAdd: GameData[] = [];
          const hadExistingGames = prev.length > 0;
          const todayIso = new Date().toISOString().split('T')[0];

          for (const ng of newGames) {
            const existingIndex = newPrev.findIndex(g => 
              (g.bggId && g.bggId === ng.bggId) || 
              g.name.toLowerCase() === ng.name.toLowerCase() ||
              matchesGameName(g.name, ng.name)
            );
            
            if (existingIndex !== -1) {
              newPrev[existingIndex] = {
                ...newPrev[existingIndex],
                bggId: newPrev[existingIndex].bggId || ng.bggId,
                thumbnail: newPrev[existingIndex].thumbnail || ng.thumbnail,
                image: newPrev[existingIndex].image || ng.image,
                status: newPrev[existingIndex].status === 'Desconhecido' ? ng.status : newPrev[existingIndex].status,
                yearPublished: newPrev[existingIndex].yearPublished || ng.yearPublished,
                minPlayers: newPrev[existingIndex].minPlayers || ng.minPlayers,
                maxPlayers: newPrev[existingIndex].maxPlayers || ng.maxPlayers,
                rating: newPrev[existingIndex].rating || ng.rating,
                geekRating: newPrev[existingIndex].geekRating || ng.geekRating,
                rank: newPrev[existingIndex].rank || ng.rank,
                acquiredAt: newPrev[existingIndex].acquiredAt || ng.acquiredAt,
                soldAt: newPrev[existingIndex].soldAt || ng.soldAt,
                type: (newPrev[existingIndex].type === 'Base' || newPrev[existingIndex].type === 'Desconhecido') && ng.type !== 'Base' ? ng.type : newPrev[existingIndex].type,
                isPlayed: (newPrev[existingIndex].isPlayed !== undefined || ng.isPlayed !== undefined)
                  ? Boolean(newPrev[existingIndex].isPlayed || ng.isPlayed)
                  : undefined,
              };
            } else {
              toAdd.push({
                ...ng,
                acquiredAt: ng.acquiredAt || (hadExistingGames && ng.status === 'Na Coleção' ? todayIso : undefined),
                soldAt: ng.soldAt || (hadExistingGames && ng.status === 'Vendido' ? todayIso : undefined),
              });
            }
          }
          
          return [...newPrev, ...toAdd];
        });
      }
    } catch (error) {
      console.error('Erro no BGG Collection:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const addGame = (game: Omit<GameData, 'id'>) => {
    const newGame: GameData = {
      ...game,
      id: `manual-${Date.now()}`
    };
    setGames(prev => [...prev, newGame]);
    if (user?.id) {
      upsertUserGame(user.id, newGame).catch(e => console.error('Erro ao salvar novo jogo no Supabase:', e));
    }
  };

  const editGame = (id: string, updates: Partial<Omit<GameData, 'id'>>) => {
    let targetGame: GameData | null = null;
    setGames(prev => {
      const updated = prev.map(g => {
        if (g.id === id) {
          targetGame = { ...g, ...updates };
          return targetGame;
        }
        return g;
      });
      return updated;
    });

    if (user?.id && targetGame) {
      upsertUserGame(user.id, targetGame).catch(e => console.error('Erro ao atualizar jogo no Supabase:', e));
    }
  };

  const deleteGame = (id: string) => {
    setGames(prev => prev.filter(g => g.id !== id));
    if (user?.id) {
      deleteUserGame(user.id, id).catch(e => console.error('Erro ao excluir jogo do Supabase:', e));
    }
  };

  const clearCollection = () => {
    if (window.confirm('Tem certeza que deseja apagar toda a coleção?')) {
      setGames([]);
      try {
        localStorage.removeItem(getStorageKey(user?.id));
      } catch {}
      if (user?.id) {
        clearUserGames(user.id).catch(e => console.error('Erro ao limpar coleção no Supabase:', e));
      }
    }
  };

  const exportToExcel = (sleeveStock?: SleeveStockItem[]) => {
    const ws = XLSX.utils.json_to_sheet(games.map(g => ({
      'Nome do Jogo': g.name,
      'Status': g.status,
      'Jogado': g.isPlayed ? 'Sim' : 'Não',
      'Lacrado': g.isSealed ? 'Sim' : 'Não',
      'Valor Pago': g.spend,
      'Valor Vendido': g.soldValue || '',
      'Tipo': g.type,
      'Valor Mercado': g.value,
      'Ano de Publicação': g.yearPublished || '',
      'Data Entrada': g.acquiredAt || '',
      'Data Saída': g.soldAt || '',
      'Designers': (g.designers || []).join('; '),
      'Nota BGG': g.rating ? g.rating.toFixed(1) : '',
      'Geek Rating': g.geekRating ? g.geekRating.toFixed(2) : '',
      'BGG ID': g.bggId || '',
      'Min Jogadores': g.minPlayers || '',
      'Max Jogadores': g.maxPlayers || '',
      'Tempo de Partida': g.playtime || '',
      'Jogadores Ideais': g.suggestedPlayers?.summary || '',
      'Prêmios': (g.honors || []).join('; '),
      'Sleevado': g.noCards 
        ? 'Sem Cartas' 
        : (() => {
            const status = getGameSleeveStatus(g);
            return status === 'full' ? 'Sim' : status === 'partial' ? 'Parcial' : 'Não';
          })(),
      'Marca Sleeve': g.sleeveBrand || '',
      'Tipo Sleeve': g.sleeveType || '',
      'Sleeves Necessários': g.noCards ? 'Não possui cartas' : (g.cardSleeves?.sets ? g.cardSleeves.sets.map(s => `${s.quantity}x ${s.sizeName || ''} (${s.width}x${s.height}mm)`).join('; ') : ''),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coleção");

    if (sleeveStock && sleeveStock.length > 0) {
      const sleeveWs = XLSX.utils.json_to_sheet(sleeveStock.map(s => ({
        'Modelo': s.model,
        'Marca': s.brand,
        'Quantidade': s.quantity,
        'Tipo': s.type || '',
        'Observações': s.notes || ''
      })));
      XLSX.utils.book_append_sheet(wb, sleeveWs, "Estoque de Sleeves");
    }

    XLSX.writeFile(wb, "Minha_Colecao_BGG.xlsx");
  };

  const exportToJson = (sleeveStock?: SleeveStockItem[]) => {
    const payload = (sleeveStock && sleeveStock.length > 0) ? {
      version: 2,
      exportDate: new Date().toISOString(),
      games,
      sleeveStock,
    } : games;
    const dataStr = JSON.stringify(payload, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'Minha_Colecao_BGG.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const processJsonUpload = (file: File, onStockParsed?: (stock: SleeveStockItem[]) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            setGames(parsed);
            resolve();
          } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.games)) {
              setGames(parsed.games);
            }
            if (Array.isArray(parsed.sleeveStock) && onStockParsed) {
              onStockParsed(parsed.sleeveStock);
            }
            resolve();
          } else {
            reject(new Error("Formato inválido. O arquivo JSON deve ser um array de jogos ou backup completo."));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  };

  const syncPlayCounts = useCallback((countsByLudoId: Record<string, number>, countsByName: Record<string, number>) => {
    setGames(prev => {
      let changed = false;
      const next = prev.map(g => {
        const normName = normalizeGameName(g.name);
        const count = (g.ludoId && countsByLudoId[g.ludoId] !== undefined)
          ? countsByLudoId[g.ludoId]
          : countsByName[normName];

        if (count !== undefined && count !== g.playCount) {
          changed = true;
          return {
            ...g,
            playCount: count,
            isPlayed: count > 0 ? true : g.isPlayed
          };
        }
        return g;
      });
      return changed ? next : prev;
    });
  }, []);

  /**
   * Atualiza múltiplos jogos em lote (ex: atribuição de datas de aquisição/saída ou metadados).
   */
  const patchGamesBatch = useCallback((updatesById: Record<string, Partial<GameData>>) => {
    const keys = Object.keys(updatesById);
    if (keys.length === 0) return;

    setGames(prev => {
      let changed = false;
      const next = prev.map(g => {
        const patch = updatesById[g.id];
        if (!patch) return g;
        changed = true;
        return { ...g, ...patch };
      });
      return changed ? next : prev;
    });
  }, []);

  /**
   * Enriquecimento rápido de metadados (designers, artistas, mecânicas em PT-BR e tempo de jogo)
   * usando BGG em lotes de até 20 IDs por chamada + Ludopedia para nomes em PT-BR e mecânicas nacionais.
   */
  const enrichGamesMetadata = useCallback(async (
    targetGames: GameData[],
    options: { includeLudopedia?: boolean } = {}
  ): Promise<number> => {
    const missingBggMeta = targetGames.filter(
      g => g.bggId && (!g.designers || g.designers.length === 0 || !g.playtime)
    );
    const missingLudoMeta = options.includeLudopedia && ludoToken
      ? targetGames.filter(g => g.ludoId && (!g.mechanicsPt || g.mechanicsPt.length === 0 || !g.designers || g.designers.length === 0))
      : [];

    if (missingBggMeta.length === 0 && missingLudoMeta.length === 0) return 0;

    abortControllerRef.current = new AbortController();
    setIsBatchUpdating(true);
    const totalSteps = missingBggMeta.length + missingLudoMeta.length;
    let completed = 0;
    const patches: Record<string, Partial<GameData>> = {};

    try {
      // 1. Lote BGG XMLAPI2 (até 20 jogos por requisição)
      if (missingBggMeta.length > 0) {
        setBatchProgress({
          current: 0,
          total: totalSteps,
          percentage: 0,
          currentGameName: `Consultando ${missingBggMeta.length} jogos no BGG (lotes de 20)...`,
          activeApi: 'BGG Batch (Designers & Mecânicas)',
        });

        const bggMap = await fetchBGGThingsBatch(
          missingBggMeta.map(g => g.bggId!),
          {
            token: bggToken,
            signal: abortControllerRef.current.signal,
            onChunkComplete: (done) => {
              completed = done;
              setBatchProgress({
                current: completed,
                total: totalSteps,
                percentage: Math.round((completed / Math.max(totalSteps, 1)) * 100),
                currentGameName: `${done}/${missingBggMeta.length} fichas BGG obtidas`,
                activeApi: 'BGG Batch (Designers & Mecânicas)',
              });
            },
          }
        );

        for (const g of missingBggMeta) {
          const parsed = g.bggId ? bggMap[g.bggId] : undefined;
          if (!parsed) continue;
          patches[g.id] = {
            ...patches[g.id],
            designers: parsed.designers?.length ? parsed.designers : g.designers,
            artists: parsed.artists?.length ? parsed.artists : g.artists,
            categories: parsed.categories?.length ? parsed.categories : g.categories,
            mechanics: parsed.mechanics?.length ? parsed.mechanics : g.mechanics,
            playtime: parsed.playtime || g.playtime,
            weight: parsed.weight !== undefined ? parsed.weight : g.weight,
            honors: parsed.honors?.length ? parsed.honors : g.honors,
          };
        }
      }

      // 2. Complemento Ludopedia para mecânicas em PT-BR e designers (se habilitado)
      if (missingLudoMeta.length > 0 && ludoToken && !abortControllerRef.current.signal.aborted) {
        await processBatchWithConcurrency(
          missingLudoMeta,
          5,
          async (game) => {
            const meta = await fetchLudopediaGameMetadata(game.ludoId!, ludoToken);
            if (meta) {
              const existingPatch = patches[game.id] || {};
              patches[game.id] = {
                ...existingPatch,
                namePt: meta.namePt || game.namePt,
                mechanicsPt: meta.mechanicsPt?.length ? meta.mechanicsPt : game.mechanicsPt,
                categories: meta.categories?.length ? meta.categories : (existingPatch.categories || game.categories),
                themes: meta.themes?.length ? meta.themes : game.themes,
                designers: meta.designers?.length ? meta.designers : (existingPatch.designers || game.designers),
                artists: meta.artists?.length ? meta.artists : (existingPatch.artists || game.artists),
                playtime: existingPatch.playtime || meta.playtime || game.playtime,
              };
            }
            completed++;
            setBatchProgress({
              current: completed,
              total: totalSteps,
              percentage: Math.round((completed / Math.max(totalSteps, 1)) * 100),
              currentGameName: game.name,
              activeApi: 'Ludopedia (Designers & Mecânicas PT-BR)',
            });
          },
          abortControllerRef.current.signal
        );
      }

      patchGamesBatch(patches);
      return Object.keys(patches).length;
    } catch (e: any) {
      if (e.message !== 'Operação cancelada pelo usuário') {
        console.error('Erro ao enriquecer metadados:', e);
      }
      patchGamesBatch(patches);
      return Object.keys(patches).length;
    } finally {
      setIsBatchUpdating(false);
      setBatchProgress(null);
      abortControllerRef.current = null;
    }
  }, [bggToken, ludoToken, patchGamesBatch]);

  return {
    games,
    columnMapping,
    setColumnMapping,
    isLoading,
    ludoToken,
    setLudoToken,
    bggToken,
    setBggToken,
    // Lote e Progresso
    isBatchUpdating,
    batchProgress,
    updatingGameIds,
    cancelBatchUpdate,
    updateGamesParallel,
    fetchBGGDataForGames,
    fetchLudoDataForGames,
    fetchComparaDataForGames,
    fetchSleevesForGames,
    enrichGamesMetadata,
    patchGamesBatch,
    // Coleções e CRUD
    processExcelUpload,
    fetchBGGCollection,
    fetchLudoCollection,
    syncPlayCounts,
    clearCollection,
    exportToExcel,
    exportToJson,
    processJsonUpload,
    addGame,
    editGame,
    deleteGame,
  };
}
