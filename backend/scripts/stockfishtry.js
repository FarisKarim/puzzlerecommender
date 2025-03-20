const { spawn } = require("child_process");

/*********************************************************
 * A) Function to Run Stockfish Analysis on a FEN String
 *********************************************************/
function analyzeFenLocally(fen, depth = 15) {
    return new Promise((resolve, reject) => {
        console.log(`\n🔍 Analyzing FEN: ${fen}`);

        // Spawn Stockfish
        const engine = spawn("./stockfish/stockfish"); 

        let bestMove = null;
        let evalScore = null;

        // Debugging helper: ensure commands are sent
        function sendCommand(command) {
            console.log(`📤 Sending to Stockfish: ${command}`);
            engine.stdin.write(command + "\n");
        }

        // Handle Stockfish Output
        engine.stdout.on("data", (data) => {
            const line = data.toString().trim();
            console.log("📥 Stockfish says:", line);

            if (line.startsWith("info depth")) {
                const match = line.match(/score cp (-?\d+)/);
                if (match) evalScore = parseInt(match[1], 10);
            }

            if (line.startsWith("bestmove")) {
                const parts = line.split(" ");
                bestMove = parts[1];
                console.log(`✅ bestmove = ${bestMove}, eval = ${evalScore}`);
                engine.kill();
                resolve({ bestMove, evalScore });
            }
        });

        engine.stderr.on("data", (err) => reject(err.toString()));

        // Send commands in order
        sendCommand("uci");
        sendCommand("isready");
        sendCommand("ucinewgame");

        setTimeout(() => {
            sendCommand(`position fen ${fen}`);
            sendCommand("go movetime 2000");
        }, 500);
    });
}

/*********************************************************
 * B) Run Stockfish Analysis on a Sample FEN
 *********************************************************/
(async () => {
    const sampleFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const result = await analyzeFenLocally(sampleFEN);
    console.log("\n🚀 Final Analysis Result:", result);
})();
