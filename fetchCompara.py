import urllib.request
import json

gameName = "Wyrmspan: Academia dos Dragões"
query = """
    query GetGamePrice($nameExact: String!, $nameLike: String!, $bggId: Int!) {
      byNameExact: product(where: {name: {_ilike: $nameExact}, type: {_eq: game}}, limit: 1) {
        id
        name
        prices { name, price_to, available }
      }
      byNameLike: product(where: {name: {_ilike: $nameLike}, type: {_eq: game}}, limit: 1) {
        id
        name
        prices { name, price_to, available }
      }
    }
"""

data = json.dumps({
    "query": query,
    "variables": {
        "nameExact": gameName,
        "nameLike": "%" + gameName + "%",
        "bggId": 0
    }
}).encode('utf-8')

req = urllib.request.Request("https://api.comparajogos.com.br/v1/graphql", data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        print(json.dumps(result, indent=2))
except Exception as e:
    print(e)
