import { matchesGameName } from '../utils/nameMatcher.ts';
import type {
  CardSleevesData,
  CardSleeveSet,
  LudopediaMatch,
  LudopediaPlaysSummary,
  LudopediaMeProfile,
  LudopediaWishlistItem,
} from '../types/index.ts';
import { getCardSleeveSizeName, parseModelDimensions } from '../utils/sleeveUtils.ts';

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
  playtime?: number;
  ludoRating?: number;
  rank?: number;
  domains?: string[];
  mechanicsPt?: string[];
  categories?: string[];
  themes?: string[];
  designers?: string[];
  artists?: string[];
  bggId?: string;
  isPlayed?: boolean;
  isOwned?: boolean;
  cardSleeves?: CardSleevesData; // Quantidade e tipos de sleeves extraídos da Ludopedia (fallback secundário)
  spend?: number; // Valor pago pelo usuário (vl_custo)
  playCount?: number; // Quantidade de partidas jogadas informada pela Ludopedia
  acquiredAt?: string; // Data se retornada pela API (YYYY-MM-DD)
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

/**
 * Extrai a quantidade de vezes que o jogo foi jogado na Ludopedia (qt_partidas).
 * Fonte exclusiva: Ludopedia API.
 */
export function parsePlayCountFromLudo(data: any, shallowData: any = {}): number | undefined {
  const check = (obj: any): number | null => {
    if (!obj || typeof obj !== 'object') return null;

    if (obj.qt_partidas !== undefined && obj.qt_partidas !== null) {
      const n = Number(obj.qt_partidas);
      if (!isNaN(n) && n >= 0) return n;
    }
    if (obj.total_partidas !== undefined && obj.total_partidas !== null) {
      const n = Number(obj.total_partidas);
      if (!isNaN(n) && n >= 0) return n;
    }
    if (obj.qtde_partidas !== undefined && obj.qtde_partidas !== null) {
      const n = Number(obj.qtde_partidas);
      if (!isNaN(n) && n >= 0) return n;
    }
    if (obj.num_partidas !== undefined && obj.num_partidas !== null) {
      const n = Number(obj.num_partidas);
      if (!isNaN(n) && n >= 0) return n;
    }
    if (obj.qtde !== undefined && obj.qtde !== null) {
      const n = Number(obj.qtde);
      if (!isNaN(n) && n >= 0) return n;
    }
    if (obj.playCount !== undefined && obj.playCount !== null) {
      const n = Number(obj.playCount);
      if (!isNaN(n) && n >= 0) return n;
    }
    if (obj.partidas !== undefined && obj.partidas !== null) {
      if (typeof obj.partidas === 'number' && !isNaN(obj.partidas) && obj.partidas >= 0) return obj.partidas;
      if (Array.isArray(obj.partidas)) return obj.partidas.length;
      if (typeof obj.partidas === 'string') {
        const n = Number(obj.partidas);
        if (!isNaN(n) && n >= 0) return n;
      }
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

    // Indicador booleano comprovado de que jogou: garante pelo menos 1
    if (
      obj.fl_jogou === 1 || obj.fl_jogou === '1' || obj.fl_jogou === true ||
      obj.fl_jogado === 1 || obj.fl_jogado === '1' || obj.fl_jogado === true ||
      obj.jogou === 1 || obj.jogou === '1' || obj.jogou === true ||
      obj.jogado === 1 || obj.jogado === '1' || obj.jogado === true
    ) {
      return 1;
    }

    return null;
  };

  const primary = check(data);
  if (primary !== null) return primary;

  const shallow = check(shallowData);
  if (shallow !== null) return shallow;

  return undefined;
}

/**
 * Parser de contingência secundária para extrair contagem e tamanhos de sleeves
 * a partir de estruturas ou descrições da API da Ludopedia.
 */
export function parseLudopediaSleeves(data: any, shallowData: any = {}): CardSleevesData | undefined {
  if (!data && !shallowData) return undefined;

  const raw = { ...(shallowData || {}), ...(data || {}) };
  const sets: CardSleeveSet[] = [];

  // 1. Arrays estruturados diretos: data.sleeves, data.cartas, data.card_sleeves, data.protetores, data.componentes
  const rawList = Array.isArray(raw.sleeves) ? raw.sleeves :
                  Array.isArray(raw.cartas) ? raw.cartas :
                  Array.isArray(raw.card_sleeves) ? raw.card_sleeves :
                  Array.isArray(raw.protetores) ? raw.protetores :
                  Array.isArray(raw.componentes) ? raw.componentes : [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;

    const qty = Number(item.quantity || item.qt_cartas || item.quantidade || item.qtde || item.qt || 0);
    let width = Number(item.width || item.largura || item.tam_largura || item.dim_largura || 0);
    let height = Number(item.height || item.altura || item.tam_altura || item.dim_altura || 0);
    let sizeName = item.sizeName || item.nm_tamanho || item.tp_sleeve || item.modelo || item.tamanho || '';

    // Se as dimensões estão em formato texto (ex: "63,5 x 88 mm" ou "63.5x88")
    if ((!width || !height) && (typeof item.dimensoes === 'string' || typeof item.tamanho === 'string' || typeof item.descricao === 'string')) {
      const parsedDim = parseModelDimensions(item.dimensoes || item.tamanho || item.descricao || '');
      width = parsedDim.width;
      height = parsedDim.height;
      if (!sizeName) sizeName = parsedDim.sizeName;
    }

    if (qty > 0 && width > 0 && height > 0) {
      sets.push({
        name: item.name || item.nm_cartas || item.descricao || item.ds_item || undefined,
        quantity: qty,
        width,
        height,
        sizeName: sizeName || getCardSleeveSizeName(width, height),
        sleeveProductName: item.sleeveProductName || item.nm_produto || undefined
      });
    }
  }

  // 2. Parser por Expressões Regulares na descrição se nenhum array estruturado foi detectado
  if (sets.length === 0) {
    const text = String(raw.ds_jogo || raw.descricao || raw.de_resumo || raw.componentes_texto || '');
    if (text) {
      // Padrão A: "110 cartas (63,5 x 88 mm)" ou "110 cartas 63.5x88"
      const regexA = /(\d+)\s*(?:cartas?|cards?|sleeves?)\s*(?:\((?:tamanho\s*)?([^\)]+)\)|(?:tamanho\s*)?(\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?(?:\s*mm)?))/gi;
      let match;
      while ((match = regexA.exec(text)) !== null) {
        const qty = parseInt(match[1], 10);
        const dimStr = match[2] || match[3] || '';
        const parsed = parseModelDimensions(dimStr);
        if (qty > 0 && parsed.width > 0 && parsed.height > 0) {
          sets.push({
            quantity: qty,
            width: parsed.width,
            height: parsed.height,
            sizeName: parsed.sizeName || getCardSleeveSizeName(parsed.width, parsed.height),
          });
        }
      }

      // Padrão B: "Sleeves: 162 Padrão (63,5x88mm), 8 Tarot (70x120mm)"
      if (sets.length === 0) {
        const regexB = /(?:sleeves?|protetores?)\s*:\s*([^.\n\r]+)/i;
        const bMatch = text.match(regexB);
        if (bMatch) {
          const sleeveText = bMatch[1];
          const itemRegex = /(\d+)\s*(?:x\s*)?([^\d,;]+)?\s*\(?(\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?(?:\s*mm)?)\)?/gi;
          let iMatch;
          while ((iMatch = itemRegex.exec(sleeveText)) !== null) {
            const qty = parseInt(iMatch[1], 10);
            const rawName = (iMatch[2] || '').trim();
            const dimStr = iMatch[3];
            const parsed = parseModelDimensions(dimStr);
            if (qty > 0 && parsed.width > 0 && parsed.height > 0) {
              sets.push({
                name: rawName || undefined,
                quantity: qty,
                width: parsed.width,
                height: parsed.height,
                sizeName: rawName || parsed.sizeName || getCardSleeveSizeName(parsed.width, parsed.height),
              });
            }
          }
        }
      }
    }
  }

  if (sets.length === 0) return undefined;

  const ludoId = raw.id_jogo || raw.ludoId;
  return {
    source: 'Ludopedia',
    sourceUrl: ludoId ? `https://ludopedia.com.br/jogo/${ludoId}` : undefined,
    sets
  };
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

  // Extrair mecânicas, categorias, temas, designers e artistas separadamente
  const rawMecanicas = Array.isArray(data.mecanicas) ? data.mecanicas : (Array.isArray(shallowData.mecanicas) ? shallowData.mecanicas : []);
  const rawCategorias = Array.isArray(data.categorias) ? data.categorias : (Array.isArray(shallowData.categorias) ? shallowData.categorias : []);
  const rawTemas = Array.isArray(data.temas) ? data.temas : (Array.isArray(shallowData.temas) ? shallowData.temas : []);
  const rawDesigners = Array.isArray(data.designers) ? data.designers : (Array.isArray(shallowData.designers) ? shallowData.designers : []);
  const rawArtistas = Array.isArray(data.artistas) ? data.artistas : (Array.isArray(shallowData.artistas) ? shallowData.artistas : []);

  const mechanicsPt: string[] = Array.from(new Set(
    rawMecanicas.map((m: any) => String(m?.nm_mecanica || m?.nome || '').trim()).filter(Boolean)
  ));
  const categoriesOut: string[] = Array.from(new Set(
    rawCategorias.map((c: any) => String(c?.nm_categoria || c?.nome || '').trim()).filter(Boolean)
  ));
  const themesOut: string[] = Array.from(new Set(
    rawTemas.map((t: any) => String(t?.nm_tema || t?.nome || '').trim()).filter(Boolean)
  ));
  const designersOut: string[] = Array.from(new Set(
    rawDesigners.map((d: any) => String(d?.nm_profissional || d?.nome || d?.name || '').trim()).filter(Boolean)
  ));
  const artistsOut: string[] = Array.from(new Set(
    rawArtistas.map((a: any) => String(a?.nm_profissional || a?.nome || a?.name || '').trim()).filter(Boolean)
  ));

  // Extrair domínios brutos para compatibilidade retroativa
  const domainsOut: string[] = Array.from(new Set([
    ...categoriesOut,
    ...mechanicsPt,
    ...themesOut,
  ]));

  const playtimeRaw = data.vl_tempo_jogo ?? shallowData.vl_tempo_jogo ?? data.tempo_jogo;
  const parsedPlaytime = playtimeRaw ? parseInt(String(playtimeRaw), 10) : NaN;
  const playtime = !isNaN(parsedPlaytime) && parsedPlaytime > 0 ? parsedPlaytime : undefined;

  const rawDate =
    data.dt_aquisicao || shallowData.dt_aquisicao ||
    data.dt_cadastro || shallowData.dt_cadastro ||
    data.dt_inclusao || shallowData.dt_inclusao;
  let acquiredAt: string | undefined;
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const isoMatch = rawDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    const brMatch = rawDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (isoMatch) acquiredAt = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    else if (brMatch) acquiredAt = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const rankRaw = data.rank_jogo || shallowData.rank_jogo || data.posicao_rank || shallowData.posicao_rank || data.rank || shallowData.rank;
  const rank = rankRaw ? parseInt(rankRaw, 10) : undefined;

  const rawCusto = data.vl_custo ?? shallowData.vl_custo;
  let spend: number | undefined;
  if (rawCusto !== undefined && rawCusto !== null && rawCusto !== '') {
    const num = typeof rawCusto === 'number' ? rawCusto : parseFloat(String(rawCusto).replace(',', '.'));
    if (!isNaN(num)) {
      spend = num;
    }
  }

  const isOwned = isOwnedInLudopedia(data, shallowData);
  const rawIsPlayed = parseIsPlayedFromLudo(data, shallowData);
  const rawPlayCount = parsePlayCountFromLudo(data, shallowData);
  const resolvedPlayCount = isOwned
    ? (rawIsPlayed ? (rawPlayCount && rawPlayCount > 0 ? rawPlayCount : 1) : undefined)
    : undefined;

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
    playtime,
    ludoRating: (data.vl_nota || shallowData.vl_nota) ? parseFloat(data.vl_nota || shallowData.vl_nota) : undefined,
    rank: isNaN(rank as number) ? undefined : rank,
    domains: domainsOut.length > 0 ? domainsOut : undefined,
    mechanicsPt: mechanicsPt.length > 0 ? mechanicsPt : undefined,
    categories: categoriesOut.length > 0 ? categoriesOut : undefined,
    themes: themesOut.length > 0 ? themesOut : undefined,
    designers: designersOut.length > 0 ? designersOut : undefined,
    artists: artistsOut.length > 0 ? artistsOut : undefined,
    bggId: inferredBggId,
    isOwned,
    isPlayed: isOwned ? rawIsPlayed : false,
    playCount: resolvedPlayCount,
    cardSleeves: parseLudopediaSleeves(data, shallowData),
    spend,
    acquiredAt,
  };
}

