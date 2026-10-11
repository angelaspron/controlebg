import { updateSingleGameParallel } from '../src/services/batchProcessor.ts';
import { DEFAULT_BGG_TOKEN } from '../src/services/bggService.ts';

async function testShackleton() {
  console.log('Testing Shackleton Base update...');
  const initialGame = {
    id: 'test-shackleton-1',
    name: 'Shackleton Base',
    bggId: '408180',
    status: 'Na Coleção',
    type: 'Base',
    spend: 0,
    value: 0
  };

  const updated = await updateSingleGameParallel(initialGame, undefined, DEFAULT_BGG_TOKEN);

  console.log('--- RESULTADO DA ATUALIZAÇÃO ---');
  console.log('ID:', updated.id);
  console.log('Nome:', updated.name);
  console.log('BGG ID:', updated.bggId);
  console.log('Tipo:', updated.type);
  console.log('Ano:', updated.yearPublished);
  console.log('Jogadores:', `${updated.minPlayers} - ${updated.maxPlayers}`);
  console.log('Peso (Dificuldade):', updated.weight);
  console.log('Rank:', updated.rank);
  console.log('Nota BGG:', updated.rating);
  console.log('Thumbnail:', updated.thumbnail ? 'SIM' : 'NÃO');
  console.log('Preço Varejo:', updated.retailPrice);
  console.log('Valor Mercado:', updated.value);
  console.log('Mecânicas:', updated.mechanics?.length);
  console.log('Descrição:', updated.description ? 'SIM' : 'NÃO');

  if (!updated.bggId || updated.bggId !== '408180') throw new Error('BGG ID incorreto');
  if (updated.type !== 'Base') throw new Error(`Tipo incorreto: ${updated.type} (esperava Base)`);
  if (!updated.yearPublished || updated.yearPublished !== 2024) throw new Error(`Ano incorreto: ${updated.yearPublished}`);
  if (!updated.weight || updated.weight < 3.5) throw new Error(`Peso incorreto: ${updated.weight}`);
  if (!updated.rank) throw new Error('Rank não encontrado');
  if (!updated.thumbnail) throw new Error('Thumbnail ausente');
  if (!updated.retailPrice || updated.retailPrice <= 0) throw new Error('Preço de varejo ausente');
  if (updated.value !== updated.retailPrice) throw new Error('Valor de mercado deve ser igual ao varejo');

  console.log('\n✔ TESTE 100% SUCESSO SEM FALHAS OU ERROS (0/0)');
}

testShackleton().catch(e => {
  console.error('ERRO:', e);
  process.exit(1);
});
