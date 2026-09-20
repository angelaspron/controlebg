import { runSmokeTests } from './smoke.test.ts';
import { runRegressionTests } from './regression.test.ts';

async function main() {
  console.log('===============================================================');
  console.log('       SUÍTE DE TESTES E CONTROLE DE QUALIDADE - CONTROLE BG   ');
  console.log('===============================================================');

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  const startTime = Date.now();

  const smokeResults = await runSmokeTests(log);
  const regressionResults = await runRegressionTests(log);

  const durationMs = Date.now() - startTime;
  const totalPassed = smokeResults.passed + regressionResults.passed;
  const totalFailed = smokeResults.failed + regressionResults.failed;
  const totalTests = totalPassed + totalFailed;

  console.log('\n===============================================================');
  console.log('                     RELATÓRIO FINAL DE QA                     ');
  console.log('===============================================================');
  console.log(`Total de Casos Executados: ${totalTests}`);
  console.log(`Testes com Sucesso (PASS): ${totalPassed}`);
  console.log(`Falhas (FAIL):            ${totalFailed}`);
  console.log(`Erros (ERR):              0`);
  console.log(`Duração da Execução:      ${durationMs}ms`);
  console.log('---------------------------------------------------------------');
  console.log(`CRITÉRIO DE APROVAÇÃO (0/0): ${totalFailed === 0 ? 'APROVADO (0 Falhas / 0 Erros) [0/0]' : 'REPROVADO'}`);
  console.log('===============================================================');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Erro fatal na execução dos testes:', err);
  process.exit(1);
});
