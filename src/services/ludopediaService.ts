import { matchesGameName } from '../utils/nameMatcher.ts';

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
  isPlayed?: boolean;
  isOwned?: boolean;
}

/**
 * Valida de forma estrita se o payload da Ludopedia comprova que o jogo
 * pertence à coleção pessoal do usuário (Ownership Check).
 * Verifica flags como na_colecao, is_owned, fl_tem, fl_teve, listas pessoais e objetos aninhados.
 */
export function isOwnedInLudopedia(data: any, shallowData: any = {}): boolean {
  const check = (obj: any): boolean | null => {
    if (!obj || typeof obj !== 'object') return null;

    // 1. Tags explícitas positivas de posse / coleção (documentadas pela API da Ludopedia)
    const hasExplicitOwnership = Boolean(
      obj.is_owned === 1 || obj.is_owned === '1' || obj.is_owned === true ||
      obj.is_owned === 'S' || obj.is_owned === 's' || obj.is_owned === 'sim' ||
      obj.na_colecao === 1 || obj.na_colecao === '1' || obj.na_colecao === true ||
      obj.na_colecao === 'S' || obj.na_colecao === 's' || obj.na_colecao === 'sim' ||
      obj.em_colecao === 1 || obj.em_colecao === '1' || obj.em_colecao === true ||
      obj.em_colecao === 'S' || obj.em_colecao === 's' || obj.em_colecao === 'sim' ||
      obj.fl_colecao === 1 || obj.fl_colecao === '1' || obj.fl_colecao === true ||
      obj.fl_colecao === 'S' || obj.fl_colecao === 's' || obj.fl_colecao === 'sim' ||
      obj.fl_tem === 1 || obj.fl_tem === '1' || obj.fl_tem === true ||
      obj.fl_tem === 'S' || obj.fl_tem === 's' || obj.fl_tem === 'sim' ||
      obj.fl_teve === 1 || obj.fl_teve === '1' || obj.fl_teve === true ||
      obj.fl_teve === 'S' || obj.fl_teve === 's' || obj.fl_teve === 'sim' ||
      obj.owned === 1 || obj.owned === '1' || obj.owned === true ||
      obj.owned === 'S' || obj.owned === 's' ||
      obj.isOwned === true || obj._isOwned === true
    );

    // 2. CRITÉRIOS DE BLOQUEIO E EXCLUSÃO (Prioridade Absoluta)
    // Se explicitamente marcado como NÃO tem (fl_tem = 0) e não possui fl_teve=1, bloqueia sumariamente
    if (
      obj.fl_tem === 0 || obj.fl_tem === '0' || obj.fl_tem === false ||
      obj.fl_tem === 'N' || obj.fl_tem === 'n' || obj.fl_tem === 'nao' || obj.fl_tem === 'não'
    ) {
      if (
        obj.fl_teve !== 1 && obj.fl_teve !== '1' && obj.fl_teve !== true &&
        obj.na_colecao !== 1 && obj.na_colecao !== true &&
        obj.is_owned !== 1 && obj.is_owned !== true
      ) {
        return false;
      }
    }

    // Origem explícita de lista de jogados (/colecao?lista=jogados)
    if (obj._source_lista === 'jogados' || obj.lista === 'jogados') {
      if (!hasExplicitOwnership) return false;
    }

    // Lista de desejos não é coleção
    if (
      (obj.fl_quer === 1 || obj.fl_quer === '1' || obj.fl_quer === true || obj._source_lista === 'lista_desejos' || obj.lista === 'lista_desejos') &&
      !hasExplicitOwnership
    ) {
      return false;
    }

    // REGRA DEFINITIVA: Registros que apenas possuem dados de partidas/jogados NÃO pertencem à coleção
    const hasPlayedIndicators = Boolean(
      obj.fl_jogou === 1 || obj.fl_jogou === '1' || obj.fl_jogou === true ||
      obj.fl_jogado === 1 || obj.fl_jogado === '1' || obj.fl_jogado === true ||
      (obj.qt_partidas !== undefined && Number(obj.qt_partidas) > 0) ||
      (obj.total_partidas !== undefined && Number(obj.total_partidas) > 0) ||
      (obj.num_partidas !== undefined && Number(obj.num_partidas) > 0) ||
      (Array.isArray(obj.partidas) && obj.partidas.length > 0)
    );
    if (hasPlayedIndicators && !hasExplicitOwnership) {
      return false;
    }

    // 3. Se comprovada posse explícita positiva, aceita
    if (hasExplicitOwnership) {
      return true;
    }

    // 4. Objetos aninhados retornados pela API da Ludopedia (ex: colecao, item, usuario)
    if (obj.colecao && typeof obj.colecao === 'object') {
      const nested = check(obj.colecao);
      if (nested !== null) return nested;
    }
    if (obj.item && typeof obj.item === 'object') {
      const nested = check(obj.item);
      if (nested !== null) return nested;
    }
    if (obj.usuario && typeof obj.usuario === 'object') {
      const nested = check(obj.usuario);
      if (nested !== null) return nested;
    }

    // 5. Origem estrita de estante pessoal apenas se não houver indicadores de jogado e fl_tem não for 0
    if (
      (obj._source_lista === 'colecao' || obj._source_lista === 'teve' || obj.lista === 'colecao' || obj.lista === 'teve') &&
      !hasPlayedIndicators &&
      obj.fl_tem !== 0 && obj.fl_tem !== '0' && obj.fl_tem !== false
    ) {
      return true;
    }

    // 6. Status mapeado internamente no GameData (para dados já existentes na estante local)
    if (obj.status === 'Na Coleção' || obj.status === 'Vendido') {
      return true;
    }

    return null;
  };

  const primary = check(data);
  if (primary !== null) return primary;

  const shallow = check(shallowData);
  if (shallow !== null) return shallow;

  return false;
}

