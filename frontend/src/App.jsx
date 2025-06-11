import { useState, useEffect, useCallback } from "react";

import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useMemo } from "react";
import Sidebar from "./components/Sidebar";
import { Settings } from "lucide-react";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function App() {
  const [dark, setDark] = useState(false);
  const [username, setUsername] = useState("");
  const [game] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [ply, setPly] = useState(0);
  const [loading, setLoading] = useState(false);
  const [orientation, setOrientation] = useState("white");
  const [sandboxGame, setSandboxGame] = useState(null);
  const [sandboxHistory, setSandboxHistory] = useState([]);
  const [blunders, setBlunders] = useState([]);
  const [missedMates, setMissedMates] = useState([]);
  const [gameList, setGameList] = useState([]);
  const [gameType, setGameType] = useState("blitz"); // default to blitz
  const [count, setCount] = useState(1);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [theme, setTheme] = useState("default");

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
    setSandboxHistory([]);
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
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (theme !== "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        if (sandboxGame && sandboxHistory.length > 0) {
          const newHistory = sandboxHistory.slice(0, -1);
          setSandboxHistory(newHistory);
          if (newHistory.length === 0) {
            setSandboxGame(null);
          } else {
            setSandboxGame(new Chess(newHistory[newHistory.length - 1]));
          }
        } else {
          setPly((p) => Math.max(0, p - 1));
        }
      } else if (e.key === "ArrowRight") {
        if (!sandboxGame) {
          setPly((p) => Math.min(moves.length, p + 1));
        }
      } else if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === "x") {
          e.preventDefault();
          setTheme((t) => (t === "dark" ? "" : "dark"));
        } else if (key === "r") {
          e.preventDefault();
          setTheme((t) => (t === "red" ? "" : "red"));
        } else if (key === "y") {
          e.preventDefault();
          setTheme((t) => (t === "yellow" ? "" : "yellow"));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moves.length, sandboxGame, sandboxHistory]);

  function copyPgn() {
    navigator.clipboard.writeText(game.pgn());
  }

  async function fetchLatest() {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/analyze/${username}?type=${gameType}&count=${count}`
      );
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (!data || data.length === 0) {
        alert("No game data found.");
        return;
      }
      setGameList(data);
      setSelectedGameIndex(0); // Default to first game
      const firstGame = data[0];
      setMoves(firstGame.moves);
      setBlunders(firstGame.blunders);
      setMissedMates(firstGame.missedMates);
      setPly(firstGame.moves.length);
    } catch (err) {
      alert("Could not analyze game. See console.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-theme={theme}
      className="min-h-screen font-mono flex flex-col bg-background text-foreground transition-colors"
    >
      <nav className="flex items-center justify-between px-6 py-4 shadow-md transition-colors">
        <h1 className="text-xl font-bold tracking-wide">Blundery</h1>
        <div className="flex items-center gap-3">
          <Select value={gameType} onValueChange={setGameType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className={"font-mono"}>
              <SelectItem value="blitz">Blitz</SelectItem>
              <SelectItem value="rapid">Rapid</SelectItem>
              <SelectItem value="bullet">Bullet</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            min={1}
            max={20}
          />

          <input
            type="text"
            placeholder="Chess.com username"
            className="px-3 py-1 rounded border dark:bg-neutral-700 dark:border-neutral-600 outline-none focus:ring-2 focus:ring-blue-400"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            onClick={fetchLatest}
            className="px-4 py-1 rounded font-mono bg-sidebar-foreground text-primary-foreground hover:bg-green-700 transition"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Analyze"
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="p-2">
                <Settings size={16} className="text-black dark:text-white" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="font-mono"
                onClick={() => setTheme("default")}
              >
                Default
              </DropdownMenuItem>
              <DropdownMenuItem
                className="font-mono"
                onClick={() => setTheme("red")}
              >
                Red
                <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="font-mono"
                onClick={() => setTheme("yellow")}
              >
                Yellow
                <DropdownMenuShortcut>⌘Y</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="font-mono"
                onClick={() => setTheme("dark")}
              >
                Dark
                <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <main className="flex-1 flex justify-end p-6 xl:gap-32">
        <div className="relative w-fit">
          <section className="flex flex-col items-center gap-2">
            {gameList.length > 0 && (
              <div className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                {gameList[selectedGameIndex]?.headers?.players?.black?.name ??
                  "Black"}
              </div>
            )}

            <div className="relative">
              <button
                onClick={() =>
                  setOrientation((o) => (o === "white" ? "black" : "white"))
                }
                className="absolute -top-3 -right-5 z-10 bg-gray-200 dark:bg-neutral-700 p-1 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-600 transition"
                title="Flip Board"
              >
                <Repeat
                  size={18}
                  className="text-neutral-700 dark:text-white"
                />
              </button>

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
                  setSandboxHistory(prev => [...prev, game.fen()]);
                  return true;
                }}
                customBoardStyle={{
                  borderRadius: "0.25rem",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                }}
                customSquareStyles={customSquareStyles}
              />
            </div>

            {gameList.length > 0 && (
              <div className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mt-1">
                {gameList[selectedGameIndex]?.headers?.players?.white?.name ??
                  "White"}
              </div>
            )}

            <div className="w-full flex gap-2 justify-center mt-2">
              <button
                className="flex-1 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 transition"
                onClick={() => goToPly(Math.max(0, ply - 1))}
              >
                ⏮ Prev
              </button>
              <button
                className="flex-1 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 transition"
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
            moves={moves}
            ply={ply}
            setPly={setPly}
            plyForMove={plyForMove}
            setOrientation={setOrientation}
            copyPgn={copyPgn}
          />
        </div>
        <div className="flex flex-col justify-start p-2 items-center w-52 gap-2">
          <div>Imported Games</div>
          {gameList.map((g, i) => {
            const white = g.headers.players?.white?.name ?? "White";
            const black = g.headers.players?.black?.name ?? "Black";
            return (
              <button
                key={i}
                className={`text-left p-2 h-16 w-full hover:scale-105 font-mono transition-transform text-xs rounded-md border ${
                  i === selectedGameIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                }`}
                onClick={() => {
                  setSelectedGameIndex(i);
                  setMoves(g.moves);
                  setBlunders(g.blunders);
                  setMissedMates(g.missedMates);
                  setPly(g.moves.length);
                  setSandboxGame(null);
                  setSandboxHistory([]);
                }}
              >
                {white} vs {black}{" "}
                <span
                  className={`ml-1 ${
                    i === selectedGameIndex
                      ? "text-white"
                      : "text-neutral-400 dark:text-neutral-300"
                  }`}
                >
                  {g.headers.winner === "white"
                    ? "(1-0)"
                    : g.headers.winner === "black"
                    ? "(0-1)"
                    : "(½–½)"}
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-neutral-500 dark:text-neutral-400">
        © {new Date().getFullYear()} Blundery
      </footer>
    </div>
  );
}
