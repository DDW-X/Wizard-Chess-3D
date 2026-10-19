export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface ChessPiece {
  id: string;
  type: PieceType;
  color: PieceColor;
  hasMoved: boolean;
}

export interface SquareCoord {
  row: number; // 0 (rank 8, Black back rank) to 7 (rank 1, White back rank)
  col: number; // 0 (file a) to 7 (file h)
}

export interface ChessMove {
  from: SquareCoord;
  to: SquareCoord;
  piece: ChessPiece;
  captured?: ChessPiece;
  promotion?: PieceType;
  isCastling?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
  san: string;
}

export interface GameState {
  board: (ChessPiece | null)[][];
  turn: PieceColor;
  moveHistory: ChessMove[];
  capturedByWhite: ChessPiece[];
  capturedByBlack: ChessPiece[];
  enPassantTarget: SquareCoord | null;
  inCheck: boolean;
  status: 'playing' | 'checkmate' | 'stalemate';
  winner: PieceColor | 'draw' | null;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function coordToAlgebraic(coord: SquareCoord): string {
  return `${FILES[coord.col]}${RANKS[coord.row]}`;
}

export function algebraicToCoord(sq: string): SquareCoord | null {
  if (sq.length !== 2) return null;
  const col = FILES.indexOf(sq[0].toLowerCase());
  const row = RANKS.indexOf(sq[1]);
  if (col === -1 || row === -1) return null;
  return { row, col };
}

export function cloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function cloneGameState(state: GameState): GameState {
  return {
    board: cloneBoard(state.board),
    turn: state.turn,
    moveHistory: state.moveHistory.map((m) => ({ ...m })),
    capturedByWhite: state.capturedByWhite.map((p) => ({ ...p })),
    capturedByBlack: state.capturedByBlack.map((p) => ({ ...p })),
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    inCheck: state.inCheck,
    status: state.status,
    winner: state.winner,
  };
}

export function createInitialGameState(): GameState {
  const board: (ChessPiece | null)[][] = Array.from({ length: 8 }, () =>
    Array(8).fill(null)
  );

  const backRank: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  for (let col = 0; col < 8; col++) {
    board[0][col] = {
      id: `b-${backRank[col]}-${col}`,
      type: backRank[col],
      color: 'b',
      hasMoved: false,
    };
    board[1][col] = {
      id: `b-p-${col}`,
      type: 'p',
      color: 'b',
      hasMoved: false,
    };
    board[6][col] = {
      id: `w-p-${col}`,
      type: 'p',
      color: 'w',
      hasMoved: false,
    };
    board[7][col] = {
      id: `w-${backRank[col]}-${col}`,
      type: backRank[col],
      color: 'w',
      hasMoved: false,
    };
  }

  return {
    board,
    turn: 'w',
    moveHistory: [],
    capturedByWhite: [],
    capturedByBlack: [],
    enPassantTarget: null,
    inCheck: false,
    status: 'playing',
    winner: null,
  };
}

/**
 * Creates a mid-game tactical clash preset where multiple immediate captures
 * (Knight capture, Queen capture, Bishop strike) are ready to execute on turn 1.
 */
export function createTacticalClashPreset(): GameState {
  const state = createInitialGameState();
  // Execute a clean sequence of opening moves into a sharp center clash:
  // 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Nc3 Bc5 5. d4
  const openingPairs: [string, string][] = [
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
    ['b8', 'c6'],
    ['f1', 'c4'],
    ['g8', 'f6'],
    ['d2', 'd4'],
    ['f8', 'c5'],
  ];
  let current = state;
  for (const [fromSq, toSq] of openingPairs) {
    const from = algebraicToCoord(fromSq)!;
    const to = algebraicToCoord(toSq)!;
    const next = makeMove(current, from, to);
    if (next) current = next;
  }
  return current;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function findKing(board: (ChessPiece | null)[][], color: PieceColor): SquareCoord | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

export function isSquareAttacked(
  board: (ChessPiece | null)[][],
  target: SquareCoord,
  byColor: PieceColor
): boolean {
  const { row: tr, col: tc } = target;

  // 1. Pawn attacks
  const pawnRow = byColor === 'w' ? tr + 1 : tr - 1;
  for (const dc of [-1, 1]) {
    const pc = tc + dc;
    if (inBounds(pawnRow, pc)) {
      const p = board[pawnRow][pc];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
  }

  // 2. Knight attacks
  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, dc] of knightOffsets) {
    const nr = tr + dr;
    const nc = tc + dc;
    if (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  // 3. King attacks (adjacent)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const kr = tr + dr;
      const kc = tc + dc;
      if (inBounds(kr, kc)) {
        const p = board[kr][kc];
        if (p && p.color === byColor && p.type === 'k') return true;
      }
    }
  }

  // 4. Orthogonal rays (Rook / Queen)
  const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of orthoDirs) {
    let r = tr + dr;
    let c = tc + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // 5. Diagonal rays (Bishop / Queen)
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of diagDirs) {
    let r = tr + dr;
    let c = tc + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

export function isKingInCheck(board: (ChessPiece | null)[][], color: PieceColor): boolean {
  const kingSq = findKing(board, color);
  if (!kingSq) return false;
  const enemy: PieceColor = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(board, kingSq, enemy);
}

function generatePseudoLegalMovesForSquare(
  state: GameState,
  from: SquareCoord
): ChessMove[] {
  const { board, enPassantTarget } = state;
  const piece = board[from.row][from.col];
  if (!piece) return [];

  const moves: ChessMove[] = [];
  const { row: r, col: c } = from;
  const color = piece.color;
  const enemy: PieceColor = color === 'w' ? 'b' : 'w';

  const addMove = (
    toRow: number,
    toCol: number,
    opts?: {
      captured?: ChessPiece;
      promotion?: PieceType;
      isCastling?: 'kingside' | 'queenside';
      isEnPassant?: boolean;
    }
  ) => {
    const to = { row: toRow, col: toCol };
    const captured = opts?.captured ?? board[toRow][toCol] ?? undefined;
    let san = '';
    if (opts?.isCastling === 'kingside') {
      san = 'O-O';
    } else if (opts?.isCastling === 'queenside') {
      san = 'O-O-O';
    } else {
      const pieceLetter = piece.type === 'p' ? (captured ? FILES[c] : '') : piece.type.toUpperCase();
      const capSymbol = captured ? 'x' : '';
      const destSq = coordToAlgebraic(to);
      const promoSuffix = opts?.promotion ? `=${opts.promotion.toUpperCase()}` : '';
      san = `${pieceLetter}${capSymbol}${destSq}${promoSuffix}`;
    }

    moves.push({
      from,
      to,
      piece,
      captured,
      promotion: opts?.promotion,
      isCastling: opts?.isCastling,
      isEnPassant: opts?.isEnPassant,
      san,
    });
  };

  if (piece.type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;

    // 1 step forward
    const r1 = r + dir;
    if (inBounds(r1, c) && !board[r1][c]) {
      if (r1 === promoRow) {
        addMove(r1, c, { promotion: 'q' });
      } else {
        addMove(r1, c);
      }
      // 2 steps forward from start
      const r2 = r + dir * 2;
      if (r === startRow && inBounds(r2, c) && !board[r2][c]) {
        addMove(r2, c);
      }
    }

    // Captures
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (!inBounds(r1, nc)) continue;
      const targetPiece = board[r1][nc];
      if (targetPiece && targetPiece.color === enemy) {
        if (r1 === promoRow) {
          addMove(r1, nc, { captured: targetPiece, promotion: 'q' });
        } else {
          addMove(r1, nc, { captured: targetPiece });
        }
      } else if (
        enPassantTarget &&
        enPassantTarget.row === r1 &&
        enPassantTarget.col === nc
      ) {
        const epPawn = board[r][nc];
        if (epPawn && epPawn.color === enemy && epPawn.type === 'p') {
          addMove(r1, nc, { captured: epPawn, isEnPassant: true });
        }
      }
    }
  } else if (piece.type === 'n') {
    const offsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ];
    for (const [dr, dc] of offsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || target.color === enemy) {
        addMove(nr, nc);
      }
    }
  } else if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
    const dirs: [number, number][] = [];
    if (piece.type === 'b' || piece.type === 'q') {
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }
    if (piece.type === 'r' || piece.type === 'q') {
      dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    }
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          addMove(nr, nc);
        } else {
          if (target.color === enemy) addMove(nr, nc);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  } else if (piece.type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (!target || target.color === enemy) {
          addMove(nr, nc);
        }
      }
    }

    // Castling
    if (!piece.hasMoved && !isKingInCheck(board, color)) {
      const rankRow = color === 'w' ? 7 : 0;
      if (r === rankRow && c === 4) {
        // Kingside (col 7 rook)
        const ksRook = board[rankRow][7];
        if (
          ksRook &&
          ksRook.color === color &&
          ksRook.type === 'r' &&
          !ksRook.hasMoved &&
          !board[rankRow][5] &&
          !board[rankRow][6] &&
          !isSquareAttacked(board, { row: rankRow, col: 5 }, enemy) &&
          !isSquareAttacked(board, { row: rankRow, col: 6 }, enemy)
        ) {
          addMove(rankRow, 6, { isCastling: 'kingside' });
        }
        // Queenside (col 0 rook)
        const qsRook = board[rankRow][0];
        if (
          qsRook &&
          qsRook.color === color &&
          qsRook.type === 'r' &&
          !qsRook.hasMoved &&
          !board[rankRow][1] &&
          !board[rankRow][2] &&
          !board[rankRow][3] &&
          !isSquareAttacked(board, { row: rankRow, col: 3 }, enemy) &&
          !isSquareAttacked(board, { row: rankRow, col: 2 }, enemy)
        ) {
          addMove(rankRow, 2, { isCastling: 'queenside' });
        }
      }
    }
  }

  return moves;
}

