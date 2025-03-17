require("dotenv").config();
const ChessWebAPI = require("chess-web-api");
const axios = require("axios");
const { Chess } = require("chess.js");


const chessAPI = new ChessWebAPI();
const USERNAME = "honorable_knight00"; // Replace with your Chess.com username
const LICHESS_API_TOKEN = process.env.LICHESS_API_TOKEN;

if (!USERNAME || !LICHESS_API_TOKEN) {
    console.error("❌ ERROR: Missing CHESSCOM_USERNAME or LICHESS_API_TOKEN in .env");
    process.exit(1);
}

// ✅ Step 1: Get the latest available Chess.com game PGN
async function getLatestGamePGN(username) {
    try {
        // Get the list of available archives (months with games)
        const archivesResponse = await chessAPI.getPlayerMonthlyArchives(username);
        const archives = archivesResponse.body.archives;

        if (!archives || archives.length === 0) {
            console.log("❌ No game archives found.");
            return null;
        }

        // Get the most recent archive URL (latest month)
        const latestArchiveUrl = archives[archives.length - 1];
        const [year, month] = latestArchiveUrl.split("/").slice(-2);

        console.log(`📥 Fetching games from Chess.com archive: ${year}-${month}`);

        const gamesResponse = await chessAPI.getPlayerCompleteMonthlyArchives(username, year, month);
        const games = gamesResponse.body.games;

        if (!games || games.length === 0) {
            console.log("❌ No games found.");
            return null;
        }

        return games[games.length - 1].pgn; // ✅ Returns PGN of the most recent game
    } catch (error) {
        console.error("❌ Error fetching Chess.com games:", error.message);
        return null;
    }
}

