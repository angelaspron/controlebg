import { DEFAULT_BGG_TOKEN } from '../src/services/bggService.ts';

async function testCors(name, url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Origin': 'http://localhost:5173',
        ...(options.headers || {})
      }
    });

    console.log(`[${name}] Status: ${res.status} ${res.statusText}`);
    console.log(`   access-control-allow-origin: ${res.headers.get('access-control-allow-origin')}`);
    console.log(`   access-control-allow-methods: ${res.headers.get('access-control-allow-methods')}`);
  } catch (e) {
    console.log(`[${name}] Erro: ${e.message}`);
  }
}

async function main() {
  console.log('--- Testando Headers de CORS ---');
  await testCors('BGG xmlapi2 thing', 'https://boardgamegeek.com/xmlapi2/thing?id=408180&stats=1', {
    headers: { Authorization: `Bearer ${DEFAULT_BGG_TOKEN}` }
  });

  await testCors('BGG xmlapi2 search', 'https://boardgamegeek.com/xmlapi2/search?query=Shackleton+Base', {
    headers: { Authorization: `Bearer ${DEFAULT_BGG_TOKEN}` }
  });

  await testCors('BGG geekitems JSON', 'https://boardgamegeek.com/api/geekitems?objectid=408180&objecttype=thing');

  await testCors('Compara Jogos GraphQL', 'https://api.comparajogos.com.br/v1/graphql', {
    method: 'OPTIONS'
  });

  await testCors('Compara Jogos POST', 'https://api.comparajogos.com.br/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ __typename }' })
  });
}

main();
