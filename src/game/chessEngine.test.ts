import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGameState,
  createTacticalClashPreset,
  algebraicToCoord,
  getLegalMovesForSquare,
  getAllLegalMoves,
  makeMove,
  computeBestMove,
} from './chessEngine.ts';

test('initial game state has 32 pieces on 64 squares and 20 legal opening moves', () => {
  const state = createInitialGameState();
  assert.equal(state.board.length, 8);
  assert.equal(state.board[0].length, 8);

  let pieceCount = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) pieceCount++;
    }
  }
  assert.equal(pieceCount, 32);

  const openingMoves = getAllLegalMoves(state);
  assert.equal(openingMoves.length, 20);
});

test('pawn movement, capture, and turn switching work strictly', () => {
  let state = createInitialGameState();
  // e2 -> e4
  const e2 = algebraicToCoord('e2')!;
  const e4 = algebraicToCoord('e4')!;
  const e2Moves = getLegalMovesForSquare(state, e2);
  assert.equal(e2Moves.length, 2);

  state = makeMove(state, e2, e4)!;
  assert.ok(state);
  assert.equal(state.turn, 'b');

  // d7 -> d5
  state = makeMove(state, algebraicToCoord('d7')!, algebraicToCoord('d5')!)!;
  assert.equal(state.turn, 'w');

  // exd5 capture
  state = makeMove(state, e4, algebraicToCoord('d5')!)!;
  assert.equal(state.capturedByWhite.length, 1);
  assert.equal(state.capturedByWhite[0].type, 'p');
  assert.equal(state.moveHistory[state.moveHistory.length - 1].san, 'exd5');
});

test('fools mate triggers checkmate status and winner correctly', () => {
  let state = createInitialGameState();
  // 1. f3 e5 2. g4 Qh4#
  state = makeMove(state, algebraicToCoord('f2')!, algebraicToCoord('f3')!)!;
  state = makeMove(state, algebraicToCoord('e7')!, algebraicToCoord('e5')!)!;
  state = makeMove(state, algebraicToCoord('g2')!, algebraicToCoord('g4')!)!;
  state = makeMove(state, algebraicToCoord('d8')!, algebraicToCoord('h4')!)!;

  assert.equal(state.inCheck, true);
  assert.equal(state.status, 'checkmate');
  assert.equal(state.winner, 'b');
  assert.equal(state.moveHistory[state.moveHistory.length - 1].san, 'Qh4#');
});

test('tactical clash preset provides immediate legal capture moves and AI returns valid move', () => {
  const state = createTacticalClashPreset();
  assert.equal(state.status, 'playing');
  const allMoves = getAllLegalMoves(state);
  const captureMoves = allMoves.filter((m) => m.captured !== undefined);
  assert.ok(captureMoves.length > 0, 'Expected at least one immediate capture in tactical preset');

  const aiMove = computeBestMove(state, 2);
  assert.ok(aiMove !== null);
});
