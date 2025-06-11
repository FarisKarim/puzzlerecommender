# Tasks

## Bug Fixes

1. [x] Fix keyboard navigation bug where arrow keys navigate original game moves instead of manual moves when in sandbox mode after clicking a blunder

## Tactical Motif Classification & Puzzle Recommendations

### High Priority (Core Functionality)
1. [ ] Set up TensorFlow.js model loading in backend - Install @tensorflow/tfjs-node and create model loader utility
2. [ ] Create FEN to board tensor conversion function - Implement 8x8x19 input structure (pieces, attacks, castling, turn)
3. [ ] Build tactical motif classification service - Load model and create prediction function for FEN positions

### Medium Priority (Integration & API)
4. [ ] Create puzzle database query system - Parse lichess_db_puzzle.csv and create efficient theme-based search
5. [ ] Map model output classes to Lichess themes - Create mapping between your 7 motifs and puzzle database themes
6. [ ] Add API endpoint for tactical analysis - Create /api/analyze-tactics endpoint that takes FEN and returns classified motifs + recommended puzzles
7. [ ] Integrate tactical analysis into blunder detection - Modify existing blunder analysis to include tactical motif classification
8. [ ] Update frontend to fetch and display puzzle recommendations - Replace SkeletonLoader in Recommended Puzzles section with actual puzzle data
9. [ ] Test tactical classification accuracy - Validate model predictions against known puzzle positions and themes

### Low Priority (Enhancement & Polish)
10. [ ] Create puzzle display component - Design UI to show puzzle FEN, rating, themes, and link to Lichess
11. [ ] Add puzzle interaction features - Allow users to attempt puzzles inline or open in new tab
12. [ ] Optimize performance - Cache model predictions, implement puzzle database indexing, add loading states