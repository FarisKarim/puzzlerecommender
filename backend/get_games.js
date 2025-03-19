require("dotenv").config();
const axios = require("axios");
const ChessWebAPI = require("chess-web-api");
const { Chess } = require("chess.js");
const { spawn } = require("child_process");

const USERNAME = "honorable_knight00"; // Replace if needed
const LICHESS_API_TOKEN = process.env.LICHESS_API_TOKEN;
const chessAPI = new ChessWebAPI();

// 1) Fetch the most recent Chess.com PGN
async function getLatestGamePGN(username) {
  try {
    const res = await chessAPI.getPlayerMonthlyArchives(username);
    const archives = res.body.archives;
    if (!archives?.length) {
      console.log("❌ No archives found for:", username);
      return null;
    }

    // Use the latest archive
    const latestArchive = archives[archives.length - 1];
    const [year, month] = latestArchive.split("/").slice(-2);
    console.log(`📥 Fetching from Chess.com archive: ${year}-${month}`);

    const gamesRes = await chessAPI.getPlayerCompleteMonthlyArchives(
      username,
      year,
      month
    );
    let games = gamesRes.body.games;
    games = games.filter((game) =>
      ["bullet", "rapid", "blitz"].includes(game.time_class)
    );
    // console.log(games);
    if (!games?.length) {
      console.log("❌ No games in that archive.");
      return null;
    }

    // Return PGN of the newest game
    const latestGame = games[games.length - 4];

    return typeof latestGame.pgn === "string"
      ? latestGame.pgn
      : JSON.stringify(latestGame.pgn);
  } catch (err) {
    console.error("❌ Error fetching Chess.com PGN:", err);
    return null;
  }
}

// 2) Import that PGN to Lichess & get JSON instead of a standard PGN
async function getLichessJsonFromPgn(pgn) {
  if (!pgn) return null;

  try {
    // A) Import to Lichess
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
    // json pgn
    // console.log("✅ Lichess JSON Export:", exportResp.data);
    return exportResp.data; // This is an object with { moves, players, etc. }
  } catch (error) {
    console.error("❌ Error exporting from Lichess:", error.message);
    return null;
  }
}

function analyzeFenLocally(fen, depth = 12) {
  return new Promise((resolve, reject) => {
    const engine = spawn("./stockfish/stockfish");

    let bestMove = null;
    let evalScore = null;
    let foundMate = false;
    let receivedUciOk = false;
    let receivedReadyOk = false;
    let waitingForFenReadyOk = false;

    engine.stdout.on("data", (data) => {
      const lines = data
        .toString()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        // if (line.startsWith("option name")) continue;
        // // if (line.startsWith("info depth")) continue;
        // if (line.startsWith("info string")) continue;
        // if (line.startsWith("id")) continue;
        // console.log("Engine:", line); // For debugging

        // 1) Wait for uciok
        if (!receivedUciOk && line === "uciok") {
          receivedUciOk = true;
          engine.stdin.write("isready\n");
        }
        // 2) Wait for readyok
        else if (receivedUciOk && !receivedReadyOk && line === "readyok") {
          receivedReadyOk = true;
          engine.stdin.write("ucinewgame\n");
          engine.stdin.write(`position fen ${fen}\n`);
          engine.stdin.write("isready\n");
          waitingForFenReadyOk = true;
        }
        // 3) After fen readyok, run search
        else if (waitingForFenReadyOk && line === "readyok") {
          waitingForFenReadyOk = false;
          engine.stdin.write(`go depth ${depth}\n`);
        }
        // 4) Parse "info depth" lines
        else if (line.startsWith("info depth")) {
          const match = line.match(/score cp (-?\d+)/);
          if (match) {
            let cp = parseInt(match[1], 10);
            // Flip sign if it's Black to move
            if (fen.includes(" b ")) {
              cp = -cp;
            }
            evalScore = cp;
          }
          const matchMate = line.match(/score mate (-?\d+)/);
          if (matchMate) {
            foundMate = true;
          }
        }
        // 5) bestmove => done
        else if (line.startsWith("bestmove")) {
          bestMove = line.split(" ")[1];
          engine.stdin.write("quit\n");
          resolve({ bestMove, evalScore, foundMate });
        }
      }
    });

    engine.stderr.on("data", (err) => reject(err.toString()));

    // Start the handshake
    engine.stdin.write("uci\n");
  });
}

