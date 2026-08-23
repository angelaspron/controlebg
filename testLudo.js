const https = require('https');

const options = {
  hostname: 'ludopedia.com.br',
  path: '/api/v1/jogos?search=7%20Wonders',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const data = JSON.parse(body);
    if (data.jogos && data.jogos.length > 0) {
      const jogoId = data.jogos[0].id_jogo;
      console.log('ID do Jogo:', jogoId);
      
      const options2 = {
        hostname: 'ludopedia.com.br',
        path: `/api/v1/jogos/${jogoId}`,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      };
      const req2 = https.request(options2, (res2) => {
        let body2 = '';
        res2.on('data', d => body2 += d);
        res2.on('end', () => {
          const data2 = JSON.parse(body2);
          console.log('Keys:', Object.keys(data2));
          console.log('Descricao:', (data2.descricao || '').substring(0, 100));
        });
      });
      req2.on('error', console.error);
      req2.end();
    }
  });
});
req.on('error', console.error);
req.end();
