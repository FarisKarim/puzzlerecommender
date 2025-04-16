import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Copy, Repeat } from "lucide-react";
import SkeletonLoader from "@/components/SkeletonLoader";

function Sidebar({
  blunders,
  missedMates,
  fullMoves,
  moves,
  ply,
  setPly,
  plyForMove,
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <aside
      className={`fixed top-17 left-0 h-[calc(100vh-4rem)] z-40 transition-all duration-300 ${
        open ? "w-48 md:w-64 lg:72 xl:w-96" : "w-12"
      }`}
    >
      {/* Sidebar content */}
      <div
        className="h-full backdrop-blur-xl  shadow-lg p-3 flex flex-col gap-4"
        style={{
          backgroundColor: "var(--sidebar)",
          color: "var(--sidebar-foreground)",
        }}
      >
        {/* Toggle button */}
        <button
          className="absolute -top-1 -right-4 text-black p-1 rounded-full bg-green-400 border shadow-lg hover:bg-green-700"
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>

        {open && (
          <>
            {/* Blunders Card */}
            <Card title="Blunders" accent="text-red-500  dark:text-red-400">
              {moves.length === 0 ? (
                <SkeletonLoader />
              ) : blunders.length === 0 ? (
                <EmptyCard text="No blunders found." />
              ) : (
                <ul className="space-y-2 text-sm">
                  {blunders.map((b) => (
                    <li
                      key={b.moveNumber}
                      onClick={() => setPly(plyForMove(b.moveNumber, b.move))}
                      className="cursor-pointer flex justify-between hover:text-red-400 transition"
                    >
                      <div>
                        <span className="font-medium">#{b.moveNumber}</span> –{" "}
                        {b.move}{" "}
                      </div>
                      <span className="px-2 ml-4 bg-green-600 rounded-md">
                        {b.bestMove}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Missed Mates */}
            <Card title="Missed Mates" accent="text-purple-500">
              {moves.length === 0 ? (
                <SkeletonLoader />
              ) : missedMates.length === 0 ? (
                <EmptyCard text="No missed mates." />
              ) : (
                <ul className="space-y-2 text-sm">
                  {missedMates.map((m) => (
                    <li
                      key={m.moveNumber}
                      onClick={() => setPly(plyForMove(m.moveNumber, m.move))}
                      className="cursor-pointer flex justify-between hover:text-purple-400 transition"
                    >
                      <div>
                        <span className="font-medium">#{m.moveNumber}</span> –{" "}
                        {m.move}{" "}
                      </div>
                      <span className="px-2 ml-4 bg-green-600 rounded-md">
                        {m.bestMove}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Move list */}
            <Card title="Moves" accent="text-blue-500">
              {moves.length === 0 ? (
                <SkeletonLoader />
              ) : (
                <ol className="text-sm space-y-1">
                  {fullMoves.map((m, idx) => (
                    <li
                      key={idx}
                      className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center"
                    >
                      <span className="text-right">{m.no}.</span>
                      <span
                        onClick={() => setPly(idx * 2 + 1)}
                        className="cursor-pointer px-1 py-0.5 rounded"
                        style={
                          ply === idx * 2 + 1
                            ? {
                                backgroundColor: "var(--primary)",
                                color: "var(--primary-foreground)",
                              }
                            : {}
                        }
                      >
                        {m.w}
                      </span>
                      <span
                        onClick={() => setPly(idx * 2 + 2)}
                        className="cursor-pointer px-1 py-0.5 rounded"
                        style={
                          ply === idx * 2 + 2
                            ? {
                                backgroundColor: "var(--primary)",
                                color: "var(--primary-foreground)",
                              }
                            : {}
                        }
                      >
                        {m.b}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card
              title="Recommended Puzzles"
              accent="text-green-500 dark:text-green-600"
            >
              <SkeletonLoader />
            </Card>

            {/* Board Controls */}
            {/* <Card title="Controls" accent="text-neutral-500">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    setOrientation((o) => (o === "white" ? "black" : "white"))
                  }
                  className="flex items-center gap-2 justify-center py-1 px-3 rounded bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600"
                >
                  <Repeat size={16} />
                  Flip Board
                </button>
                <button
                  onClick={copyPgn}
                  className="flex items-center gap-2 justify-center py-1 px-3 rounded bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600"
                >
                  <Copy size={16} />
                  Copy FEN
                </button>
              </div>
            </Card> */}
          </>
        )}
      </div>
    </aside>
  );
}

function Card({ title, accent = "", children }) {
  return (
    <div className="rounded-sm hover:scale-105 transition-transform shadow-md bg-white dark:bg-neutral-700 p-3 w-full h-40 overflow-y-auto">
      <h2
        className={`text-xl text-center h-10 overflow-hidden font-bold mb-2 border-b pb-1 ${accent}`}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyCard({ text }) {
  return <p className="text-sm text-neutral-400">{text}</p>;
}

export default Sidebar;
