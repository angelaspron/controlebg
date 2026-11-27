import { XMLParser } from 'fast-xml-parser';
import { searchBggIdViaCompara } from './comparaService.ts';
import type { CardSleevesData, CardSleeveSet } from '../types/index.ts';
import { getCardSleeveSizeName, formatCardSleeveDimensions } from '../utils/sleeveUtils.ts';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export interface BGGParsedData {
  bggId: string;
  name?: string;
  type?: string;
  isExpansion?: boolean;
  thumbnail?: string;
  image?: string;
  minPlayers?: number;
  maxPlayers?: number;
  yearPublished?: number;
  playtime?: number;
  rating?: number; // Average
  geekRating?: number; // Bayes Average
  weight?: number; // 1-5
  rank?: number;
  domains?: string[]; // Categories + Mechanics
  mechanics?: string[];
  categories?: string[];
  designers?: string[];
  artists?: string[];
  honors?: string[]; // boardgamehonor
  suggestedPlayers?: {
    best: string[];
    recommended: string[];
    summary: string;
  };
  description?: string;
  cardSleeves?: CardSleevesData;
}

function parseBGGItemNode(item: any): BGGParsedData | null {
  if (!item || !item['@_id']) return null;

  const bggId = String(item['@_id']);

  // Nome principal
  let primaryName: string | undefined;
  if (item.name) {
    if (Array.isArray(item.name)) {
      const primary = item.name.find((n: any) => n['@_type'] === 'primary');
      primaryName = primary ? primary['@_value'] : item.name[0]?.['@_value'];
    } else {
      primaryName = item.name['@_value'] || item.name['#text'];
    }
  }

  // Rank BGG
  let bggRank: number | undefined;
  const ranksObj = item.statistics?.ratings?.ranks?.rank;
  if (ranksObj) {
    const bgRankItem = Array.isArray(ranksObj)
      ? ranksObj.find((r: any) => r['@_name'] === 'boardgame')
      : ranksObj;
    if (bgRankItem && bgRankItem['@_value'] && bgRankItem['@_value'] !== 'Not Ranked') {
      const parsed = parseInt(bgRankItem['@_value'], 10);
      if (!isNaN(parsed)) bggRank = parsed;
    }
  }

  let isExpansion = false;
  let bggType = 'Base';

  if (item['@_type'] === 'boardgameexpansion') {
    isExpansion = true;
    bggType = 'Expansão';
  }

  // Links: mecânicas, categorias, designers, artistas, honors (prêmios)
  const links = Array.isArray(item.link) ? item.link : item.link ? [item.link] : [];

  const mechanics: string[] = [];
  const categories: string[] = [];
  const designers: string[] = [];
  const artists: string[] = [];
  const honors: string[] = [];

  for (const link of links) {
    const type = link['@_type'];
    const value = link['@_value'];

    if (type === 'boardgameexpansion' && (link['@_inbound'] === 'true' || link['@_inbound'] === true)) {
      isExpansion = true;
      bggType = 'Expansão';
    }

    if (!value) continue;

    if (type === 'boardgamemechanic') {
      mechanics.push(value);
    } else if (type === 'boardgamecategory') {
      categories.push(value);
    } else if (type === 'boardgamedesigner') {
      if (value !== '(Uncredited)') designers.push(value);
    } else if (type === 'boardgameartist') {
      if (value !== '(Uncredited)') artists.push(value);
    } else if (type === 'boardgamehonor') {
      honors.push(value);
    }
  }

  const domains = [...categories, ...mechanics];

  // Ratings
  const ratings = item.statistics?.ratings;
  const rating = ratings?.average?.['@_value'] ? parseFloat(ratings.average['@_value']) : undefined;
  const geekRating = ratings?.bayesaverage?.['@_value'] ? parseFloat(ratings.bayesaverage['@_value']) : undefined;
  const rawWeight = ratings?.averageweight?.['@_value'] ? parseFloat(ratings.averageweight['@_value']) : undefined;
  const weight = (rawWeight !== undefined && !isNaN(rawWeight)) ? Math.round(rawWeight * 100) / 100 : undefined;

  // Jogadores, Tempo e Ano
  const minPlayers = item.minplayers?.['@_value'] ? parseInt(item.minplayers['@_value'], 10) : undefined;
  const maxPlayers = item.maxplayers?.['@_value'] ? parseInt(item.maxplayers['@_value'], 10) : undefined;
  const yearPublished = item.yearpublished?.['@_value'] ? parseInt(item.yearpublished['@_value'], 10) : undefined;
  const playtime = item.playingtime?.['@_value'] ? parseInt(item.playingtime['@_value'], 10) : undefined;

  // Poll: suggested_numplayers
  let suggestedPlayers: { best: string[]; recommended: string[]; summary: string } | undefined;
  const polls = Array.isArray(item.poll) ? item.poll : item.poll ? [item.poll] : [];
  const numPlayersPoll = polls.find((p: any) => p['@_name'] === 'suggested_numplayers');

  if (numPlayersPoll && numPlayersPoll.results) {
    const pollResults = Array.isArray(numPlayersPoll.results) ? numPlayersPoll.results : [numPlayersPoll.results];
    const bestCounts: { players: string; bestVotes: number; recVotes: number; notRecVotes: number }[] = [];

    for (const resNode of pollResults) {
      const numPlayersStr = resNode['@_numplayers'];
      const resList = Array.isArray(resNode.result) ? resNode.result : resNode.result ? [resNode.result] : [];

      let bestVotes = 0;
      let recVotes = 0;
      let notRecVotes = 0;

      for (const r of resList) {
        const val = r['@_value'];
        const votes = parseInt(r['@_numvotes'] || '0', 10);
        if (val === 'Best') bestVotes = votes;
        else if (val === 'Recommended') recVotes = votes;
        else if (val === 'Not Recommended') notRecVotes = votes;
      }

      if (numPlayersStr) {
        bestCounts.push({ players: numPlayersStr, bestVotes, recVotes, notRecVotes });
      }
    }

    if (bestCounts.length > 0) {
      const maxBest = Math.max(...bestCounts.map(b => b.bestVotes));
      const bestPlayers = maxBest > 0
        ? bestCounts.filter(b => b.bestVotes === maxBest && b.bestVotes >= b.notRecVotes).map(b => b.players)
        : [];

      const recommendedPlayers = bestCounts
        .filter(b => (b.bestVotes + b.recVotes) > b.notRecVotes && (b.bestVotes + b.recVotes) > 0)
        .map(b => b.players);

      let summary = '';
      if (bestPlayers.length > 0) {
        summary = `Ideal com ${bestPlayers.join(', ')} ${bestPlayers.length === 1 ? 'jogador' : 'jogadores'}`;
      } else if (recommendedPlayers.length > 0) {
        summary = `Recomendado para ${recommendedPlayers.join(', ')} jogadores`;
      }

      if (bestPlayers.length > 0 || recommendedPlayers.length > 0) {
        suggestedPlayers = {
          best: bestPlayers,
          recommended: recommendedPlayers,
          summary,
        };
      }
    }
  }

  // Descrição limpa
  let description: string | undefined;
  if (item.description) {
    description = String(item.description)
      .replace(/&#10;/g, '\n')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'");
  }

  return {
    bggId,
    name: primaryName,
    type: bggType,
    isExpansion,
    thumbnail: item.thumbnail,
    image: item.image,
    minPlayers: isNaN(minPlayers as number) ? undefined : minPlayers,
    maxPlayers: isNaN(maxPlayers as number) ? undefined : maxPlayers,
    yearPublished: isNaN(yearPublished as number) ? undefined : yearPublished,
    playtime: playtime && !isNaN(playtime) ? playtime : undefined,
    rating: isNaN(rating as number) ? undefined : rating,
    geekRating: isNaN(geekRating as number) ? undefined : geekRating,
    weight: isNaN(weight as number) ? undefined : weight,
    rank: bggRank,
    domains: domains.length > 0 ? domains : undefined,
    mechanics: mechanics.length > 0 ? mechanics : undefined,
    categories: categories.length > 0 ? categories : undefined,
    designers: designers.length > 0 ? Array.from(new Set(designers)) : undefined,
    artists: artists.length > 0 ? Array.from(new Set(artists)) : undefined,
    honors: honors.length > 0 ? honors : undefined,
    suggestedPlayers,
    description,
  };
}

export function parseBGGThingXml(xmlText: string): BGGParsedData | null {
  try {
    const obj = xmlParser.parse(xmlText);
    if (!obj?.items?.item) return null;

    const item = Array.isArray(obj.items.item) ? obj.items.item[0] : obj.items.item;
    return parseBGGItemNode(item);
  } catch (error) {
    console.error('Erro ao fazer parse do XML BGG:', error);
    return null;
  }
}

export function parseBGGThingsBatchXml(xmlText: string): BGGParsedData[] {
  try {
    const obj = xmlParser.parse(xmlText);
    if (!obj?.items?.item) return [];

    const items = Array.isArray(obj.items.item) ? obj.items.item : [obj.items.item];
    return items.map(parseBGGItemNode).filter((d: BGGParsedData | null): d is BGGParsedData => d !== null);
  } catch (error) {
    console.error('Erro ao fazer parse em lote do XML BGG:', error);
    return [];
  }
}

export async function fetchBGGGeekitems(bggId: string): Promise<BGGParsedData | null> {
  try {
    const url = `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const item = json.item;
    if (!item) return null;

    const mechanics: string[] = item.links?.boardgamemechanic?.map((m: any) => m.name) || [];
    const categories: string[] = item.links?.boardgamecategory?.map((c: any) => c.name) || [];
    const designers: string[] = (item.links?.boardgamedesigner?.map((d: any) => d.name) || []).filter((n: string) => n && n !== '(Uncredited)');
    const artists: string[] = (item.links?.boardgameartist?.map((a: any) => a.name) || []).filter((n: string) => n && n !== '(Uncredited)');
    const honors: string[] = item.links?.boardgamehonor?.map((h: any) => h.name) || [];
    const expands = item.links?.expandsboardgame || [];
    const isExpansion = item.subtype === 'boardgameexpansion' || (Array.isArray(expands) && expands.length > 0);
    const parsedPlaytime = item.playingtime ? parseInt(item.playingtime, 10) : undefined;

    let cleanDesc: string | undefined;
    const rawDesc = item.description || item.short_description;
    if (rawDesc) {
      cleanDesc = String(rawDesc)
        .replace(/<[^>]*>?/gm, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#10;/g, '\n')
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .trim();
    }

    const combinedText = `${item.wiki || ''}\n${item.description || ''}`;
    const cardSleeves = parseBGGSleeves(combinedText, String(bggId)) || undefined;

    return {
      bggId: String(bggId),
      name: item.name,
      type: isExpansion ? 'Expansão' : 'Base',
      isExpansion,
      thumbnail: item.images?.thumb,
      image: item.images?.original,
      minPlayers: item.minplayers ? parseInt(item.minplayers, 10) : undefined,
      maxPlayers: item.maxplayers ? parseInt(item.maxplayers, 10) : undefined,
      yearPublished: item.yearpublished ? parseInt(item.yearpublished, 10) : undefined,
      playtime: parsedPlaytime && !isNaN(parsedPlaytime) ? parsedPlaytime : undefined,
      domains: [...categories, ...mechanics],
      mechanics: mechanics.length > 0 ? mechanics : undefined,
      categories: categories.length > 0 ? categories : undefined,
      designers: designers.length > 0 ? Array.from(new Set(designers)) : undefined,
      artists: artists.length > 0 ? Array.from(new Set(artists)) : undefined,
      honors: honors.length > 0 ? honors : undefined,
      description: cleanDesc,
      cardSleeves,
    };
  } catch (e) {
    console.error(`Erro ao consultar fallback JSON BGG geekitems para ID ${bggId}:`, e);
    return null;
  }
}

/**
 * Parser de Sleeves do BoardGameGeek a partir da Wiki e Descrição do Jogo
 */
export function parseBGGSleeves(text: string, bggId: string): CardSleevesData | null {
  if (!text || !text.trim()) return null;

  const clean = text
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&times;/gi, 'x')
    .replace(/&#10;/gi, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/gi, ' ');

  const rawSets: CardSleeveSet[] = [];

  function normalizeName(nameHint: string | null | undefined, w: number, h: number): string {
    const sizeName = getCardSleeveSizeName(w, h);
    if (sizeName && sizeName !== 'Especial') {
      return `${sizeName} (${formatCardSleeveDimensions(w, h)})`;
    }
    if (nameHint) {
      const lower = nameHint.toLowerCase();
      if (lower.includes('standard') || lower.includes('padrão')) return `Padrão (${formatCardSleeveDimensions(w, h)})`;
      if (lower.includes('mini euro')) return `Mini Euro (${formatCardSleeveDimensions(w, h)})`;
      if (lower.includes('euro')) return `Euro (${formatCardSleeveDimensions(w, h)})`;
      if (lower.includes('mini usa') || lower.includes('mini american')) return `Mini USA (${formatCardSleeveDimensions(w, h)})`;
      if (lower.includes('tarot')) return `Tarot (${formatCardSleeveDimensions(w, h)})`;
      if (lower.includes('square') || lower.includes('quadrado')) return `Quadrado (${formatCardSleeveDimensions(w, h)})`;
    }
    return formatCardSleeveDimensions(w, h);
  }

  function getStandardDim(typeName: string): { w: number; h: number } | null {
    const l = typeName.toLowerCase();
    if (l.includes('mini euro')) return { w: 45, h: 68 };
    if (l.includes('standard european') || l.includes('euro')) return { w: 59, h: 92 };
    if (l.includes('mini usa') || l.includes('mini american')) return { w: 41, h: 63 };
    if (l.includes('standard usa') || l.includes('usa')) return { w: 56, h: 87 };
    if (l.includes('tarot')) return { w: 70, h: 120 };
    if (l.includes('square') || l.includes('quadrado')) return { w: 70, h: 70 };
    if (l.includes('standard') || l.includes('padrão')) return { w: 63.5, h: 88 };
    return null;
  }

  // Padrão 1: Quantidade + Dimensão: "170 unique bird cards (57x87mm)", "157 cards @ 65mm X 100mm", "98 cards - 62.5x88 mm", "76 Cards [63,5x88 mm]", "144 Illustrated cards (44x88mm)"
  const p1 = /(\d+)\s*(?:unique\s+)?(?:[a-zA-Z\s]{0,25})cards?[\s@\-\:\(\[]+(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*(?:x|\*)\s*(\d+(?:[.,]\d+)?)\s*mm/gi;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(clean)) !== null) {
    const qty = parseInt(m[1], 10);
    const w = parseFloat(m[2].replace(',', '.'));
    const h = parseFloat(m[3].replace(',', '.'));
    if (qty > 0 && w >= 30 && w <= 200 && h >= 30 && h <= 200) {
      const minDim = Math.min(w, h);
      const maxDim = Math.max(w, h);
      rawSets.push({
        name: normalizeName(null, minDim, maxDim),
        quantity: qty,
        width: minDim,
        height: maxDim,
        sizeName: getCardSleeveSizeName(minDim, maxDim),
      });
    }
  }

  // Padrão 2: Dimensão seguido de Quantidade: "(70 x 70mm) for 40 cards", "63x88 mm (Standard Gaming Cards) 31 cards", "(45 x 68 mm) for 200 cards"
  const p2 = /(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*(?:x|\*)\s*(\d+(?:[.,]\d+)?)\s*mm[\s\S]{0,35}?(\d+)\s*cards?/gi;
  while ((m = p2.exec(clean)) !== null) {
    const w = parseFloat(m[1].replace(',', '.'));
    const h = parseFloat(m[2].replace(',', '.'));
    const qty = parseInt(m[3], 10);
    if (qty > 0 && w >= 30 && w <= 200 && h >= 30 && h <= 200) {
      const minDim = Math.min(w, h);
      const maxDim = Math.max(w, h);
      if (!rawSets.some(s => s.quantity === qty && Math.abs(s.width - minDim) < 2)) {
        rawSets.push({
          name: normalizeName(null, minDim, maxDim),
          quantity: qty,
          width: minDim,
          height: maxDim,
          sizeName: getCardSleeveSizeName(minDim, maxDim),
        });
      }
    }
  }

  // Padrão 3: Formato BGG Wiki padrão: "233 cards / Standard", "90 cards / Standard", "50 cards / Tarot", "100 cards / Mini Euro"
  const p3 = /(\d+)\s*cards?\s*(?:\/|@|;|-)\s*(Standard|Mini Euro(?:pean)?|Standard European|Euro(?:pean)?|Tarot|Mini USA?|Standard USA|Square)/gi;
  while ((m = p3.exec(clean)) !== null) {
    const qty = parseInt(m[1], 10);
    const typeName = m[2];
    const stdDim = getStandardDim(typeName);
    if (qty > 0 && stdDim) {
      if (!rawSets.some(s => s.quantity === qty)) {
        rawSets.push({
          name: normalizeName(typeName, stdDim.w, stdDim.h),
          quantity: qty,
          width: stdDim.w,
          height: stdDim.h,
          sizeName: getCardSleeveSizeName(stdDim.w, stdDim.h),
        });
      }
    }
  }

  // Padrão 4: Sleeves listados com @: "Sleeves 50 @ 70 x 110mm ... 54 @ 57 x 87mm ... 42 @ 44 X 67mm"
  const p4 = /(\d+)\s*@\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*(?:x|\*)\s*(\d+(?:[.,]\d+)?)\s*mm/gi;
  while ((m = p4.exec(clean)) !== null) {
    const qty = parseInt(m[1], 10);
    const w = parseFloat(m[2].replace(',', '.'));
    const h = parseFloat(m[3].replace(',', '.'));
    if (qty > 0 && w >= 30 && w <= 200 && h >= 30 && h <= 200) {
      const minDim = Math.min(w, h);
      const maxDim = Math.max(w, h);
      if (!rawSets.some(s => s.quantity === qty && Math.abs(s.width - minDim) < 2)) {
        rawSets.push({
          name: normalizeName(null, minDim, maxDim),
          quantity: qty,
          width: minDim,
          height: maxDim,
          sizeName: getCardSleeveSizeName(minDim, maxDim),
        });
      }
    }
  }

  if (rawSets.length === 0) return null;

  // Consolidação de conjuntos com dimensões idênticas ou aproximadas
  const consolidated: CardSleeveSet[] = [];
  for (const s of rawSets) {
    const existing = consolidated.find(c => Math.abs(c.width - s.width) <= 1.5 && Math.abs(c.height - s.height) <= 1.5);
    if (existing) {
      existing.quantity += s.quantity;
    } else {
      consolidated.push({ ...s });
    }
  }

  return {
    source: 'BoardGameGeek',
    sourceUrl: `https://boardgamegeek.com/boardgame/${bggId}`,
    sets: consolidated
  };
}

/**
 * Consulta dedicada de sleeves via BGG (API Geekitems / JSON)
 */
export async function fetchBGGSleeves(
  bggId?: string,
  gameName?: string,
  token?: string
): Promise<CardSleevesData | null> {
  let resolvedId = bggId;
  if (!resolvedId && gameName) {
    resolvedId = (await searchBggIdViaCompara(gameName)) || (await searchBGGId(gameName, { token })) || undefined;
  }
  if (!resolvedId) return null;

  try {
    const url = `https://api.geekdo.com/api/geekitems?objectid=${resolvedId}&objecttype=thing`;
    const res = await fetch(url);
    if (!res.ok) {
      const altRes = await fetch(`https://boardgamegeek.com/api/geekitems?objectid=${resolvedId}&objecttype=thing`);
      if (!altRes.ok) return null;
      const altJson = await altRes.json();
      const combined = `${altJson.item?.wiki || ''}\n${altJson.item?.description || ''}`;
      return parseBGGSleeves(combined, resolvedId);
    }

    const json = await res.json();
    const item = json.item;
    if (!item) return null;

    const combined = `${item.wiki || ''}\n${item.description || ''}`;
    return parseBGGSleeves(combined, resolvedId);
  } catch (e) {
    console.error(`Erro ao buscar sleeves do BGG para ID ${resolvedId}:`, e);
    return null;
  }
}

export const DEFAULT_BGG_TOKEN = 'cdbac8cf-91ac-4af7-9d1f-266544061d52';

export async function fetchBGGThingWithRetry(
  bggId: string,
  options: { maxRetries?: number; token?: string } = {}
): Promise<BGGParsedData | null> {
  const maxRetries = options.maxRetries ?? 5;
  const token = options.token || DEFAULT_BGG_TOKEN;
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, { headers });

      if (res.status === 202) {
        // 202 Queued pelo BGG
        const delay = 2000 + attempt * 1000;
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        continue;
      }

      if (res.status === 429) {
        // Rate limit: exponential backoff com jitter
        const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 16000);
        console.warn(`BGG HTTP 429 (Rate Limit) para ID ${bggId}. Tentativa ${attempt + 1}/${maxRetries}. Aguardando ${Math.round(backoff)}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        attempt++;
        continue;
      }

      if (res.status === 401) {
        // BGG agora exige token para XMLAPI2. Faz fallback imediato para a API JSON pública do BGG
        return await fetchBGGGeekitems(bggId);
      }

      if (!res.ok) {
        console.warn(`BGG erro HTTP ${res.status} para ID ${bggId}. Tentando fallback JSON.`);
        return await fetchBGGGeekitems(bggId);
      }

      const text = await res.text();
      const parsed = parseBGGThingXml(text);
      if (parsed) return parsed;
      return await fetchBGGGeekitems(bggId);
    } catch (e) {
      console.error(`Erro de rede ao buscar BGG ID ${bggId}:`, e);
      attempt++;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  return await fetchBGGGeekitems(bggId);
}

/**
 * Busca múltiplos jogos no BGG XML API2 em lotes de até 20 IDs por requisição.
 * Útil para enriquecer rapidamente designers, artistas, mecânicas e tempo de jogo da coleção.
 */
export async function fetchBGGThingsBatch(
  bggIds: string[],
  options: {
    token?: string;
    maxRetries?: number;
    chunkSize?: number;
    signal?: AbortSignal;
    onChunkComplete?: (loadedCount: number, totalCount: number) => void;
  } = {}
): Promise<Record<string, BGGParsedData>> {
  const uniqueIds = Array.from(new Set(bggIds.map(id => String(id).trim()).filter(Boolean)));
  const result: Record<string, BGGParsedData> = {};
  if (uniqueIds.length === 0) return result;

  const chunkSize = Math.min(Math.max(options.chunkSize ?? 20, 1), 20);
  const maxRetries = options.maxRetries ?? 4;
  const token = options.token || DEFAULT_BGG_TOKEN;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let processed = 0;

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    if (options.signal?.aborted) break;
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(',')}&stats=1`;

    let chunkParsed: BGGParsedData[] = [];
    let attempt = 0;
    let succeeded = false;

    while (attempt < maxRetries && !options.signal?.aborted) {
      try {
        const res = await fetch(url, { headers, signal: options.signal });

        if (res.status === 202) {
          await new Promise(r => setTimeout(r, 2000 + attempt * 1000));
          attempt++;
          continue;
        }
        if (res.status === 429) {
          const backoff = Math.min(1200 * Math.pow(2, attempt) + Math.random() * 400, 12000);
          await new Promise(r => setTimeout(r, backoff));
          attempt++;
          continue;
        }
        if (!res.ok) {
          break;
        }

        const text = await res.text();
        chunkParsed = parseBGGThingsBatchXml(text);
        succeeded = chunkParsed.length > 0;
        break;
      } catch (e: any) {
        if (e?.name === 'AbortError') break;
        attempt++;
        await new Promise(r => setTimeout(r, 800 * attempt));
      }
    }

    if (succeeded) {
      for (const item of chunkParsed) {
        result[item.bggId] = item;
      }
    } else if (!options.signal?.aborted) {
      // Fallback individual para JSON público geekitems
      await Promise.allSettled(
        chunk.map(async id => {
          const single = await fetchBGGGeekitems(id);
          if (single) result[single.bggId] = single;
        })
      );
    }

    processed += chunk.length;
    options.onChunkComplete?.(processed, uniqueIds.length);
  }

  return result;
}

