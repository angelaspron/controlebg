import assert from 'node:assert/strict';
import { parseBGGThingXml, parseBGGThingsBatchXml } from '../src/services/bggService.ts';
import { parseLudopediaDetail } from '../src/services/ludopediaService.ts';
import {
  computeRetrospectiveData,
  getAvailableRetrospectiveYears,
  getGameMechanicsPt,
  resolveCollectionDates,
} from '../src/utils/retrospectiveUtils.ts';
import type { GameData, LudopediaMatch, LudopediaMeProfile } from '../src/types/index.ts';

export async function runRetrospectiveTests(logger: (msg: string) => void): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      logger(`  ✔ [RETROSPECTIVA PASS] ${name}`);
    } catch (err: any) {
      failed++;
      logger(`  ✖ [RETROSPECTIVA FAIL] ${name}: ${err.message}`);
    }
  }

  logger('\n--- [RETROSPECTIVA TESTS] Validação da Retrospectiva Dinâmica e Metadados ---');

  test('BGG Parser: Extrai designers, artistas, categorias e tempo de partida (single e batch)', () => {
    const batchXml = `<?xml version="1.0" encoding="utf-8"?>
      <items>
        <item type="boardgame" id="371942">
          <name type="primary" value="The White Castle"/>
          <yearpublished value="2023"/>
          <playingtime value="80"/>
          <link type="boardgamecategory" value="Dice"/>
          <link type="boardgamemechanic" value="Worker Placement"/>
          <link type="boardgamemechanic" value="Dice Rolling"/>
          <link type="boardgamedesigner" value="Isra C."/>
          <link type="boardgamedesigner" value="Shei S."/>
          <link type="boardgameartist" value="Joan Guardiet"/>
        </item>
        <item type="boardgameexpansion" id="420321">
          <name type="primary" value="The White Castle: Matcha"/>
          <yearpublished value="2024"/>
          <playingtime value="90"/>
          <link type="boardgamedesigner" value="Isra C."/>
          <link type="boardgamedesigner" value="Shei S."/>
        </item>
      </items>`;

    const single = parseBGGThingXml(batchXml);
    assert.ok(single);
    assert.deepEqual(single.designers, ['Isra C.', 'Shei S.']);
    assert.deepEqual(single.artists, ['Joan Guardiet']);
    assert.equal(single.playtime, 80);
    assert.deepEqual(single.categories, ['Dice']);

    const batch = parseBGGThingsBatchXml(batchXml);
    assert.equal(batch.length, 2);
    assert.equal(batch[1].bggId, '420321');
    assert.equal(batch[1].type, 'Expansão');
    assert.deepEqual(batch[1].designers, ['Isra C.', 'Shei S.']);
  });

  test('Ludopedia Parser: Extrai designers, artistas, mecânicas em PT-BR e tempo de jogo', () => {
    const rawLudo = {
      id_jogo: 41867,
      nm_jogo: 'The White Castle',
      tp_jogo: 'b',
      vl_tempo_jogo: 80,
      fl_tem: 1,
      mecanicas: [
        { id_mecanica: 1, nm_mecanica: 'Alocação de Trabalhadores' },
        { id_mecanica: 2, nm_mecanica: 'Rolagem de Dados' },
      ],
      categorias: [{ id_categoria: 1, nm_categoria: 'Jogo de Dados' }],
      temas: [{ id_tema: 1, nm_tema: 'Cultura Oriental' }],
      designers: [
        { id_profissional: 10, nm_profissional: 'Isra C.' },
        { id_profissional: 11, nm_profissional: 'Shei S.' },
      ],
      artistas: [{ id_profissional: 20, nm_profissional: 'Joan Guardiet' }],
    };

    const parsed = parseLudopediaDetail(rawLudo);
    assert.deepEqual(parsed.designers, ['Isra C.', 'Shei S.']);
    assert.deepEqual(parsed.artists, ['Joan Guardiet']);
    assert.deepEqual(parsed.mechanicsPt, ['Alocação de Trabalhadores', 'Rolagem de Dados']);
    assert.deepEqual(parsed.categories, ['Jogo de Dados']);
    assert.deepEqual(parsed.themes, ['Cultura Oriental']);
    assert.equal(parsed.playtime, 80);
  });

  test('Mecânicas PT-BR: Traduz e deduplica mecânicas BGG e Ludopedia sem repetir EN/PT', () => {
    const game: GameData = {
      id: '1',
      name: 'The White Castle',
      status: 'Na Coleção',
      spend: 200,
      type: 'Base',
      value: 250,
      mechanics: ['Worker Placement', 'Hand Management', 'Solo / Solitaire Game'],
      domains: ['Alocação de Trabalhadores', 'Worker Placement', 'Dice'],
    };

    const mechs = getGameMechanicsPt(game);
    assert.ok(mechs.includes('Alocação de Trabalhadores'));
    assert.ok(mechs.includes('Gerenciamento de Mãos'));
    assert.ok(mechs.includes('Solo / Solitário'));
    assert.equal(mechs.filter(m => m === 'Alocação de Trabalhadores').length, 1);
    assert.ok(!mechs.includes('Worker Placement'));
  });

  test('Resolução de Datas: Respeita modo explícito com legacy sem misturar com data do ID', () => {
    const mixedGames: GameData[] = [
      { id: 'ludo-1-1790000000000-0', name: 'Novo 2026', status: 'Na Coleção', spend: 100, type: 'Base', value: 100, acquiredAt: '2026-04-10' },
      { id: 'ludo-2-1790000000000-1', name: 'Antigo Legacy', status: 'Na Coleção', spend: 100, type: 'Base', value: 100, acquiredAt: 'legacy' },
      { id: 'ludo-3-1790000000000-2', name: 'Sem Data Após Classificação', status: 'Na Coleção', spend: 100, type: 'Base', value: 100 },
    ];

    const resolved = resolveCollectionDates(mixedGames);
    assert.equal(resolved.hasExplicitDates, true);
    assert.equal(resolved.acquiredById['ludo-1-1790000000000-0'], '2026-04-10');
    assert.equal(resolved.acquiredById['ludo-2-1790000000000-1'], undefined);
    assert.equal(resolved.acquiredById['ludo-3-1790000000000-2'], undefined);
  });

  test('Engine da Retrospectiva: Calcula estante, Designer do Ano (Isra C.), partidas, estreias, vitórias, calendário e co-jogadores', () => {
    const games: GameData[] = [
      {
        id: 'g1',
        ludoId: '41867',
        name: 'The White Castle',
        status: 'Na Coleção',
        spend: 220,
        type: 'Base',
        value: 260,
        yearPublished: 2023,
        weight: 2.98,
        designers: ['Isra C.', 'Shei S.'],
        mechanicsPt: ['Alocação de Trabalhadores', 'Rolagem de Dados'],
        acquiredAt: '2026-02-10',
        isPlayed: true,
        playCount: 2,
      },
      {
        id: 'g2',
        ludoId: '66530',
        name: 'The White Castle: Matcha',
        status: 'Na Coleção',
        spend: 180,
        type: 'Expansão',
        value: 200,
        yearPublished: 2024,
        weight: 3.1,
        designers: ['Isra C.', 'Shei S.'],
        mechanicsPt: ['Alocação de Trabalhadores'],
        acquiredAt: '2026-05-01',
        isPlayed: false,
      },
      {
        id: 'g3',
        ludoId: '503',
        name: 'Twilight Struggle',
        status: 'Na Coleção',
        spend: 350,
        type: 'Base',
        value: 400,
        yearPublished: 2005,
        weight: 3.6,
        designers: ['Ananda Gupta', 'Jason Matthews'],
        mechanicsPt: ['Gerenciamento de Mãos'],
        acquiredAt: '2026-03-15',
        isPlayed: false,
      },
      {
        id: 'g4',
        ludoId: '100',
        name: 'Sky Team',
        status: 'Na Coleção',
        spend: 200,
        type: 'Base',
        value: 220,
        yearPublished: 2023,
        acquiredAt: '2025-07-01',
        isPlayed: true,
      },
      {
        id: 'g5',
        ludoId: '200',
        name: 'Jogo Vendido 2026',
        status: 'Vendido',
        spend: 150,
        soldValue: 190,
        type: 'Base',
        value: 190,
        acquiredAt: '2024-05-01',
        soldAt: '2026-08-20',
      },
    ];

    const me: LudopediaMeProfile = { id_usuario: 99, usuario: 'Sultan' };

    const allMatches: LudopediaMatch[] = [
      // 2025 match: Sky Team já foi jogado em 2025, então NÃO deve ser estreia em 2026!
      {
        id_partida: 1,
        qt_partidas: 2,
        fl_digital: 0,
        duracao: 60,
        dt_partida: '2025-11-10',
        descricao: null,
        jogo: { id_jogo: 100, nm_jogo: 'Sky Team' },
        jogadores: [
          { id_partida_jogador: 1, nome: 'Sultan', id_usuario: 99, fl_vencedor: 1 },
          { id_partida_jogador: 2, nome: 'williamfa', id_usuario: 201, fl_vencedor: 1 },
        ],
      },
      // 2026 matches
      {
        id_partida: 2,
        qt_partidas: 3,
        fl_digital: 0,
        duracao: 90,
        dt_partida: '2026-02-21', // Sábado
        descricao: 'Dia cheio!',
        jogo: { id_jogo: 100, nm_jogo: 'Sky Team' },
        jogadores: [
          { id_partida_jogador: 3, nome: 'Sultan', id_usuario: 99, fl_vencedor: 1 },
          { id_partida_jogador: 4, nome: 'williamfa', id_usuario: 201, fl_vencedor: 1 },
        ],
      },
      {
        id_partida: 3,
        qt_partidas: 1,
        fl_digital: 0,
        duracao: 120,
        dt_partida: '2026-02-21', // Mesmo sábado -> total 4 partidas em 21/fev
        descricao: null,
        jogo: { id_jogo: 41867, nm_jogo: 'The White Castle' },
        jogadores: [
          { id_partida_jogador: 5, nome: 'Sultan', id_usuario: 99, fl_vencedor: 0, vl_pontos: 45 },
          { id_partida_jogador: 6, nome: 'williamfa', id_usuario: 201, fl_vencedor: 1, vl_pontos: 58 },
          { id_partida_jogador: 7, nome: 'Youkai Sanseru', id_usuario: 202, fl_vencedor: 0, vl_pontos: 40 },
        ],
      },
      {
        id_partida: 4,
        qt_partidas: 1,
        fl_digital: 1,
        duracao: 45,
        dt_partida: '2026-04-05', // Domingo, sem vencedor marcado
        descricao: 'Coop derrota',
        jogo: { id_jogo: 999, nm_jogo: 'Spirit Island' },
        jogadores: [
          { id_partida_jogador: 8, nome: 'Sultan', id_usuario: 99, fl_vencedor: 0 },
          { id_partida_jogador: 9, nome: 'williamfa', id_usuario: 201, fl_vencedor: 0 },
        ],
      },
    ];

    const years = getAvailableRetrospectiveYears(games, allMatches, new Date('2026-11-27T12:00:00'));
    assert.deepEqual(years, [2026, 2025, 2024]);

    const retro2026 = computeRetrospectiveData({
      year: 2026,
      games,
      allMatches,
      me,
      referenceDate: new Date('2026-11-27T12:00:00'),
    });

    // Na estante 2026
    assert.equal(retro2026.enteredGames.length, 3);
    assert.equal(retro2026.enteredBaseGames.length, 2);
    assert.equal(retro2026.enteredExpGames.length, 1);
    assert.equal(retro2026.leftGames.length, 1);
    assert.equal(retro2026.netBalance, 2);
    assert.equal(retro2026.shelfEndCount, 4); // 4 ativos na coleção atualmente
    assert.equal(retro2026.totalInvested, 750); // 220 + 180 + 350
    assert.equal(retro2026.soldRevenue, 190);
    assert.equal(retro2026.oldestArrival?.game.name, 'Twilight Struggle');
    assert.equal(retro2026.oldestArrival?.year, 2005);

    // Designer do ano e drilldown de jogos
    assert.equal(retro2026.topDesigners[0].name, 'Isra C.');
    assert.equal(retro2026.topDesigners[0].count, 2);
    assert.deepEqual(
      retro2026.topDesigners[0].games.map(g => g.name),
      ['The White Castle', 'The White Castle: Matcha']
    );
    assert.equal(retro2026.topMechanics[0].name, 'Alocação de Trabalhadores');
    assert.equal(retro2026.topMechanics[0].count, 2);

    // Chegou e foi pra mesa
    assert.equal(retro2026.arrivalsBasePlayed.length, 1);
    assert.equal(retro2026.arrivalsBaseUnplayed.length, 1);

    // Na mesa 2026
    assert.equal(retro2026.totalPlays, 5); // 3 + 1 + 1
    assert.equal(retro2026.prevYearTotalPlays, 2);
    assert.equal(retro2026.yoyGrowthPct, 150);
    assert.equal(retro2026.uniqueDaysCount, 2);
    assert.equal(retro2026.uniqueGamesPlayedCount, 3);
    assert.equal(retro2026.busiestDay?.dateStr, '2026-02-21');
    assert.equal(retro2026.busiestDay?.count, 4);
    assert.equal(retro2026.busiestMonth?.monthIndex, 1); // Fevereiro

    // Estreias reais (Sky Team NÃO é estreia pois teve partida em 2025!)
    assert.deepEqual(
      retro2026.debuts.map(d => d.name).sort(),
      ['Spirit Island', 'The White Castle']
    );

    // Vitórias: 3 vitórias (Sky Team qt_partidas=3) em 4 partidas com vencedor marcado (75%)
    assert.equal(retro2026.winStats.matchesWithWinnerCount, 4);
    assert.equal(retro2026.winStats.userWinsCount, 3);
    assert.equal(retro2026.winStats.winRatePct, 75);

    // Co-jogadores: exclui Sultan! williamfa = 5, Youkai Sanseru = 1
    assert.equal(retro2026.coPlayers.length, 2);
    assert.equal(retro2026.coPlayers[0].name, 'williamfa');
    assert.equal(retro2026.coPlayers[0].playCount, 5);
    assert.equal(retro2026.coPlayers[1].name, 'Youkai Sanseru');
    assert.equal(retro2026.coPlayers[1].playCount, 1);

    // Dia favorito: sábado (4 de 5 = 80%)
    assert.equal(retro2026.topWeekday?.shortLabel, 'sáb');
    assert.equal(retro2026.topWeekday?.percentage, 80);

    // Cálculo retroativo da estante em 2025: 4 (atual) - 3 (entraram em 2026) + 1 (saiu em 2026) = 2
    const retro2025 = computeRetrospectiveData({
      year: 2025,
      games,
      allMatches,
      me,
      referenceDate: new Date('2026-11-27T12:00:00'),
    });
    assert.equal(retro2025.shelfEndCount, 2);
  });

  return { passed, failed };
}
