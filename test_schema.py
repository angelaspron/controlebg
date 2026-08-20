import json
import urllib.request
url = 'https://api.comparajogos.com.br/v1/graphql'
query = """
query IntrospectionQuery {
  __type(name: "price") {
    fields {
      name
      type { name kind }
    }
  }
}
"""
payload = json.dumps({'query': query}).encode('utf-8')
headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
res = urllib.request.urlopen(req).read().decode('utf-8')
data = json.loads(res)
for f in data['data']['__type']['fields']:
    print(f['name'])
