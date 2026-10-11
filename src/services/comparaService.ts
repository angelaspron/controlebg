export interface ComparaPriceData {
  retailPrice?: number; // Menor preço de varejo (lojas novas)
  usedPrice?: number; // Estimativa de mercado de usados
}

const FORBIDDEN_ACCESSORIES = [
  'insert', 'dashboard', 'playmat', 'luva', 'sleeve', 'sleeves', 
  'organizador', 'moeda', 'moedas', 'promo', 'combo', 'kit'
];

const USED_KEYWORDS = [
  'usado', 'usados', 'seminovo', 'semi-novo', 'segunda mão', 
  'segunda mao', 'desapego', 'bgg market', 'ludopedia classificados'
];

export function parseComparaPrices(product: any): ComparaPriceData {
  if (!product) return {};

  const prices = Array.isArray(product.prices) ? product.prices : [];
  const retailPrices: number[] = [];
  const usedPrices: number[] = [];

  for (const p of prices) {
    if (p.available === false) continue;
    const priceVal = typeof p.price_to === 'number' ? p.price_to : parseFloat(String(p.price_to || 0));
    if (isNaN(priceVal) || priceVal <= 0) continue;

    const itemName = (p.name || '').toLowerCase();
    const storeName = (p.store?.name || '').toLowerCase();
    const combined = `${itemName} ${storeName}`;

    // Ignorar acessórios
    if (FORBIDDEN_ACCESSORIES.some(acc => combined.includes(acc))) {
      continue;
    }

    // Verificar se é mercado de usados
    const isUsed = USED_KEYWORDS.some(kw => combined.includes(kw));
    if (isUsed) {
      usedPrices.push(priceVal);
    } else {
      retailPrices.push(priceVal);
    }
  }

  let retailPrice: number | undefined;
  if (retailPrices.length > 0) {
    retailPrice = Math.min(...retailPrices);
  } else if (product.product_price?.min_price && product.product_price.min_price > 0) {
    retailPrice = product.product_price.min_price;
  }

  let usedPrice: number | undefined;
  if (usedPrices.length > 0) {
    usedPrice = Math.min(...usedPrices);
  }

  return {
    retailPrice,
    usedPrice,
  };
}

export async function fetchComparaJogosData(
  gameName: string,
  bggId?: string,
  options: { maxRetries?: number } = {}
): Promise<ComparaPriceData | null> {
  const maxRetries = options.maxRetries ?? 5;
  const bggIdInt = bggId ? parseInt(bggId, 10) : 0;

  // Query estritamente focada em preços, sem poluir dados estatísticos do jogo
  const query = `
    query GetGamePricesOnly($nameExact: String!, $nameLike: String!, $bggId: Int!) {
      byBggId: product(where: {bgg_id: {_eq: $bggId}}, limit: 1) {
        id
        name
        product_price { min_price }
        prices {
          name
          price_to
          available
          store { name }
        }
      }
      byNameExact: product(where: {name: {_ilike: $nameExact}, type: {_in: [game, expansion]}}, limit: 1) {
        id
        name
        product_price { min_price }
        prices {
          name
          price_to
          available
          store { name }
        }
      }
      byNameLike: product(where: {name: {_ilike: $nameLike}, type: {_in: [game, expansion]}}, limit: 1) {
        id
        name
        product_price { min_price }
        prices {
          name
          price_to
          available
          store { name }
        }
      }
    }
  `;

  const variables = {
    nameExact: gameName,
    nameLike: `%${gameName}%`,
    bggId: isNaN(bggIdInt) ? 0 : bggIdInt,
  };

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  };

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      let res = await fetch('https://api.comparajogos.com.br/v1/graphql', requestOptions);

      if (res.status === 429) {
        const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 16000);
        console.warn(`Compara Jogos HTTP 429 (Rate Limit). Aguardando ${Math.round(backoff)}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        attempt++;
        continue;
      }

      if (!res.ok) {
        console.error(`Compara Jogos erro HTTP ${res.status} para "${gameName}"`);
        return null;
      }

      const json = await res.json();
      if (!json.data) return null;

      let product = null;
      if (json.data.byBggId && json.data.byBggId.length > 0) {
        product = json.data.byBggId[0];
      } else if (json.data.byNameExact && json.data.byNameExact.length > 0) {
        product = json.data.byNameExact[0];
      } else if (json.data.byNameLike && json.data.byNameLike.length > 0) {
        product = json.data.byNameLike[0];
      }

      if (product) {
        return parseComparaPrices(product);
      }
      return null;
    } catch (e) {
      console.error(`Erro ao consultar Compara Jogos para "${gameName}":`, e);
      attempt++;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  return null;
}

export async function searchBggIdViaCompara(gameName: string): Promise<string | null> {
  const query = `
    query SearchBggId($nameExact: String!, $nameLike: String!) {
      byExact: product(where: {name: {_ilike: $nameExact}, type: {_in: [game, expansion]}}, limit: 1) {
        bgg_id
      }
      byLike: product(where: {name: {_ilike: $nameLike}, type: {_in: [game, expansion]}}, limit: 1) {
        bgg_id
      }
    }
  `;
  try {
    const res = await fetch('https://api.comparajogos.com.br/v1/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { nameExact: gameName, nameLike: `%${gameName}%` }
      })
    });
    if (!res.ok) return null;
    const json = await res.json();
    const product = json?.data?.byExact?.[0] || json?.data?.byLike?.[0];
    if (product?.bgg_id) {
      return String(product.bgg_id);
    }
  } catch (e) {
    console.error(`Erro ao buscar BGG ID via Compara Jogos para "${gameName}":`, e);
  }
  return null;
}

