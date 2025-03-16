require("dotenv").config();
const ChessWebAPI = require("chess-web-api");
const axios = require("axios");

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

        // Fetch all games for the latest month
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
function extractBlundersFromPGN(pgnText) {
    if (typeof pgnText !== "string") {
        console.error("❌ Error: PGN data is not a string.");
        return [];
    }

    const blunderPattern = /\{[^}]*Blunder[^}]*\}/g;
    return pgnText.match(blunderPattern) || [];
}

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
    console.log("📥 Received Annotated PGN:", annotatedPGN); 
    console.log(typeof jsonResponse);
    // Find which color "honorable_knight00" played as
    const playerColor = Object.keys(jsonResponse.players).find(
        (color) => jsonResponse.players[color]?.name === "honorable_knight00"
    );

    if (playerColor) {
        console.log(`🎯 Found 'honorable_knight00' as ${playerColor}`);

        // Keep only "honorable_knight00" and remove the other player
        jsonResponse.players = { [playerColor]: jsonResponse.players[playerColor] };

        console.log("✅ Players after filtering:", JSON.stringify(jsonResponse.players, null, 2));
    } else {
        console.error("❌ Error: 'honorable_knight00' not found in players.");
    }

    const blunders = extractBlundersFromPGN(annotatedPGN);

    if (blunders.length > 0) {
        console.log(`🚨 Detected ${blunders.length} blunder(s):`);
        blunders.forEach((blunder, index) => {
            console.log(`${index + 1}. ${blunder}`);
        });
    } else {
        console.log("✅ No blunders detected.");
    }
})();
