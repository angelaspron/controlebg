async function testPreflight() {
  const url = 'https://boardgamegeek.com/xmlapi2/thing?id=408180&stats=1';
  try {
    const res = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization'
      }
    });

    console.log('OPTIONS Preflight Status:', res.status, res.statusText);
    console.log('access-control-allow-origin:', res.headers.get('access-control-allow-origin'));
    console.log('access-control-allow-headers:', res.headers.get('access-control-allow-headers'));
    console.log('access-control-allow-methods:', res.headers.get('access-control-allow-methods'));
  } catch (e) {
    console.error('Error on preflight:', e);
  }
}

testPreflight();
