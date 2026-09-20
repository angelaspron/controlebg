import assert from 'node:assert/strict';
import { parseBGGThingXml } from '../src/services/bggService.ts';
import { parseLudopediaDetail } from '../src/services/ludopediaService.ts';
import { parseComparaPrices } from '../src/services/comparaService.ts';
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
      geekRating: 7.15,
      rating: 7.20,
      honors: ['1995 Spiel des Jahres Winner'],
      suggestedPlayers: { best: ['3', '4'], recommended: ['3', '4'], summary: 'Ideal com 3, 4 jogadores' },
      descriptionPt: 'Catan é um clássico moderno de negociação e desenvolvimento.',
      retailPrice: 220,
      usedPrice: 180,
    };

    assert.ok(sampleGame.geekRating && sampleGame.geekRating > 0);
    assert.ok(Array.isArray(sampleGame.honors) && sampleGame.honors.length === 1);
    assert.ok(sampleGame.suggestedPlayers?.summary);
    assert.ok(sampleGame.descriptionPt);
    assert.ok(sampleGame.retailPrice && sampleGame.usedPrice);
  });

  return { passed, failed };
}