// 4) Detect blunders by splitting JSON moves & applying them in chess.js
async function detectBlundersFromJson(gameJson, username) {
  if (!gameJson?.moves) {
    console.log("❌ No moves found in the Lichess JSON.");
    return [];
  }

  // Determine the player's color from the JSON "players"
  let color = null;
  if (gameJson.players?.white?.name?.toLowerCase() === username.toLowerCase())
    color = "w";
  if (gameJson.players?.black?.name?.toLowerCase() === username.toLowerCase())
    color = "b";
  if (!color) {
    console.log("❌ Username not found in Lichess JSON players.");
    return [];
  }
  console.log(
    `✅ Found ${username} as ${color === "w" ? "White" : "Black"}.\n`
  );

  // Initialize chess & parse moves
  const moves = gameJson.moves.split(" "); // e.g. "d4 d5 e3 Nf6 ..."
  const chess = new Chess();
  const blunders = [];
  const missedMates = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const fenBefore = chess.fen(); // Evaluate before the move
    // Attempt to apply this move to the board
    const result = chess.move(move, { sloppy: true });
    if (!result) {
      // Move is invalid for chess.js
      console.log(`❌ Invalid move in PGN: ${move}, skipping...`);
      continue;
    }

    // Only check blunders on your color's moves
    if (result.color === color) {
      const beforeEval = await analyzeFenLocally(fenBefore);
      const afterEval = await analyzeFenLocally(chess.fen());

      if (!beforeEval || !afterEval) continue;
      const drop = (beforeEval.evalScore || 0) - (afterEval.evalScore || 0);
      console.log(`Move #${Math.floor(i / 2) + 1}: ${move}`);
      console.log(
        `   Eval Before: ${beforeEval.evalScore} | Eval After: ${afterEval.evalScore}`
      );
      console.log(`   Eval Drop: ${drop} cp\n`);
      console.log(`   Best Move: ${beforeEval.bestMove}\n`);

      if (beforeEval.foundMate && beforeEval.bestMove !== move) {
        missedMates.push({
          moveNumber: Math.floor(i / 2) + 1,
          move,
          fenBefore,
          bestMove: beforeEval.bestMove,
        });
      }

      if (drop >= 300) {
        blunders.push({
          moveNumber: Math.floor(i / 2) + 1,
          move: move,
          fenBefore,
          bestMove: beforeEval.bestMove,
          evalDrop: drop,
        });
      }
    }
  }

  return { blunders, missedMates };
}

// 5) Main
(async () => {
  console.log("📂 Fetching latest Chess.com game PGN...");
  const chessComPgn = await getLatestGamePGN(USERNAME);
  if (!chessComPgn) {
    console.log("❌ No PGN found from Chess.com.");
    return;
  }

  console.log("🔄 Importing PGN to Lichess & retrieving JSON...");
  const lichessJson = await getLichessJsonFromPgn(chessComPgn);
  if (!lichessJson) {
    console.log("❌ Could not get Lichess JSON export.");
    return;
  }

  console.log("🔍 Detecting blunders using local Stockfish on JSON moves...");
  const { blunders, missedMates } = await detectBlundersFromJson(
    lichessJson,
    USERNAME
  );

  if (blunders.length === 0) {
    console.log("✅ No major blunders detected (≥300 cp).");
  } else {
    console.log(`🚨 Found ${blunders.length} blunder(s):`);
    for (const b of blunders) {
      console.log(`Move #${b.moveNumber}: ${b.move}
   FEN Before: ${b.fenBefore}
   Best Move:  ${b.bestMove}
   Drop:       ${b.evalDrop} cp
`);
    }
  }
  if (missedMates.length > 0) {
    console.log(`\n🚨 Missed Mates Found (${missedMates.length}):`);
    for (const mm of missedMates) {
      console.log(`
     Move #${mm.moveNumber}: ${mm.move}
       FEN Before: ${mm.fenBefore}
       Best Move:  ${mm.bestMove}
       (You had a forced mate here!)
    `);
    }
  }
})();

// TODO
// Currently stockfish outputs algebraic and chess.js uses SAN. Need to convert between the two.
