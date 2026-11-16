import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

  // Teste 3: Mapeamento de Cartas com 27 Imagens Exclusivas
  test('Mapeamento de Cartas: Cada índice mapeia para seu arquivo individual de carta exclusiva', () => {
    for (let i = 0; i < 27; i++) {
      const cardStyle = getCardSpriteStyle(i);
      assert.ok(String(cardStyle.backgroundImage).includes(`/boardgame-cards/quem-vai-cards/card-${i}.png`), `Carta #${i} deve mapear para card-${i}.png`);
      assert.equal(cardStyle.backgroundSize, 'cover');
      assert.equal(cardStyle.backgroundPosition, 'center');
    }
  });

  // Teste 4: Existência Física e Unicidade Absoluta das 27 Cartas
  test('Arquivos de Arte: Todas as 27 cartas existem em public/boardgame-cards/quem-vai-cards/ e nenhuma é repetida', () => {
    const cardsDir = path.join(process.cwd(), 'public', 'boardgame-cards', 'quem-vai-cards');
    assert.ok(fs.existsSync(cardsDir), 'Pasta public/boardgame-cards/quem-vai-cards deve existir');

    const hashes = new Set<string>();

    for (let i = 0; i < 27; i++) {
      const cardPath = path.join(cardsDir, `card-${i}.png`);
      assert.ok(fs.existsSync(cardPath), `Carta card-${i}.png deve existir`);
      const stat = fs.statSync(cardPath);
      assert.ok(stat.size > 20000, `Carta ${i} deve ter tamanho maior que 20KB (possui ${stat.size} bytes)`);

      const buf = fs.readFileSync(cardPath);
      const hash = crypto.createHash('md5').update(buf).digest('hex');
      assert.ok(!hashes.has(hash), `Regra de ouro violada: Carta #${i} é repetida (hash idêntico a outra carta)`);
      hashes.add(hash);
    }

    assert.equal(hashes.size, 27, 'Todas as 27 cartas devem ser rigorosamente únicas e diferentes entre si');
  });

  return { passed, failed };
}
