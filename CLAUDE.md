# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a full-stack chess puzzle learning application with three main components:

### Frontend (`/frontend`)
- React + Vite application using TypeScript/JSX
- Uses `react-chessboard` for chess board visualization
- Chess logic handled by `chess.js` library  
- UI components built with Radix UI and Tailwind CSS
- Features include:
  - Interactive chess board with move navigation
  - Multiple color themes (default, red, yellow, dark)
  - Game import and analysis display
  - Keyboard shortcuts for theme switching and move navigation

### Backend (`/backend`)
- Node.js Express server that analyzes Chess.com games
- Integrates with Chess.com API to fetch user games
- Uses Lichess API for PGN import and JSON conversion
- Local Stockfish engine integration for move analysis
- Key workflow:
  1. Fetches recent games from Chess.com
  2. Imports PGNs to Lichess for structured data
  3. Analyzes positions with local Stockfish engine
  4. Detects blunders (300+ centipawn evaluation drops)
  5. Identifies missed mate opportunities

### Stockfish Engine (`/backend/stockfish`)
- Complete Stockfish chess engine source code
- Pre-compiled binary available at `/backend/stockfish/stockfish`
- Used for position evaluation in blunder detection

## Development Commands

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start development server (port 3000)
npm run build        # Production build
npm run lint         # Run ESLint
```

### Backend
```bash
cd backend
npm install          # Install dependencies
node server.js       # Start server (port 4000)
```

### Stockfish Engine
```bash
cd backend/stockfish/src
make profile-build ARCH=native  # Compile optimized binary
```

## Environment Setup

Backend requires `.env` file with:
- `LICHESS_API_TOKEN` - Personal API token from Lichess

## Key API Endpoints

- `GET /api/analyze/:username?type={blitz|rapid|bullet}&count={number}` - Analyze recent games for a Chess.com user

## Code Architecture Notes

### Frontend State Management
- Uses React hooks for local state management
- Main state includes: current game, move history, blunders list, UI preferences
- Chess position calculated dynamically from move history + current ply

### Backend Game Analysis Pipeline
1. `getLatestGamesPGN()` - Fetches games from Chess.com API
2. `getLichessJsonFromPgn()` - Imports to Lichess for structured data  
3. `detectBlundersFromJson()` - Analyzes each move with Stockfish
4. Persistent Stockfish process with job queue for efficient evaluation

### Stockfish Integration
- Single persistent process spawned on server start
- Job queue system for concurrent position analysis
- UCI protocol communication for engine control
- 15-depth analysis used for move evaluation

## Testing

No formal test suite currently exists. Manual testing via:
- Frontend: Use dev server and test UI interactions
- Backend: Test API endpoints with curl/Postman
- Engine: Use built-in Stockfish benchmark

## Dependencies Management

Frontend uses modern React ecosystem:
- React 19 with Vite 6 for fast development
- Radix UI for accessible components
- Tailwind CSS 4 for styling

Backend uses minimal Node.js stack:
- Express for HTTP server
- chess.js for game logic validation
- axios for external API calls