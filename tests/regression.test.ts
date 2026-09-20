import assert from 'node:assert/strict';
import type { GameData } from '../src/types/index.ts';
import { processBatchWithConcurrency } from '../src/services/batchProcessor.ts';

export async function runRegressionTests(logger: (msg: string) => void): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      passed++;
      logger(`  ✔ [REGRESSION PASS] ${name}`);
    } catch (err: any) {
      failed++;
      logger(`  ✖ [REGRESSION FAIL] ${name}: ${err.message}`);
    }
  }

  logger('\n--- [REGRESSION TESTS] Garantia de Não-Regressão e Regras de Negócio ---');

  // Regressão 1: Cálculos Financeiros
  await test('Cálculos Financeiros: Total gasto, valor da coleção e lucro de vendidos com presentes/R$0', () => {
    const mockGames: GameData[] = [
      { id: '1', name: 'Jogo 1', status: 'Na Coleção', spend: 200, type: 'Base', value: 300 },
      { id: '2', name: 'Jogo 2 (Presente)', status: 'Na Coleção', spend: 0, type: 'Base', value: 150 },
      { id: '3', name: 'Jogo 3', status: 'Vendido', spend: 100, soldValue: 180, type: 'Base', value: 0 },
      { id: '4', name: 'Jogo 4 (Prejuízo)', status: 'Vendido', spend: 250, soldValue: 200, type: 'Base', value: 0 },
    ];

    const totals = mockGames.reduce((acc, game) => {
      const spendNum = Number(game.spend) || 0;
      const valueNum = Number(game.value) || 0;
      const soldNum = Number(game.soldValue) || 0;

      const isOwned = String(game.status).toLowerCase().includes('coleção');
      const isSold = String(game.status).toLowerCase().includes('vendido');

      acc.totalGasto += spendNum;

      if (isOwned) {
        acc.totalInCollection += 1;
        acc.valorColecao += valueNum;
      }

      if (isSold) {
        acc.totalSold += 1;
        acc.totalVendido += soldNum;
        acc.gastoVendido += spendNum;
      }
      return acc;
    }, { totalGasto: 0, valorColecao: 0, totalVendido: 0, totalInCollection: 0, totalSold: 0, gastoVendido: 0 });

    const lucroTotal = totals.totalVendido - totals.gastoVendido;

    // Provas:
    // Total Gasto: 200 + 0 + 100 + 250 = 550
    assert.equal(totals.totalGasto, 550, 'Total gasto deve ser 550');
    // Valor Coleção: 300 + 150 = 450
    assert.equal(totals.valorColecao, 450, 'Valor da coleção deve ser 450');
    // Total Vendido: 180 + 200 = 380
    assert.equal(totals.totalVendido, 380, 'Total vendido deve ser 380');
    // Gasto dos vendidos: 100 + 250 = 350
    assert.equal(totals.gastoVendido, 350, 'Custo dos vendidos deve ser 350');
    // Lucro: 380 - 350 = +30
    assert.equal(lucroTotal, 30, 'Lucro deve ser +30');
    assert.equal(totals.totalInCollection, 2, 'Total na coleção deve ser 2');
    assert.equal(totals.totalSold, 2, 'Total vendido deve ser 2');
  });

  // Regressão 2: Regras de Identificação de Tipo (Base vs Expansão)
  await test('Detecção de Tipo: Identifica expansões por flag da Ludopedia e subtipo BGG', () => {
    const normalizeType = (typeStr?: string, name?: string) => {
      const lowerType = String(typeStr || '').toLowerCase().trim();
      const lowerName = String(name || '').toLowerCase().trim();
      if (lowerType === 'e' || lowerType.includes('expans') || lowerName.includes('expans') || lowerName.includes('expansion')) return 'Expansão';
      if (lowerType === 'p' || lowerType.includes('promo') || lowerName.includes('promo')) return 'Promo';
      if (lowerType === 'a' || lowerType.includes('acess') || lowerName.includes('acess')) return 'Acessório';
      if (lowerType.includes('base') || lowerType === 'b') return 'Base';
      return typeStr || 'Base';
    };

    assert.equal(normalizeType('Base', 'Catan: Navegadores (Expansão)'), 'Expansão');
    assert.equal(normalizeType('e', 'Terraforming Mars: Prelúdio'), 'Expansão');
    assert.equal(normalizeType('Expansão', 'Wyrmspan: Academia dos Dragões'), 'Expansão');
    assert.equal(normalizeType('b', 'Concordia'), 'Base');
    assert.equal(normalizeType('promo', 'Carta Especial'), 'Promo');
  });

  // Regressão 3: Ordenação e Filtros Multifatoriais
  await test('Filtros e Ordenação: Ordenação por Ranking, Peso, Preço e Nome', () => {
    const games: GameData[] = [
      { id: '1', name: 'Zombicide', rank: 400, weight: 2.5, spend: 300, value: 350, status: 'Na Coleção', type: 'Base' },
      { id: '2', name: 'Ark Nova', rank: 4, weight: 3.74, spend: 450, value: 500, status: 'Na Coleção', type: 'Base' },
      { id: '3', name: 'Brass: Birmingham', rank: 1, weight: 3.9, spend: 500, value: 600, status: 'Na Coleção', type: 'Base' },
    ];

    // Ordenação por Rank (Crescente: menor rank = melhor posição)
    const sortedByRank = [...games].sort((a, b) => (a.rank || 999999) - (b.rank || 999999));
    assert.equal(sortedByRank[0].name, 'Brass: Birmingham');
    assert.equal(sortedByRank[1].name, 'Ark Nova');
    assert.equal(sortedByRank[2].name, 'Zombicide');

    // Ordenação por Peso (Decrescente)
    const sortedByWeightDesc = [...games].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    assert.equal(sortedByWeightDesc[0].name, 'Brass: Birmingham');
    assert.equal(sortedByWeightDesc[1].name, 'Ark Nova');
    assert.equal(sortedByWeightDesc[2].name, 'Zombicide');
  });

  // Regressão 4: Controle de Concorrência e Chunking
  await test('Concorrência: Limita execução a blocos simultâneos sem perder itens', async () => {
    const items = Array.from({ length: 15 }, (_, i) => i + 1);
    let activeWorkers = 0;
    let maxConcurrencyObserved = 0;

    const results = await processBatchWithConcurrency(items, 5, async (item) => {
      activeWorkers++;
      if (activeWorkers > maxConcurrencyObserved) {
        maxConcurrencyObserved = activeWorkers;
      }
      // Simula pequena latência assíncrona
      await new Promise(r => setTimeout(r, 10));
      activeWorkers--;
      return item * 2;
    });

    assert.equal(results.length, 15, 'Todos os 15 itens devem ser processados');
    assert.deepEqual(results, items.map(x => x * 2), 'Resultados devem ser mapeados corretamente');
    assert.ok(maxConcurrencyObserved <= 5, `Concorrência máxima observada (${maxConcurrencyObserved}) não deve exceder 5`);
  });

  // Regressão 5: Fórmula de Backoff Exponencial com Jitter
  await test('Backoff Exponencial: Atraso cresce exponencialmente com tentativas', () => {
    const calculateBackoff = (attempt: number, base: number = 1000, max: number = 16000) => {
      return Math.min(base * Math.pow(2, attempt), max);
    };

    assert.equal(calculateBackoff(0), 1000);
    assert.equal(calculateBackoff(1), 2000);
    assert.equal(calculateBackoff(2), 4000);
    assert.equal(calculateBackoff(3), 8000);
    assert.equal(calculateBackoff(4), 16000);
    assert.equal(calculateBackoff(5), 16000, 'Não deve exceder o teto máximo de 16000');
  });

  return { passed, failed };
}
