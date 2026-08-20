const https = require('https');
const data = JSON.stringify({
  query: `
    query GetGamePrice($nameExact: String!, $nameLike: String!) {
      byNameExact: product(where: {name: {_ilike: $nameExact}}, limit: 1) {
        id
        name
        type
        bgg_id
      }
      byNameLike: product(where: {name: {_ilike: $nameLike}}, limit: 1) {
        id
        name
        type
        bgg_id
      }
    }
  `,
  variables: {
    nameExact: "Wyrmspan: Academia dos Dragões",
    nameLike: "%Wyrmspan: Academia dos Dragões%"
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
req.on('error', e => console.error(e));
req.write(data);
req.end();
