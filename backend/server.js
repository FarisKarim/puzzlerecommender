require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { analyzeLatestGame } = require("./get_games");

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.get("/api/analyze/:username", async (req, res) => {
    const username = req.params.username;
    console.log("🟡 /api/analyze HIT with username:", username);
  
    try {
      console.log("🟠 Calling analyzeLatestGame...");
      const result = await analyzeLatestGame(username);
      console.log("🟢 analyzeLatestGame returned!");
  
      if (!result) {
        console.log("🔴 No game data returned, sending 404");
        return res.status(404).json({ error: "No game found" });
      }
  
      console.log("✅ Sending game analysis to client");
      res.json(result);
    } catch (err) {
      console.error("❌ Error inside /api/analyze route:", err);
      res.status(500).json({ error: "Server error" });
    }
  });
  
  app.listen(PORT, () => {
    console.log(`🚀 API running at http://localhost:${PORT}/api/analyze/{username}`);
  });