function applyMoveToBoard(board: (ChessPiece | null)[][], move: ChessMove): (ChessPiece | null)[][] {
  const next = cloneBoard(board);
  const movingPiece = next[move.from.row][move.from.col];
  if (!movingPiece) return next;

  next[move.from.row][move.from.col] = null;

  if (move.isEnPassant) {
    next[move.from.row][move.to.col] = null;
  }

  if (move.isCastling === 'kingside') {
    const rook = next[move.from.row][7];
    if (rook) {
      next[move.from.row][7] = null;
      next[move.from.row][5] = { ...rook, hasMoved: true };
    }
  } else if (move.isCastling === 'queenside') {
    const rook = next[move.from.row][0];
    if (rook) {
      next[move.from.row][0] = null;
      next[move.from.row][3] = { ...rook, hasMoved: true };
    }
  }

  next[move.to.row][move.to.col] = {
    ...movingPiece,
    type: move.promotion ?? movingPiece.type,
    hasMoved: true,
  };

  return next;
}

export function getLegalMovesForSquare(state: GameState, from: SquareCoord): ChessMove[] {
  const piece = state.board[from.row]?.[from.col];
  if (!piece || piece.color !== state.turn) return [];

  const pseudo = generatePseudoLegalMovesForSquare(state, from);
  return pseudo.filter((move) => {
    const nextBoard = applyMoveToBoard(state.board, move);
    return !isKingInCheck(nextBoard, piece.color);
  });
}