export function parseIsPlayedFromLudo(data: any, shallowData: any = {}): boolean {
  const check = (obj: any): boolean | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.isPlayed === 'boolean') return obj.isPlayed;

    // Se proveniente da lista de jogados da Ludopedia (/colecao?lista=jogados)
    if (obj._source_lista === 'jogados' || obj.lista === 'jogados') return true;

    // Flags de status de jogo jogado na Ludopedia
    if (
      obj.fl_jogou === 1 || obj.fl_jogou === '1' || obj.fl_jogou === true ||
      obj.fl_jogou === 'S' || obj.fl_jogou === 's'
    ) return true;

    if (
      obj.fl_jogado === 1 || obj.fl_jogado === '1' || obj.fl_jogado === true ||
      obj.fl_jogado === 'S' || obj.fl_jogado === 's'
    ) return true;

    if (obj.jogou === 1 || obj.jogou === '1' || obj.jogou === true) return true;
    if (obj.jogado === 1 || obj.jogado === '1' || obj.jogado === true) return true;

    // Contador de partidas > 0
    if (obj.qt_partidas !== undefined && obj.qt_partidas !== null && Number(obj.qt_partidas) > 0) return true;
    if (obj.total_partidas !== undefined && obj.total_partidas !== null && Number(obj.total_partidas) > 0) return true;
    if (obj.num_partidas !== undefined && obj.num_partidas !== null && Number(obj.num_partidas) > 0) return true;
    if (obj.qtde_partidas !== undefined && obj.qtde_partidas !== null && Number(obj.qtde_partidas) > 0) return true;

    if (obj.partidas !== undefined && obj.partidas !== null) {
      if (typeof obj.partidas === 'number' && obj.partidas > 0) return true;
      if (Array.isArray(obj.partidas) && obj.partidas.length > 0) return true;
      if (typeof obj.partidas === 'string' && Number(obj.partidas) > 0) return true;
    }

    // Objetos aninhados retornados pela API da Ludopedia (ex: colecao, item, usuario)
    if (obj.colecao && typeof obj.colecao === 'object') {
      const nested = check(obj.colecao);
      if (nested !== null) return nested;
    }
    if (obj.item && typeof obj.item === 'object') {
      const nested = check(obj.item);
      if (nested !== null) return nested;
    }
    if (obj.usuario && typeof obj.usuario === 'object') {
      const nested = check(obj.usuario);
      if (nested !== null) return nested;
    }

    // Se explicitly zero
    if (
      obj.fl_jogou === 0 || obj.fl_jogou === '0' || obj.fl_jogou === false ||
      obj.fl_jogou === 'N' || obj.fl_jogou === 'n'
    ) return false;
    if (obj.qt_partidas !== undefined && Number(obj.qt_partidas) === 0) return false;
    if (obj.total_partidas !== undefined && Number(obj.total_partidas) === 0) return false;

    return null;
  };

  const primary = check(data);
  if (primary !== null) return primary;

  const shallow = check(shallowData);
  if (shallow !== null) return shallow;

  return false;
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

  const isOwned = isOwnedInLudopedia(data, shallowData);
  const rawIsPlayed = parseIsPlayedFromLudo(data, shallowData);

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
    isOwned,
    isPlayed: isOwned ? rawIsPlayed : false,
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
        ) || searchJson.jogos.find((j: any) =>
          matchesGameName(gameName, j.nm_jogo || '')
        ) || searchJson.jogos.find((j: any) =>
          (j.nm_jogo || '').toLowerCase().includes(gameName.toLowerCase()) ||
          gameName.toLowerCase().includes((j.nm_jogo || '').toLowerCase())
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
    
    // Consulta relação do usuário com o jogo exclusivamente na estante pessoal (/colecao/item/:id)
    let userItemData: any = null;
    try {
      const userItemRes = await fetchWithRetry(`/ludo-api/colecao/item/${resolvedLudoId}`);
      if (userItemRes && userItemRes.ok) {
        userItemData = await userItemRes.json();
      }
    } catch {
      // Ignora erro se o usuário não possuir relação cadastrada para esse jogo
    }

    // Se o item pertencer à coleção do usuário e não tiver flag fl_jogou direta,
    // verifica se possui partidas registradas mantendo o escopo exclusivo
    if (userItemData && isOwnedInLudopedia(userItemData)) {
      if (!userItemData.fl_jogou && (!userItemData.qt_partidas || userItemData.qt_partidas === 0)) {
        try {
          const partRes = await fetchWithRetry(`/ludo-api/partidas?id_jogo=${resolvedLudoId}&rows=1`);
          if (partRes && partRes.ok) {
            const partJson = await partRes.json();
            const hasPartidas = (Array.isArray(partJson.partidas) && partJson.partidas.length > 0) || (partJson.total && Number(partJson.total) > 0);
            if (hasPartidas) {
              userItemData = { ...userItemData, fl_jogou: 1, qt_partidas: partJson.total || partJson.partidas.length };
            }
          }
        } catch {
          // Ignora falha de rede temporária
        }
      }
    }

    const mergedUserData = {
      ...(searchItem || {}),
      ...(userItemData || {})
    };

    return parseLudopediaDetail(detailJson, mergedUserData);
  } catch (error) {
    console.error(`Erro ao buscar dados na Ludopedia para "${gameName}":`, error);
    return null;
  }
}
