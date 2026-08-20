import json
import urllib.request
import urllib.error
import argparse

def fetch_game_price(game_name):
    url = "https://api.comparajogos.com.br/v1/graphql"
    
    query = """
    query GetGamePrice($name: String!) {
      product(where: {name: {_ilike: $name}}, limit: 1) {
        id
        name
        product_price {
          min_price
        }
      }
    }
    """
    
    variables = {
        "name": game_name
    }
    
    payload = json.dumps({
        "query": query,
        "variables": variables
    }).encode('utf-8')
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print(f"Buscando informações para: '{game_name}'...")
    
    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            response_data = response.read().decode('utf-8')
            data = json.loads(response_data)
            
            if "errors" in data:
                print("Erro retornado pela API:")
                print(json.dumps(data["errors"], indent=2, ensure_ascii=False))
                return
                
            products = data.get("data", {}).get("product", [])
            
            if not products:
                print("Nenhum jogo encontrado com esse nome.")
                return
                
            game = products[0]
            print("\n--- Resultado ---")
            print(f"Jogo: {game.get('name')}")
            
            product_price = game.get('product_price')
            if product_price and product_price.get('min_price') is not None:
                print(f"Menor Preço de Mercado: R$ {product_price.get('min_price'):.2f}")
            else:
                print("Preço indisponível no momento.")
                
    except urllib.error.URLError as e:
        print(f"Erro na requisição: {e.reason}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Busca o menor preço de um jogo no Compara Jogos.')
    parser.add_argument('jogo', nargs='?', default='Catan', help='Nome do jogo a ser pesquisado')
    
    args = parser.parse_args()
    fetch_game_price(args.jogo)
