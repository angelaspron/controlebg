import { XMLParser } from 'fast-xml-parser';
import { searchBggIdViaCompara } from './comparaService.ts';

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
  rating?: number; // Average
  geekRating?: number; // Bayes Average
  weight?: number; // 1-5
  rank?: number;
  domains?: string[]; // Categories + Mechanics
  mechanics?: string[];
  honors?: string[]; // boardgamehonor
  suggestedPlayers?: {
    best: string[];
    recommended: string[];
    summary: string;
  };
  description?: string;
}

export function parseBGGThingXml(xmlText: string): BGGParsedData | null {
  try {
    const obj = xmlParser.parse(xmlText);
    if (!obj?.items?.item) return null;

    const item = Array.isArray(obj.items.item) ? obj.items.item[0] : obj.items.item;
    if (!item) return null;

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

    // Links: mecânicas, categorias, honors (prêmios)
    const links = Array.isArray(item.link) ? item.link : item.link ? [item.link] : [];
    
    const mechanics: string[] = [];
    const categories: string[] = [];
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
      } else if (type === 'boardgamehonor') {
        honors.push(value);
      }
    }

    const domains = [...categories, ...mechanics];

    // Ratings
    const ratings = item.statistics?.ratings;
    const rating = ratings?.average?.['@_value'] ? parseFloat(ratings.average['@_value']) : undefined;
    const geekRating = ratings?.bayesaverage?.['@_value'] ? parseFloat(ratings.bayesaverage['@_value']) : undefined;
    const weight = ratings?.averageweight?.['@_value'] ? parseFloat(ratings.averageweight['@_value']) : undefined;

    // Jogadores e Ano
    const minPlayers = item.minplayers?.['@_value'] ? parseInt(item.minplayers['@_value'], 10) : undefined;
    const maxPlayers = item.maxplayers?.['@_value'] ? parseInt(item.maxplayers['@_value'], 10) : undefined;
    const yearPublished = item.yearpublished?.['@_value'] ? parseInt(item.yearpublished['@_value'], 10) : undefined;

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
        // Encontrar os que têm mais votos "Best"
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
      rating: isNaN(rating as number) ? undefined : rating,
      geekRating: isNaN(geekRating as number) ? undefined : geekRating,
      weight: isNaN(weight as number) ? undefined : weight,
      rank: bggRank,
      domains: domains.length > 0 ? domains : undefined,
      mechanics: mechanics.length > 0 ? mechanics : undefined,
      honors: honors.length > 0 ? honors : undefined,
      suggestedPlayers,
      description,
    };
  } catch (error) {
    console.error('Erro ao fazer parse do XML BGG:', error);
    return null;
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
    const honors: string[] = item.links?.boardgamehonor?.map((h: any) => h.name) || [];
    const expands = item.links?.expandsboardgame || [];
    const isExpansion = item.subtype === 'boardgameexpansion' || (Array.isArray(expands) && expands.length > 0);

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
      domains: [...categories, ...mechanics],
      mechanics: mechanics.length > 0 ? mechanics : undefined,
      honors: honors.length > 0 ? honors : undefined,
      description: cleanDesc,
    };
  } catch (e) {
    console.error(`Erro ao consultar fallback JSON BGG geekitems para ID ${bggId}:`, e);
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
