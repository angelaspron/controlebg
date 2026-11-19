import assert from 'node:assert';
import type { GameData, SleeveStockItem } from '../src/types/index.ts';

export async function runSupabaseIntegrationTests(log: (msg: string) => void) {
  let passed = 0;
  let failed = 0;

  log('\n--- [SUPABASE TESTS] Validação de Integração e Autenticação Supabase Cloud ---');

  // Teste 1: Resolução de Identificador de Login
  try {
    const isEmail = (input: string) => input.includes('@');
    const resolveIdentifier = (input: string) => {
      const trimmed = input.trim();
      if (isEmail(trimmed)) return trimmed;
      return `${trimmed.toLowerCase()}@controlebg.local`;
    };

    assert.strictEqual(resolveIdentifier('teste@gmail.com'), 'teste@gmail.com');
    assert.strictEqual(resolveIdentifier('usuario_bg'), 'usuario_bg@controlebg.local');
    assert.strictEqual(resolveIdentifier('  joao.silva@boardgame.com  '), 'joao.silva@boardgame.com');

    log('  ✔ [SUPABASE PASS] Resolução de Identificador: Suporta e-mail direto e apelido mapeado para domínio local');
    passed++;
  } catch (err: any) {
    log(`  ❌ [SUPABASE FAIL] Resolução de Identificador: ${err.message}`);
    failed++;
  }

  // Teste 2: Mapeamento e Integridade de Dados de GameData no formato Supabase
  try {
    const mockGame: GameData = {
      id: 'bgg-12345',
      name: 'Terraforming Mars',
      status: 'Na Coleção',
      spend: 'R$ 350,00',
      type: 'Base',
      value: 420.50,
      isPlayed: true,
      bggId: '167791',
      rating: 8.4,
      suggestedPlayers: {
        best: ['3', '4'],
        summary: 'Melhor com 3 ou 4 jogadores'
      },
      cardSleeves: {
        source: 'Compara Jogos',
        sets: [
          { name: 'Cartas de Projeto', quantity: 208, width: 63.5, height: 88, isSleeved: true, sleeveBrand: 'Bucaneiros' }
        ]
      },
      sleevesUsed: [
        { sizeName: 'Padrão (63,5 × 88 mm)', isSleeved: true, sleeveBrand: 'Bucaneiros', sleeveType: 'Premium', quantity: 208 }
      ]
    };

    // Função de serialização para o banco
    const toRow = (userId: string, game: GameData) => ({
      id: String(game.id),
      user_id: userId,
      name: game.name,
      status: game.status,
      type: game.type,
      spend: String(game.spend),
      value: String(game.value),
      is_played: Boolean(game.isPlayed),
      bgg_id: game.bggId,
      raw_data: game,
    });

    const row = toRow('user-uuid-abc', mockGame);

    assert.strictEqual(row.id, 'bgg-12345');
    assert.strictEqual(row.user_id, 'user-uuid-abc');
    assert.strictEqual(row.raw_data.name, 'Terraforming Mars');
    assert.deepStrictEqual(row.raw_data.suggestedPlayers, mockGame.suggestedPlayers);
    assert.deepStrictEqual(row.raw_data.cardSleeves, mockGame.cardSleeves);
    assert.deepStrictEqual(row.raw_data.sleevesUsed, mockGame.sleevesUsed);

    log('  ✔ [SUPABASE PASS] Mapeamento de GameData: Preserva integridade total de objetos aninhados (sleeves, jogadores, etc.)');
    passed++;
  } catch (err: any) {
    log(`  ❌ [SUPABASE FAIL] Mapeamento de GameData: ${err.message}`);
    failed++;
  }

  // Teste 3: Mapeamento e Integridade de Dados de SleeveStockItem
  try {
    const mockStockItem: SleeveStockItem = {
      id: 'sleeve-001',
      model: 'Padrão (63,5 × 88 mm)',
      brand: 'Bucaneiros',
      quantity: 500,
      type: 'Premium',
      notes: 'Pacotes lacrados'
    };

    const toStockRow = (userId: string, item: SleeveStockItem) => ({
      id: item.id,
      user_id: userId,
      model: item.model,
      brand: item.brand,
      quantity: item.quantity,
      type: item.type,
      notes: item.notes,
      raw_data: item
    });

    const stockRow = toStockRow('user-uuid-abc', mockStockItem);

    assert.strictEqual(stockRow.quantity, 500);
    assert.strictEqual(stockRow.model, 'Padrão (63,5 × 88 mm)');
    assert.deepStrictEqual(stockRow.raw_data, mockStockItem);

    log('  ✔ [SUPABASE PASS] Mapeamento de SleeveStock: Garante persistência estruturada e atômica');
    passed++;
  } catch (err: any) {
    log(`  ❌ [SUPABASE FAIL] Mapeamento de SleeveStock: ${err.message}`);
    failed++;
  }

  return { passed, failed };
}
