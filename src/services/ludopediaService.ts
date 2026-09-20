export interface LudopediaParsedData {
  ludoId: string;
  namePt?: string; // Nome de lançamento no Brasil
  type: string; // 'Base' | 'Expansão' | 'Acessório' | 'Promo'
  isExpansion: boolean;
  descriptionPt?: string;
  thumbnail?: string;
  image?: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  ludoRating?: number;
  rank?: number;
  domains?: string[];
  bggId?: string;
}

export function parseLudopediaDetail(data: any): LudopediaParsedData {
  const ludoId = String(data.id_jogo || '');
  const nmJogo = data.nm_jogo || '';
  
  // Detecção estrutural de Base vs Expansão
  const tpJogo = String(data.tp_jogo || data.nm_tipo_jogo || data.tipo_jogo || '').toLowerCase().trim();
  const lowerName = nmJogo.toLowerCase();
  
  let inferredType = 'Base';
  let isExpansion = false;

  if (
    tpJogo === 'e' || 
    tpJogo === 'expansão' || 
    tpJogo === 'expansao' || 
    lowerName.includes('expans') || 
    lowerName.includes('expansion') ||
    Boolean(data.id_jogo_base) || 
    Boolean(data.jogo_base)
  ) {
    inferredType = 'Expansão';
    isExpansion = true;
  } else if (tpJogo === 'p' || tpJogo === 'promo' || lowerName.includes('promo')) {
    inferredType = 'Promo';
  } else if (tpJogo === 'a' || tpJogo === 'acessório' || tpJogo === 'acessorio' || lowerName.includes('acess')) {
    inferredType = 'Acessório';
  } else if (tpJogo === 'b' || tpJogo === 'base') {
    inferredType = 'Base';
  } else if (tpJogo) {
    inferredType = tpJogo.charAt(0).toUpperCase() + tpJogo.slice(1);
  }

  // Descrição em português
  const rawDesc = data.ds_jogo || data.descricao || data.de_resumo || '';
  let descriptionPt: string | undefined;
  if (rawDesc) {
    // Limpar possíveis tags HTML
    descriptionPt = String(rawDesc)
      .replace(/<[^>]*>?/gm, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#10;/g, '\n')
      .trim();
  }

  // BGG ID vinculado
  let inferredBggId: string | undefined;
  if (data.link_bgg) {
    const match = String(data.link_bgg).match(/boardgamegeek\.com\/boardgame\/(\d+)/);
    if (match) inferredBggId = match[1];
  }
  if (!inferredBggId && data.bgg_id) inferredBggId = String(data.bgg_id);
  if (!inferredBggId && data.id_bgg) inferredBggId = String(data.id_bgg);
  if (!inferredBggId && data.links && Array.isArray(data.links)) {
    const bggLink = data.links.find((l: any) => l.url && l.url.includes('boardgamegeek.com'));
    if (bggLink) {
      const match = String(bggLink.url).match(/boardgamegeek\.com\/boardgame\/(\d+)/);
      if (match) inferredBggId = match[1];
    }
  }

  // Categorias, Mecânicas, Temas
  const domains: string[] = [
    ...(data.categorias || []).map((c: any) => c.nm_categoria),
    ...(data.mecanicas || []).map((m: any) => m.nm_mecanica),
    ...(data.temas || []).map((t: any) => t.nm_tema)
  ].filter(Boolean);

  const rank = data.rank_jogo ? parseInt(data.rank_jogo, 10) :
    data.posicao_rank ? parseInt(data.posicao_rank, 10) :
    data.rank ? parseInt(data.rank, 10) :
    data.rank_base ? parseInt(data.rank_base, 10) : undefined;

  return {
    ludoId,
    namePt: nmJogo || undefined,
    type: inferredType,
    isExpansion,
    descriptionPt: descriptionPt || undefined,
    thumbnail: data.thumb || data.imagem || undefined,
    image: data.imagem || undefined,
    yearPublished: data.ano_publicacao ? parseInt(data.ano_publicacao, 10) : undefined,
    minPlayers: data.qt_jogadores_min ? parseInt(data.qt_jogadores_min, 10) : undefined,
    maxPlayers: data.qt_jogadores_max ? parseInt(data.qt_jogadores_max, 10) : undefined,
    ludoRating: data.vl_nota ? parseFloat(data.vl_nota) : undefined,
    rank: isNaN(rank as number) ? undefined : rank,
    domains: domains.length > 0 ? domains : undefined,
    bggId: inferredBggId,
  };
}

export async function fetchLudopediaData(
  gameName: string,
  token: string,
  ludoId?: string,
  options: { maxRetries?: number } = {}
): Promise<LudopediaParsedData | null> {
  if (!token) return null;
  const maxRetries = options.maxRetries ?? 5;

  const fetchWithRetry = async (url: string) => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 429) {
          const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 16000);
          console.warn(`Ludopedia HTTP 429 (Rate Limit). Aguardando ${Math.round(backoff)}ms...`);
          await new Promise(r => setTimeout(r, backoff));
          attempt++;
          continue;
        }

        return res;
      } catch {
        attempt++;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    return null;
  };

  try {
    let resolvedLudoId = ludoId;
    let searchItem: any = null;

    if (!resolvedLudoId) {
      const searchRes = await fetchWithRetry(`/ludo-api/jogos?search=${encodeURIComponent(gameName)}`);
      if (!searchRes || !searchRes.ok) return null;
      const searchJson = await searchRes.json();
      if (searchJson.jogos && searchJson.jogos.length > 0) {
        searchItem = searchJson.jogos.find((j: any) => 
          (j.nm_jogo || '').toLowerCase() === gameName.toLowerCase()
        ) || searchJson.jogos[0];
        resolvedLudoId = String(searchItem.id_jogo);
      }
    }

    if (!resolvedLudoId) return null;

    const detailRes = await fetchWithRetry(`/ludo-api/jogos/${resolvedLudoId}`);
    if (!detailRes || !detailRes.ok) {
      if (searchItem) {
        return parseLudopediaDetail(searchItem);
      }
      return null;
    }

    const detailJson = await detailRes.json();
    return parseLudopediaDetail({ ...searchItem, ...detailJson });
  } catch (error) {
    console.error(`Erro ao buscar dados na Ludopedia para "${gameName}":`, error);
    return null;
  }
}
