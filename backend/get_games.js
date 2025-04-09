require("dotenv").config();
const axios = require("axios");
const ChessWebAPI = require("chess-web-api");
const { Chess } = require("chess.js");
const { spawn } = require("child_process");
const path = require("path");
const LICHESS_API_TOKEN = process.env.LICHESS_API_TOKEN;
const chessAPI = new ChessWebAPI();

/* ────────────────────────────────────────────────────────────── */
/*  Persistent Stockfish process (starts once, reused everywhere) */
/* ────────────────────────────────────────────────────────────── */
const engine = spawn(path.join(__dirname, "stockfish", "stockfish"));
console.log(
  "⏩ Launching Stockfish:",
  path.join(__dirname, "stockfish", "stockfish")
);

engine.on("error", (e) => console.error("❌  Spawn error:", e));
engine.on("close", (c) => console.log("⚠️  Stockfish closed with code", c));

let sfReady = false;
const sfQueue = []; // pending evaluation jobs
engine.listener = null; // per‑job output handler

engine.stdout.on("data", (chunk) => {
  const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (!sfReady && line === "uciok") {
      sfReady = true;
      engine.stdin.write("isready\n");
      continue;
    }
    if (line === "readyok") {
      console.log("🚀 Stockfish says ready — pulling next job");
      const next = sfQueue.shift();
      if (next) next();
      continue;
    }
    if (engine.listener) engine.listener(line);
  }
});

engine.stdin.write("uci\n");
/* ────────────────────────────────────────────────────────────── */

/* 1) Fetch the most recent Chess.com PGN */
async function getLatestGamesPGN(username, gameType, count) {
  const res = await chessAPI.getPlayerMonthlyArchives(username);
  const archives = res.body.archives;
  const matchingGames = [];

  for (let i = archives.length - 1; i >= 0 && matchingGames.length < count; i--) {
    const archiveUrl = archives[i];
    const [year, month] = archiveUrl.split("/").slice(-2);
    const gamesRes = await chessAPI.getPlayerCompleteMonthlyArchives(username, year, month);

    const allGames = gamesRes.body.games;
    let filtered = allGames.filter((g) => ["bullet", "blitz", "rapid"].includes(g.time_class));
    if (gameType) filtered = filtered.filter((g) => g.time_class === gameType);

    for (const g of filtered.reverse()) {
      if (matchingGames.length < count && g.pgn) {
        matchingGames.push(g.pgn);
      }
    }
  }

  return matchingGames;
}


/* 2) Import that PGN to Lichess & get JSON instead of a standard PGN */
async function getLichessJsonFromPgn(pgn) {
  if (!pgn) return null;
  try {
    const importUrl = "https://lichess.org/api/import";
    const headers = {
      Authorization: `Bearer ${LICHESS_API_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const resp = await axios.post(importUrl, new URLSearchParams({ pgn }), {
      headers,
    });
    if (resp.status !== 200 || !resp.data.id) {
      console.log("❌ Lichess import failed:", resp.data);
      return null;
    }
    const gameId = resp.data.id;
    console.log(`✅ Imported to Lichess: ${resp.data.url}`);

    const exportUrl = `https://lichess.org/game/export/${gameId}`;
    const exportResp = await axios.get(exportUrl, { headers });
    if (exportResp.status !== 200) {
      console.log("❌ Lichess export failed.");
      return null;
    }
    return exportResp.data; // JSON with moves, players, etc.
  } catch (error) {
    console.error("❌ Error exporting from Lichess:", error.message);
    return null;
  }
}

/* 3) Evaluate a FEN with the persistent Stockfish process */
function analyzeFenLocally(fen, depth = 15) {
  return new Promise((resolve) => {
    const job = () => {
      console.log("➡️  START eval for FEN:", fen);

      let evalScore = null;
      let bestMove = null;
      let foundMate = false;

      engine.listener = (line) => {
        // console.log("[SF]", line); // uncomment for full spam
        if (line.startsWith("info depth")) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          if (cpMatch) {
            let score = parseInt(cpMatch[1], 10);
            if (fen.includes(" b ")) score = -score; // flip if Black to move
            evalScore = score;
          }
          if (/score mate/.test(line)) foundMate = true;
        } else if (line.startsWith("bestmove")) {
          bestMove = line.split(" ")[1];
          engine.listener = null;
          engine.stdin.write("isready\n"); // trigger next job
          resolve({ bestMove, evalScore, foundMate });
        }
      };

      engine.stdin.write("ucinewgame\n");
      engine.stdin.write(`position fen ${fen}\n`);
      engine.stdin.write(`go depth ${depth}\n`);
    };

    /* --- if engine already idle, run immediately; else queue --- */
    if (sfReady && sfQueue.length === 0) {
      job();
    } else {
      sfQueue.push(job);
    }
  });
}

