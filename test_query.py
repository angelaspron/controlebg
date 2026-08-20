import json
import urllib.request
url = 'https://api.comparajogos.com.br/v1/graphql'
query = '''
query GetGamePrice($nameExact: String!, $nameLike: String!, $bggId: Int!) {
  byBggId: product(where: {bgg_id: {_eq: $bggId}}, limit: 1) {
    id
    name
    product_price { min_price }
  }
  byNameExact: product(where: {name: {_ilike: $nameExact}, type: {_eq: game}}, limit: 1) {
    id
    name
    product_price { min_price }
  }
  byNameLike: product(where: {name: {_ilike: $nameLike}, type: {_eq: game}}, limit: 1) {
    id
    name
    product_price { min_price }
  }
}
'''
variables = {'nameExact': 'Ark Nova', 'nameLike': '%Ark Nova%', 'bggId': 342942}
payload = json.dumps({'query': query, 'variables': variables}).encode('utf-8')
headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
try:
    res = urllib.request.urlopen(req).read().decode('utf-8')
    print(json.dumps(json.loads(res), indent=2))
except Exception as e:
    print('Error:', e)
