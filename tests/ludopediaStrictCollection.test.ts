import assert from 'node:assert/strict';
import { isOwnedInLudopedia, parseIsPlayedFromLudo } from '../src/services/ludopediaService.ts';
import { matchesGameName } from '../src/utils/nameMatcher.ts';
import type { GameData } from '../src/types/index.ts';

/**
 * Função de simulação do fluxo de importação e filtragem da Ludopedia,
 * espelhando as regras de negócio de useCollection.
 */
export function simulateLudoCollectionImport(
  existingCollection: GameData[],
  apiCollectionPages: any[][],
  apiMatchHistory: any[],
  options: { simulateError?: boolean } = {}
): GameData[] {
  if (options.simulateError) {
    // Em caso de falha de API/timeout, preserva a coleção anterior sem alterações
    return [...existingCollection];
  }

  // 1. Coleta itens das páginas da coleção (endpoints 'colecao' e 'teve')
  let allRawItems: any[] = [];
  for (const page of apiCollectionPages) {
    allRawItems = [...allRawItems, ...page];
  }

  // 2. Extrai identificadores de partidas do histórico
  const playedGameIds = new Set<string>();
  const playedGameNames = new Set<string>();
  for (const match of apiMatchHistory) {
    if (match.id_jogo) playedGameIds.add(String(match.id_jogo));
    if (match.jogo?.id_jogo) playedGameIds.add(String(match.jogo.id_jogo));
    if (match.nm_jogo) playedGameNames.add(match.nm_jogo.trim().toLowerCase());
    if (match.jogo?.nm_jogo) playedGameNames.add(match.jogo.nm_jogo.trim().toLowerCase());
  }

  // 3. Deduplicação por id_jogo nos itens brutos da coleção
  const uniqueItemsMap = new Map<string, any>();
  for (const item of allRawItems) {
    const idKey = String(item.id_jogo);
    const existing = uniqueItemsMap.get(idKey);
    if (existing) {
      uniqueItemsMap.set(idKey, {
        ...existing,
        ...item,
        fl_tem: (existing.fl_tem || item.fl_tem),
        fl_teve: (existing.fl_teve || item.fl_teve),
        fl_jogou: (existing.fl_jogou || item.fl_jogou) ? 1 : 0,
        qt_partidas: Math.max(Number(existing.qt_partidas || 0), Number(item.qt_partidas || 0)),
      });
    } else {
      uniqueItemsMap.set(idKey, item);
    }
  }

  const uniqueItems = Array.from(uniqueItemsMap.values());

  // 4. Mapeamento e Validação Estrita de Pertencimento à Coleção
  const validIncomingGames: GameData[] = [];

  for (const item of uniqueItems) {
    const isOwned = isOwnedInLudopedia(item);
    if (!isOwned) {
      // REGRA DE OURO: Se não comprovar posse, descarta sumariamente
      continue;
    }

    let mappedStatus = 'Desconhecido';
    if (item.fl_tem === 1 || item.fl_tem === '1' || item.fl_tem === true) {
      mappedStatus = 'Na Coleção';
    } else if (item.fl_teve === 1 || item.fl_teve === '1' || item.fl_teve === true) {
      mappedStatus = 'Vendido';
    } else if (item.na_colecao || item.is_owned) {
      mappedStatus = 'Na Coleção';
    }

    // Apenas status confirmados entram na estante
    if (mappedStatus !== 'Na Coleção' && mappedStatus !== 'Vendido') {
      continue;
    }

    const isExp = item.tp_jogo === 'e' || (item.nm_jogo || '').toLowerCase().includes('expans');
    const isPlayedInLudo = isExp
      ? Boolean(
          parseIsPlayedFromLudo(item) ||
          item.fl_jogou === 1 ||
          (item.id_jogo && playedGameIds.has(String(item.id_jogo))) ||
          (item.nm_jogo && playedGameNames.has(item.nm_jogo.trim().toLowerCase()))
        )
      : Boolean(
          parseIsPlayedFromLudo(item) ||
          item.fl_jogou === 1 ||
          playedGameIds.has(String(item.id_jogo)) ||
          (item.nm_jogo && playedGameNames.has(item.nm_jogo.trim().toLowerCase()))
        );

    validIncomingGames.push({
      id: `ludo-${item.id_jogo}`,
      ludoId: String(item.id_jogo),
      name: item.nm_jogo || 'Jogo Desconhecido',
      status: mappedStatus,
      spend: item.vl_custo ? parseFloat(item.vl_custo) : 0,
      type: item.tp_jogo === 'e' ? 'Expansão' : 'Base',
      value: 0,
      isPlayed: isPlayedInLudo,
      _isOwned: true,
    } as GameData);
  }

  // 5. Merge com a coleção existente
  const mergedShelf = [...existingCollection];

  for (const incoming of validIncomingGames) {
    const isIncomingExp = incoming.type === 'Expansão';
    const existingIdx = mergedShelf.findIndex(g => {
      if (g.ludoId && incoming.ludoId) return g.ludoId === incoming.ludoId;
      const isGExp = g.type === 'Expansão';
      if (isGExp !== isIncomingExp) return false;
      return (
        g.name.toLowerCase() === incoming.name.toLowerCase() ||
        matchesGameName(g.name, incoming.name)
      );
    });

    if (existingIdx !== -1) {
      const prevG = mergedShelf[existingIdx];
      const isExpTarget = prevG.type === 'Expansão' || incoming.type === 'Expansão';
      mergedShelf[existingIdx] = {
        ...prevG,
        ludoId: prevG.ludoId || incoming.ludoId,
        status: prevG.status === 'Desconhecido' ? incoming.status : prevG.status,
        isPlayed: isExpTarget ? incoming.isPlayed : Boolean(prevG.isPlayed || incoming.isPlayed),
      };
    } else {
      mergedShelf.push(incoming);
    }
  }

  // 6. Atualização de status jogado para itens que já estavam na estante
  if (playedGameIds.size > 0 || playedGameNames.size > 0) {
    for (let i = 0; i < mergedShelf.length; i++) {
      const g = mergedShelf[i];
      if (!g.isPlayed) {
        const isGExp = g.type === 'Expansão';
        if (isGExp) {
          if (
            (g.ludoId && playedGameIds.has(g.ludoId)) ||
            (g.name && playedGameNames.has(g.name.trim().toLowerCase()))
          ) {
            mergedShelf[i] = { ...g, isPlayed: true };
          }
        } else {
          if (
            (g.ludoId && playedGameIds.has(g.ludoId)) ||
            (g.name && playedGameNames.has(g.name.trim().toLowerCase())) ||
            Array.from(playedGameNames).some(pn => matchesGameName(g.name, pn))
          ) {
            mergedShelf[i] = { ...g, isPlayed: true };
          }
        }
      }
    }
  }

  return mergedShelf;
}

