require("dotenv").config();
const axios = require("axios");
const ChessWebAPI = require("chess-web-api");
const { Chess } = require("chess.js");
const { spawn } = require("child_process");
const path = require("path");
const USERNAME = "honorable_knight00";
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
async function getLatestGamePGN(username) {
  try {
    const res = await chessAPI.getPlayerMonthlyArchives(username);
    const archives = res.body.archives;
    if (!archives?.length) {
      console.log("❌ No archives found for:", username);
      return null;
    }

    const latestArchive = archives[archives.length - 1];
    const [year, month] = latestArchive.split("/").slice(-2);
    console.log(`📥 Fetching from Chess.com archive: ${year}-${month}`);

    const gamesRes = await chessAPI.getPlayerCompleteMonthlyArchives(
      username,
      year,
      month
    );
    let games = gamesRes.body.games;
    games = games.filter((g) =>
      ["bullet", "rapid", "blitz"].includes(g.time_class)
    );

    if (!games?.length) {
      console.log("❌ No games in that archive.");
      return null;
    }

    const latestGame = games[games.length - 1];
    return typeof latestGame.pgn === "string"
      ? latestGame.pgn
      : JSON.stringify(latestGame.pgn);
  } catch (err) {
    console.error("❌ Error fetching Chess.com PGN:", err);
    return null;
  }
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

// /* 5) Main */
// (async () => {
//   console.log("📂 Fetching latest Chess.com game PGN...");
//   const chessComPgn = await getLatestGamePGN(USERNAME);
//   if (!chessComPgn) {
//     console.log("❌ No PGN found from Chess.com.");
//     return;
//   }

//   console.log("🔄 Importing PGN to Lichess & retrieving JSON...");
//   const lichessJson = await getLichessJsonFromPgn(chessComPgn);
//   if (!lichessJson) {
//     console.log("❌ Could not get Lichess JSON export.");
//     return;
//   }

//   console.log("🔍 Detecting blunders using local Stockfish on JSON moves...");
//   const { blunders, missedMates } = await detectBlundersFromJson(lichessJson, USERNAME);

//   if (blunders.length === 0) {
//     console.log("✅ No major blunders detected (≥300 cp).");
//   } else {
//     console.log(`🚨 Found ${blunders.length} blunder(s):`);
//     for (const b of blunders) {
//       console.log(`Move #${b.moveNumber}: ${b.move}
//    FEN Before: ${b.fenBefore}
//    Best Move:  ${b.bestMove}
//    Drop:       ${b.evalDrop} cp
// `);
//     }
//   }

//   if (missedMates.length > 0) {
//     console.log(`\n🚨 Missed Mates Found (${missedMates.length}):`);
//     for (const mm of missedMates) {
//       console.log(`
//      Move #${mm.moveNumber}: ${mm.move}
//        FEN Before: ${mm.fenBefore}
//        Best Move:  ${mm.bestMove}
//        (You had a forced mate here!)
//     `);
//     }
//   }

//   /* ──────────────────────────────────────────────────────────── */
//   /*  Cleanly shut down the Stockfish process                     */
//   /* ──────────────────────────────────────────────────────────── */
//   engine.stdin.write("quit\n");
//   engine.kill();
// })();
async function analyzeLatestGame(username) {
  // 1) Fetch PGN
  const chessComPgn = await getLatestGamePGN(username);
  if (!chessComPgn) return null;

  // 2) Import to Lichess & get JSON
  const lichessJson = await getLichessJsonFromPgn(chessComPgn);
  if (!lichessJson) return null;

  // 3) Detect blunders & missed mates
  const { blunders, missedMates } = await detectBlundersFromJson(
    lichessJson,
    username
  );

  return {
    moves: lichessJson.moves.split(" "),
    blunders,
    missedMates,
  };
}

// analyzeLatestGame(USERNAME).then((data) => console.log(data));

module.exports = { analyzeLatestGame };