// ✅ Step 2: Upload the PGN to Lichess
async function importGameToLichess(pgn) {
    const url = "https://lichess.org/api/import";
    const headers = {
        "Authorization": `Bearer ${LICHESS_API_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded"
    };
    const data = new URLSearchParams({ pgn });

    try {
        const response = await axios.post(url, data, { headers });
        if (response.status === 200 && response.data.id) {
            console.log(`✅ Game successfully imported! Lichess URL: ${response.data.url}`);
            return response.data.id;
        } else {
            console.log("❌ Failed to import game.");
            return null;
        }
    } catch (error) {
        console.error("❌ Error importing game to Lichess:", error.message);
        return null;
    }
}

// ✅ Step 3: Fetch the analyzed PGN from Lichess
async function fetchAnalyzedPGN(gameId) {
    const url = `https://lichess.org/game/export/${gameId}?literate=1`;
    const headers = { "Authorization": `Bearer ${LICHESS_API_TOKEN}` };

    try {
        const response = await axios.get(url, { headers, responseType: "text" });

        // json response
        // console.log("📥 Received Annotated PGN:", response.data.slice(0, 500)); // Print first 500 chars

        return response.data; // This is now a PGN string, not JSON
    } catch (error) {
        console.error("❌ Error fetching analyzed PGN:", error.message);
        return null;
    }
}

// ✅ Step 4: Extract blunders from PGN
// function extractBlundersFromPGN(pgnText) {
//     if (typeof pgnText !== "string") {
//         console.error("❌ Error: PGN data is not a string.");
//         return [];
//     }

//     const blunderPattern = /\{[^}]*Blunder[^}]*\}/g;
//     return pgnText.match(blunderPattern) || [];
// }


// Get player color for specified player
function getPlayerColor(jsonResponse, playerName) {
    if (!jsonResponse.players || typeof jsonResponse.players !== "object") {
        console.error("❌ Error: 'players' field is missing or invalid.");
        return null;
    }

    return Object.keys(jsonResponse.players).find(
        (color) => jsonResponse.players[color]?.name === playerName
    );
}

function getBlunderPositions(jsonResponse, playerColor) {
    if (!jsonResponse.moves || !jsonResponse.analysis) {
        console.error("❌ Error: Missing 'moves' or 'analysis' fields.");
        return [];
    }

    const chess = new Chess(); // Initialize chess game state
    const movesArray = jsonResponse.moves.split(" ");
    const blunderPositions = [];

    console.log("🔍 Total Moves:", movesArray.length);
    console.log("🔍 Analysis Length:", jsonResponse.analysis.length);

    jsonResponse.analysis.forEach((entry, index) => {
        // Ensure it's the player's move
        const isPlayerMove = playerColor === "white" ? index % 2 === 0 : index % 2 === 1;
        if (entry.judgment?.name === "Blunder" && isPlayerMove) {
            console.log(`⚠️ Blunder Detected at Move Index: ${index}, Move: ${movesArray[index]}`);

            // Reset board
            chess.reset();

            // Play all moves up to **before** the blunder move
            for (let i = 0; i < index; i++) {
                chess.move(movesArray[i]);
            }

            // Get FEN before blunder occurs
            const fenBeforeBlunder = chess.fen();
            const blunderMove = movesArray[index]; // The move that caused the blunder

            // console.log(`♟️ FEN Before Blunder: ${fenBeforeBlunder}`);
            // console.log(`📉 Best Move Suggested: ${entry.best || "N/A"}`);

            blunderPositions.push({
                move_number: Math.floor(index / 2) + 1, // Convert ply to move number
                player: playerColor,
                move: blunderMove,
                fen_before: fenBeforeBlunder,
                best_move: entry.best || null,
                blunder_type: null // You need to classify this later
            });

            console.log("✅ Blunder Recorded:", blunderPositions[blunderPositions.length - 1]);
        }

        // Move the blunder move **after capturing FEN** so that future iterations have an updated board
        if (movesArray[index]) {
            chess.move(movesArray[index]);
        }
    });

    console.log("\n📊 Final Extracted Blunder Positions:", JSON.stringify(blunderPositions, null, 2));
    return blunderPositions;
}

function filterMoves(jsonResponse, playerColor) {
    if (!jsonResponse.moves) {
        console.error("❌ Error: 'moves' field is missing.");
        return;
    }

    const movesArray = jsonResponse.moves.split(" ");
    jsonResponse.moves = movesArray
        .filter((_, index) => (playerColor === "white" ? index % 2 === 0 : index % 2 === 1))
        .join(" ");
}

// function filterBlunders(jsonResponse, playerColor) {
//     if (!jsonResponse.analysis || !Array.isArray(jsonResponse.analysis)) {
//         console.error("❌ Error: 'analysis' field is missing or invalid.");
//         return;
//     }

//     // Find the indexes of the player's moves
//     const playerMoveIndexes = jsonResponse.analysis
//         .map((_, index) => index)
//         .filter((index) => (playerColor === "white" ? index % 2 === 0 : index % 2 === 1));

//     // Filter analysis for only the player's blunders
//     jsonResponse.analysis = jsonResponse.analysis.filter(
//         (entry, index) =>
//             playerMoveIndexes.includes(index) && entry.judgment?.name === "Blunder"
//     );

//     console.log("Filtered Analysis (Blunders Only):", JSON.stringify(jsonResponse.analysis, null, 2));
// }

// ✅ Run the process
(async () => {
    console.log("📂 Fetching latest game from Chess.com...");
    const latestPGN = await getLatestGamePGN(USERNAME);

    if (!latestPGN) {
        console.log("❌ No PGN found.");
        return;
    }

    console.log("🚀 Uploading game to Lichess...");
    const gameId = await importGameToLichess(latestPGN);

    if (!gameId) {
        console.log("❌ Game import failed.");
        return;
    }

    console.log("⏳ Waiting 10 seconds for analysis...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("📥 Fetching analyzed PGN...");
    const annotatedPGN = await fetchAnalyzedPGN(gameId);
    const jsonResponse = JSON.parse(annotatedPGN);
    
    // Extract blunders needs a string. NEED TO CHANGE!
    // console.log("📥 Received Annotated PGN:", annotatedPGN); 
    // console.log(typeof jsonResponse);
    // Find which color "honorable_knight00" played as
    const playerColor = getPlayerColor(jsonResponse, USERNAME);

    if (playerColor) {
        console.log(`🎯 Found 'honorable_knight00' as ${playerColor}`);

        jsonResponse.players[playerColor].color = playerColor;
        getBlunderPositions(jsonResponse, playerColor);
        filterMoves(jsonResponse, playerColor);
        console.log("♟️ Filtered moves for the player:", jsonResponse.moves);
        // filterBlunders(jsonResponse, playerColor);
        // console.log("♟️ Filtered analysis for the player:", jsonResponse.analysis);
    } else {
        console.error("❌ Error: 'honorable_knight00' not found in players.");
    }


    // const blunders = extractBlundersFromPGN(annotatedPGN);

    // if (blunders.length > 0) {
    //     console.log(`🚨 Detected ${blunders.length} blunder(s):`);
    //     blunders.forEach((blunder, index) => {
    //         console.log(`${index + 1}. ${blunder}`);
    //     });
    // } else {
    //     console.log("✅ No blunders detected.");
    // }
})();
