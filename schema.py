import json
import urllib.request
import urllib.error

url = "https://api.comparajogos.com.br/v1/graphql"
query = """
query {
  __type(name: "product") {
    fields {
      name
    }
  }
}
"""

payload = json.dumps({"query": query}).encode('utf-8')
headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}

req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        print(json.dumps(data, indent=2))
except urllib.error.URLError as e:
    print(f"Error: {e}")
