import requests
import time
import os
import chess.pgn
from io import StringIO
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Lichess API token and username
LICHESS_API_TOKEN = os.getenv("LICHESS_API_TOKEN")
USERNAME = "honorable_knight00"

def import_game_to_lichess(pgn_text, token):
    """Uploads a PGN to Lichess and returns the new Lichess game ID."""
    url = "https://lichess.org/api/import"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"pgn": pgn_text}

    response = requests.post(url, headers=headers, data=data)

    if response.status_code == 200:
        game_info = response.json()
        game_id = game_info.get("id")
        if game_id:
            print(f"✅ Game successfully imported! Lichess URL: {game_info.get('url')}")
            return game_id
        else:
            print("❌ Game imported, but no game ID found.")
            return None
    else:
        print(f"❌ Error importing game. Status: {response.status_code}")
        print("Response:", response.text)
        return None

def fetch_annotated_pgn(game_id, token):
    """Fetches the PGN with blunder/mistake annotations from Lichess."""
    url = f"https://lichess.org/game/export/{game_id}?literate=1"
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        print("📥 Successfully fetched annotated PGN")
        return response.text  # PGN text content
    else:
        print(f"❌ Error fetching PGN. Status: {response.status_code}")
        print("Response:", response.text)
        return None

def extract_blunders_from_pgn(pgn_text, username):
    """Extracts blunders made only by the specified user, with actual move numbers."""
    print("🔍 Parsing PGN to extract blunders...")
    pgn_io = StringIO(pgn_text)
    game = chess.pgn.read_game(pgn_io)

    if not game:
        print("❌ Error parsing PGN.")
        return []

    # Determine player's color
    white_player = game.headers.get("White", "").lower()
    black_player = game.headers.get("Black", "").lower()

    if username.lower() == white_player:
        player_color = chess.WHITE
        print(f"🎭 {username} is playing as WHITE")
    elif username.lower() == black_player:
        player_color = chess.BLACK
        print(f"🎭 {username} is playing as BLACK")
    else:
        print(f"❌ Username '{username}' not found in game headers.")
        return []

    blunders = []
    node = game

    while node.variations:
        next_node = node.variation(0)
        move = next_node.move
        move_comment = next_node.comment

        # Get actual move number
        move_number = (node.ply() // 2) + 1  # Convert ply count to move number

        print(f"📝 Move: {node.board().san(move)} | Turn: {'White' if node.board().turn == chess.WHITE else 'Black'} | Comment: {move_comment}")

        # Extract blunders only for the user
        if node.board().turn == player_color and "Blunder" in move_comment:
            move_san = node.board().san(move)
            move_format = f"{move_number}. {move_san}" if player_color == chess.WHITE else f"{move_number}... {move_san}"
            blunders.append(f"{move_format}: {move_comment.strip()}")

        node = next_node

    return blunders

if __name__ == "__main__":
    pgn_file_path = "samplegame.pgn"

    # 1. Read PGN file
    print("📂 Reading PGN file...")
    with open(pgn_file_path, "r", encoding="utf-8") as f:
        pgn_text = f.read().strip()

    # 2. Import game to Lichess
    print("🚀 Uploading game to Lichess...")
    game_id = import_game_to_lichess(pgn_text, LICHESS_API_TOKEN)
    if not game_id:
        print("❌ Game import failed. Exiting.")
        exit(1)

    # 3. Wait 10 seconds for analysis
    print("⏳ Waiting 10 seconds for analysis...")
    time.sleep(10)

    # 4. Fetch analyzed PGN
    print("📥 Fetching analyzed PGN with blunder comments...")
    pgn_analysis = fetch_annotated_pgn(game_id, LICHESS_API_TOKEN)
    
    if not pgn_analysis:
        print("❌ Failed to retrieve PGN analysis.")
        exit(1)

    # 5. Extract blunders only by `honorable_knight00`
    blunders = extract_blunders_from_pgn(pgn_analysis, USERNAME)

    if blunders:
        print(f"🚨 Detected {len(blunders)} blunder(s) by {USERNAME}:")
        for idx, annotation in enumerate(blunders, start=1):
            print(f"  {annotation}")
    else:
        print(f"✅ No blunders detected for {USERNAME}.")
