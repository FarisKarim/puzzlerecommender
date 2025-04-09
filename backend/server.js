require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { analyzeLatestGames } = require("./get_games");
const { parse } = require("dotenv");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.get("/api/analyze/:username", async (req, res) => {
  const username = req.params.username;
  const gameType = req.query.type;
  const count = parseInt(req.query.count || "1");
  console.log("🟡 /api/analyze HIT with username:", username);

  try {
    console.log("🟠 Calling analyzeLatestGame...");
    const result = await analyzeLatestGames(username, gameType, count);
    console.log("🟢 analyzeLatestGame returned!");

    if (!result) {
      console.log("🔴 No game data returned, sending 404");
      return res.status(404).json({ error: "No game found" });
    }

    console.log(`📤 Sending ${result.length} analyzed game(s) to frontend.`);
    result.forEach((g, i) => {
      console.log(
        `  #${i + 1}: ${g.headers.players.white.name} vs ${
          g.headers.players.black.name
        }`

      );
    });

    res.json(result);
  } catch (err) {
    console.error("❌ Error inside /api/analyze route:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(
    `🚀 API running at http://localhost:${PORT}/api/analyze/{username}`
  );
});
