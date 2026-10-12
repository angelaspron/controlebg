import assert from 'node:assert/strict';
import { parseBGGThingXml } from '../src/services/bggService.ts';
import { parseLudopediaDetail, parseIsPlayedFromLudo, isOwnedInLudopedia } from '../src/services/ludopediaService.ts';
import { parseComparaPrices } from '../src/services/comparaService.ts';
import { matchesGameName } from '../src/utils/nameMatcher.ts';
import type { GameData } from '../src/types/index.ts';

export async function runSmokeTests(logger: (msg: string) => void): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      logger(`  ✔ [SMOKE PASS] ${name}`);
    } catch (err: any) {
      failed++;
      logger(`  ✖ [SMOKE FAIL] ${name}: ${err.message}`);
    }
  }

  logger('\n--- [SMOKE TESTS] Caminhos Críticos do Sistema ---');

  // Smoke 1: BGG XML Parser
  test('BGG Parser: Extrai mecânicas, geekRating, honors e poll suggested_numplayers', () => {
    const mockBggXml = `
      <items>
        <item type="boardgame" id="174430">
          <thumbnail>https://cf.geekdo-images.com/thumb.jpg</thumbnail>
          <image>https://cf.geekdo-images.com/large.jpg</image>
          <name type="primary" sortindex="1" value="Gloomhaven" />
          <description>Vanquish monsters with strategic cards.&#10;&quot;Epic adventure&quot;&amp;more.</description>
          <yearpublished value="2017" />
          <minplayers value="1" />
          <maxplayers value="4" />
          <poll name="suggested_numplayers" title="User Suggested Number of Players" totalvotes="1000">
            <results numplayers="1">
              <result value="Best" numvotes="150" />
              <result value="Recommended" numvotes="300" />
              <result value="Not Recommended" numvotes="50" />
            </results>
            <results numplayers="3">
              <result value="Best" numvotes="650" />
              <result value="Recommended" numvotes="250" />
              <result value="Not Recommended" numvotes="10" />
            </results>
          </poll>
          <link type="boardgamemechanic" id="2689" value="Action Queue" />
          <link type="boardgamemechanic" id="2040" value="Hand Management" />
          <link type="boardgamecategory" id="1022" value="Adventure" />
          <link type="boardgamehonor" id="4567" value="2017 Golden Geek Board Game of the Year Winner" />
          <statistics page="1">
            <ratings>
              <average value="8.65" />
              <bayesaverage value="8.42" />
              <averageweight value="3.91" />
              <ranks>
                <rank type="subtype" id="1" name="boardgame" value="3" />
              </ranks>
            </ratings>
          </statistics>
        </item>
      </items>
    `;

    const result = parseBGGThingXml(mockBggXml);
    assert.ok(result, 'Resultado do BGG não deve ser nulo');
    assert.equal(result.bggId, '174430');
    assert.equal(result.name, 'Gloomhaven');
    assert.equal(result.rating, 8.65);
    assert.equal(result.geekRating, 8.42);
    assert.equal(result.weight, 3.91);
    assert.equal(result.rank, 3);
    assert.deepEqual(result.mechanics, ['Action Queue', 'Hand Management']);
    assert.deepEqual(result.honors, ['2017 Golden Geek Board Game of the Year Winner']);
    assert.ok(result.suggestedPlayers, 'suggestedPlayers deve existir');
    assert.ok(result.suggestedPlayers?.best.includes('3'), '3 deve ser o melhor número de jogadores');
    assert.ok(result.suggestedPlayers?.summary.includes('3'), 'Summary deve mencionar 3 jogadores');
    assert.ok(result.description?.includes('Epic adventure'), 'Descrição deve ter entidades HTML limpas');
  });

  // Smoke 2: Ludopedia Detail Parser
  test('Ludopedia Parser: Extrai nome nacional, flag de expansão e sinopse em português', () => {
    const mockLudoDetail = {
      id_jogo: 404,
      nm_jogo: "Terra Mystica: Edição Brasileira",
      tp_jogo: "b",
      ds_jogo: "<p>Construa seu império e desenvolva facções únicas no Brasil.</p>",
      imagem: "https://ludopedia.com.br/capa.jpg",
      ano_publicacao: 2013,
      qt_jogadores_min: 2,
      qt_jogadores_max: 5,
      vl_nota: 8.8,
      rank_jogo: 12,
      link_bgg: "https://boardgamegeek.com/boardgame/120643/terra-mystica"
    };

    const parsed = parseLudopediaDetail(mockLudoDetail);
    assert.equal(parsed.ludoId, '404');
    assert.equal(parsed.namePt, 'Terra Mystica: Edição Brasileira');
    assert.equal(parsed.type, 'Base');
    assert.equal(parsed.isExpansion, false);
    assert.equal(parsed.descriptionPt, 'Construa seu império e desenvolva facções únicas no Brasil.');
    assert.equal(parsed.bggId, '120643');
    assert.equal(parsed.ludoRating, 8.8);
    assert.equal(parsed.rank, 12);
    assert.equal(parsed.isPlayed, false);
  });

  // Smoke 3: Compara Jogos Parser
  test('Compara Jogos Parser: Isola estritamente menor preço de varejo e mercado de usados', () => {
    const mockComparaProduct = {
      id: 999,
      name: "Wingspan",
      prices: [
        { name: "Wingspan - Jogo Lacrado", price_to: 350.00, available: true, store: { name: "Bravo Jogos" } },
        { name: "Wingspan - Usado Estado Excelente", price_to: 270.00, available: true, store: { name: "Classificados BGG" } },
        { name: "Wingspan - Insert em MDF", price_to: 89.00, available: true, store: { name: "Bucaneiros" } }, // acessório, ignorar
        { name: "Wingspan - Indisponível", price_to: 290.00, available: false, store: { name: "Loja X" } } // indisponível, ignorar
      ],
      product_price: { min_price: 340.00 }
    };

    const prices = parseComparaPrices(mockComparaProduct);
    assert.equal(prices.retailPrice, 350.00, 'Menor preço de varejo deve ser 350.00');
    assert.equal(prices.usedPrice, 270.00, 'Estimativa de usados deve ser 270.00');
  });

  // Smoke 4: Modal Data Contract
  test('Modal Data Contract: GameData renderiza com segurança todas as novas propriedades', () => {
    const sampleGame: GameData = {
      id: 'test-1',
      name: 'Catan',
      status: 'Na Coleção',
      spend: 150,
      type: 'Base',
      value: 200,
      isPlayed: true,
      geekRating: 7.15,
      rating: 7.20,
      honors: ['1995 Spiel des Jahres Winner'],
      suggestedPlayers: { best: ['3', '4'], recommended: ['3', '4'], summary: 'Ideal com 3, 4 jogadores' },
      descriptionPt: 'Catan é um clássico moderno de negociação e desenvolvimento.',
      retailPrice: 220,
      usedPrice: 180,
    };

    assert.equal(sampleGame.isPlayed, true);
    assert.ok(sampleGame.geekRating && sampleGame.geekRating > 0);
    assert.ok(Array.isArray(sampleGame.honors) && sampleGame.honors.length === 1);
    assert.ok(sampleGame.suggestedPlayers?.summary);
    assert.ok(sampleGame.descriptionPt);
    assert.ok(sampleGame.retailPrice && sampleGame.usedPrice);
  });

  // Smoke 5: Ludopedia isPlayed Parser
  test('Ludopedia isPlayed Parser: Identifica status de jogo jogado por partidas > 0 e flags fl_jogou', () => {
    // 1. Contador qt_partidas > 0
    assert.equal(parseIsPlayedFromLudo({ qt_partidas: 3 }), true);
    assert.equal(parseIsPlayedFromLudo({ qt_partidas: "10" }), true);
    assert.equal(parseIsPlayedFromLudo({ qt_partidas: 0 }), false);

    // 2. Flags de status fl_jogou
    assert.equal(parseIsPlayedFromLudo({ fl_jogou: 1 }), true);
    assert.equal(parseIsPlayedFromLudo({ fl_jogou: "1" }), true);
    assert.equal(parseIsPlayedFromLudo({ fl_jogou: true }), true);
    assert.equal(parseIsPlayedFromLudo({ fl_jogou: 0 }), false);

    // 3. Flags fl_jogado e total_partidas
    assert.equal(parseIsPlayedFromLudo({ fl_jogado: 1 }), true);
    assert.equal(parseIsPlayedFromLudo({ total_partidas: 5 }), true);
    assert.equal(parseIsPlayedFromLudo({ partidas: [1, 2] }), true);

    // 4. Jogo sem partidas registradas
    assert.equal(parseIsPlayedFromLudo({ id_jogo: 100 }), false);
    assert.equal(parseIsPlayedFromLudo({}, { qt_partidas: 2 }), true);

    // 5. Lista de jogados oficial da Ludopedia (/colecao?lista=jogados)
    assert.equal(parseIsPlayedFromLudo({ id_jogo: 129759, _source_lista: 'jogados' }), true);
    assert.equal(parseIsPlayedFromLudo({ id_jogo: 129759, lista: 'jogados' }), true);

    // 6. Objetos aninhados retornados pela API (item, colecao, usuario)
    assert.equal(parseIsPlayedFromLudo({ colecao: { fl_jogou: 1 } }), true);
    assert.equal(parseIsPlayedFromLudo({ item: { qt_partidas: 4 } }), true);
  });

  // Smoke 6: Resolução e Correspondência Tolerante de Nomes (Caso Arnak)
  test('Nome Matcher: Resolve correspondências entre nomes nacionais, internacionais e abreviados (ex: Arnak)', () => {
    // Caso de uso relatado pelo usuário: "Arnak" vs "As Ruínas Perdidas de Arnak" vs "Lost Ruins of Arnak"
    assert.equal(matchesGameName('Arnak', 'As Ruínas Perdidas de Arnak'), true);
    assert.equal(matchesGameName('Arnak', 'Lost Ruins of Arnak'), true);
    assert.equal(matchesGameName('As Ruínas Perdidas de Arnak', 'Lost Ruins of Arnak'), true);
    assert.equal(matchesGameName('As Ruínas Perdidas de Arnak', 'Arnak'), true);

    // Proteção de segurança: Não confundir Jogo Base com Expansão
    assert.equal(matchesGameName('Arnak', 'As Ruínas Perdidas de Arnak: Líderes da Expedição (Expansão)'), false);
    assert.equal(matchesGameName('Catan', 'Catan: Navegadores (Expansão)'), false);

    // Outros jogos com variações de títulos
    assert.equal(matchesGameName('Catan', 'The Settlers of Catan'), true);
    assert.equal(matchesGameName('Terra Mystica', 'Terra Mystica: Edição Brasileira'), true);
  });

  // Smoke 7: Validação Estrita de Coleção (Ownership Check da Ludopedia)
  test('Ludopedia Ownership Check: Isola estritamente jogos da coleção e bloqueia jogos apenas jogados', () => {
    // 1. Confirmação positiva com flags na_colecao, is_owned, fl_tem
    assert.equal(isOwnedInLudopedia({ id_jogo: 101, fl_tem: 1 }), true, 'fl_tem = 1 indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 102, fl_tem: '1' }), true, 'fl_tem = "1" em string indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 103, fl_tem: true }), true, 'fl_tem = true booleano indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 104, na_colecao: 1 }), true, 'na_colecao = 1 indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 105, na_colecao: true }), true, 'na_colecao = true indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 106, is_owned: 1 }), true, 'is_owned = 1 indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 107, is_owned: true }), true, 'is_owned = true indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 108, em_colecao: true }), true, 'em_colecao = true indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 109, fl_colecao: 'S' }), true, 'fl_colecao = "S" indica posse');

    // 2. Confirmação positiva para jogos vendidos (histórico da coleção)
    assert.equal(isOwnedInLudopedia({ id_jogo: 110, fl_teve: 1 }), true, 'fl_teve = 1 indica histórico na coleção');
    assert.equal(isOwnedInLudopedia({ id_jogo: 111, _source_lista: 'colecao' }), true, 'Origem lista colecao indica posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 112, _source_lista: 'teve' }), true, 'Origem lista teve indica posse');

    // 3. Estruturas aninhadas retornadas pela API da Ludopedia
    assert.equal(isOwnedInLudopedia({ colecao: { fl_tem: 1 } }), true, 'Objeto colecao aninhado');
    assert.equal(isOwnedInLudopedia({ item: { na_colecao: true } }), true, 'Objeto item aninhado');
    assert.equal(isOwnedInLudopedia({ usuario: { is_owned: 1 } }), true, 'Objeto usuario aninhado');

    // 4. BLOQUEIO: Jogos apenas jogados, partidas ou histórico NÃO devem ser confirmados como da coleção
    assert.equal(isOwnedInLudopedia({ id_jogo: 900, fl_jogou: 1, qt_partidas: 5 }), false, 'Apenas partidas não confere posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 901, _source_lista: 'jogados', fl_jogou: 1 }), false, 'Lista jogados sem fl_tem não é da coleção');
    assert.equal(isOwnedInLudopedia({ id_jogo: 902, fl_tem: 0, fl_jogou: 1, qt_partidas: 10 }), false, 'fl_tem = 0 explícito não é posse');
    assert.equal(isOwnedInLudopedia({ id_jogo: 903, partidas: 3 }), false, 'Contador de partidas isolado');
  });

  return { passed, failed };
}