export async function searchBGGId(
  gameName: string,
  options: { token?: string } = {}
): Promise<string | null> {
  const token = options.token || DEFAULT_BGG_TOKEN;

  if (token) {
    const trySearch = async (exact: boolean): Promise<string | null> => {
      const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameName)}&type=boardgame,boardgameexpansion${exact ? '&exact=1' : ''}`;
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        let res = await fetch(url, { headers });
        let retries = 0;
        while ((res.status === 429 || res.status === 202) && retries < 4) {
          const delay = Math.min(1000 * Math.pow(2, retries) + 200, 8000);
          await new Promise(r => setTimeout(r, delay));
          res = await fetch(url, { headers });
          retries++;
        }
        if (!res.ok) return null;
        const text = await res.text();
        const obj = xmlParser.parse(text);
        if (obj?.items?.item) {
          const items = Array.isArray(obj.items.item) ? obj.items.item : [obj.items.item];
          return items[0]?.['@_id'] ?? null;
        }
      } catch (e) {
        console.error(`Erro ao pesquisar BGG por "${gameName}":`, e);
      }
      return null;
    };

    const exactMatch = await trySearch(true);
    if (exactMatch) return exactMatch;
    const partialMatch = await trySearch(false);
    if (partialMatch) return partialMatch;
  }

  // Fallback transparente e resiliente através da base de produtos do Compara Jogos
  return await searchBggIdViaCompara(gameName);
}