export function getAllLegalMoves(state: GameState, color: PieceColor = state.turn): ChessMove[] {
  const tempState: GameState = { ...state, turn: color };
  const allMoves: ChessMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.color === color) {
        allMoves.push(...getLegalMovesForSquare(tempState, { row: r, col: c }));
      }
    }
  }
  return allMoves;
}

export function makeMove(
  state: GameState,
  from: SquareCoord,
  to: SquareCoord,
  promotion: PieceType = 'q'
): GameState | null {
  if (state.status !== 'playing') return null;

  const legalMoves = getLegalMovesForSquare(state, from);
  const matchingMove = legalMoves.find(
    (m) => m.to.row === to.row && m.to.col === to.col
  );
  if (!matchingMove) return null;

  const move: ChessMove = {
    ...matchingMove,
    promotion: matchingMove.promotion ? promotion : undefined,
  };

  const nextBoard = applyMoveToBoard(state.board, move);
  const nextTurn: PieceColor = state.turn === 'w' ? 'b' : 'w';

  const capturedByWhite = [...state.capturedByWhite];
  const capturedByBlack = [...state.capturedByBlack];
  if (move.captured) {
    if (state.turn === 'w') {
      capturedByWhite.push(move.captured);
    } else {
      capturedByBlack.push(move.captured);
    }
  }

  // En passant target if pawn moved 2 squares
  let enPassantTarget: SquareCoord | null = null;
  if (move.piece.type === 'p' && Math.abs(move.to.row - move.from.row) === 2) {
    enPassantTarget = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col,
    };
  }

  const inCheck = isKingInCheck(nextBoard, nextTurn);

  const partialNextState: GameState = {
    board: nextBoard,
    turn: nextTurn,
    moveHistory: [],
    capturedByWhite,
    capturedByBlack,
    enPassantTarget,
    inCheck,
    status: 'playing',
    winner: null,
  };

  const opponentLegalMoves = getAllLegalMoves(partialNextState, nextTurn);
  let status: GameState['status'] = 'playing';
  let winner: GameState['winner'] = null;
  let sanSuffix = '';

  if (opponentLegalMoves.length === 0) {
    if (inCheck) {
      status = 'checkmate';
      winner = state.turn;
      sanSuffix = '#';
    } else {
      status = 'stalemate';
      winner = 'draw';
    }
  } else if (inCheck) {
    sanSuffix = '+';
  }

  const finalMove: ChessMove = {
    ...move,
    san: `${move.san}${sanSuffix}`,
  };

  return {
    ...partialNextState,
    moveHistory: [...state.moveHistory, finalMove],
    status,
    winner,
  };
}

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