function resolveStoredLudoToken(providedToken?: string): string {
  if (providedToken) return providedToken;
  if (typeof window === 'undefined') return '';
  try {
    const direct = localStorage.getItem('boardgame_manager_ludo_token');
    if (direct) return direct;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('boardgame_manager_ludo_token_')) {
        const val = localStorage.getItem(key);
        if (val) return val;
      }
    }
  } catch {}
  return '';
}

export async function fetchLudopediaData(
  gameName: string,
  token?: string,
  ludoId?: string,
  options: { maxRetries?: number } = {}
): Promise<LudopediaParsedData | null> {
  const resolvedToken = resolveStoredLudoToken(token);
  if (!resolvedToken) return null;
  const maxRetries = options.maxRetries ?? 5;

  const fetchWithRetry = async (url: string) => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${resolvedToken}` }
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

// ==========================================
// SERVIÇOS DE PARTIDAS (LUDOPEDIA V1 API)
// ==========================================

/**
 * Formata minutos em formato amigável (ex: "2h 30m" ou "45 min").
 */
export function formatPlayDuration(minutes?: number | null): string {
  if (minutes === undefined || minutes === null || isNaN(minutes) || minutes <= 0) {
    return 'Tempo não informado';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins} min`;
}

/**
 * Formata data ISO (yyyy-mm-dd) em formato brasileiro amigável com dia da semana.
 */
