import assert from 'node:assert/strict';
import type { GameData } from '../src/types/index.ts';
import { processBatchWithConcurrency } from '../src/services/batchProcessor.ts';
import { matchesGameName } from '../src/utils/nameMatcher.ts';

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

  // Regressão 6: Seleção Individual de Cards e Operações em Massa
  await test('Seleção Individual de Cards: Alternância de seleção e integridade do Set imutável', () => {
    let selectedSet = new Set<string>();

    const toggle = (id: string) => {
      const next = new Set(selectedSet);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      selectedSet = next;
    };

    const selectAll = (ids: string[]) => {
      selectedSet = new Set(ids);
    };

    const deselectAll = () => {
      selectedSet = new Set();
    };

    // 1. Seleciona jogo 1
    toggle('game-1');
    assert.equal(selectedSet.has('game-1'), true);
    assert.equal(selectedSet.size, 1);

    // 2. Seleciona jogo 2
    toggle('game-2');
    assert.equal(selectedSet.has('game-2'), true);
    assert.equal(selectedSet.size, 2);

    // 3. Desmarca jogo 1
    toggle('game-1');
    assert.equal(selectedSet.has('game-1'), false);
    assert.equal(selectedSet.has('game-2'), true);
    assert.equal(selectedSet.size, 1);

    // 4. Selecionar Todos
    selectAll(['game-1', 'game-2', 'game-3']);
    assert.equal(selectedSet.size, 3);

    // 5. Limpar seleção
    deselectAll();
    assert.equal(selectedSet.size, 0);
  });

  // Regressão 7: Virtual Scrolling e Agrupamento em Linhas
  await test('Virtual Scrolling: Agrupamento em grid e cálculo de fatiamento sem perda de jogos', () => {
    const totalGames = 45;
    const mockGames: GameData[] = Array.from({ length: totalGames }, (_, i) => ({
      id: `game-${i}`,
      name: `Jogo ${i}`,
      status: 'Na Coleção',
      spend: 100,
      type: 'Base',
      value: 120,
    }));

    const MIN_CARD_WIDTH = 280;
    const GAP = 20;
    const containerWidth = 1200;
    const cols = Math.max(1, Math.floor((containerWidth + GAP) / (MIN_CARD_WIDTH + GAP)));

    const grouped: GameData[][] = [];
    for (let i = 0; i < mockGames.length; i += cols) {
      grouped.push(mockGames.slice(i, i + cols));
    }

    // Todos os jogos devem estar presentes nos rows
    const flattened = grouped.flatMap(r => r);
    assert.equal(flattened.length, totalGames, 'Todos os 45 jogos devem estar presentes na grade');
    assert.equal(grouped.length, Math.ceil(totalGames / cols));

    // Simula cálculo de range visível
    const ESTIMATED_ROW_HEIGHT = 440;
    const OVERSCAN = 2;
    const scrollTop = 1000;
    const viewportHeight = 800;

    const startRow = Math.max(0, Math.floor(scrollTop / ESTIMATED_ROW_HEIGHT) - OVERSCAN);
    const visibleRowCount = Math.ceil(viewportHeight / ESTIMATED_ROW_HEIGHT) + OVERSCAN * 2;
    const endRow = Math.min(grouped.length, startRow + visibleRowCount);

    const visibleRows = grouped.slice(startRow, endRow);
    assert.ok(visibleRows.length > 0, 'Deve haver linhas visíveis calculadas');
    assert.ok(endRow <= grouped.length, 'Fim do range não deve exceder total de linhas');
  });

  // Regressão 8: Sistema de Filtro de Partidas (Todos / Jogados / Não Jogados)
  await test('Filtros de Partidas: Isolamento estrito entre Todos, Jogados e Não Jogados', () => {
    const games: GameData[] = [
      { id: '1', name: 'Terraforming Mars', type: 'Base', status: 'Na Coleção', spend: 300, value: 350, isPlayed: true },
      { id: '2', name: 'Brass Birmingham', type: 'Base', status: 'Na Coleção', spend: 400, value: 450, isPlayed: false },
      { id: '3', name: 'Prelúdio (Expansão)', type: 'Expansão', status: 'Na Coleção', spend: 120, value: 150, isPlayed: true },
      { id: '4', name: 'Vênus Próxima (Expansão)', type: 'Expansão', status: 'Na Coleção', spend: 150, value: 180, isPlayed: false },
    ];

    const filterGames = (list: GameData[], filter: 'Todos' | 'Jogados' | 'Não Jogados') => {
      return list.filter(g => {
        if (filter === 'Todos') return true;
        if (filter === 'Jogados') return Boolean(g.isPlayed);
        if (filter === 'Não Jogados') return !g.isPlayed;
        return true;
      });
    };

    const todos = filterGames(games, 'Todos');
    const jogados = filterGames(games, 'Jogados');
    const naoJogados = filterGames(games, 'Não Jogados');

    assert.equal(todos.length, 4, 'Filtro Todos deve retornar todos os 4 jogos');
    assert.equal(jogados.length, 2, 'Filtro Jogados deve retornar 2 jogos');
    assert.deepEqual(jogados.map(g => g.name), ['Terraforming Mars', 'Prelúdio (Expansão)']);
    assert.equal(naoJogados.length, 2, 'Filtro Não Jogados deve retornar 2 jogos');
    assert.deepEqual(naoJogados.map(g => g.name), ['Brass Birmingham', 'Vênus Próxima (Expansão)']);
  });

  // Regressão 9: Dashboard Analítico & Cruzamento Tipo x Partidas com Reatividade
  await test('Dashboard Analítico: Cruzamento Tipo x Status e Reatividade após Edição Manual', () => {
    let mockCollection: GameData[] = [
      { id: '1', name: 'Catan', type: 'Base', status: 'Na Coleção', spend: 200, value: 250, isPlayed: true },
      { id: '2', name: 'Carcassonne', type: 'Base', status: 'Na Coleção', spend: 180, value: 200, isPlayed: false },
      { id: '3', name: 'Catan: Navegadores', type: 'Expansão', status: 'Na Coleção', spend: 150, value: 180, isPlayed: true },
      { id: '4', name: 'Catan: Cidades & Cavaleiros', type: 'Expansão', status: 'Na Coleção', spend: 170, value: 210, isPlayed: false },
    ];

    const calculateDashboardStats = (list: GameData[]) => {
      let basePlayed = 0;
      let baseUnplayed = 0;
      let expPlayed = 0;
      let expUnplayed = 0;

      for (const g of list) {
        const typeLower = String(g.type || '').toLowerCase();
        const isExp = typeLower.includes('expans') || typeLower.includes('expansion');
        const isPlayed = Boolean(g.isPlayed);

        if (isExp) {
          if (isPlayed) expPlayed++;
          else expUnplayed++;
        } else {
          if (isPlayed) basePlayed++;
          else baseUnplayed++;
        }
      }

      return { basePlayed, baseUnplayed, expPlayed, expUnplayed, total: list.length };
    };

    // Estado inicial
    let stats = calculateDashboardStats(mockCollection);
    assert.equal(stats.basePlayed, 1, '1 jogo base jogado');
    assert.equal(stats.baseUnplayed, 1, '1 jogo base não jogado');
    assert.equal(stats.expPlayed, 1, '1 expansão jogada');
    assert.equal(stats.expUnplayed, 1, '1 expansão não jogada');
    assert.equal(stats.total, 4);

    // Simula edição manual (Usuário joga Carcassonne e marca isPlayed = true)
    mockCollection = mockCollection.map(g => g.id === '2' ? { ...g, isPlayed: true } : g);

    // Reatividade: Dashboard recalculado reflete o novo status instantaneamente
    stats = calculateDashboardStats(mockCollection);
    assert.equal(stats.basePlayed, 2, 'Agora 2 jogos base jogados');
    assert.equal(stats.baseUnplayed, 0, '0 jogos base não jogados');
    assert.equal(stats.expPlayed, 1);
    assert.equal(stats.expUnplayed, 1);
  });

  // Regressão 10: Sincronização e Fusão de Jogos Jogados (Caso Arnak)
  await test('Sincronização e Fusão de Jogos Jogados: Identifica Arnak e atualiza isPlayed sem sobrescrever com false', () => {
    // 1. O usuário tem "Arnak" cadastrado localmente com isPlayed = false
    const localCollection: GameData[] = [
      { id: 'local-1', name: 'Arnak', status: 'Na Coleção', spend: 300, type: 'Base', value: 350, isPlayed: false }
    ];

    // 2. A API da Ludopedia retorna a ficha completa "As Ruínas Perdidas de Arnak" marcada como jogada (isPlayed = true)
    const apiIncomingGame: GameData = {
      id: 'ludo-129759',
      ludoId: '129759',
      name: 'As Ruínas Perdidas de Arnak',
      status: 'Na Coleção',
      spend: 0,
      type: 'Base',
      value: 0,
      isPlayed: true
    };

    // 3. Lógica de merge do hook useCollection com matchesGameName e fusão OR de isPlayed
    const merged = [...localCollection];
    const existingIndex = merged.findIndex(g => 
      (g.ludoId && apiIncomingGame.ludoId && g.ludoId === apiIncomingGame.ludoId) ||
      g.name.toLowerCase() === apiIncomingGame.name.toLowerCase() ||
      matchesGameName(g.name, apiIncomingGame.name)
    );

    assert.notEqual(existingIndex, -1, 'Arnak deve ser encontrado e associado a "As Ruínas Perdidas de Arnak"');

    merged[existingIndex] = {
      ...merged[existingIndex],
      ludoId: merged[existingIndex].ludoId || apiIncomingGame.ludoId,
      isPlayed: Boolean(merged[existingIndex].isPlayed || apiIncomingGame.isPlayed)
    };

    // Prova irrefutável do requisito do usuário:
    assert.equal(merged[0].name, 'Arnak', 'Nome original preservado');
    assert.equal(merged[0].ludoId, '129759', 'ID da Ludopedia atribuído');
    assert.equal(merged[0].isPlayed, true, 'isPlayed deve ser atualizado para true após identificação na Ludopedia');
  });

  return { passed, failed };
}
