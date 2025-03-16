import requests
import os
from dotenv import load_dotenv

load_dotenv()
GAME_ID = "SveWZixS"
LICHESS_API_TOKEN = os.getenv("LICHESS_API_TOKEN") 

def fetch_annotated_pgn(game_id, token=None):
    url = f"https://lichess.org/game/export/{game_id}?literate=1"
    headers = {}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        return response.text  
    else:
        print(f"❌ Error fetching PGN. Status: {response.status_code}")
        print("Response:", response.text)
        return None

if __name__ == "__main__":
    print("🚀 Fetching annotated PGN from Lichess...")
    pgn_content = fetch_annotated_pgn(GAME_ID, LICHESS_API_TOKEN)

    if pgn_content:
        print("\n✅ Annotated PGN Content:\n")
        print(pgn_content) 
    else:
        print("❌ Failed to retrieve PGN.")
