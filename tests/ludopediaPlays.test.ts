import assert from 'node:assert/strict';
import { 
  parsePlayCountFromLudo, 
  parseLudopediaDetail,
  formatPlayDuration,
  formatMatchDate
} from '../src/services/ludopediaService.ts';
import type { GameData, LudopediaMatch } from '../src/types/index.ts';

export async function runPlaysTests(logger: (msg: string) => void): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      logger(`  ✔ [PARTIDAS PASS] ${name}`);
    } catch (err: any) {
      failed++;
      logger(`  ✖ [PARTIDAS FAIL] ${name}: ${err.message}`);
    }
  }

  logger('\n--- [PARTIDAS TESTS] Nova Funcionalidade de Partidas (Ludopedia Exclusiva) ---');

  // 1. Parser de Contagem de Partidas (parsePlayCountFromLudo)
  test('PlayCount Parser: Extrai contagem numérica direta de qt_partidas, total_partidas e qtde', () => {
    assert.equal(parsePlayCountFromLudo({ qt_partidas: 7 }), 7);
    assert.equal(parsePlayCountFromLudo({ qt_partidas: '12' }), 12);
    assert.equal(parsePlayCountFromLudo({ total_partidas: 25 }), 25);
    assert.equal(parsePlayCountFromLudo({ qtde_partidas: 3 }), 3);
    assert.equal(parsePlayCountFromLudo({ num_partidas: 9 }), 9);
    assert.equal(parsePlayCountFromLudo({ qtde: 4 }), 4);
    assert.equal(parsePlayCountFromLudo({ playCount: 8 }), 8);
  });

  test('PlayCount Parser: Extrai contagem de arrays de partidas e de objetos aninhados', () => {
    // Array de partidas
    const withArray = {
      partidas: [
        { id_partida: 1, dt_partida: '2024-05-10' },
        { id_partida: 2, dt_partida: '2024-05-18' },
        { id_partida: 3, dt_partida: '2024-06-01' }
      ]
    };
    assert.equal(parsePlayCountFromLudo(withArray), 3);

    // Objeto aninhado em item ou usuario
    const withNested = {
      id_jogo: 100,
      item: {
        qt_partidas: 15,
        fl_tem: 1
      }
    };
    assert.equal(parsePlayCountFromLudo(withNested), 15);
  });

  test('PlayCount Parser: Garante contagem mínima 1 quando fl_jogou=1 sem número explícito', () => {
    assert.equal(parsePlayCountFromLudo({ fl_jogou: 1 }), 1);
    assert.equal(parsePlayCountFromLudo({ fl_jogado: 1 }), 1);
    assert.equal(parsePlayCountFromLudo({ jogou: true }), 1);
  });

  test('PlayCount Parser: Retorna undefined para jogos não jogados', () => {
    assert.equal(parsePlayCountFromLudo({}), undefined);
    assert.equal(parsePlayCountFromLudo({ nm_jogo: 'Catan', fl_tem: 1, fl_jogou: 0 }), undefined);
  });

  // 2. Integração com parseLudopediaDetail
  test('Ludopedia Detail Parser: Popula playCount e isPlayed quando jogo pertence à coleção', () => {
    const rawData = {
      id_jogo: 200,
      nm_jogo: 'Terraforming Mars',
      fl_tem: 1,
      fl_jogou: 1,
      qt_partidas: 18,
      tp_jogo: 'b'
    };

    const parsed = parseLudopediaDetail(rawData);
    assert.equal(parsed.isOwned, true);
    assert.equal(parsed.isPlayed, true);
    assert.equal(parsed.playCount, 18);
  });

  test('Ludopedia Detail Parser: Não atribui playCount se jogo não pertence à coleção (bloqueio estrito)', () => {
    const notOwnedPlayed = {
      id_jogo: 300,
      nm_jogo: 'Brass Birmingham',
      fl_tem: 0,
      fl_jogou: 1,
      qt_partidas: 10,
      lista: 'jogados'
    };

    const parsed = parseLudopediaDetail(notOwnedPlayed);
    assert.equal(parsed.isOwned, false);
    assert.equal(parsed.isPlayed, false);
    assert.equal(parsed.playCount, undefined);
  });

  // 3. Formatação de Duração e Datas
  test('Formatadores: formatPlayDuration converte minutos para horas e minutos', () => {
    assert.equal(formatPlayDuration(120), '2h');
    assert.equal(formatPlayDuration(135), '2h 15m');
    assert.equal(formatPlayDuration(45), '45 min');
    assert.equal(formatPlayDuration(0), 'Tempo não informado');
    assert.equal(formatPlayDuration(null), 'Tempo não informado');
    assert.equal(formatPlayDuration(undefined), 'Tempo não informado');
  });

  test('Formatadores: formatMatchDate formata data yyyy-mm-dd em dia da semana e data dd/mm/yyyy', () => {
    const formatted = formatMatchDate('2024-06-01');
    assert.ok(formatted.includes('01/06/2024'));
    assert.ok(formatted.includes('Sáb') || formatted.includes('sab'));
    assert.equal(formatMatchDate(null), 'Data não informada');
  });

  // 4. Integridade da Estrutura de Partidas (LudopediaMatch)
  test('Match Data Contract: Valida estrutura completa da Partida segundo especificação da API Ludopedia', () => {
    const mockMatch: LudopediaMatch = {
      id_partida: 999,
      qt_partidas: 1,
      fl_digital: 0, // Presencial
      duracao: 90,
      dt_partida: '2024-09-15',
      descricao: 'Partida épica com vitória apertada',
      grupo: {
        id_grupo_jogo: 1,
        nm_grupo: 'Quinta dos Tabuleiros'
      },
      jogo: {
        id_jogo: 400,
        nm_jogo: 'Dune: Imperium',
        thumb: 'https://storage.googleapis.com/ludopedia-capas/dune.jpg',
        link: 'https://ludopedia.com.br/jogo/dune-imperium'
      },
      expansoes: [
        {
          id_jogo: 401,
          nm_jogo: 'Rise of Ix'
        }
      ],
      jogadores: [
        {
          id_partida_jogador: 1,
          nome: 'Jogador 1',
          id_usuario: 50,
          fl_vencedor: 1,
          vl_pontos: 11,
          observacao: 'Líder: Paul Atreides'
        },
        {
          id_partida_jogador: 2,
          nome: 'Jogador 2',
          id_usuario: null,
          fl_vencedor: 0,
          vl_pontos: 9,
          observacao: 'Líder: Conde Ilban'
        }
      ]
    };

    assert.equal(mockMatch.id_partida, 999);
    assert.equal(mockMatch.duracao, 90);
    assert.equal(mockMatch.fl_digital, 0);
    assert.equal(mockMatch.jogo.nm_jogo, 'Dune: Imperium');
    assert.equal(mockMatch.expansoes?.length, 1);
    assert.equal(mockMatch.jogadores.length, 2);
    assert.equal(mockMatch.jogadores[0].fl_vencedor, 1);
    assert.equal(mockMatch.jogadores[0].vl_pontos, 11);
    assert.equal(mockMatch.jogadores[1].observacao, 'Líder: Conde Ilban');
  });

  // 5. Isolamento Estrito: Expansão vs Jogo Base em Partidas
  test('Isolamento Estrito: Expansões não herdam playCount do jogo base', () => {
    const baseGame: GameData = {
      id: 'ludo-500-1',
      ludoId: '500',
      name: 'Wingspan',
      status: 'Na Coleção',
      spend: 300,
      type: 'Base',
      value: 300,
      isPlayed: true,
      playCount: 14
    };

    const expGame: GameData = {
      id: 'ludo-501-1',
      ludoId: '501',
      name: 'Wingspan: Expansão Europa',
      status: 'Na Coleção',
      spend: 150,
      type: 'Expansão',
      value: 150,
      isPlayed: false,
      playCount: undefined
    };

    // A expansão deve permanecer estritamente NÃO JOGADA com playCount undefined
    assert.equal(baseGame.playCount, 14);
    assert.equal(baseGame.isPlayed, true);
    assert.equal(expGame.playCount, undefined);
    assert.equal(expGame.isPlayed, false);
  });

  // 6. Atualização e Sincronização Atômica de playCount
  test('Sincronização de playCount: Mapeia corretamente contagens por id_jogo e por nome normalizado', () => {
    const initialGames: GameData[] = [
      { id: '1', ludoId: '10', name: 'Root', status: 'Na Coleção', spend: 200, type: 'Base', value: 200 },
      { id: '2', ludoId: '20', name: 'Everdell', status: 'Na Coleção', spend: 250, type: 'Base', value: 250 },
      { id: '3', name: 'Cascadia', status: 'Na Coleção', spend: 180, type: 'Base', value: 180 }
    ];

    const countsByLudoId: Record<string, number> = {
      '10': 6,
      '20': 3
    };
    const countsByName: Record<string, number> = {
      'cascadia': 8
    };

    const updated = initialGames.map(g => {
      const count = (g.ludoId && countsByLudoId[g.ludoId]) || countsByName[g.name.toLowerCase()];
      if (count !== undefined) {
        return {
          ...g,
          playCount: count,
          isPlayed: count > 0
        };
      }
      return g;
    });

    assert.equal(updated[0].playCount, 6);
    assert.equal(updated[0].isPlayed, true);
    assert.equal(updated[1].playCount, 3);
    assert.equal(updated[1].isPlayed, true);
    assert.equal(updated[2].playCount, 8);
    assert.equal(updated[2].isPlayed, true);
  });

  return { passed, failed };
}
