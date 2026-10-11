import { fetchBGGThingWithRetry, searchBGGId } from '../src/services/bggService.ts';
import { fetchComparaJogosData } from '../src/services/comparaService.ts';

async function runLiveApiTests() {
  console.log('===============================================================');
  console.log('        TESTE AO VIVO DE CONECTIVIDADE E RESPOSTA DAS APIs    ');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      console.log(`\n⏳ Testando: ${name}...`);
      const start = Date.now();
      await fn();
      const elapsed = Date.now() - start;
      console.log(`✔ [APROVADO] ${name} (${elapsed}ms)`);
      passed++;
    } catch (e) {
      console.error(`✖ [FALHOU] ${name}: ${e.message}`);
      failed++;
    }
  }

  // 1. TESTE BGG SEARCH API (BGG Search com resolução por Token / Fallback Compara)
  await check('BoardGameGeek API - searchBGGId (Busca e Identificação de Jogo)', async () => {
    const bggId = await searchBGGId('Catan');
    if (!bggId) throw new Error('Não foi possível resolver o BGG ID para "Catan"');
    if (bggId !== '13') throw new Error(`BGG ID retornado incorreto: ${bggId} (esperado 13)`);
    console.log(`   -> Resolução com sucesso: Jogo "Catan" mapeado para BGG ID ${bggId}`);
  });

  // 2. TESTE BGG THING API + PARSER (Com token Bearer e fallback JSON geekitems)
  await check('BoardGameGeek API - fetchBGGThingWithRetry (Dados, Imagens e Estatísticas)', async () => {
    const data = await fetchBGGThingWithRetry('13');
    if (!data) throw new Error('fetchBGGThingWithRetry retornou nulo para Catan (ID 13)');
    if (data.bggId !== '13') throw new Error(`BGG ID inválido: ${data.bggId}`);
    if (!data.name) throw new Error('Nome do jogo ausente');
    if (!data.minPlayers || !data.maxPlayers) throw new Error('Contagem de jogadores ausente');
    console.log(`   -> Jogo: ${data.name}`);
    console.log(`   -> Rank BGG: ${data.rank ? '#' + data.rank : 'N/D'} | Nota: ${data.rating || 'N/D'} | GeekRating: ${data.geekRating || 'N/D'}`);
    console.log(`   -> Jogadores: ${data.minPlayers}-${data.maxPlayers} | Ano: ${data.yearPublished}`);
    console.log(`   -> Mecânicas identificadas: ${data.mechanics?.length || 0}`);
    console.log(`   -> Prêmios (Honors): ${data.honors?.length || 0}`);
    console.log(`   -> Thumbnail: ${data.thumbnail ? 'OK' : 'Ausente'}`);
  });

  // 3. TESTE COMPARA JOGOS GRAPHQL API
  await check('Compara Jogos API - fetchComparaJogosData (Preços de Mercado e Varejo)', async () => {
    const prices = await fetchComparaJogosData('Catan', '13');
    if (!prices) throw new Error('Nenhum dado de preço retornado para Catan');
    if (prices.retailPrice === undefined && prices.usedPrice === undefined) {
      throw new Error('Nenhum preço de varejo ou usado foi identificado');
    }
    console.log(`   -> Preço de Varejo (Menor): R$ ${prices.retailPrice?.toFixed(2) || 'N/D'}`);
    console.log(`   -> Preço de Usados: R$ ${prices.usedPrice?.toFixed(2) || 'N/D'}`);
  });

  // 4. TESTE LUDOPEDIA API (Disponibilidade do endpoint oficial)
  await check('Ludopedia API - Endpoint /api/v1/jogos (Disponibilidade e Protocolo OAuth2)', async () => {
    const url = 'https://ludopedia.com.br/api/v1/jogos?search=Catan';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (res.status === 401 || res.status === 403) {
      console.log(`   -> Status ${res.status}: Servidor da Ludopedia online e exigindo autenticação OAuth2.`);
    } else if (res.ok) {
      const json = await res.json();
      console.log(`   -> Status 200: Sucesso com ${json.jogos?.length || 0} itens retornados.`);
    } else {
      throw new Error(`Status inesperado: ${res.status} ${res.statusText}`);
    }
  });

  console.log('\n===============================================================');
  console.log('              RESUMO DA VERIFICAÇÃO DAS APIs                   ');
  console.log('===============================================================');
  console.log(`APIs Testadas: ${passed + failed}`);
  console.log(`Aprovadas:     ${passed}`);
  console.log(`Falhas:        ${failed}`);
  console.log(`Resultado:     ${failed === 0 ? '100% OPERACIONAL [0/0]' : 'FALHA'}`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
}

runLiveApiTests().catch(err => {
  console.error('Erro na execução dos testes de API:', err);
  process.exit(1);
});