/* 4) Detect blunders by splitting JSON moves & applying them in chess.js */
async function detectBlundersFromJson(gameJson, username) {
  if (!gameJson?.moves) {
    console.log("❌ No moves found in the Lichess JSON.");
    return { blunders: [], missedMates: [] };
  }

  let color = null;
  if (gameJson.players?.white?.name?.toLowerCase() === username.toLowerCase())
    color = "w";
  if (gameJson.players?.black?.name?.toLowerCase() === username.toLowerCase())
    color = "b";
  if (!color) {
    console.log("❌ Username not found in Lichess JSON players.");
    return { blunders: [], missedMates: [] };
  }
  console.log(
    `✅ Found ${username} as ${color === "w" ? "White" : "Black"}.\n`
  );

  const moves = gameJson.moves.split(" ");
  const chess = new Chess();
  const blunders = [];
  const missedMates = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const fenBefore = chess.fen();
    const result = chess.move(move, { sloppy: true });
    if (!result) {
      console.log(`❌ Invalid move in PGN: ${move}, skipping...`);
      continue;
    }

    if (result.color === color) {
      const beforeEval = await analyzeFenLocally(fenBefore);
      const afterEval = await analyzeFenLocally(chess.fen());

      if (!beforeEval || !afterEval) continue;
      const drop = (beforeEval.evalScore || 0) - (afterEval.evalScore || 0);

      console.log(`Move #${Math.floor(i / 2) + 1}: ${move}`);
      console.log(
        `   Eval Before: ${beforeEval.evalScore} | Eval After: ${afterEval.evalScore}`
      );
      console.log(`   Eval Drop : ${drop} cp`);
      console.log(`   Best Move : ${beforeEval.bestMove}\n`);

      const playedUCI = result.from + result.to;
      if (beforeEval.foundMate && beforeEval.bestMove !== playedUCI) {
        missedMates.push({
          moveNumber: Math.floor(i / 2) + 1,
          move,
          fenBefore,
          bestMove: beforeEval.bestMove,
        });
      }

      if ((color === "w" && drop >= 300) || (color === "b" && drop <= -300)) {
        blunders.push({
          moveNumber: Math.floor(i / 2) + 1,
          move,
          fenBefore,
          bestMove: beforeEval.bestMove,
          evalDrop: drop,
        });
      }
    }
  }

  return { blunders, missedMates };
}

async function analyzeLatestGames(username, gameType, count) {
  const pgnList = await getLatestGamesPGN(username, gameType, count);

  const results = [];
  for (const pgn of pgnList) {
    const lichessJson = await getLichessJsonFromPgn(pgn);
    if (!lichessJson) continue;

    const { blunders, missedMates } = await detectBlundersFromJson(
      lichessJson,
      username
    );

    results.push({
      headers: lichessJson,
      moves: lichessJson.moves.split(" "),
      blunders,
      missedMates,
    });
  }

  return results;
}

module.exports = { analyzeLatestGames };
