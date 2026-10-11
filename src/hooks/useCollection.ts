import { useState, useEffect, useRef } from 'react';
import type { GameData, ColumnMapping } from '../types';
import * as XLSX from 'xlsx';
import { XMLParser } from 'fast-xml-parser';
import { 
  batchUpdateGamesParallel, 
  processBatchWithConcurrency, 
  type BatchProgress 
} from '../services/batchProcessor';
import { fetchBGGThingWithRetry, searchBGGId, DEFAULT_BGG_TOKEN } from '../services/bggService';
import { fetchLudopediaData } from '../services/ludopediaService';
import { fetchComparaJogosData } from '../services/comparaService';

const STORAGE_KEY = 'boardgame_manager_data';
const MAPPING_STORAGE_KEY = 'boardgame_manager_mapping';

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

export function useCollection() {
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

  // Carregar do Local Storage na inicialização
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setGames(parsed.filter(g => g && typeof g === 'object'));
          } else {
            console.warn('Dados no localStorage não são um array. Limpando...');
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch (e) {
          console.error('Erro ao fazer parse dos dados locais', e);
        }
      }
    } catch {}

    try {
      const savedMapping = localStorage.getItem(MAPPING_STORAGE_KEY);
      if (savedMapping) {
        try {
          setColumnMapping(JSON.parse(savedMapping));
        } catch (e) {
          console.error('Erro ao fazer parse do mapping local', e);
        }
      }
    } catch {}

    try {
      const savedLudo = localStorage.getItem('boardgame_manager_ludo_token');
      if (savedLudo) setLudoToken(savedLudo);
    } catch {}

    try {
      const savedBgg = localStorage.getItem('boardgame_manager_bgg_token');
      if (savedBgg) setBggToken(savedBgg);
    } catch {}

    setIsLoading(false);
  }, []);

  // Salvar no Local Storage sempre que games mudar
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
      } catch {}
    }
  }, [games, isLoading]);

  // Salvar mapping e tokens no Local Storage
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(columnMapping));
        localStorage.setItem('boardgame_manager_ludo_token', ludoToken);
        localStorage.setItem('boardgame_manager_bgg_token', bggToken);
      } catch {}
    }
  }, [columnMapping, ludoToken, bggToken, isLoading]);

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

            return {
              id: `local-${index}-${Date.now()}`,
              name,
              status: mappedStatus || getVal(row, ['status', 'estado', 'situacao', 'situação']) || 'Desconhecido',
              spend: toNumber(mappedSpend !== undefined ? mappedSpend : getVal(row, ['valor', 'grana', 'gasto', 'custo', 'valor pago', 'spend', 'preco', 'preço', 'price'])),
              type: detectedType,
              value: toNumber(mappedValue !== undefined ? mappedValue : getVal(row, ['valor mercado', 'valor de mercado', 'mercado', 'market value', 'market'])),
              soldValue: toNumber(mappedSoldValue !== undefined ? mappedSoldValue : getVal(row, ['valor vendido', 'venda', 'sold'])),
            };
          });

          setGames(prevGames => {
            const newGames = [...prevGames];

            for (const parsedGame of parsedGames) {
              const existingIndex = newGames.findIndex(g => g.name.toLowerCase() === parsedGame.name.toLowerCase());
              
              if (existingIndex !== -1) {
                const existing = newGames[existingIndex];
                newGames[existingIndex] = {
                  ...existing,
                  status: (parsedGame.status !== 'Desconhecido' && parsedGame.status) ? parsedGame.status : existing.status,
                  spend: parsedGame.spend ? parsedGame.spend : existing.spend,
                  type: (parsedGame.type !== 'Base' && parsedGame.type) ? parsedGame.type : existing.type,
                  value: parsedGame.value ? parsedGame.value : existing.value,
                  soldValue: parsedGame.soldValue ? parsedGame.soldValue : existing.soldValue,
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
            if (bggData) {
              setGames(prev => prev.map(g => {
                if (g.id !== game.id) return g;
                return {
                  ...g,
                  bggId,
                  thumbnail: bggData.thumbnail || g.thumbnail,
                  image: bggData.image || g.image,
                  minPlayers: bggData.minPlayers || g.minPlayers,
                  maxPlayers: bggData.maxPlayers || g.maxPlayers,
                  yearPublished: bggData.yearPublished || g.yearPublished,
                  rating: bggData.rating || g.rating,
                  geekRating: bggData.geekRating || g.geekRating,
                  weight: bggData.weight || g.weight,
                  rank: bggData.rank || g.rank,
                  domains: bggData.domains || g.domains,
                  mechanics: bggData.mechanics || g.mechanics,
                  honors: bggData.honors || g.honors,
                  suggestedPlayers: bggData.suggestedPlayers || g.suggestedPlayers,
                  description: bggData.description || g.description,
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
              return {
                ...g,
                ludoId: ludoData.ludoId || g.ludoId,
                bggId: ludoData.bggId || g.bggId,
                type: ludoData.type !== 'Base' ? ludoData.type : g.type,
                thumbnail: ludoData.thumbnail || g.thumbnail,
                image: ludoData.image || g.image,
                yearPublished: ludoData.yearPublished || g.yearPublished,
                minPlayers: ludoData.minPlayers || g.minPlayers,
                maxPlayers: ludoData.maxPlayers || g.maxPlayers,
                ludoRating: ludoData.ludoRating || g.ludoRating,
                rank: ludoData.rank || g.rank,
                domains: ludoData.domains || g.domains,
                descriptionPt: ludoData.descriptionPt || g.descriptionPt,
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
            activeApi: 'Compara Jogos (Preços)',
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
            activeApi: 'Compara Jogos (Preços)',
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

  const fetchLudoCollection = async () => {
    if (!ludoToken) {
      alert("Token da Ludopedia não configurado. Vá em Configurações para adicionar.");
      throw new Error("Token não configurado");
    }
    
    try {
      setIsLoading(true);
      let allItems: any[] = [];

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
            allItems = [...allItems, ...items];
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
      
      if (allItems.length > 0) {
        const uniqueItemsMap = new Map();
        for (const item of allItems) {
          uniqueItemsMap.set(item.id_jogo, item);
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

          return {
            id: `ludo-${item.id_jogo}-${Date.now()}-${idx}`,
            ludoId: String(item.id_jogo),
            name: item.nm_jogo || 'Jogo Desconhecido',
            status: item.fl_tem ? 'Na Coleção' : (item.fl_teve ? 'Vendido' : (item.fl_quer ? 'Desejo' : 'Na Coleção')),
            spend: item.vl_custo ? parseFloat(item.vl_custo) : 0,
            type: inferredType,
            value: 0,
            yearPublished: item.ano_publicacao ? parseInt(item.ano_publicacao, 10) : undefined,
            thumbnail: item.thumb,
            ludoRating: item.vl_nota ? parseFloat(item.vl_nota) : undefined,
          };
        });

        setGames(prev => {
          const newPrev = [...prev];
          
          for (const ng of newGames) {
            const existingIndex = newPrev.findIndex(g => g.name.toLowerCase() === ng.name.toLowerCase() || g.ludoId === ng.ludoId);
            
            if (existingIndex !== -1) {
              newPrev[existingIndex] = {
                ...newPrev[existingIndex],
                ludoId: newPrev[existingIndex].ludoId || ng.ludoId,
                thumbnail: newPrev[existingIndex].thumbnail || ng.thumbnail,
                ludoRating: newPrev[existingIndex].ludoRating || ng.ludoRating,
                status: newPrev[existingIndex].status === 'Desconhecido' ? ng.status : newPrev[existingIndex].status,
                spend: newPrev[existingIndex].spend === 0 ? ng.spend : newPrev[existingIndex].spend,
                yearPublished: newPrev[existingIndex].yearPublished || ng.yearPublished,
                type: ng.type || newPrev[existingIndex].type,
              };
            } else {
              newPrev.push(ng);
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
            rank: !isNaN(bggRank as number) ? bggRank : undefined
          };
        });

        setGames(prev => {
          const newPrev = [...prev];
          const toAdd: GameData[] = [];

          for (const ng of newGames) {
            const existingIndex = newPrev.findIndex(g => (g.bggId && g.bggId === ng.bggId) || g.name.toLowerCase() === ng.name.toLowerCase());
            
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
                type: (newPrev[existingIndex].type === 'Base' || newPrev[existingIndex].type === 'Desconhecido') && ng.type !== 'Base' ? ng.type : newPrev[existingIndex].type,
              };
            } else {
              toAdd.push(ng);
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
  };

  const editGame = (id: string, updates: Partial<Omit<GameData, 'id'>>) => {
    setGames(prev => prev.map(g => (g.id === id ? { ...g, ...updates } : g)));
  };

  const deleteGame = (id: string) => {
    setGames(prev => prev.filter(g => g.id !== id));
  };

  const clearCollection = () => {
    if (window.confirm('Tem certeza que deseja apagar toda a coleção?')) {
      setGames([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(games.map(g => ({
      'Nome do Jogo': g.name,
      'Status': g.status,
      'Valor Pago': g.spend,
      'Valor Vendido': g.soldValue || '',
      'Tipo': g.type,
      'Valor Mercado': g.value,
      'Ano de Publicação': g.yearPublished || '',
      'Nota BGG': g.rating ? g.rating.toFixed(1) : '',
      'Geek Rating': g.geekRating ? g.geekRating.toFixed(2) : '',
      'BGG ID': g.bggId || '',
      'Min Jogadores': g.minPlayers || '',
      'Max Jogadores': g.maxPlayers || '',
      'Tempo de Partida': g.playtime || '',
      'Jogadores Ideais': g.suggestedPlayers?.summary || '',
      'Prêmios': (g.honors || []).join('; '),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coleção");
    XLSX.writeFile(wb, "Minha_Colecao_BGG.xlsx");
  };

  const exportToJson = () => {
    const dataStr = JSON.stringify(games, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'Minha_Colecao_BGG.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const processJsonUpload = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            setGames(parsed);
            resolve();
          } else {
            reject(new Error("Formato inválido. O arquivo JSON deve ser um array de jogos."));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  };

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
    // Coleções e CRUD
    processExcelUpload,
    fetchBGGCollection,
    fetchLudoCollection,
    clearCollection,
    exportToExcel,
    exportToJson,
    processJsonUpload,
    addGame,
    editGame,
    deleteGame,
  };
}
