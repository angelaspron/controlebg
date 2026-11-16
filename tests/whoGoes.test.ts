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

  // Teste 3: Mapeamento de Sprite Sheets (3 sheets x 9 cartas = 27)
  test('Mapeamento de Sprite: Distribui 9 cartas por folha com coordenadas corretas', () => {
    // Sheet 1 (índices 0 a 8)
    const card0 = getCardSpriteStyle(0);
    assert.ok(String(card0.backgroundImage).includes('quem-vai-v2-sheet-1.png'));
    assert.equal(card0.backgroundPosition, '0% 0%');

    const card4 = getCardSpriteStyle(4);
    assert.ok(String(card4.backgroundImage).includes('quem-vai-v2-sheet-1.png'));
    assert.equal(card4.backgroundPosition, '50% 50%');

    const card8 = getCardSpriteStyle(8);
    assert.ok(String(card8.backgroundImage).includes('quem-vai-v2-sheet-1.png'));
    assert.equal(card8.backgroundPosition, '100% 100%');

    // Sheet 2 (índices 9 a 17)
    const card9 = getCardSpriteStyle(9);
    assert.ok(String(card9.backgroundImage).includes('quem-vai-v2-sheet-2.png'));
    assert.equal(card9.backgroundPosition, '0% 0%');

    const card17 = getCardSpriteStyle(17);
    assert.ok(String(card17.backgroundImage).includes('quem-vai-v2-sheet-2.png'));
    assert.equal(card17.backgroundPosition, '100% 100%');

    // Sheet 3 (índices 18 a 26)
    const card18 = getCardSpriteStyle(18);
    assert.ok(String(card18.backgroundImage).includes('quem-vai-v2-sheet-3.png'));
    assert.equal(card18.backgroundPosition, '0% 0%');

    const card26 = getCardSpriteStyle(26);
    assert.ok(String(card26.backgroundImage).includes('quem-vai-v2-sheet-3.png'));
    assert.equal(card26.backgroundPosition, '100% 100%');
  });

  // Teste 4: Existência Física dos Arquivos de Imagem
  test('Arquivos de Arte: As 3 folhas PNG existem em public/boardgame-cards/ com tamanhos válidos', () => {
    const cardsDir = path.join(process.cwd(), 'public', 'boardgame-cards');
    assert.ok(fs.existsSync(cardsDir), 'Pasta public/boardgame-cards deve existir');

    for (let i = 1; i <= 3; i++) {
      const sheetPath = path.join(cardsDir, `quem-vai-v2-sheet-${i}.png`);
      assert.ok(fs.existsSync(sheetPath), `Folha quem-vai-v2-sheet-${i}.png deve existir`);
      const stat = fs.statSync(sheetPath);
      assert.ok(stat.size > 1000000, `Folha ${i} deve ter tamanho maior que 1MB (possui ${stat.size} bytes)`);
    }
  });

  return { passed, failed };
}