export function formatMatchDate(dateStr?: string | null): string {
  if (!dateStr) return 'Data não informada';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.toLocaleDateString('pt-BR', { weekday: 'short' });
    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    return `${capitalizedDay}, ${formatted}`;
  } catch {
    return dateStr;
  }
}

interface FetchPlaysOptions {
  page?: number;
  rows?: number;
  id_jogo?: number;
  dt_ini?: string;
  dt_fim?: string;
  weekday?: number;
  maxRetries?: number;
}

/**
 * Utilitário central de requisição à API da Ludopedia com suporte a
 * autenticação Bearer, rate limiting HTTP 429 e backoff exponencial.
 */
async function fetchLudoApi(url: string, token: string, maxRetries = 5): Promise<Response | null> {
  const resolvedToken = resolveStoredLudoToken(token);
  if (!resolvedToken) return null;

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${resolvedToken}` }
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
}

/**
 * Consulta uma página de partidas do usuário na Ludopedia (/partidas).
 */
export async function fetchLudopediaPlaysList(
  token: string,
  options: FetchPlaysOptions = {}
): Promise<{ partidas: LudopediaMatch[]; total: number }> {
  const params = new URLSearchParams();
  params.set('page', String(options.page || 1));
  params.set('rows', String(Math.min(options.rows || 100, 100)));
  if (options.id_jogo) params.set('id_jogo', String(options.id_jogo));
  if (options.dt_ini) params.set('dt_ini', options.dt_ini);
  if (options.dt_fim) params.set('dt_fim', options.dt_fim);
  if (options.weekday) params.set('weekday', String(options.weekday));

  const url = `/ludo-api/partidas?${params.toString()}`;
  const res = await fetchLudoApi(url, token, options.maxRetries ?? 5);

  if (!res || !res.ok) {
    throw new Error(res ? `Erro na API da Ludopedia (${res.status})` : 'Falha de conexão com a Ludopedia.');
  }

  const json = await res.json();
  const rawList = Array.isArray(json.partidas) ? json.partidas : (Array.isArray(json) ? json : []);
  const total = Number(json.total) || rawList.length;

  return {
    partidas: rawList as LudopediaMatch[],
    total
  };
}

/**
 * Consulta o resumo estatístico geral de partidas do usuário (/partidas/resumo).
 */
export async function fetchLudopediaPlaysSummary(
  token: string,
  options: { id_jogo?: number; dt_ini?: string; dt_fim?: string; weekday?: number } = {}
): Promise<LudopediaPlaysSummary | null> {
  const params = new URLSearchParams();
  if (options.id_jogo) params.set('id_jogo', String(options.id_jogo));
  if (options.dt_ini) params.set('dt_ini', options.dt_ini);
  if (options.dt_fim) params.set('dt_fim', options.dt_fim);
  if (options.weekday) params.set('weekday', String(options.weekday));

  const url = `/ludo-api/partidas/resumo${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetchLudoApi(url, token, 3);

  if (!res || !res.ok) return null;

  try {
    const json = await res.json();
    return {
      qt_partidas: Number(json.qt_partidas || 0),
      vl_duracao: Number(json.vl_duracao || 0),
      qt_duracao: Number(json.qt_duracao || 0),
      qt_jogos: Number(json.qt_jogos || 0),
      qt_expansoes: Number(json.qt_expansoes || 0),
      qt_vitorias: Number(json.qt_vitorias || 0),
      qt_usuarios: Number(json.qt_usuarios || 0),
      qt_nao_usuarios: Number(json.qt_nao_usuarios || 0),
    };
  } catch {
    return null;
  }
}

/**
 * Busca todas as partidas registradas pelo usuário na Ludopedia com paginação sequencial e resiliente.
 */
export async function fetchAllLudopediaPlays(
  token: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ partidas: LudopediaMatch[]; summary: LudopediaPlaysSummary | null }> {
  if (!token) {
    throw new Error('Token da Ludopedia não configurado.');
  }

  // 1. Tentar obter o resumo agregado primeiro para saber o volume de partidas
  const summary = await fetchLudopediaPlaysSummary(token);

  let allPartidas: LudopediaMatch[] = [];
  let currentPage = 1;
  let totalReported = summary?.qt_partidas || 0;
  let hasMore = true;

  while (hasMore) {
    const pageData = await fetchLudopediaPlaysList(token, { page: currentPage, rows: 100 });
    const items = pageData.partidas || [];
    if (items.length === 0) break;

    allPartidas = allPartidas.concat(items);
    totalReported = Math.max(totalReported, pageData.total);

    if (onProgress) {
      onProgress(allPartidas.length, totalReported);
    }

    if (allPartidas.length >= totalReported || items.length < 100) {
      hasMore = false;
    } else {
      currentPage++;
      // Pequeno intervalo entre páginas para evitar rate limits
      await new Promise(r => setTimeout(r, 250));
    }
  }

  return {
    partidas: allPartidas,
    summary
  };
}

/**
 * Agrupa partidas por jogo da Ludopedia (/partidas/group?groupby=jogos) para mapear
 * a quantidade exata de partidas de cada jogo cadastrado.
 */
export async function fetchLudopediaPlaysGroupedByGame(
  token: string
): Promise<{ countByLudoId: Record<string, number>; countByName: Record<string, number> }> {
  const countByLudoId: Record<string, number> = {};
  const countByName: Record<string, number> = {};

  if (!token) return { countByLudoId, countByName };

  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `/ludo-api/partidas/group?groupby=jogos&rows=100&page=${currentPage}`;
    const res = await fetchLudoApi(url, token, 3);
    if (!res || !res.ok) break;

    try {
      const json = await res.json();
      const list = Array.isArray(json.jogos) ? json.jogos : (Array.isArray(json) ? json : []);
      if (list.length === 0) break;

      for (const item of list) {
        const id = item.id_jogo || item.jogo?.id_jogo;
        const name = item.nm_jogo || item.jogo?.nm_jogo;
        const count = Number(item.qtde || item.qt_partidas || item.total_partidas || item.total || item.count || 1);

        if (id) countByLudoId[String(id)] = count;
        if (name) {
          const norm = String(name).trim().toLowerCase();
          countByName[norm] = count;
        }
      }

      const total = Number(json.total) || list.length;
      if (currentPage * 100 >= total || list.length < 100) {
        hasMore = false;
      } else {
        currentPage++;
        await new Promise(r => setTimeout(r, 200));
      }
    } catch {
      break;
    }
  }

  return { countByLudoId, countByName };
}

