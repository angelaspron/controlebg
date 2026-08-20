import { useState, useEffect } from 'react';
import type { GameData, ColumnMapping } from '../types';
import * as XLSX from 'xlsx';
import { XMLParser } from 'fast-xml-parser';

const STORAGE_KEY = 'boardgame_manager_data';
const MAPPING_STORAGE_KEY = 'boardgame_manager_mapping';

const defaultMapping: ColumnMapping = {
  name: '',
  status: '',
  spend: '',
  type: '',
  value: ''
};

// A API do BGG agora suporta CORS nativamente, não precisamos de proxy.
function bggUrl(path: string) {
  return `https://boardgamegeek.com/xmlapi2/${path}`;
}

export function useCollection() {
  const [games, setGames] = useState<GameData[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(defaultMapping);
  const [ludoToken, setLudoToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Carregar do Local Storage na inicialização
  useEffect(() => {
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

    const savedMapping = localStorage.getItem(MAPPING_STORAGE_KEY);
    if (savedMapping) {
      try {
        setColumnMapping(JSON.parse(savedMapping));
      } catch (e) {
        console.error('Erro ao fazer parse do mapping local', e);
      }
    }

    const savedLudo = localStorage.getItem('boardgame_manager_ludo_token');
    if (savedLudo) setLudoToken(savedLudo);

    setIsLoading(false);
  }, []);

  // Salvar no Local Storage sempre que games mudar
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    }
  }, [games, isLoading]);

  // Salvar mapping no Local Storage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(columnMapping));
      localStorage.setItem('boardgame_manager_ludo_token', ludoToken);
    }
  }, [columnMapping, ludoToken, isLoading]);

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

          // Helper para buscar colunas ignorando maiúsculas/minúsculas, espaços e acentos
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

          // Log das colunas para debug
          if (json.length > 0) {
            console.log('Colunas detectadas no Excel:', Object.keys(json[0]));
          }

          const parsedGames: GameData[] = json.map((row, index) => {
            const mappedName = columnMapping.name ? getVal(row, [columnMapping.name]) : undefined;
            const mappedStatus = columnMapping.status ? getVal(row, [columnMapping.status]) : undefined;
            const mappedSpend = columnMapping.spend ? getVal(row, [columnMapping.spend]) : undefined;
            const mappedType = columnMapping.type ? getVal(row, [columnMapping.type]) : undefined;
            const mappedValue = columnMapping.value ? getVal(row, [columnMapping.value]) : undefined;
            const mappedSoldValue = columnMapping.soldValue ? getVal(row, [columnMapping.soldValue]) : undefined;

            return {
              id: `local-${index}-${Date.now()}`,
              name: mappedName || getVal(row, ['jogos', 'jogo', 'nome', 'name', 'titulo', 'título']) || 'Jogo Desconhecido',
              status: mappedStatus || getVal(row, ['status', 'estado', 'situacao', 'situação']) || 'Desconhecido',
              spend: toNumber(mappedSpend !== undefined ? mappedSpend : getVal(row, ['valor', 'grana', 'gasto', 'custo', 'valor pago', 'spend', 'preco', 'preço', 'price'])),
              type: mappedType || getVal(row, ['tipo', 'categoria', 'type']) || 'Base',
              value: toNumber(mappedValue !== undefined ? mappedValue : getVal(row, ['valor mercado', 'valor de mercado', 'mercado', 'market value', 'market'])),
              soldValue: toNumber(mappedSoldValue !== undefined ? mappedSoldValue : getVal(row, ['valor vendido', 'venda', 'sold'])),
            };
          });

          setGames(prevGames => {
            const newGames = [...prevGames];
            const toFetchBGG: GameData[] = [];

            for (const parsedGame of parsedGames) {
              const existingIndex = newGames.findIndex(g => g.name.toLowerCase() === parsedGame.name.toLowerCase());
              
              if (existingIndex !== -1) {
                // Mesclar informações
                const existing = newGames[existingIndex];
                newGames[existingIndex] = {
                  ...existing,
                  status: (parsedGame.status !== 'Desconhecido' && parsedGame.status) ? parsedGame.status : existing.status,
                  spend: parsedGame.spend ? parsedGame.spend : existing.spend,
                  type: (parsedGame.type !== 'Base' && parsedGame.type) ? parsedGame.type : existing.type,
                  value: parsedGame.value ? parsedGame.value : existing.value,
                  soldValue: parsedGame.soldValue ? parsedGame.soldValue : existing.soldValue,
                };
                
                // Se o jogo não tem BGG info ainda, entra na fila pra buscar
                if (!existing.bggId) {
                  toFetchBGG.push(newGames[existingIndex]);
                }
              } else {
                // Adicionar como novo
                newGames.push(parsedGame);
                toFetchBGG.push(parsedGame);
              }
            }

            // REMOVIDO: Iniciar busca no BGG em background automaticamente
            // if (toFetchBGG.length > 0) {
            //   setTimeout(() => fetchBGGDataForGames(toFetchBGG), 100);
            // }

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

  const fetchBGGDataForGames = async (gameList: GameData[]) => {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

    for (let i = 0; i < gameList.length; i++) {
      const game = gameList[i];
      // Removido: if (game.bggId) continue; para permitir atualização forçada

      try {
        // Função helper com retry para Rate Limit (429)
        const fetchWithRetry = async (url: string) => {
          let res = await fetch(url, { headers: { 'Authorization': 'Bearer cdbac8cf-91ac-4af7-9d1f-266544061d52' } });
          let retryCount = 0;
          while (res.status === 429 && retryCount < 5) {
            console.log('BGG Rate Limit alcançado. Aguardando 5 segundos...');
            await new Promise(r => setTimeout(r, 5000));
            res = await fetch(url, { headers: { 'Authorization': 'Bearer cdbac8cf-91ac-4af7-9d1f-266544061d52' } });
            retryCount++;
          }
          return res;
        };

        // 1. Busca por nome - tenta exato primeiro, depois genérico
        const trySearch = async (exact: boolean): Promise<string | null> => {
          const url = bggUrl(
            `search?query=${encodeURIComponent(game.name)}&type=boardgame,boardgameexpansion${exact ? '&exact=1' : ''}`
          );
          const res = await fetchWithRetry(url);
          if (!res.ok) return null;
          const text = await res.text();
          const obj = parser.parse(text);
          if (obj?.items?.item) {
            const items = Array.isArray(obj.items.item) ? obj.items.item : [obj.items.item];
            return items[0]?.['@_id'] ?? null;
          }
          return null;
        };

        let bggId: string | undefined | null = game.bggId;
        if (!bggId) {
          bggId = await trySearch(true);
          if (!bggId) bggId = await trySearch(false);
        }

        if (bggId) {
          // 2. Busca detalhes
          const thingRes = await fetchWithRetry(bggUrl(`thing?id=${bggId}&stats=1`));
          if (thingRes.ok) {
            const thingText = await thingRes.text();
            const thingObj = parser.parse(thingText);

            if (thingObj?.items?.item) {
              const item = Array.isArray(thingObj.items.item)
                ? thingObj.items.item[0]
                : thingObj.items.item;

              setGames(prev => {
                const newGames = [...prev];
                const index = newGames.findIndex(g => g.id === game.id);
                if (index !== -1) {
                  const current = newGames[index];
                  newGames[index] = {
                    ...current,
                    bggId: bggId || current.bggId,
                    thumbnail: item.thumbnail || current.thumbnail || undefined,
                    image: item.image || current.image || undefined,
                    minPlayers: parseInt(item.minplayers?.['@_value']) || current.minPlayers || undefined,
                    maxPlayers: parseInt(item.maxplayers?.['@_value']) || current.maxPlayers || undefined,
                    yearPublished: parseInt(item.yearpublished?.['@_value']) || current.yearPublished || undefined,
                    rating: parseFloat(item.statistics?.ratings?.average?.['@_value']) || current.rating || undefined,
                    weight: parseFloat(item.statistics?.ratings?.averageweight?.['@_value']) || current.weight || undefined,
                    domains: item.link ? item.link.filter((l: any) => l['@_type'] === 'boardgamecategory' || l['@_type'] === 'boardgamemechanic').map((l: any) => l['@_value']) : current.domains,
                  };
                }
                return newGames;
              });
            }
          }
        }

        // Delay conservador para respeitar as regras estritas da BGG API e evitar bloqueios IP
        await new Promise(r => setTimeout(r, 2500));
      } catch (e) {
        console.error(`Erro ao buscar "${game.name}" no BGG`, e);
      }
    }
  };

  const fetchLudoDataForGames = async (gameList: GameData[]) => {
    if (!ludoToken) {
      alert("Token da Ludopedia não configurado. Vá em Configurações para adicionar.");
      return;
    }

    for (let i = 0; i < gameList.length; i++) {
      const game = gameList[i];
      // Removido: if (game.ludoId) continue; para permitir atualização forçada

      try {
        const fetchWithRetry = async (url: string) => {
          let res = await fetch(url, { headers: { 'Authorization': `Bearer ${ludoToken}` } });
          let retryCount = 0;
          while (res.status === 429 && retryCount < 5) {
            console.log('Ludopedia Rate Limit alcançado. Aguardando 5 segundos...');
            await new Promise(r => setTimeout(r, 5000));
            res = await fetch(url, { headers: { 'Authorization': `Bearer ${ludoToken}` } });
            retryCount++;
          }
          return res;
        };

        let ludoId = game.ludoId;
        let match: any = null;
        if (!ludoId) {
          const url = `/ludo-api/jogos?search=${encodeURIComponent(game.name)}`;
          const res = await fetchWithRetry(url);
          if (res.ok) {
            const json = await res.json();
            if (json.jogos && json.jogos.length > 0) {
              match = json.jogos.find((j: any) => j.nm_jogo.toLowerCase() === game.name.toLowerCase()) || json.jogos[0];
              ludoId = String(match.id_jogo);
            }
          }
        }

        if (ludoId) {
            const detailRes = await fetchWithRetry(`/ludo-api/jogos/${ludoId}`);
            if (detailRes.ok) {
              const detailJson = await detailRes.json();
              
              setGames(prev => {
                const newGames = [...prev];
                const index = newGames.findIndex(g => g.id === game.id);
                if (index !== -1) {
                  let inferredType = newGames[index].type;
                  
                  const lName = ((match && match.nm_jogo) || detailJson.nm_jogo || '').toLowerCase();
                  const lTipo = String((match && match.tp_jogo) || detailJson.tp_jogo || (match && match.nm_tipo_jogo) || detailJson.nm_tipo_jogo || (match && match.tipo_jogo) || detailJson.tipo_jogo || '').toLowerCase();
                  
                  if (lTipo === 'e' || lTipo === 'expansão' || lTipo === 'expansao' || lName.includes('expans') || lName.includes('expansion')) {
                     inferredType = 'Expansão';
                  } else if (lTipo === 'p' || lTipo === 'promo' || lName.includes('promo')) {
                     inferredType = 'Promo';
                  } else if (lTipo === 'a' || lTipo === 'acessório' || lTipo === 'acessorio' || lName.includes('acess')) {
                     inferredType = 'Acessório';
                  } else if (lTipo === 'b' || lTipo === 'base') {
                     inferredType = 'Base';
                  } else if (detailJson.id_jogo_base || detailJson.jogo_base) {
                     inferredType = 'Expansão';
                  } else if (lTipo && lTipo !== 'null' && lTipo !== 'undefined') {
                     inferredType = lTipo.charAt(0).toUpperCase() + lTipo.slice(1);
                  }

                  const current = newGames[index];
                  newGames[index] = {
                    ...current,
                    ludoId: ludoId || current.ludoId,
                    thumbnail: (match && match.thumb) || detailJson.imagem || current.thumbnail || undefined,
                    image: detailJson.imagem || current.image || undefined,
                    yearPublished: (match && match.ano_publicacao ? parseInt(match.ano_publicacao) : undefined) || current.yearPublished,
                    minPlayers: (detailJson.qt_jogadores_min ? parseInt(detailJson.qt_jogadores_min) : undefined) || current.minPlayers,
                    maxPlayers: (detailJson.qt_jogadores_max ? parseInt(detailJson.qt_jogadores_max) : undefined) || current.maxPlayers,
                    ludoRating: (detailJson.vl_nota ? parseFloat(detailJson.vl_nota) : undefined) || current.ludoRating,
                    type: inferredType !== 'Base' && inferredType !== 'Desconhecido' ? inferredType : current.type,
                    domains: (detailJson.categorias || detailJson.mecanicas || detailJson.temas) ? [
                      ...(detailJson.categorias || []).map((c: any) => c.nm_categoria),
                      ...(detailJson.mecanicas || []).map((m: any) => m.nm_mecanica),
                      ...(detailJson.temas || []).map((t: any) => t.nm_tema)
                    ] : current.domains
                  };
                }
                return newGames;
              });
            }
        }
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        console.error(`Erro ao buscar "${game.name}" na Ludopedia`, e);
      }
    }
  };

  const fetchComparaDataForGames = async (gameList: GameData[]) => {
    for (let i = 0; i < gameList.length; i++) {
      const game = gameList[i];
      try {
        const bggIdInt = game.bggId ? parseInt(game.bggId) : 0;
        
        const query = `
          query GetGamePrice($nameExact: String!, $nameLike: String!, $bggId: Int!) {
            byBggId: product(where: {bgg_id: {_eq: $bggId}}, limit: 1) {
              id
              name
              prices { name, price_to, available }
            }
            byNameExact: product(where: {name: {_ilike: $nameExact}, type: {_eq: game}}, limit: 1) {
              id
              name
              prices { name, price_to, available }
            }
            byNameLike: product(where: {name: {_ilike: $nameLike}, type: {_eq: game}}, limit: 1) {
              id
              name
              prices { name, price_to, available }
            }
          }
        `;
        
        const variables = { 
          nameExact: game.name,
          nameLike: "%" + game.name + "%",
          bggId: isNaN(bggIdInt) ? 0 : bggIdInt
        };
        
        const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables })
        };
        
        let res = await fetch('https://api.comparajogos.com.br/v1/graphql', requestOptions);
        let retryCount = 0;
        
        // Handle rate limiting (429)
        while (res.status === 429 && retryCount < 5) {
          console.log('Compara Jogos Rate Limit alcançado. Aguardando 5 segundos...');
          await new Promise(r => setTimeout(r, 5000));
          res = await fetch('https://api.comparajogos.com.br/v1/graphql', requestOptions);
          retryCount++;
        }
        
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            // Priority: BGG ID -> Exact Name -> Like Name
            let product = null;
            if (json.data.byBggId && json.data.byBggId.length > 0) {
              product = json.data.byBggId[0];
            } else if (json.data.byNameExact && json.data.byNameExact.length > 0) {
              product = json.data.byNameExact[0];
            } else if (json.data.byNameLike && json.data.byNameLike.length > 0) {
              product = json.data.byNameLike[0];
            }
            
            if (product && product.prices && product.prices.length > 0) {
              const forbiddenWords = ['insert', 'dashboard', 'playmat', 'luva', 'sleeve', 'organizador', 'moeda', 'promo', 'expansão', 'combo', 'usado', 'kit'];
              
              const validPrices = product.prices
                .filter((p: any) => {
                  if (p.available === false) return false;
                  if (!p.price_to || p.price_to <= 0) return false;
                  const nameLower = p.name ? p.name.toLowerCase() : '';
                  return !forbiddenWords.some(word => nameLower.includes(word));
                })
                .map((p: any) => p.price_to);
                
              let minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
              
              if (minPrice !== undefined && minPrice !== null) {
                setGames(prev => {
                  const newGames = [...prev];
                  const index = newGames.findIndex(g => g.id === game.id);
                  if (index !== -1) {
                    newGames[index] = {
                      ...newGames[index],
                      value: minPrice
                    };
                  }
                  return newGames;
                });
              }
            }
          }
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`Erro ao buscar "${game.name}" no Compara Jogos`, e);
      }
    }
  };

  const fetchLudoCollection = async () => {
    return new Promise<void>(async (resolve, reject) => {
      if (!ludoToken) {
        alert("Token da Ludopedia não configurado. Vá em Configurações para adicionar.");
        reject(new Error("Token não configurado"));
        return;
      }
      
      try {
        setIsLoading(true);
        let currentPage = 1;
        let hasMore = true;
        let allItems: any[] = [];

        while (hasMore) {
          const url = `/ludo-api/colecao?lista=colecao&rows=100&page=${currentPage}`;
          
          let res = await fetch(url, { headers: { 'Authorization': `Bearer ${ludoToken}` } });
          let attempts = 0;
          while (res.status === 429 && attempts < 5) {
            await new Promise(r => setTimeout(r, 5000));
            res = await fetch(url, { headers: { 'Authorization': `Bearer ${ludoToken}` } });
            attempts++;
          }
          
          if (!res.ok) {
            throw new Error('Falha ao buscar coleção na Ludopedia.');
          }

          const json = await res.json();
          
          if (json.colecao) {
            const items = Array.isArray(json.colecao) ? json.colecao : [json.colecao];
            allItems = [...allItems, ...items];
            if (currentPage * 100 >= json.total) {
              hasMore = false;
            } else {
              currentPage++;
              await new Promise(r => setTimeout(r, 1000));
            }
          } else {
            hasMore = false;
          }
        }
        
        if (allItems.length > 0) {
          // Deduplicar itens vindos da API (caso a paginação da Ludopedia repita itens)
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
              yearPublished: item.ano_publicacao ? parseInt(item.ano_publicacao) : undefined,
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
                  type: (newPrev[existingIndex].type === 'Base' || newPrev[existingIndex].type === 'Desconhecido') && ng.type !== 'Base' ? ng.type : newPrev[existingIndex].type,
                };
              } else {
                newPrev.push(ng);
              }
            }
            
            return newPrev;
          });
        }
        resolve();
      } catch (error) {
        console.error('Erro no Ludopedia Collection:', error);
        reject(error);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const fetchBGGCollection = async (username: string) => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        setIsLoading(true);
        const url = bggUrl(`collection?username=${encodeURIComponent(username)}&stats=1`);
        const fetchOpts = { headers: { 'Authorization': 'Bearer cdbac8cf-91ac-4af7-9d1f-266544061d52' } };
        
        let res = await fetch(url, fetchOpts);
        
        // Se a API do BGG estiver enfileirando (202), precisamos tentar novamente.
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
            let mappedStatus = 'Na Coleção'; // Default
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

            return {
              id: `bgg-${item['@_objectid']}-${Date.now()}-${idx}`,
              bggId: item['@_objectid'],
              name: name,
              status: mappedStatus,
              spend: 0,
              type: bggType,
              value: 0,
              thumbnail: item.thumbnail,
              image: item.image,
              yearPublished: item.yearpublished ? parseInt(item.yearpublished) : undefined,
              minPlayers: item.stats?.['@_minplayers'] ? parseInt(item.stats['@_minplayers']) : undefined,
              maxPlayers: item.stats?.['@_maxplayers'] ? parseInt(item.stats['@_maxplayers']) : undefined,
              rating: item.stats?.rating?.average?.['@_value'] ? parseFloat(item.stats.rating.average['@_value']) : undefined
            };
          });

          setGames(prev => {
            const newPrev = [...prev];
            const existingBggIds = new Set();
            const existingNames = new Set();

            newPrev.forEach(g => {
              if (g.bggId) existingBggIds.add(g.bggId);
              existingNames.add(g.name.toLowerCase());
            });
            
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
                  type: (newPrev[existingIndex].type === 'Base' || newPrev[existingIndex].type === 'Desconhecido') && ng.type !== 'Base' ? ng.type : newPrev[existingIndex].type,
                };
              } else {
                toAdd.push(ng);
              }
            }
            
            return [...newPrev, ...toAdd];
          });
        }
        resolve();
      } catch (error) {
        console.error('Erro no BGG Collection:', error);
        reject(error);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const addGame = (game: Omit<GameData, 'id'>) => {
    const newGame: GameData = {
      ...game,
      id: `manual-${Date.now()}`
    };
    setGames(prev => [...prev, newGame]);
    // fetchBGGDataForGames([newGame]); // Removido
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
      localStorage.removeItem(STORAGE_KEY);
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
      'BGG ID': g.bggId || '',
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

  return {
    games,
    columnMapping,
    setColumnMapping,
    isLoading,
    ludoToken,
    setLudoToken,
    processExcelUpload,
    fetchBGGCollection,
    clearCollection,
    exportToExcel,
    exportToJson,
    addGame,
    editGame,
    deleteGame,
    fetchBGGDataForGames,
    fetchLudoDataForGames,
    fetchComparaDataForGames,
    fetchLudoCollection,
  };
}
