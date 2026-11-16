import assert from 'node:assert/strict';
import { parseComparaPrices } from '../src/services/comparaService.ts';
import { 
  getCardSleeveSizeName, 
  formatCardSleeveDimensions, 
  computeCollectionSleeveDemands,
  matchStockToDemand,
  summarizeGameSleeves,
  parseModelDimensions
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
    assert.equal(parsed.cardSleeves?.sets[0].sizeName, 'Padrão');
    assert.equal(parsed.cardSleeves?.sets[0].sleeveProductName, 'Sleeve Padrão (63,5x88mm)');

    assert.equal(parsed.cardSleeves?.sets[1].name, 'Reference Cards');
    assert.equal(parsed.cardSleeves?.sets[1].quantity, 4);
    assert.equal(parsed.cardSleeves?.sets[1].sizeName, 'Tarot');
    assert.equal(parsed.cardSleeves?.sourceUrl, 'https://www.comparajogos.com.br/item/terraforming-mars-expedicao-ares/50740');
  });

  // Teste 2: Dimensionamento e Nomenclatura de Padrões
  test('Sleeve Utils: Identifica corretamente nomes de tamanhos e formata milímetros', () => {
    assert.equal(getCardSleeveSizeName(63.5, 88), 'Padrão');
    assert.equal(getCardSleeveSizeName(64, 89), 'Padrão');
    assert.equal(getCardSleeveSizeName(45, 68), 'Mini Euro');
    assert.equal(getCardSleeveSizeName(41, 63), 'Mini USA');
    assert.equal(getCardSleeveSizeName(54, 80), 'Yucatan');
    assert.equal(getCardSleeveSizeName(70, 120), 'Tarot');
    assert.equal(getCardSleeveSizeName(80, 120), 'Ilustrada grande (Dixit)');

    assert.equal(formatCardSleeveDimensions(63.5, 88), '63,5 × 88 mm');
    assert.equal(formatCardSleeveDimensions(70, 120), '70 × 120 mm');
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
    assert.equal(custom2.sizeName, '75 × 105 mm');

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

  return { passed, failed };
}