export async function runStrictLudopediaTests(log: (msg: string) => void = console.log) {
  log('\n--- [STRICT LUDOPEDIA TESTS] Validação dos 14 Cenários Obrigatórios ---');
  let passed = 0;
  let failed = 0;

  const testCase = (name: string, fn: () => void) => {
    try {
      fn();
      log(`  ✔ [CENÁRIO PASS] ${name}`);
      passed++;
    } catch (err: any) {
      log(`  ✖ [CENÁRIO FAIL] ${name}: ${err.message}`);
      failed++;
    }
  };

  // Cenário 1: Jogo presente somente no histórico de partidas -> Não incluir na coleção
  testCase('1. Jogo presente somente no histórico de partidas: Não incluir na coleção', () => {
    const playedOnly = { id_jogo: 901, nm_jogo: 'Nemesis', fl_tem: 0, fl_jogou: 1, qt_partidas: 8, _source_lista: 'colecao' };
    assert.equal(isOwnedInLudopedia(playedOnly), false, 'Jogo apenas com fl_jogou e fl_tem=0 não é da coleção');

    const result = simulateLudoCollectionImport([], [], [{ id_jogo: 901, nm_jogo: 'Nemesis' }]);
    assert.equal(result.length, 0, 'Histórico de partidas isolado não pode criar jogos na coleção');
  });

  // Cenário 2: Jogo presente somente na coleção -> Incluir na coleção
  testCase('2. Jogo presente somente na coleção: Incluir na coleção', () => {
    const ownedOnly = { id_jogo: 101, nm_jogo: 'Catan', fl_tem: 1, fl_jogou: 0, qt_partidas: 0, _source_lista: 'colecao' };
    assert.equal(isOwnedInLudopedia(ownedOnly), true, 'fl_tem=1 confirma posse');

    const result = simulateLudoCollectionImport([], [[ownedOnly]], []);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Catan');
    assert.equal(result[0].status, 'Na Coleção');
    assert.equal(result[0].isPlayed, false, 'Jogo não jogado mantém isPlayed=false');
  });

  // Cenário 3: Jogo presente na coleção e no histórico -> Incluir uma única vez
  testCase('3. Jogo presente na coleção e no histórico: Incluir uma única vez com isPlayed=true', () => {
    const game = { id_jogo: 201, nm_jogo: 'Terraforming Mars', fl_tem: 1, fl_jogou: 1, qt_partidas: 5, _source_lista: 'colecao' };
    const history = [{ id_jogo: 201, nm_jogo: 'Terraforming Mars' }];

    const result = simulateLudoCollectionImport([], [[game]], history);
    assert.equal(result.length, 1, 'Deve ser incluído exatamente uma vez');
    assert.equal(result[0].name, 'Terraforming Mars');
    assert.equal(result[0].isPlayed, true, 'isPlayed deve ser true');
  });

  // Cenário 4: Jogo presente apenas em uma busca geral -> Não incluir na coleção
  testCase('4. Jogo presente apenas em uma busca geral: Não incluir na coleção', () => {
    const searchItem = { id_jogo: 501, nm_jogo: 'Search Game Random' };
    assert.equal(isOwnedInLudopedia(searchItem), false, 'Busca geral sem posse não deve pertencer à coleção');
  });

  // Cenário 5: Histórico com vários jogos e coleção com poucos títulos -> Importar somente os títulos da coleção
  testCase('5. Histórico com vários jogos e coleção com poucos títulos: Importar somente títulos da coleção', () => {
    const collectionPage = [
      { id_jogo: 1, nm_jogo: 'Jogo A', fl_tem: 1, _source_lista: 'colecao' },
      { id_jogo: 2, nm_jogo: 'Jogo B', fl_tem: 1, _source_lista: 'colecao' },
      // Vazamento no payload da estante: apenas jogados
      { id_jogo: 901, nm_jogo: 'Jogado 1', fl_tem: 0, fl_jogou: 1, _source_lista: 'colecao' },
      { id_jogo: 902, nm_jogo: 'Jogado 2', fl_jogou: 1, qt_partidas: 10, _source_lista: 'colecao' }
    ];

    const matchHistory = Array.from({ length: 25 }, (_, i) => ({
      id_jogo: 1000 + i,
      nm_jogo: `Histórico ${i}`
    }));

    const result = simulateLudoCollectionImport([], [collectionPage], matchHistory);
    assert.equal(result.length, 2, 'Apenas os 2 jogos confirmados com fl_tem=1 devem ser importados');
    assert.ok(result.some(g => g.name === 'Jogo A'));
    assert.ok(result.some(g => g.name === 'Jogo B'));
  });

  // Cenário 6: Jogo que nunca foi jogado, mas pertence à coleção -> Incluir na coleção
  testCase('6. Jogo que nunca foi jogado, mas pertence à coleção: Incluir na coleção', () => {
    const unplayedOwned = { id_jogo: 301, nm_jogo: 'Brass: Birmingham', fl_tem: 1, fl_jogou: 0, qt_partidas: 0, _source_lista: 'colecao' };
    assert.equal(isOwnedInLudopedia(unplayedOwned), true);

    const result = simulateLudoCollectionImport([], [[unplayedOwned]], []);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Brass: Birmingham');
    assert.equal(result[0].isPlayed, false);
  });

  // Cenário 7: Jogo jogado várias vezes, mas ausente da coleção -> Não incluir na coleção
  testCase('7. Jogo jogado várias vezes, mas ausente da coleção: Não incluir na coleção', () => {
    const playedManyTimes = { id_jogo: 401, nm_jogo: 'Scythe', fl_tem: 0, fl_jogou: 1, qt_partidas: 45, _source_lista: 'colecao' };
    assert.equal(isOwnedInLudopedia(playedManyTimes), false, 'Jogo com fl_tem=0 mesmo jogado 45 vezes deve retornar false');
  });

  // Cenário 8: Respostas de endpoints diferentes com títulos coincidentes -> Não misturar procedência dos registros
  testCase('8. Respostas de endpoints diferentes com títulos coincidentes: Não misturar procedência', () => {
    assert.equal(matchesGameName('Castles of Burgundy', 'Castles of Mad King Ludwig'), false, 'Títulos com palavras temáticas comuns não devem colidir');
    assert.equal(matchesGameName('Marvel United', 'Marvel Champions'), false, 'Títulos da mesma franquia não devem ser confundidos');
    assert.equal(matchesGameName('Wyrmspan', 'Wyrmspan: Academia dos Dragões'), false, 'Jogo base e expansão com subtítulo temático não devem colidir');
  });

  // Cenário 9: Jogo duplicado na resposta da coleção -> Aplicar deduplicação correta
  testCase('9. Jogo duplicado na resposta da coleção: Deduplicar corretamente', () => {
    const duplicates = [
      { id_jogo: 501, nm_jogo: 'Azul', fl_tem: 1, _source_lista: 'colecao' },
      { id_jogo: 501, nm_jogo: 'Azul', fl_tem: 1, _source_lista: 'colecao' }
    ];
    const result = simulateLudoCollectionImport([], [duplicates], []);
    assert.equal(result.length, 1, 'Item duplicado deve resultar em exatamente 1 registro');
  });

  // Cenário 10: Coleção distribuída em várias páginas -> Importar todos os válidos sem histórico
  testCase('10. Coleção distribuída em várias páginas: Importar todos válidos sem acréscimo de histórico', () => {
    const page1 = [{ id_jogo: 601, nm_jogo: 'Page 1 Game', fl_tem: 1, _source_lista: 'colecao' }];
    const page2 = [{ id_jogo: 602, nm_jogo: 'Page 2 Game', fl_tem: 1, _source_lista: 'colecao' }];
    const history = [{ id_jogo: 9999, nm_jogo: 'Ghost Game' }];

    const result = simulateLudoCollectionImport([], [page1, page2], history);
    assert.equal(result.length, 2);
    assert.ok(result.some(g => g.name === 'Page 1 Game'));
    assert.ok(result.some(g => g.name === 'Page 2 Game'));
    assert.ok(!result.some(g => g.name === 'Ghost Game'));
  });

  // Cenário 11: Resposta vazia do endpoint da coleção -> Não preencher com histórico
  testCase('11. Resposta vazia do endpoint da coleção: Não preencher coleção com jogos do histórico', () => {
    const history = Array.from({ length: 15 }, (_, i) => ({ id_jogo: 8000 + i, nm_jogo: `Partida ${i}` }));
    const result = simulateLudoCollectionImport([], [[]], history);
    assert.equal(result.length, 0, 'Coleção vazia na API não pode ser preenchida por partidas');
  });

  // Cenário 12: Erro de autenticação, timeout ou falha da API -> Preservar coleção anterior
  testCase('12. Erro de autenticação, timeout ou falha da API: Preservar coleção anterior', () => {
    const previous: GameData[] = [
      { id: '1', name: 'Jogo Salvo', status: 'Na Coleção', spend: 100, type: 'Base', value: 120 }
    ];
    const result = simulateLudoCollectionImport(previous, [], [], { simulateError: true });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Jogo Salvo');
  });

  // Cenário 13: Resposta incompleta ou com campos ausentes -> Tratar de forma segura
  testCase('13. Resposta incompleta ou com campos ausentes: Não incluir indevidamente', () => {
    const incomplete = { id_jogo: 777 }; // Sem fl_tem, sem nome, sem status
    assert.equal(isOwnedInLudopedia(incomplete), false, 'Campos ausentes não devem conferir posse');

    const result = simulateLudoCollectionImport([], [[incomplete]], []);
    assert.equal(result.length, 0, 'Item incompleto sem comprovação de posse deve ser ignorado');
  });

  // Cenário 14: Sincronização repetida da mesma coleção -> Não criar duplicações nem alterar dados
  testCase('14. Sincronização repetida da mesma coleção: Não criar duplicações', () => {
    const page = [{ id_jogo: 888, nm_jogo: 'Cascadia', fl_tem: 1, vl_custo: '250', _source_lista: 'colecao' }];
    const firstSync = simulateLudoCollectionImport([], [page], []);
    assert.equal(firstSync.length, 1);

    const secondSync = simulateLudoCollectionImport(firstSync, [page], []);
    assert.equal(secondSync.length, 1, 'Segunda sincronização não deve duplicar Cascadia');
    assert.equal(secondSync[0].name, 'Cascadia');
  });

  // Cenário 15: Isolamento Estrito de Expansão -> Expansão não deve assumir partidas do jogo base
  testCase('15. Isolamento Estrito de Expansão: Expansão não jogada vem como NÃO JOGADO mesmo com jogo base jogado', () => {
    // 1. O usuário jogou o jogo base Wyrmspan no histórico de partidas
    const historyWithBaseGameOnly = [{ id_jogo: 1001, nm_jogo: 'Wyrmspan' }];

    // 2. Na coleção da API, o usuário tem a expansão "Wyrmspan: Academia dos Dragões"
    // Na API da Ludopedia ela está marcada como fl_jogou: 0 e qt_partidas: 0
    const expansionInCollection = [{
      id_jogo: 1002,
      nm_jogo: 'Wyrmspan: Academia dos Dragões',
      tp_jogo: 'e',
      fl_tem: 1,
      fl_jogou: 0,
      qt_partidas: 0,
      _source_lista: 'colecao'
    }];

    // 3. Execução da importação
    const result = simulateLudoCollectionImport([], [expansionInCollection], historyWithBaseGameOnly);

    assert.equal(result.length, 1, 'A expansão pertence à coleção e deve ser importada');
    assert.equal(result[0].name, 'Wyrmspan: Academia dos Dragões');
    assert.equal(result[0].type, 'Expansão');
    // REGRA DE OURO DO USUÁRIO: Se na API não constar na expansão JOGADO, ele deve vir como NÃO JOGADO!
    assert.equal(result[0].isPlayed, false, 'Expansão NÃO deve herdar status de jogado do jogo base Wyrmspan');

    // 4. E se a expansão realmente tiver sido jogada na API (fl_jogou: 1)
    const expansionPlayed = [{
      id_jogo: 1003,
      nm_jogo: 'Wingspan: Oceania',
      tp_jogo: 'e',
      fl_tem: 1,
      fl_jogou: 1,
      qt_partidas: 2,
      _source_lista: 'colecao'
    }];
    const resultPlayed = simulateLudoCollectionImport([], [expansionPlayed], []);
    assert.equal(resultPlayed.length, 1);
    assert.equal(resultPlayed[0].isPlayed, true, 'Expansão com fl_jogou: 1 na API deve vir como JOGADO');
  });

  return { passed, failed };
}
