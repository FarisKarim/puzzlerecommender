import chess
import chess.pgn
import chess.engine

STOCKFISH_PATH = "./stockfish/stockfish"  # Update with your actual Stockfish path

def get_eval(board, engine, color):
    """
    Evaluates the board from the perspective of the given color.
    """
    info = engine.analyse(board, chess.engine.Limit(depth=15))
    return info["score"].pov(color).score(mate_score=1000)

def detect_user_blunders(game, user_color, threshold=300):
    """
    Analyzes the game and flags user moves that cause a drop
    of at least 'threshold' centipawns in the evaluation.
    """
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    board = game.board()
    blunders = []

    print("\nUser Blunder Detection:")
    for move in game.mainline_moves():
        # Only consider moves if it's user's turn
        if board.turn == user_color:
            # Evaluate board before the move
            prev_eval = get_eval(board, engine, user_color)
            fen_before = board.fen()  # FEN before the user move
            board.push(move)

            # Evaluate board after the move
            new_eval = get_eval(board, engine, user_color)
            score_drop = prev_eval - new_eval

            if score_drop >= threshold:
                move_number = board.fullmove_number
                # Print the FEN of the position before the blunder move
                print(f"FEN before blunder: {fen_before}")
                print(f"🚨 Blunder on Move {move_number} "
                      f"by {'White' if user_color == chess.WHITE else 'Black'}: "
                      f"{move}, Score Drop: {score_drop}")
                blunders.append((move_number, move, score_drop))
        else:
            board.push(move)

    engine.quit()
    return blunders

def load_game_for_user(file_path, username):
    """
    Reads through the PGN and returns the first game where
    'username' is found in the White or Black headers.
    If none is found, returns None.
    """
    with open(file_path, "r", encoding="utf-8") as pgn:
        while True:
            game = chess.pgn.read_game(pgn)
            if not game:
                break  # No more games in PGN
            white_name = game.headers.get("White", "").lower()
            black_name = game.headers.get("Black", "").lower()
            if white_name == username.lower():
                return game, chess.WHITE
            if black_name == username.lower():
                return game, chess.BLACK
    return None, None

if __name__ == "__main__":
    # Adjust these as needed
    username = "honorable_knight00"
    pgn_file = "samplegame.pgn"
    blunder_threshold = 300

    game, user_color = load_game_for_user(pgn_file, username)
    if game is None:
        print(f"Could not find a game in '{pgn_file}' with user '{username}'.")
    else:
        blunders = detect_user_blunders(game, user_color, threshold=blunder_threshold)
        print("\nDetected User Blunders:")
        for move_num, move, drop in blunders:
            print(f"Move {move_num}: {move}, Eval Drop: {drop}")