export function evaluateBoard(state: GameState): number {
  if (state.status === 'checkmate') {
    return state.winner === 'w' ? 99999 : -99999;
  }
  if (state.status === 'stalemate') return 0;

  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      const base = PIECE_VALUES[p.type];
      const tableRow = p.color === 'w' ? r : 7 - r;
      let positional = 0;
      if (p.type === 'p') positional = PAWN_PST[tableRow][c];
      else if (p.type === 'n') positional = KNIGHT_PST[tableRow][c];
      else if (p.type === 'b' || p.type === 'q') {
        positional = (3.5 - Math.abs(3.5 - r)) * 4 + (3.5 - Math.abs(3.5 - c)) * 4;
      }
      const total = base + positional;
      score += p.color === 'w' ? total : -total;
    }
  }
  return score;
}

export function computeBestMove(state: GameState, depth = 2): ChessMove | null {
  const legalMoves = getAllLegalMoves(state);
  if (legalMoves.length === 0) return null;

  // Sort captures first for better alpha-beta pruning and dramatic Wizard's Chess action
  const ordered = [...legalMoves].sort((a, b) => {
    const capA = a.captured ? PIECE_VALUES[a.captured.type] : 0;
    const capB = b.captured ? PIECE_VALUES[b.captured.type] : 0;
    return capB - capA;
  });

  const isMaximizing = state.turn === 'w';
  let bestMove = ordered[0];
  let bestScore = isMaximizing ? -Infinity : Infinity;

  for (const move of ordered) {
    const nextState = makeMove(state, move.from, move.to, move.promotion);
    if (!nextState) continue;
    const score = minimax(nextState, depth - 1, -Infinity, Infinity, !isMaximizing);
    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  return bestMove;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || state.status !== 'playing') {
    return evaluateBoard(state);
  }

  const moves = getAllLegalMoves(state);
  if (moves.length === 0) return evaluateBoard(state);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const next = makeMove(state, m.from, m.to, m.promotion);
      if (!next) continue;
      const ev = minimax(next, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      const next = makeMove(state, m.from, m.to, m.promotion);
      if (!next) continue;
      const ev = minimax(next, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}
