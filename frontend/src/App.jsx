import { useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useMemo } from "react";

export default function App() {
  /* ---------- state ---------- */
  const [dark, setDark] = useState(false);
  const [username, setUsername] = useState("");

  const [game] = useState(new Chess()); // immutable master game
  const [moves, setMoves] = useState([]); // moves from the backend
  const [ply, setPly] = useState(0); // current move number
  const [loading, setLoading] = useState(false);

  const [orientation, setOrientation] = useState("white");
  const [showCoords, setShowCoords] = useState(true);

  const [blunders, setBlunders] = useState([]);
  const [missedMates, setMissedMates] = useState([]);

  /* ---------- derived ---------- */
  const fen = useMemo(() => {
    const tmp = new Chess();
    moves.slice(0, ply).forEach((m) => tmp.move(m, { sloppy: true }));
    return tmp.fen();
  }, [moves, ply]);

  const lastMove = ply > 0 ? moves[ply - 1] : null;

  /* ---------- theme ---------- */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  /* ---------- helpers ---------- */
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

      setMoves(data.moves); // array of SAN strings
      setBlunders(data.blunders);
      setMissedMates(data.missedMates);
      setPly(data.moves.length); // jump to end
    } catch (err) {
      alert("Could not analyze game. See console.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 shadow-md bg-white dark:bg-neutral-800">
        <h1 className="text-xl font-bold tracking-wide">
          Chess Blunder Tracker
        </h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Chess.com username"
            className="px-3 py-1 rounded border dark:bg-neutral-700 dark:border-neutral-600 outline-none focus:ring-2 focus:ring-blue-400"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            onClick={() => fetchLatest()}
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

      {/* Main area */}
      <main className="flex-1 p-6">
        <div className="relative mx-auto w-fit">
          {/* Board */}
          <section className="flex flex-col items-center gap-4">
            <div className="relative">
              {/* Eval bar (placeholder) */}
              <div className="absolute -left-3 top-0 h-full w-2 rounded bg-gradient-to-b from-green-500 via-gray-300 to-red-600" />
              <Chessboard
                id="review-board"
                position={fen}
                boardWidth={480}
                boardOrientation={orientation}
                showCoordinates={showCoords}
                arePiecesDraggable={false}
                customBoardStyle={{
                  borderRadius: "0.5rem",
                  boxShadow: dark
                    ? "0 4px 12px rgba(0,0,0,0.5)"
                    : "0 4px 12px rgba(0,0,0,0.1)",
                }}
                customSquareStyles={
                  lastMove
                    ? {
                        [lastMove.from]: { background: "rgba(255,255,0,0.5)" },
                        [lastMove.to]: { background: "rgba(255,255,0,0.5)" },
                      }
                    : {}
                }
              />
            </div>

            {/* Ply controls */}
            <div className="w-full flex gap-2 justify-center">
              <button
                className="flex-1 py-1 rounded bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
                onClick={() => setPly(Math.max(0, ply - 1))}
              >
                ⏮ Prev
              </button>
              <button
                className="flex-1 py-1 rounded bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
                onClick={() => setPly(Math.min(moves.length, ply + 1))}
              >
                Next ⏭
              </button>
            </div>
          </section>

          {/* --- Sidebar container --- */}
          <aside className="absolute -left-[25rem] top-0 w-96 flex flex-col gap-6">
            {/* Header */}
            <header className="text-xl font-semibold px-4">
              Analysis Panel
            </header>

            {/* Blunders card */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow p-4">
              <h2 className="text-lg font-semibold mb-2">Blunders</h2>
              {blunders.length === 0 ? (
                <p className="text-sm text-neutral-500">No blunders yet.</p>
              ) : (
                <ul className="space-y-2">
                  {blunders.map((b) => (
                    <li key={b.moveNumber} className="text-sm">
                      <span className="font-medium">#{b.moveNumber}</span> –{" "}
                      {b.move}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Missed mates card */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow p-4">
              <h2 className="text-lg font-semibold mb-2">Missed Mates</h2>
              {missedMates.length === 0 ? (
                <p className="text-sm text-neutral-500">No missed mates.</p>
              ) : (
                <ul className="space-y-2">
                  {missedMates.map((m) => (
                    <li key={m.moveNumber} className="text-sm">
                      <span className="font-medium">#{m.moveNumber}</span> –{" "}
                      {m.move}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Move list */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow p-4 max-h-64 overflow-y-auto">
              <h2 className="text-lg font-semibold mb-2">Moves</h2>
              <ol className="text-sm space-y-1">
                {moves.map((m, i) => (
                  <li
                    key={i}
                    onClick={() => setPly(i + 1)}
                    className={`cursor-pointer px-1 rounded ${
                      i + 1 === ply
                        ? "bg-blue-500 text-white"
                        : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {i + 1}. {m}
                  </li>
                ))}
              </ol>
            </div>

            {/* Board controls */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow p-4 flex flex-col gap-2">
              <button
                onClick={() =>
                  setOrientation((o) => (o === "white" ? "black" : "white"))
                }
                className="py-1 rounded bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
              >
                🔄 Flip Board
              </button>
              <button
                onClick={() => setShowCoords((c) => !c)}
                className="py-1 rounded bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
              >
                {showCoords ? "📐 Hide Coords" : "📐 Show Coords"}
              </button>
              <button
                onClick={copyPgn}
                className="py-1 rounded bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
              >
                📋 Copy PGN
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-neutral-500 dark:text-neutral-400">
        © {new Date().getFullYear()} Chess Blunder Tracker
      </footer>
    </div>
  );
}
