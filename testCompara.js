const https = require('https');

const data = JSON.stringify({
  query: `
    query GetGameDesc($nameExact: String!) {
      product(where: {name: {_ilike: $nameExact}}, limit: 1) {
        id
        name
        description
        bgg_id
        min_players
        max_players
        best_players
      }
    }
  `,
  variables: {
    nameExact: "%7 Wonders%"
  }
});

const options = {
  hostname: 'api.comparajogos.com.br',
  path: '/v1/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'Mozilla/5.0'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(body));
});

req.on('error', console.error);
req.write(data);
req.end();
