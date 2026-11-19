import assert from 'node:assert/strict';
import { parseComparaPrices } from '../src/services/comparaService.ts';
import { parseLudopediaSleeves, parseLudopediaDetail } from '../src/services/ludopediaService.ts';
import { parseBGGSleeves } from '../src/services/bggService.ts';
import { 
  getCardSleeveSizeName, 
  formatCardSleeveDimensions, 
  computeCollectionSleeveDemands,
  matchStockToDemand,
  summarizeGameSleeves,
  parseModelDimensions,
  isGameInCollection,
  POPULAR_SLEEVE_MODELS,
  KNOWN_SLEEVE_BRANDS,
  SLEEVE_SUBTYPES,
  findCompatibleStockItems,
  calculateSleeveDeductionCandidates,
} from '../src/utils/sleeveUtils.ts';
import type { GameData, SleeveStockItem } from '../src/types/index.ts';

export async function runSleevesTests(logger: (msg: string) => void): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      logger(`  ✔ [SLEEVES PASS] ${name}`);
    } catch (err: any) {
      failed++;
      logger(`  ✖ [SLEEVES FAIL] ${name}: ${err.message}`);
    }
  }

  logger('\n--- [SLEEVES & ESTOQUE TESTS] Validação de Sleeves e Controle de Estoque ---');

  // Teste 1: Parser de Sleeves da API do Compara Jogos
  test('Compara Jogos Parser: Extrai conjuntos de sleeves com quantidades, dimensões e produtos', () => {
    const mockProduct = {
      id: 50740,
      name: "Terraforming Mars: Expedição Ares",
      slug: "terraforming-mars-expedicao-ares",
      sleeves: [
        {
          id: 11649,
          name: null,
          quantity: 240,
          width: 64.0,
          height: 89.0,
          sleeveProduct: {
            product: {
              name: "Sleeve Padrão (63,5x88mm)"
            }
          }
        },
        {
          id: 11650,
          name: "Reference Cards",
          quantity: 4,
          width: 70.0,
          height: 120.0,
          sleeveProduct: {
            product: {
              name: "Sleeve Tarot (70x120mm)"
            }
          }
        }
      ],
      prices: [
        { name: "Expedição Ares", price_to: 280, available: true, store: { name: "Bravo Jogos" } }
      ]
    };

    const parsed = parseComparaPrices(mockProduct);
    assert.ok(parsed.cardSleeves, 'cardSleeves deve ser extraído');
    assert.equal(parsed.cardSleeves?.sets.length, 2, 'Deve conter 2 conjuntos de sleeves');
    assert.equal(parsed.cardSleeves?.sets[0].quantity, 240);
    assert.equal(parsed.cardSleeves?.sets[0].width, 64);
    assert.equal(parsed.cardSleeves?.sets[0].height, 89);
    assert.equal(parsed.cardSleeves?.sets[0].sizeName, 'Padrão / Standard');
    assert.equal(parsed.cardSleeves?.sets[0].sleeveProductName, 'Sleeve Padrão (63,5x88mm)');

    assert.equal(parsed.cardSleeves?.sets[1].name, 'Reference Cards');
    assert.equal(parsed.cardSleeves?.sets[1].quantity, 4);
    assert.equal(parsed.cardSleeves?.sets[1].sizeName, 'Tarot');
    assert.equal(parsed.cardSleeves?.sourceUrl, 'https://www.comparajogos.com.br/item/terraforming-mars-expedicao-ares/50740');
  });

  // Teste 2: Dimensionamento e Nomenclatura de Padrões
  test('Sleeve Utils: Identifica corretamente nomes de tamanhos e formata milímetros', () => {
    assert.equal(getCardSleeveSizeName(63.5, 88), 'Padrão / Standard');
    assert.equal(getCardSleeveSizeName(64, 89), 'Padrão / Standard');
    assert.equal(getCardSleeveSizeName(45, 68), 'Mini Euro');
    assert.equal(getCardSleeveSizeName(41, 63), 'Mini USA');
    assert.equal(getCardSleeveSizeName(43.5, 67.5), 'Mini Chimeuro');
    assert.equal(getCardSleeveSizeName(43, 65), 'Mini Chimera');
    assert.equal(getCardSleeveSizeName(56, 87), 'Padrão USA');
    assert.equal(getCardSleeveSizeName(57.5, 89), 'Chimera');
    assert.equal(getCardSleeveSizeName(59, 92), 'Padrão Euro');
    assert.equal(getCardSleeveSizeName(61, 112), 'French Tarot');
    assert.equal(getCardSleeveSizeName(65, 100), 'Copper');
    assert.equal(getCardSleeveSizeName(70, 70), 'Quadrado');
    assert.equal(getCardSleeveSizeName(70, 110), 'Silver');
    assert.equal(getCardSleeveSizeName(70, 120), 'Tarot');
    assert.equal(getCardSleeveSizeName(80, 120), 'Gold');

    assert.equal(formatCardSleeveDimensions(63.5, 88), '63,5 x 88 mm');
    assert.equal(formatCardSleeveDimensions(70, 120), '70 x 120 mm');
  });

  // Teste 3: Cálculo de Demanda da Coleção
  test('Demanda da Coleção: Agrupa quantidades de cartas e separa pendentes de jogos já sleevados', () => {
    const mockGames: GameData[] = [
      {
        id: 'g-1',
        name: 'Jogo A',
        status: 'Na Coleção',
        spend: 100,
        type: 'Base',
        value: 150,
        isSleeved: false,
        cardSleeves: {
          sets: [
            { quantity: 100, width: 63.5, height: 88, sizeName: 'Padrão' }
          ]
        }
      },
      {
        id: 'g-2',
        name: 'Jogo B (Já Sleevado)',
        status: 'Na Coleção',
        spend: 120,
        type: 'Base',
        value: 180,
        isSleeved: true,
        sleeveBrand: 'Bucaneiros',
        cardSleeves: {
          sets: [
            { quantity: 50, width: 63.5, height: 88, sizeName: 'Padrão' },
            { quantity: 20, width: 45, height: 68, sizeName: 'Mini Euro' }
          ]
        }
      }
    ];

    const demands = computeCollectionSleeveDemands(mockGames);
    assert.equal(demands.length, 2);

    const padraoDemand = demands.find(d => d.modelName === 'Padrão');
    assert.ok(padraoDemand, 'Demanda Padrão deve existir');
    assert.equal(padraoDemand?.totalCards, 150, 'Total de cartas deve ser 100 + 50 = 150');
    assert.equal(padraoDemand?.neededCards, 100, 'Apenas o Jogo A precisa de sleeves (100 pendentes)');
    assert.equal(padraoDemand?.games.length, 2);

    const miniEuroDemand = demands.find(d => d.modelName === 'Mini Euro');
    assert.ok(miniEuroDemand, 'Demanda Mini Euro deve existir');
    assert.equal(miniEuroDemand?.totalCards, 20);
    assert.equal(miniEuroDemand?.neededCards, 0, 'Jogo B está sleevado, 0 pendentes');
  });

  // Teste 4: Correspondência entre Estoque e Demanda
  test('Estoque vs Demanda: Associa modelo do estoque à necessidade da coleção', () => {
    const mockStockItem: SleeveStockItem = {
      id: 's-1',
      model: 'Padrão (63,5 × 88 mm)',
      brand: 'Bucaneiros',
      quantity: 200,
      type: 'Premium'
    };

    const mockDemands = [
      {
        key: '63.5x88',
        modelName: 'Padrão',
        dimensions: '63,5 × 88 mm',
        width: 63.5,
        height: 88,
        totalCards: 150,
        neededCards: 100,
        games: []
      }
    ];

    const matched = matchStockToDemand(mockStockItem, mockDemands);
    assert.ok(matched, 'Deve corresponder ao modelo Padrão');
    assert.equal(matched?.modelName, 'Padrão');
  });

  // Teste 5: Ajuste de Quantidade de Estoque
  test('Controle de Estoque: Ajustes de quantidade e restrição contra valores negativos', () => {
    let item: SleeveStockItem = {
      id: 's-1',
      model: 'Mini Euro (45 × 68 mm)',
      brand: 'Gamegenic',
      quantity: 110,
    };

    // Adição de pacote
    item = { ...item, quantity: item.quantity + 100 };
    assert.equal(item.quantity, 210);

    // Redução controlada
    item = { ...item, quantity: Math.max(0, item.quantity - 50) };
    assert.equal(item.quantity, 160);

    // Tentativa de reduzir abaixo de zero
    item = { ...item, quantity: Math.max(0, item.quantity - 300) };
    assert.equal(item.quantity, 0, 'Quantidade não deve ficar negativa');
  });

  // Teste 6: Múltiplos Tipos e Marcas de Sleeves por Jogo
  test('Múltiplos Sleeves por Jogo: Suporta diferentes tipos e marcas no mesmo título', () => {
    const multiSleeveGame: GameData = {
      id: 'g-multi',
      name: 'Terraforming Mars: Ares Expedition',
      status: 'Na Coleção',
      spend: 250,
      type: 'Base',
      value: 280,
      cardSleeves: {
        sets: [
          {
            name: 'Corporações e Projetos',
            quantity: 208,
            width: 63.5,
            height: 88,
            sizeName: 'Padrão',
            isSleeved: true,
            sleeveBrand: 'Bucaneiros',
            sleeveType: 'Premium',
          },
          {
            name: 'Cartas de Referência',
            quantity: 4,
            width: 70,
            height: 120,
            sizeName: 'Tarot',
            isSleeved: true,
            sleeveBrand: 'Gamegenic',
            sleeveType: 'Matte',
          }
        ]
      }
    };

    const summary = summarizeGameSleeves(multiSleeveGame.cardSleeves!.sets);
    assert.equal(summary.isSleeved, true);
    assert.ok(summary.sleeveBrand.includes('Bucaneiros'));
    assert.ok(summary.sleeveBrand.includes('Gamegenic'));
    assert.ok(summary.sleeveType.includes('Premium'));
    assert.ok(summary.sleeveType.includes('Matte'));

    const demands = computeCollectionSleeveDemands([multiSleeveGame]);
    assert.equal(demands.length, 2);
    const padraoDemand = demands.find(d => d.modelName === 'Padrão');
    const tarotDemand = demands.find(d => d.modelName === 'Tarot');
    assert.equal(padraoDemand?.neededCards, 0, 'Ambos os tipos estão sleevados');
    assert.equal(tarotDemand?.neededCards, 0);
  });

  // Teste 7: Sleevagem Parcial (um tipo sleevado, outro pendente)
  test('Sleevagem Parcial: Computa demanda apenas para os tipos ainda não sleevados', () => {
    const partialGame: GameData = {
      id: 'g-partial',
      name: 'Dune: Imperium',
      status: 'Na Coleção',
      spend: 300,
      type: 'Base',
      value: 350,
      cardSleeves: {
        sets: [
          {
            name: 'Deck Principal',
            quantity: 162,
            width: 63.5,
            height: 88,
            sizeName: 'Padrão',
            isSleeved: true,
            sleeveBrand: 'MeepleBR',
            sleeveType: 'Padrão',
          },
          {
            name: 'Líderes',
            quantity: 8,
            width: 70,
            height: 120,
            sizeName: 'Tarot',
            isSleeved: false,
          }
        ]
      }
    };

    const demands = computeCollectionSleeveDemands([partialGame]);
    const padraoDemand = demands.find(d => d.modelName === 'Padrão');
    const tarotDemand = demands.find(d => d.modelName === 'Tarot');
    assert.equal(padraoDemand?.neededCards, 0, 'Deck principal está 100% sleevado');
    assert.equal(tarotDemand?.neededCards, 8, '8 cartas de Líderes ainda precisam de sleeves');
  });

  // Teste 8: Parser de Modelos Populares e Inserção Manual
  test('Parser de Modelos: Extrai dimensões e nome para modelos padrão e inseridos manualmente', () => {
    const padrao = parseModelDimensions('Padrão (63,5 × 88 mm)');
    assert.equal(padrao.width, 63.5);
    assert.equal(padrao.height, 88);
    assert.equal(padrao.sizeName, 'Padrão');

    const miniEuro = parseModelDimensions('Mini Euro (45 × 68 mm)');
    assert.equal(miniEuro.width, 45);
    assert.equal(miniEuro.height, 68);
    assert.equal(miniEuro.sizeName, 'Mini Euro');

    // Modelos manuais/personalizados fora do padrão
    const custom1 = parseModelDimensions('Quadrado Especial (70 × 70 mm)');
    assert.equal(custom1.width, 70);
    assert.equal(custom1.height, 70);
    assert.equal(custom1.sizeName, 'Quadrado Especial');

    const custom2 = parseModelDimensions('75x105');
    assert.equal(custom2.width, 75);
    assert.equal(custom2.height, 105);
    assert.equal(custom2.sizeName, '75 x 105 mm');

    const custom3 = parseModelDimensions('Customizado Livre');
    assert.equal(custom3.sizeName, 'Customizado Livre');
  });

  // Teste 9: Demanda e Estoque com Modelo / Tamanho Inserido Manualmente
  test('Inserção Manual: Jogo com sleeve customizado gera demanda correta e conecta ao estoque', () => {
    const customGame: GameData = {
      id: 'g-custom-sleeve',
      name: 'Jogo com Cartas Quadradas Customizadas',
      status: 'Na Coleção',
      spend: 180,
      type: 'Base',
      value: 200,
      cardSleeves: {
        sets: [
          {
            name: 'Tiles Quadrados',
            quantity: 60,
            width: 70,
            height: 70,
            sizeName: 'Quadrado (70 × 70 mm)',
            isSleeved: false,
          }
        ]
      }
    };

    const demands = computeCollectionSleeveDemands([customGame]);
    assert.equal(demands.length, 1);
    assert.equal(demands[0].width, 70);
    assert.equal(demands[0].height, 70);
    assert.equal(demands[0].neededCards, 60);

    const stockItem: SleeveStockItem = {
      id: 'st-custom',
      model: 'Quadrado (70 × 70 mm)',
      brand: 'Bucaneiros',
      quantity: 110,
    };

    const matched = matchStockToDemand(stockItem, demands);
    assert.ok(matched, 'Estoque deve associar perfeitamente ao modelo manual');
    assert.equal(matched?.totalCards, 60);
  });

  // Teste 10: Arredondamento Estrito do Peso BGG (2 casas decimais)
  test('BGG Weight: Garante formatação com estritamente até 2 casas decimais', () => {
    const roundWeight = (raw: number) => Math.round(raw * 100) / 100;
    assert.equal(roundWeight(3.9142), 3.91);
    assert.equal(roundWeight(2.8000), 2.8);
    assert.equal(roundWeight(4.5678), 4.57);
    assert.equal(roundWeight(1.2345), 1.23);
    assert.equal(roundWeight(3.9999), 4);
  });

  // Teste 11: Resolução de BGG ID e múltiplos tipos de sleeves no parser Compara Jogos
  test('Compara Jogos Parser: Extrai bggId vinculado e preserva todos os tipos de sleeves', () => {
    const mockProductWithBgg = {
      id: 36125,
      bgg_id: 312484,
      name: "As Ruínas Perdidas de Arnak",
      slug: "as-ruinas-perdidas-de-arnak",
      sleeves: [
        {
          id: 340,
          name: "Cartas de Itens e Artefatos",
          quantity: 110,
          width: 63.0,
          height: 88.0,
          sleeveProduct: { product: { name: "Sleeve Padrão (63,5x88mm)" } }
        },
        {
          id: 341,
          name: "Pranchas de Líderes / Especial",
          quantity: 4,
          width: 115.0,
          height: 160.0,
          sleeveProduct: null
        }
      ],
      prices: []
    };

    const parsed = parseComparaPrices(mockProductWithBgg);
    assert.equal(parsed.bggId, '312484', 'BGG ID deve ser extraído do produto');
    assert.equal(parsed.comparaId, 36125);
    assert.equal(parsed.cardSleeves?.sets.length, 2);
    assert.equal(parsed.cardSleeves?.sets[0].quantity, 110);
    assert.equal(parsed.cardSleeves?.sets[0].sizeName, 'Padrão / Standard');
    assert.equal(parsed.cardSleeves?.sets[1].quantity, 4);
    assert.equal(parsed.cardSleeves?.sets[1].sizeName, 'Especial');
  });

  // Teste 12: Canonicalização de dimensões equivalentes para agrupamento
  test('Demanda da Coleção: Agrupa dimensões equivalentes (ex: 64x89mm e 63,5x88mm) no mesmo modelo padrão', () => {
    const games: GameData[] = [
      {
        id: 'g-arnak',
        name: 'Arnak',
        status: 'Na Coleção',
        spend: 250,
        type: 'Base',
        value: 280,
        cardSleeves: {
          sets: [{ quantity: 110, width: 63, height: 88, sizeName: 'Padrão' }]
        }
      },
      {
        id: 'g-ares',
        name: 'Terraforming Mars Ares',
        status: 'Na Coleção',
        spend: 200,
        type: 'Base',
        value: 220,
        cardSleeves: {
          sets: [{ quantity: 240, width: 64, height: 89, sizeName: 'Padrão' }]
        }
      }
    ];

    const demands = computeCollectionSleeveDemands(games);
    assert.equal(demands.length, 1, 'Deve agrupar ambos os jogos no modelo canônico Padrão');
    assert.equal(demands[0].modelName, 'Padrão');
    assert.equal(demands[0].totalCards, 350, '110 + 240 = 350 cartas');
    assert.equal(demands[0].games.length, 2);
  });

  // Teste 13: Consolidação da quantidade de sleeves por tipo por jogo
  test('Sleeves por Jogo: Apura a quantidade exata de cada tipo para exibição individual', () => {
    const game: GameData = {
      id: 'g-dune',
      name: 'Dune: Imperium',
      status: 'Na Coleção',
      spend: 320,
      type: 'Base',
      value: 360,
      cardSleeves: {
        sets: [
          { name: 'Deck Principal', quantity: 162, width: 63.5, height: 88, sizeName: 'Padrão', isSleeved: true },
          { name: 'Líderes', quantity: 8, width: 70, height: 120, sizeName: 'Tarot', isSleeved: false },
          { name: 'Mini Intriga', quantity: 44, width: 45, height: 68, sizeName: 'Mini Euro', isSleeved: false }
        ]
      }
    };

    const sets = game.cardSleeves?.sets || [];
    const totalCards = sets.reduce((sum, s) => sum + s.quantity, 0);
    assert.equal(totalCards, 214, 'Total de cartas deve ser 162 + 8 + 44 = 214');

    const padraoSet = sets.find(s => s.sizeName === 'Padrão');
    const tarotSet = sets.find(s => s.sizeName === 'Tarot');
    const miniEuroSet = sets.find(s => s.sizeName === 'Mini Euro');

    assert.equal(padraoSet?.quantity, 162);
    assert.equal(padraoSet?.isSleeved, true);
    assert.equal(tarotSet?.quantity, 8);
    assert.equal(tarotSet?.isSleeved, false);
    assert.equal(miniEuroSet?.quantity, 44);
    assert.equal(miniEuroSet?.isSleeved, false);
  });

  // Teste 14: Parser de Sleeves da Ludopedia (Array Estruturado e Texto)
  test('Ludopedia Parser: Extrai sleeves estruturados e texto de descrição como contingência', () => {
    // Caso 1: Array estruturado da Ludopedia
    const ludoStructured = {
      id_jogo: 129759,
      nm_jogo: 'As Ruínas Perdidas de Arnak',
      sleeves: [
        { qt_cartas: 110, largura: 63.5, altura: 88, nm_tamanho: 'Padrão' },
        { qt_cartas: 4, largura: 115, altura: 160, nm_tamanho: 'Especial' }
      ]
    };

    const parsed1 = parseLudopediaSleeves(ludoStructured);
    assert.ok(parsed1, 'Deve extrair sleeves da Ludopedia');
    assert.equal(parsed1.source, 'Ludopedia');
    assert.equal(parsed1.sourceUrl, 'https://ludopedia.com.br/jogo/129759');
    assert.equal(parsed1.sets.length, 2);
    assert.equal(parsed1.sets[0].quantity, 110);
    assert.equal(parsed1.sets[0].sizeName, 'Padrão');
    assert.equal(parsed1.sets[1].quantity, 4);

    // Caso 2: Texto em ds_jogo
    const ludoText = {
      id_jogo: 50740,
      nm_jogo: 'Ares Expedition',
      ds_jogo: 'Componentes: 208 cartas (63,5 x 88 mm) e 4 cartas (70 x 120 mm) de auxílio.'
    };

    const parsed2 = parseLudopediaSleeves(ludoText);
    assert.ok(parsed2, 'Deve extrair sleeves do texto da Ludopedia');
    assert.equal(parsed2.sets.length, 2);
    assert.equal(parsed2.sets[0].quantity, 208);
    assert.equal(parsed2.sets[0].sizeName, 'Padrão / Standard');
    assert.equal(parsed2.sets[1].quantity, 4);
    assert.equal(parsed2.sets[1].sizeName, 'Tarot');
  });

  // Teste 15: Fallback Secundário Ludopedia quando Compara Jogos não tem dados
  test('Fallback Secundário Ludopedia: Alimenta demanda da coleção quando Compara Jogos não tem cadastro', () => {
    // Jogo que não veio com sleeves do Compara Jogos (retornou sets vazio ou nulo)
    const rawLudoDetail = {
      id_jogo: 7777,
      nm_jogo: 'Jogo Exclusivo Nacional',
      cartas: [
        { qt_cartas: 80, largura: 45, altura: 68, nm_tamanho: 'Mini Euro' }
      ]
    };

    const ludoParsed = parseLudopediaDetail(rawLudoDetail);
    assert.ok(ludoParsed.cardSleeves, 'cardSleeves deve ser extraído pela Ludopedia');
    assert.equal(ludoParsed.cardSleeves?.source, 'Ludopedia');
    assert.equal(ludoParsed.cardSleeves?.sets[0].quantity, 80);

    const gameWithLudoSleeves: GameData = {
      id: 'g-ludo-exclusive',
      name: 'Jogo Exclusivo Nacional',
      status: 'Na Coleção',
      spend: 150,
      type: 'Base',
      value: 170,
      cardSleeves: ludoParsed.cardSleeves
    };

    const demands = computeCollectionSleeveDemands([gameWithLudoSleeves]);
    assert.equal(demands.length, 1);
    assert.equal(demands[0].modelName, 'Mini Euro');
    assert.equal(demands[0].totalCards, 80);
    assert.equal(demands[0].neededCards, 80);
  });

  // Teste 16: Parser de Sleeves do BoardGameGeek (BGG Wiki e Descrição)
  test('BGG Parser: Extrai sleeves e dimensões da Wiki e Descrição do BGG em múltiplos padrões', () => {
    // Caso 1: Formato clássico Wiki BGG "233 cards / Standard"
    const text1 = '<strong>Cards/Sleeves:</strong><ul><li> 233 cards / Standard</li></ul>';
    const parsed1 = parseBGGSleeves(text1, '167791');
    assert.ok(parsed1, 'Deve extrair sleeves da wiki do BGG');
    assert.equal(parsed1.source, 'BoardGameGeek');
    assert.equal(parsed1.sourceUrl, 'https://boardgamegeek.com/boardgame/167791');
    assert.equal(parsed1.sets.length, 1);
    assert.equal(parsed1.sets[0].quantity, 233);
    assert.equal(parsed1.sets[0].sizeName, 'Padrão / Standard');

    // Caso 2: Formato com @ e dimensão "157 cards @ 65mm X 100mm"
    const text2 = 'Cards/Sleeves: 157 cards @ 65mm X 100mm / Card_Sleeves_-_65x100';
    const parsed2 = parseBGGSleeves(text2, '68448');
    assert.ok(parsed2);
    assert.equal(parsed2.sets.length, 1);
    assert.equal(parsed2.sets[0].quantity, 157);
    assert.equal(parsed2.sets[0].sizeName, 'Copper');

    // Caso 3: Múltiplos conjuntos de cartas consolidados com mesma dimensão
    const text3 = '170 unique bird cards (57x87mm) and 26 bonus cards (57x87mm)';
    const parsed3 = parseBGGSleeves(text3, '266192');
    assert.ok(parsed3);
    assert.equal(parsed3.sets.length, 1);
    assert.equal(parsed3.sets[0].quantity, 196, '170 + 26 = 196 cartas somadas na mesma dimensão');
    assert.equal(parsed3.sets[0].width, 57);
    assert.equal(parsed3.sets[0].height, 87);

    // Caso 4: Dimensão antecedendo quantidade "(70 x 70mm) for 40 cards, (45 x 68 mm) for 200 cards"
    const text4 = 'Card Sleeves: (70 x 70mm) for 40 cards and (45 x 68 mm) for 200 cards';
    const parsed4 = parseBGGSleeves(text4, '178900');
    assert.ok(parsed4);
    assert.equal(parsed4.sets.length, 2);
    const sqSet = parsed4.sets.find(s => s.width === 70 && s.height === 70);
    const meSet = parsed4.sets.find(s => s.width === 45 && s.height === 68);
    assert.equal(sqSet?.quantity, 40);
    assert.equal(meSet?.quantity, 200);

    // Caso 5: Sleeves múltiplos com @ (ex: Scythe)
    const text5 = 'Sleeves 50 @ 70 x 110mm 54 @ 57 x 87mm 42 @ 44 X 67mm';
    const parsed5 = parseBGGSleeves(text5, '169786');
    assert.ok(parsed5);
    assert.equal(parsed5.sets.length, 3);
  });

  // Teste 17: Fallback Terciário BGG quando Compara Jogos e Ludopedia não possuem dados
  test('Fallback Terciário BGG: Alimenta demanda da coleção quando Compara Jogos e Ludopedia não possuem dados', () => {
    // Jogo internacional ou sem cadastro de sleeves no Compara Jogos e sem cadastro na Ludopedia
    const bggWikiSnippet = 'Contents: 233 cards / Standard';
    const bggParsedSleeves = parseBGGSleeves(bggWikiSnippet, '167791');

    assert.ok(bggParsedSleeves, 'Deve extrair sleeves do BGG');
    assert.equal(bggParsedSleeves.source, 'BoardGameGeek');
    assert.equal(bggParsedSleeves.sourceUrl, 'https://boardgamegeek.com/boardgame/167791');

    const gameWithBggSleeves: GameData = {
      id: 'g-bgg-tertiary',
      name: 'Terraforming Mars (Importado)',
      bggId: '167791',
      status: 'Na Coleção',
      spend: 300,
      type: 'Base',
      value: 350,
      cardSleeves: bggParsedSleeves
    };

    const demands = computeCollectionSleeveDemands([gameWithBggSleeves]);
    assert.equal(demands.length, 1);
    assert.equal(demands[0].modelName, 'Padrão / Standard');
    assert.equal(demands[0].totalCards, 233);
    assert.equal(demands[0].neededCards, 233);

    // Associação com estoque existente
    const stock: SleeveStockItem[] = [
      { id: 'stk-1', model: 'Padrão (63,5 × 88 mm)', brand: 'Bucaneiros', quantity: 200 }
    ];

    const matched = matchStockToDemand(stock[0], demands);
    assert.ok(matched, 'Estoque padrão deve associar à demanda obtida via BGG');
    assert.equal(matched?.neededCards, 233);
  });

  // Teste 18: Filtro Estrito da Coleção: Isola estritamente jogos na coleção e exclui jogos vendidos (status Vendido ou soldValue > 0)
  test('Filtro Estrito da Coleção: Isola estritamente jogos na coleção e exclui jogos vendidos (status Vendido ou soldValue > 0) das necessidades de sleeves', () => {
    const inCollectionGame: GameData = {
      id: 'g-owned-1',
      name: 'Wingspan (Coleção)',
      status: 'Coleção',
      spend: 300,
      type: 'Base',
      value: 350,
      cardSleeves: {
        source: 'Compara Jogos',
        sets: [{ quantity: 170, width: 57, height: 87, sizeName: 'USA Chimera' }]
      }
    };

    const soldGame: GameData = {
      id: 'g-sold-1',
      name: 'Everdell (Vendido)',
      status: 'Vendido',
      spend: 250,
      type: 'Base',
      value: 200,
      soldValue: 280,
      cardSleeves: {
        source: 'Compara Jogos',
        sets: [{ quantity: 150, width: 63.5, height: 88, sizeName: 'Padrão' }]
      }
    };

    const soldWithColStatusGame: GameData = {
      id: 'g-sold-2',
      name: 'Catan (Vendido com valor preenchido)',
      status: 'Na Coleção',
      spend: 150,
      type: 'Base',
      value: 150,
      soldValue: 'R$ 200,00', // Tem valor vendido em formato string R$ -> Não pertence mais à coleção
      cardSleeves: {
        source: 'Compara Jogos',
        sets: [{ quantity: 120, width: 54, height: 80, sizeName: 'Mini Euro' }]
      }
    };

    const soldByTagGame: GameData = {
      id: 'g-sold-3',
      name: 'Ticket to Ride (Tag VENDIDOS)',
      status: 'Na Coleção',
      spend: 200,
      type: 'Base',
      value: 200,
      cardSleeves: {
        source: 'Compara Jogos',
        sets: [{ quantity: 110, width: 57, height: 87, sizeName: 'USA Chimera' }]
      },
      ...({ tag: 'VENDIDOS' } as any)
    };

    const soldByStatusPluralGame: GameData = {
      id: 'g-sold-4',
      name: 'Azul (Status VENDIDOS)',
      status: 'VENDIDOS',
      spend: 180,
      type: 'Base',
      value: 180,
      cardSleeves: {
        source: 'Compara Jogos',
        sets: [{ quantity: 100, width: 63.5, height: 88, sizeName: 'Padrão' }]
      }
    };

    const wishlistGame: GameData = {
      id: 'g-wish-1',
      name: 'Dune: Imperium (Lista de Desejos)',
      status: 'Desejo',
      spend: 0,
      type: 'Base',
      value: 400,
      cardSleeves: {
        source: 'Compara Jogos',
        sets: [{ quantity: 160, width: 63.5, height: 88, sizeName: 'Padrão' }]
      }
    };

    // Validação de isGameInCollection individualmente
    assert.equal(isGameInCollection(inCollectionGame), true, 'Jogo com status Coleção deve ser identificado na coleção');
    assert.equal(isGameInCollection(soldGame), false, 'Jogo com status Vendido não deve constar na coleção');
    assert.equal(isGameInCollection(soldWithColStatusGame), false, 'Jogo com soldValue formatado em moeda não deve constar na coleção');
    assert.equal(isGameInCollection(soldByTagGame), false, 'Jogo com tag VENDIDOS não deve constar na coleção de sleeves');
    assert.equal(isGameInCollection(soldByStatusPluralGame), false, 'Jogo com status VENDIDOS não deve constar na coleção de sleeves');
    assert.equal(isGameInCollection(wishlistGame), false, 'Jogo em lista de desejos não deve constar na coleção');

    // Validação na apuração agregada de demanda de sleeves
    const demands = computeCollectionSleeveDemands([
      inCollectionGame,
      soldGame,
      soldWithColStatusGame,
      soldByTagGame,
      soldByStatusPluralGame,
      wishlistGame
    ]);

    // Deve conter única e exclusivamente o sleeve de Wingspan (USA Chimera)
    assert.equal(demands.length, 1, 'Deve computar demanda estritamente para jogos presentes na coleção');
    assert.equal(demands[0].modelName, 'USA Chimera');
    assert.equal(demands[0].totalCards, 170);
    assert.equal(demands[0].games.length, 1);
    assert.equal(demands[0].games[0].name, 'Wingspan (Coleção)');
  });

  // Teste 19: Inserção e Alteração Manual de Sleeves
  test('Inserção e Alteração Manual de Sleeves: Permite definir e sobrescrever sleeves com origem Manual', () => {
    // Jogo inicialmente sem sleeves ou com sleeve que o usuário deseja corrigir manualmente
    const initialGame: GameData = {
      id: 'g-manual-1',
      name: 'Jogo Com Sleeves Manuais',
      status: 'Tenho',
      spend: 200,
      type: 'Base',
      value: 200,
    };

    // O usuário edita os sleeves manualmente definindo 2 tipos diferentes
    const manualCardSleeves = {
      source: 'Manual' as const,
      sets: [
        {
          name: 'Cartas de Personagem',
          quantity: 80,
          width: 70,
          height: 120,
          sizeName: 'Tarot',
          isSleeved: false
        },
        {
          name: 'Cartas Pequenas de Recursos',
          quantity: 45,
          width: 41,
          height: 63,
          sizeName: 'Mini USA',
          isSleeved: true // já sleevado
        }
      ]
    };

    const updatedGame: GameData = {
      ...initialGame,
      cardSleeves: manualCardSleeves
    };

    assert.equal(updatedGame.cardSleeves?.source, 'Manual');
    assert.equal(updatedGame.cardSleeves?.sets.length, 2);

    const demands = computeCollectionSleeveDemands([updatedGame]);
    assert.equal(demands.length, 2, 'Deve gerar demandas para ambos os modelos manuais');

    const tarotDemand = demands.find(d => d.modelName === 'Tarot');
    assert.ok(tarotDemand, 'Demanda Tarot deve existir');
    assert.equal(tarotDemand?.totalCards, 80);
    assert.equal(tarotDemand?.neededCards, 80, 'Cartas de Tarot não sleevadas devem estar pendentes');

    const miniUsaDemand = demands.find(d => d.modelName === 'Mini USA');
    assert.ok(miniUsaDemand, 'Demanda Mini USA deve existir');
    assert.equal(miniUsaDemand?.totalCards, 45);
    assert.equal(miniUsaDemand?.neededCards, 0, 'Cartas de Mini USA marcadas como sleevadas não devem estar pendentes');

    // Resumo de sleeves por jogo
    const summary = summarizeGameSleeves(updatedGame.cardSleeves?.sets || []);
    assert.equal(summary.isSleeved, true, 'Como pelo menos um conjunto está sleevado, flag geral isSleeved é verdadeira');
    const sets = updatedGame.cardSleeves?.sets || [];
    const totalCards = sets.reduce((sum, s) => sum + s.quantity, 0);
    const sleevedCards = sets.filter(s => s.isSleeved).reduce((sum, s) => sum + s.quantity, 0);
    const pendingCards = totalCards - sleevedCards;
    assert.equal(totalCards, 125);
    assert.equal(sleevedCards, 45);
    assert.equal(pendingCards, 80);
  });

  // Teste 20: Jogo sem Cartas (Opção "Não possui cartas")
  test('Opção Jogo Não Possui Cartas: Exclui jogo das demandas e zera cartas necessárias', () => {
    const hiveGame: GameData = {
      id: 'hive-1',
      name: 'Hive Pocket',
      status: 'Na Coleção',
      spend: 120,
      type: 'Base',
      value: 140,
      noCards: true,
      cardSleeves: {
        source: 'Manual',
        sets: []
      }
    };

    const azulGame: GameData = {
      id: 'azul-1',
      name: 'Azul',
      status: 'Na Coleção',
      spend: 250,
      type: 'Base',
      value: 280,
      noCards: true
    };

    const catanGame: GameData = {
      id: 'catan-1',
      name: 'Catan',
      status: 'Na Coleção',
      spend: 200,
      type: 'Base',
      value: 220,
      noCards: false,
      cardSleeves: {
        source: 'Compara Jogos',
        sets: [
          {
            quantity: 120,
            width: 54,
            height: 80,
            sizeName: 'Yucatan',
            isSleeved: false
          }
        ]
      }
    };

    // Coleção com 2 jogos sem cartas e 1 jogo com cartas
    const demands = computeCollectionSleeveDemands([hiveGame, azulGame, catanGame]);
    assert.equal(demands.length, 1, 'Apenas o jogo com cartas (Catan) deve gerar demandas');
    assert.equal(demands[0].modelName, 'Yucatan');
    assert.equal(demands[0].totalCards, 120);
    assert.equal(demands[0].neededCards, 120);

    // Coleção contendo exclusivamente jogos sem cartas
    const noCardsDemands = computeCollectionSleeveDemands([hiveGame, azulGame]);
    assert.equal(noCardsDemands.length, 0, 'Jogos marcados sem cartas não geram nenhuma demanda');

    // Jogo com cardSleeves prévio que é marcado como noCards: true
    const carcassonneWithResidual: GameData = {
      id: 'carcassonne-1',
      name: 'Carcassonne',
      status: 'Na Coleção',
      spend: 180,
      type: 'Base',
      value: 200,
      noCards: true, // Usuário configurou que o jogo não possui cartas (apenas tiles)
      cardSleeves: {
        source: 'BGG',
        sets: [
          {
            quantity: 72,
            width: 63.5,
            height: 88,
            sizeName: 'Padrão',
            isSleeved: false
          }
        ]
      }
    };

    const residualDemands = computeCollectionSleeveDemands([carcassonneWithResidual]);
    assert.equal(residualDemands.length, 0, 'Mesmo se houver sets prévios de API, a flag noCards tem precedência estrita');
  });

  // Teste 21: Lista Estrita de 16 Tipos, 9 Marcas e 3 Subtipos (Normal, Premium, Slim)
  test('Tipos, Marcas e Subtipos: Valida estritamente a lista de 16 modelos, 9 marcas e 3 subtipos', () => {
    // 1. Validar 16 tipos
    const expectedModels = [
      'Mini USA (41 x 63 mm)',
      'Mini Chimeuro (43,5 x 67,5 mm)',
      'Mini Chimera (43 x 65 mm)',
      'Mini Euro (45 x 68 mm)',
      'Padrão USA (56 x 87 mm)',
      'Chimera (57,5 x 89 mm)',
      'Padrão Euro (59 x 92 mm)',
      'French Tarot (61 x 112 mm)',
      'Padrão / Standard (63,5 x 88 mm)',
      'Padrão Premium (63,5 x 88 mm - mais espesso)',
      'Padrão Fit / Shield Perfect Size (ajuste justo)',
      'Copper (65 x 100 mm)',
      'Quadrado (70 x 70 mm)',
      'Silver (70 x 110 mm)',
      'Tarot (70 x 120 mm)',
      'Gold (80 x 120 mm)',
    ];
    assert.equal(POPULAR_SLEEVE_MODELS.length, 16, 'Deve conter exatamente 16 tipos de sleeves');
    assert.deepEqual([...POPULAR_SLEEVE_MODELS], expectedModels);

    // 2. Validar 9 marcas
    const expectedBrands = [
      'Bucaneiros',
      'Meeple Virus',
      'Meeple BR',
      'Mayday',
      'Dragon Shield',
      'Sleeve Kings',
      'Central',
      'Mosaico',
      'Jelly Monster',
    ];
    assert.equal(KNOWN_SLEEVE_BRANDS.length, 9, 'Deve conter exatamente 9 marcas de sleeves');
    assert.deepEqual([...KNOWN_SLEEVE_BRANDS], expectedBrands);

    // 3. Validar 3 subtipos (Normal, Premium, Slim)
    const expectedSubtypes = ['Normal', 'Premium', 'Slim'];
    assert.equal(SLEEVE_SUBTYPES.length, 3, 'Deve conter exatamente 3 subtipos');
    assert.deepEqual([...SLEEVE_SUBTYPES], expectedSubtypes);

    // 4. Parser dos modelos especiais sem dimensões numéricas no título
    const parsedFit = parseModelDimensions('Padrão Fit / Shield Perfect Size (ajuste justo)');
    assert.equal(parsedFit.width, 63.5);
    assert.equal(parsedFit.height, 88);
    assert.equal(parsedFit.sizeName, 'Padrão Fit / Shield Perfect Size');

    const parsedPremium = parseModelDimensions('Padrão Premium (63,5 x 88 mm - mais espesso)');
    assert.equal(parsedPremium.width, 63.5);
    assert.equal(parsedPremium.height, 88);
    assert.equal(parsedPremium.sizeName, 'Padrão Premium');

    const parsedGold = parseModelDimensions('Gold (80 x 120 mm)');
    assert.equal(parsedGold.width, 80);
    assert.equal(parsedGold.height, 120);
    assert.equal(parsedGold.sizeName, 'Gold');

    // 5. Múltiplos conjuntos com marca e subtipo
    const sets = [
      {
        name: 'Cartas Principais',
        quantity: 100,
        width: 63.5,
        height: 88,
        sizeName: 'Padrão / Standard',
        isSleeved: true,
        sleeveBrand: 'Bucaneiros',
        sleeveType: 'Normal',
      },
      {
        name: 'Cartas Especiais',
        quantity: 20,
        width: 70,
        height: 120,
        sizeName: 'Tarot',
        isSleeved: true,
        sleeveBrand: 'Dragon Shield',
        sleeveType: 'Premium',
      }
    ];

    const summary = summarizeGameSleeves(sets);
    assert.equal(summary.isSleeved, true);
    assert.equal(summary.sleeveBrand, 'Bucaneiros, Dragon Shield');
    assert.equal(summary.sleeveType, 'Normal, Premium');
  });

  // Teste 22: Correspondência de Estoque (findCompatibleStockItems)
  test('Estoque: findCompatibleStockItems identifica tamanhos equivalentes e pontua marca/tipo', () => {
    const stock: SleeveStockItem[] = [
      { id: 's1', brand: 'Bucaneiros', model: 'Padrão / Standard (63,5 x 88 mm)', quantity: 200, type: 'Normal' },
      { id: 's2', brand: 'Gamegenic', model: 'Padrão (64 x 89 mm)', quantity: 100, type: 'Premium' },
      { id: 's3', brand: 'Mayday', model: 'Mini Euro (45 x 68 mm)', quantity: 50, type: 'Normal' },
    ];

    // Busca por manga Padrão com marca Bucaneiros
    const matchesBuc = findCompatibleStockItems(
      { width: 63.5, height: 88, sizeName: 'Padrão', sleeveBrand: 'Bucaneiros', sleeveType: 'Normal', quantity: 100 },
      stock
    );

    assert.equal(matchesBuc.length, 2, 'Deve encontrar 2 itens compatíveis com Padrão');
    assert.equal(matchesBuc[0].item.id, 's1', 'Bucaneiros deve ser o primeiro por bater marca e tipo');
    assert.equal(matchesBuc[1].item.id, 's2', 'Gamegenic Padrão 64x89mm deve ser aceito como compatível');

    // Busca por manga Mini Euro
    const matchesEuro = findCompatibleStockItems(
      { width: 45, height: 68, sizeName: 'Mini Euro', quantity: 30 },
      stock
    );
    assert.equal(matchesEuro.length, 1);
    assert.equal(matchesEuro[0].item.id, 's3');
  });

  // Teste 23: Cálculo de Candidatos a Desconto (calculateSleeveDeductionCandidates)
  test('Estoque: calculateSleeveDeductionCandidates detecta novas cartas sleevadas e sugere quantidade correta', () => {
    const stock: SleeveStockItem[] = [
      { id: 's1', brand: 'Bucaneiros', model: 'Padrão (63,5 x 88 mm)', quantity: 150 },
      { id: 's2', brand: 'Meeple Virus', model: 'Mini Euro (45 x 68 mm)', quantity: 25 },
    ];

    // Cenário 1: Jogo novo sem sleeves salvos -> usuário sleeva 100 cartas Padrão
    const gameNovo: GameData = {
      id: 'g1',
      name: 'Wingspan',
      status: 'Na Coleção',
      spend: 300,
      type: 'Base',
      value: 350,
      isSleeved: false,
    };

    const newSets1 = [
      { width: 63.5, height: 88, sizeName: 'Padrão', quantity: 100, isSleeved: true, sleeveBrand: 'Bucaneiros' }
    ];

    const candidates1 = calculateSleeveDeductionCandidates(gameNovo, newSets1, stock);
    assert.equal(candidates1.length, 1, 'Deve gerar 1 candidato para Wingspan');
    assert.equal(candidates1[0].cardsToDeduct, 100, 'Deve sugerir descontar 100 cartas');
    assert.equal(candidates1[0].selectedStockId, 's1');
    assert.equal(candidates1[0].deductQuantity, 100, 'Deve pré-preencher com 100 pois estoque possui 150');
    assert.equal(candidates1[0].shouldDeduct, true);

    // Cenário 2: Jogo já estava sleevado com 100 cartas -> usuário salva sem alterar quantidades de sleeves
    const gameJaSleevado: GameData = {
      ...gameNovo,
      isSleeved: true,
      cardSleeves: {
        source: 'Manual',
        sets: [{ width: 63.5, height: 88, sizeName: 'Padrão', quantity: 100, isSleeved: true }]
      }
    };

    const candidates2 = calculateSleeveDeductionCandidates(gameJaSleevado, newSets1, stock);
    assert.equal(candidates2.length, 0, 'Não deve gerar candidatos se o jogo já estava sleevado com as mesmas cartas');

    // Cenário 3: Jogo tinha 100 cartas sleevadas e agora o usuário adicionou mais 50 cartas sleevadas (total 150)
    const newSets3 = [
      { width: 63.5, height: 88, sizeName: 'Padrão', quantity: 150, isSleeved: true, sleeveBrand: 'Bucaneiros' }
    ];
    const candidates3 = calculateSleeveDeductionCandidates(gameJaSleevado, newSets3, stock);
    assert.equal(candidates3.length, 1, 'Deve gerar candidato para as cartas excedentes');
    assert.equal(candidates3[0].cardsToDeduct, 50, 'Deve deduzir apenas as 50 novas cartas sleevadas');

    // Cenário 4: Estoque insuficiente (precisa de 40 cartas Mini Euro mas só tem 25 em estoque)
    const newSets4 = [
      { width: 45, height: 68, sizeName: 'Mini Euro', quantity: 40, isSleeved: true }
    ];
    const candidates4 = calculateSleeveDeductionCandidates(gameNovo, newSets4, stock);
    assert.equal(candidates4.length, 1);
    assert.equal(candidates4[0].cardsToDeduct, 40);
    assert.equal(candidates4[0].selectedStockId, 's2');
    assert.equal(candidates4[0].deductQuantity, 25, 'Deve limitar a quantidade inicial a descontar para 25 (saldo do estoque)');

    // Cenário 5: Jogo marcado como noCards
    const gameNoCards: GameData = { ...gameNovo, noCards: true };
    const candidates5 = calculateSleeveDeductionCandidates(gameNoCards, [{ width: 63.5, height: 88, quantity: 50, isSleeved: false }], stock);
    assert.equal(candidates5.length, 0);

    // Cenário 6: Estoque vazio
    const candidates6 = calculateSleeveDeductionCandidates(gameNovo, newSets1, []);
    assert.equal(candidates6.length, 0);
  });

  return { passed, failed };
}

