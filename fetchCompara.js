async function run() {
  const gameName = 'Wyrmspan: Academia dos Dragões';
  const query = `
    query GetGamePrice($nameExact: String!, $nameLike: String!) {
      byNameExact: product(where: {name: {_ilike: $nameExact}}, limit: 1) {
        id
        name
        bgg_id
        type
      }
      byNameLike: product(where: {name: {_ilike: $nameLike}}, limit: 1) {
        id
        name
        bgg_id
        type
      }
    }
  `;
  const variables = {
    nameExact: gameName,
    nameLike: '%' + gameName + '%'
  };
  const res = await fetch('https://api.comparajogos.com.br/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
run();
