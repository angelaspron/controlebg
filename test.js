const query = `
  query {
    __type(name: "product") {
      fields {
        name
      }
    }
  }
`;

fetch('https://api.comparajogos.com.br/v1/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
})
  .then(r => r.json())
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(console.error);
