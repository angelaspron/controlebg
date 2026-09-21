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

export function parseLudopediaDetail(data: any, shallowData: any = {}): LudopediaParsedData {
  const ludoId = String(data.id_jogo || shallowData.id_jogo || '');
  const nmJogo = String(data.nm_jogo || shallowData.nm_jogo || '');
  
  // 1. Regex Robusta e Tolerante: Normalização para ignorar acentuação e case
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  
  const expRegex = /\b(expansa?o|expansion|expansions|exp)\b/i;
  const promoRegex = /\b(promo|promos|promocional)\b/i;
  const acessorioRegex = /\b(acessorio|acessorios|accessory|accessories)\b/i;

  const tpJogoRaw = String(data.tp_jogo || data.nm_tipo_jogo || data.tipo_jogo || '');
  const tpJogoShallowRaw = String(shallowData.tp_jogo || shallowData.nm_tipo_jogo || shallowData.tipo_jogo || '');
  
  const tpJogo = normalize(tpJogoRaw);
  const tpJogoShallow = normalize(tpJogoShallowRaw);
  const normName = normalize(nmJogo);

  // Arrays de categorias, domínios e temas para busca ampla
  const dominios = Array.isArray(data.dominios) ? data.dominios.map((d: any) => normalize(String(d.nm_dominio || ''))) : [];
  const categorias = Array.isArray(data.categorias) ? data.categorias.map((c: any) => normalize(String(c.nm_categoria || ''))) : [];
  const temas = Array.isArray(data.temas) ? data.temas.map((t: any) => normalize(String(t.nm_tema || ''))) : [];
  const dominiosShallow = Array.isArray(shallowData.dominios) ? shallowData.dominios.map((d: any) => normalize(String(d.nm_dominio || ''))) : [];

  const allTags = [...dominios, ...categorias, ...temas, ...dominiosShallow];

  // Heurística de Broad Matching nas tags
  const hasExpansaoTag = allTags.some(t => expRegex.test(t));
  const hasPromoTag = allTags.some(t => promoRegex.test(t));
  const hasAcessorioTag = allTags.some(t => acessorioRegex.test(t));

  // 2. Ampliação do Escopo de Chaves (Broad Matching)
  const hasLinkBase = Boolean(
    data.id_jogo_base || shallowData.id_jogo_base || 
    data.jogo_base || shallowData.jogo_base || 
    data.link_base || shallowData.link_base || 
    data.expansao_de || shallowData.expansao_de
  );
  
  const isExpansaoFlag = Boolean(
    data.is_expansao || shallowData.is_expansao || 
    data.is_expansion || shallowData.is_expansion
  );

  // Verificar dependência no array de itens relacionados
  const relacionados = Array.isArray(data.relacionados) ? data.relacionados : [];
  const hasRelacionamentoExpansao = relacionados.some((r: any) => 
    r.tipo_relacionamento && expRegex.test(normalize(String(r.tipo_relacionamento)))
  );

  let inferredType = 'Base';
  let isExpansion = false;

  // 3. Validação do Merge Raso vs Profundo: 
  // Nunca sobrescrevemos a flag se o dado raso preliminarmente identificou Expansão/Promo.
  const shallowIsExpansao = tpJogoShallow === 'e' || expRegex.test(tpJogoShallow);
  const shallowIsPromo = tpJogoShallow === 'p' || promoRegex.test(tpJogoShallow);
  const shallowIsAcessorio = tpJogoShallow === 'a' || acessorioRegex.test(tpJogoShallow);

  if (
    tpJogo === 'e' || 
    expRegex.test(tpJogo) || 
    shallowIsExpansao ||
    hasExpansaoTag ||
    expRegex.test(normName) ||
    hasLinkBase ||
    isExpansaoFlag ||
    hasRelacionamentoExpansao
  ) {
    inferredType = 'Expansão';
    isExpansion = true;
  } else if (
    tpJogo === 'p' || 
    promoRegex.test(tpJogo) || 
    shallowIsPromo || 
    hasPromoTag || 
    promoRegex.test(normName)
  ) {
    inferredType = 'Promo';
  } else if (
    tpJogo === 'a' || 
    acessorioRegex.test(tpJogo) || 
    shallowIsAcessorio || 
    hasAcessorioTag || 
    acessorioRegex.test(normName)
  ) {
    inferredType = 'Acessório';
  } else if (tpJogo === 'b' || tpJogoRaw.toLowerCase() === 'base' || tpJogoShallowRaw.toLowerCase() === 'base') {
    inferredType = 'Base';
  } else if (tpJogoRaw) {
    inferredType = tpJogoRaw.charAt(0).toUpperCase() + tpJogoRaw.slice(1);
  } else if (tpJogoShallowRaw) {
    inferredType = tpJogoShallowRaw.charAt(0).toUpperCase() + tpJogoShallowRaw.slice(1);
  }

  // Descrição em português (preferir dado detalhado)
  const rawDesc = data.ds_jogo || data.descricao || data.de_resumo || shallowData.ds_jogo || '';
  let descriptionPt: string | undefined;
  if (rawDesc) {
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
  const linkBgg = data.link_bgg || shallowData.link_bgg;
  if (linkBgg) {
    const match = String(linkBgg).match(/boardgamegeek\.com\/boardgame\/(\d+)/);
    if (match) inferredBggId = match[1];
  }
  if (!inferredBggId && (data.bgg_id || shallowData.bgg_id)) inferredBggId = String(data.bgg_id || shallowData.bgg_id);
  if (!inferredBggId && (data.id_bgg || shallowData.id_bgg)) inferredBggId = String(data.id_bgg || shallowData.id_bgg);
  
  const linksArray = Array.isArray(data.links) ? data.links : (Array.isArray(shallowData.links) ? shallowData.links : []);
  if (!inferredBggId && linksArray.length > 0) {
    const bggLink = linksArray.find((l: any) => l.url && l.url.includes('boardgamegeek.com'));
    if (bggLink) {
      const match = String(bggLink.url).match(/boardgamegeek\.com\/boardgame\/(\d+)/);
      if (match) inferredBggId = match[1];
    }
  }

  // Extrair domínios brutos para uso externo
  const domainsOut: string[] = [
    ...(data.categorias || shallowData.categorias || []).map((c: any) => c.nm_categoria),
    ...(data.mecanicas || shallowData.mecanicas || []).map((m: any) => m.nm_mecanica),
    ...(data.temas || shallowData.temas || []).map((t: any) => t.nm_tema)
  ].filter(Boolean);

  const rankRaw = data.rank_jogo || shallowData.rank_jogo || data.posicao_rank || shallowData.posicao_rank || data.rank || shallowData.rank;
  const rank = rankRaw ? parseInt(rankRaw, 10) : undefined;

  return {
    ludoId,
    namePt: nmJogo || undefined,
    type: inferredType,
    isExpansion,
    descriptionPt: descriptionPt || undefined,
    thumbnail: data.thumb || data.imagem || shallowData.thumb || shallowData.imagem || undefined,
    image: data.imagem || shallowData.imagem || undefined,
    yearPublished: (data.ano_publicacao || shallowData.ano_publicacao) ? parseInt(data.ano_publicacao || shallowData.ano_publicacao, 10) : undefined,
    minPlayers: (data.qt_jogadores_min || shallowData.qt_jogadores_min) ? parseInt(data.qt_jogadores_min || shallowData.qt_jogadores_min, 10) : undefined,
    maxPlayers: (data.qt_jogadores_max || shallowData.qt_jogadores_max) ? parseInt(data.qt_jogadores_max || shallowData.qt_jogadores_max, 10) : undefined,
    ludoRating: (data.vl_nota || shallowData.vl_nota) ? parseFloat(data.vl_nota || shallowData.vl_nota) : undefined,
    rank: isNaN(rank as number) ? undefined : rank,
    domains: domainsOut.length > 0 ? domainsOut : undefined,
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
        return parseLudopediaDetail(searchItem, {});
      }
      return null;
    }

    const detailJson = await detailRes.json();
    
    // Passamos o shallow data (searchItem) como parâmetro separado em vez de fazer um objeto merged raso { ...searchItem, ...detailJson }
    // Isso garante que flags de expansão do payload listagem não sejam sobrescritas por null no payload detalhado.
    return parseLudopediaDetail(detailJson, searchItem || {});
  } catch (error) {
    console.error(`Erro ao buscar dados na Ludopedia para "${gameName}":`, error);
    return null;
  }
}