/**
 * Busca os dados do usuário autenticado na Ludopedia (/me).
 */
export async function fetchLudopediaMe(token: string): Promise<LudopediaMeProfile | null> {
  const resolvedToken = resolveStoredLudoToken(token);
  if (!resolvedToken) return null;

  const res = await fetchLudoApi('/ludo-api/me', resolvedToken, 3);
  if (!res || !res.ok) return null;

  try {
    const json = await res.json();
    if (!json || (!json.id_usuario && !json.usuario)) return null;
    return {
      id_usuario: Number(json.id_usuario || 0),
      usuario: String(json.usuario || '').trim(),
      thumb: json.thumb || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Busca a lista de desejos (lista=lista_desejos) da Ludopedia sem misturar com a coleção principal.
 */
export async function fetchLudopediaWishlist(token: string): Promise<LudopediaWishlistItem[]> {
  const resolvedToken = resolveStoredLudoToken(token);
  if (!resolvedToken) return [];

  const items: LudopediaWishlistItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetchLudoApi(`/ludo-api/colecao?lista=lista_desejos&rows=100&page=${page}`, resolvedToken, 3);
    if (!res || !res.ok) break;

    try {
      const json = await res.json();
      const rawList = Array.isArray(json.colecao) ? json.colecao : [];
      if (rawList.length === 0) break;

      for (const it of rawList) {
        if (!it?.id_jogo) continue;
        items.push({
          ludoId: String(it.id_jogo),
          name: String(it.nm_jogo || 'Jogo Desconhecido'),
          thumbnail: it.thumb || undefined,
          yearPublished: it.ano_publicacao ? parseInt(String(it.ano_publicacao), 10) : undefined,
          link: it.link || `https://ludopedia.com.br/jogo/${it.id_jogo}`,
        });
      }

      const total = Number(json.total) || rawList.length;
      if (page * 100 >= total || rawList.length < 100) {
        hasMore = false;
      } else {
        page++;
        await new Promise(r => setTimeout(r, 200));
      }
    } catch {
      break;
    }
  }

  return items;
}

/**
 * Consulta leve da ficha de um jogo na Ludopedia (/jogos/:id) apenas para enriquecer
 * metadados (designers, artistas, mecânicas em PT-BR, categorias, temas, tempo de jogo).
 */
export async function fetchLudopediaGameMetadata(
  ludoId: string,
  token: string
): Promise<LudopediaParsedData | null> {
  const resolvedToken = resolveStoredLudoToken(token);
  if (!resolvedToken || !ludoId) return null;

  const res = await fetchLudoApi(`/ludo-api/jogos/${ludoId}`, resolvedToken, 4);
  if (!res || !res.ok) return null;

  try {
    const json = await res.json();
    return parseLudopediaDetail(json, {});
  } catch {
    return null;
  }
}

