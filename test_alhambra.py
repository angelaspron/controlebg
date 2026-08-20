import json
import urllib.request
url = 'https://api.comparajogos.com.br/v1/graphql'
query = '''
query GetAlhambraPrices {
    product(where: {bgg_id: {_eq: 6249}}, limit: 10) {
      name
      prices {
        name
        price_to
        available
        store { name }
      }
    }
}
'''
payload = json.dumps({'query': query}).encode('utf-8')
headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
res = urllib.request.urlopen(req).read().decode('utf-8')
print(json.dumps(json.loads(res), indent=2))
