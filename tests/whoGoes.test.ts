import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { QUEM_VAI_CARDS, getCardSpriteStyle } from '../src/utils/whoGoesUtils.ts';

export async function runWhoGoesTests(logger: (msg: string) => void): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      logger(`  ✔ [QUEM VAI PASS] ${name}`);
    } catch (err: any) {
      failed++;
      logger(`  ✖ [QUEM VAI FAIL] ${name}: ${err.message}`);
    }
  }

  logger('\n--- [QUEM VAI? TESTS] Validação do Seletor de Primeiro Jogador ---');

  // Teste 1: Quantidade de Cartas
  test('Baralho Quem Vai: Deve conter exatamente 27 cartas', () => {
    assert.equal(QUEM_VAI_CARDS.length, 27, 'Total de cartas deve ser estritamente 27');
  });

  // Teste 2: Integridade do Texto das Cartas
  test('Integridade das Cartas: Todas as 27 cartas começam com "Vai quem" e possuem texto válido', () => {
    QUEM_VAI_CARDS.forEach((card, idx) => {
      assert.ok(card.trim().length > 10, `Carta #${idx + 1} deve ter texto descritivo`);
      assert.ok(card.startsWith('Vai quem'), `Carta #${idx + 1} deve começar com "Vai quem": ${card}`);
    });
  });

  // Teste 3: Mapeamento de Cartas de Arte Estilo Cartoon
  test('Mapeamento de Cartas: Cada índice mapeia para seu arquivo individual de ilustração cartoon', () => {
    for (let i = 0; i < 27; i++) {
      const cardStyle = getCardSpriteStyle(i);
      assert.ok(String(cardStyle.backgroundImage).includes(`/boardgame-cards/cartoon/card-${i}.jpg`), `Carta #${i} deve mapear para card-${i}.jpg`);
      assert.equal(cardStyle.backgroundSize, 'cover');
      assert.equal(cardStyle.backgroundPosition, 'center');
    }
  });

  // Teste 4: Existência Física de Todas as 27 Imagens Cartoon
  test('Arquivos de Arte: Todas as 27 ilustrações cartoon existem em public/boardgame-cards/cartoon/ com tamanhos válidos', () => {
    const cartoonDir = path.join(process.cwd(), 'public', 'boardgame-cards', 'cartoon');
    assert.ok(fs.existsSync(cartoonDir), 'Pasta public/boardgame-cards/cartoon deve existir');

    for (let i = 0; i < 27; i++) {
      const cardPath = path.join(cartoonDir, `card-${i}.jpg`);
      assert.ok(fs.existsSync(cardPath), `Ilustração cartoon card-${i}.jpg deve existir`);
      const stat = fs.statSync(cardPath);
      assert.ok(stat.size > 50000, `Carta ${i} deve ter tamanho maior que 50KB (possui ${stat.size} bytes)`);
    }
  });

  return { passed, failed };
}
