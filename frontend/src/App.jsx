import { useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useMemo } from "react";
import Sidebar from "./components/Sidebar"; 

export default function App() {
  const [dark, setDark] = useState(false);
  const [username, setUsername] = useState("");
  const [game] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [ply, setPly] = useState(0);
  const [loading, setLoading] = useState(false);
  const [orientation, setOrientation] = useState("white");
  const [sandboxGame, setSandboxGame] = useState(null);
  const [blunders, setBlunders] = useState([]);
  const [missedMates, setMissedMates] = useState([]);

  const customSquareStyles = useMemo(() => {
    if (ply === 0) return {};

    const tmp = new Chess();
    let move = null;
    for (let i = 0; i < ply; i++) {
      move = tmp.move(moves[i], { sloppy: true });
    }

    if (!move || !move.from || !move.to) return {};
    return {
      [move.from]: { backgroundColor: "rgba(135, 206, 250, 0.6)" }, 
      [move.to]: { backgroundColor: "rgba(30, 64, 175, 0.8)" },
    };
  }, [moves, ply]);

  const plyForMove = (moveNumber, san) => {
    const base = (moveNumber - 1) * 2;
    if (moves[base] === san) return base + 1;
    if (moves[base + 1] === san) return base + 2;
    return base + 1;
  };

  const goToPly = (newPly) => {
    setSandboxGame(null);
    setPly(newPly);
  };

  const fullMoves = useMemo(() => {
    const out = [];
    for (let i = 0; i < moves.length; i += 2) {
      out.push({ no: i / 2 + 1, w: moves[i] ?? "", b: moves[i + 1] ?? "" });
    }
    return out;
  }, [moves]);

  const fen = useMemo(() => {
    if (sandboxGame) return sandboxGame.fen();
    const tmp = new Chess();
    moves.slice(0, ply).forEach((m) => tmp.move(m, { sloppy: true }));
    return tmp.fen();
  }, [moves, ply, sandboxGame]);

  // const lastMove = ply > 0 ? moves[ply - 1] : null;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
      else if (e.key === "ArrowRight")
        setPly((p) => Math.min(moves.length, p + 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moves.length]);

  function copyPgn() {
    navigator.clipboard.writeText(game.pgn());
  }

  async function fetchLatest() {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/analyze/${username}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setMoves(data.moves);
      setBlunders(data.blunders);
      setMissedMates(data.missedMates);
      setPly(data.moves.length);
    } catch (err) {
      alert("Could not analyze game. See console.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen font-roboto flex flex-col bg-gray-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-colors">
      <nav className="flex items-center justify-between px-6 py-4 shadow-md bg-white dark:bg-neutral-800">
        <h1 className="text-xl font-bold tracking-wide">Blundery</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Chess.com username"
            className="px-3 py-1 rounded border dark:bg-neutral-700 dark:border-neutral-600 outline-none focus:ring-2 focus:ring-blue-400"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            onClick={fetchLatest}
            className="px-4 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            {loading ? "..." : "Analyze"}
          </button>
          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-neutral-700 transition"
            aria-label="toggle theme"
          >
            {dark ? "🌞" : "🌙"}
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6">
        <div className="relative mx-auto w-fit">
          <section className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute -left-3 top-0 h-full w-2 rounded bg-gradient-to-b from-green-500 via-gray-300 to-red-600" />
              <Chessboard
                id="review-board"
                position={fen}
                boardWidth={550}
                boardOrientation={orientation}
                showCoordinates={true}
                arePiecesDraggable={true}
                onPieceDrop={(sourceSquare, targetSquare) => {
                  const game = new Chess(fen);
                  const move = game.move({
                    from: sourceSquare,
                    to: targetSquare,
                    promotion: "q",
                  });
                  if (move === null) return false;
                  setSandboxGame(game);
                  return true;
                }}
                customBoardStyle={{
                  borderRadius: "0.5rem",
                  boxShadow: dark
                    ? "0 4px 12px rgba(0,0,0,0.5)"
                    : "0 4px 12px rgba(0,0,0,0.1)",
                }}
                customSquareStyles={customSquareStyles}
              />
            </div>
            <div className="w-full flex gap-2 justify-center">
              <button
                className="flex-1 py-1 rounded bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
                onClick={() => goToPly(Math.max(0, ply - 1))}
              >
                ⏮ Prev
              </button>
              <button
                className="flex-1 py-1 rounded bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
                onClick={() => goToPly(Math.min(moves.length, ply + 1))}
              >
                Next ⏭
              </button>
            </div>
          </section>

          <Sidebar
            blunders={blunders}
            missedMates={missedMates}
            fullMoves={fullMoves}
            ply={ply}
            setPly={setPly}
            plyForMove={plyForMove}
            setOrientation={setOrientation}
            copyPgn={copyPgn}
          />
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-neutral-500 dark:text-neutral-400">
        © {new Date().getFullYear()} Chesser Tracker
      </footer>
    </div>
  );
}
