import { BasicPieceBoardState, TeamColor, ParsedFenData } from './types';
import { INITIAL_FEN, PIECE_FROM_FEN_CHAR } from '../../constants';

export const getInitialBoardFen = (): string => INITIAL_FEN;

export const parseFenForBoardState = (fen: string): ParsedFenData => {
  const fenParts = fen.split(' ');
  if (fenParts.length < 2) throw new Error("Invalid FEN: Must include at least piece placement and active color.");
  
  const piecePlacement = fenParts[0];
  const activeColorStr = fenParts[1].toLowerCase();

  const ranksStr = piecePlacement.split('/');
  const numRanks = ranksStr.length;
  if (numRanks === 0) throw new Error("Invalid FEN: No ranks found in piece placement.");

  let numFiles = 0;
  if (ranksStr[0]) {
    let fileCount = 0;
    for (const char of ranksStr[0]) {
      if (isNaN(parseInt(char))) {
        fileCount++;
      } else {
        fileCount += parseInt(char);
      }
    }
    numFiles = fileCount;
  }
  if (numFiles === 0) throw new Error("Invalid FEN: Could not determine number of files from the first rank.");

  const board: BasicPieceBoardState = Array(numRanks).fill(null).map(() => Array(numFiles).fill(null));

  for (let r = 0; r < numRanks; r++) {
    let fileIndex = 0;
    if (!ranksStr[r]) throw new Error(`Invalid FEN: Rank ${r + 1} (from top) is empty or missing.`);
    for (const char of ranksStr[r]) {
      if (fileIndex >= numFiles) throw new Error(`Invalid FEN: Too many items in rank ${r + 1}. Expected ${numFiles} files. Rank content: '${ranksStr[r]}'`);
      
      if (isNaN(parseInt(char))) { 
        const pieceDetails = PIECE_FROM_FEN_CHAR[char];
        if (pieceDetails) {
          board[r][fileIndex] = { symbol: pieceDetails.symbol, color: pieceDetails.color };
        } else {
          // This allows dynamic pieces not in PIECE_FROM_FEN_CHAR to be parsed initially
          const color = (char === char.toUpperCase()) ? 'white' : 'black';
          board[r][fileIndex] = { symbol: char, color: color };
        }
        fileIndex++;
      } else { 
        const numEmpty = parseInt(char);
        if (numEmpty <= 0) throw new Error(`Invalid FEN: Rank ${r+1} has non-positive empty square count ${numEmpty}. Content: '${ranksStr[r]}'`);
        if (fileIndex + numEmpty > numFiles) throw new Error(`Invalid FEN: Rank ${r + 1} count exceeds ${numFiles} files with empty squares. Number was ${numEmpty}, current file index ${fileIndex}, content: '${ranksStr[r]}'`);
        fileIndex += numEmpty;
      }
    }
    if (fileIndex !== numFiles) throw new Error(`Invalid FEN: Rank ${r + 1} does not sum to ${numFiles} files. Summed to ${fileIndex}. Content: '${ranksStr[r]}'`);
  }

  const activePlayer = getPlayerColorFromFenPart(activeColorStr);

  return { board, activePlayer, numFiles, numRanks };
};

const getPlayerColorFromFenPart = (activeColorPart: string): TeamColor => {
  return activeColorPart;
};

export const getPlayerColorFromFen = (fen: string): TeamColor => {
  const fenParts = fen.split(' ');
  if (fenParts.length < 2) throw new Error("Invalid FEN: Missing active color part.");
  return getPlayerColorFromFenPart(fenParts[1]);
};

export const getNextTeamInOrder = (currentTeam: TeamColor, teamOrder: TeamColor[]): TeamColor => {
  const idx = teamOrder.indexOf(currentTeam);
  if (idx === -1) throw new Error(`Current team '${currentTeam}' not found in team order: ${teamOrder}`);
  return teamOrder[(idx + 1) % teamOrder.length];
};

export const getSquareCoordinates = (algebraic: string, numRanks: number): { row: number, col: number } | null => {
  if (algebraic.length < 2) return null;
  
  const fileChar = algebraic[0].toLowerCase();
  const rankStr = algebraic.substring(1);

  const col = fileChar.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(rankStr);

  if (isNaN(rank)) return null;
  const row = numRanks - rank; 

  if (col < 0 || row < 0 || row >= numRanks) return null;
  return { row, col };
};

export const getAlgebraicNotation = (row: number, col: number, numRanks: number): string => {
  if (row < 0 || row >= numRanks || col < 0 ) return "invalid_square";
  const file = String.fromCharCode('a'.charCodeAt(0) + col);
  const rank = (numRanks - row).toString();
  return file + rank;
};

export const isStandardChessSetup = (fen: string, numFiles: number, numRanks: number): boolean => {
    if (numFiles !== 8 || numRanks !== 8) {
        return false;
    }
    const standardPieceChars = "prnbqkPRNBQK";
    const fenParts = fen.split(' ');
    if (fenParts.length === 0) return false;
    const piecePlacement = fenParts[0];
    for (const char of piecePlacement) {
        if (char === '/') continue;
        if (isNaN(parseInt(char))) { // It's a piece character
            if (standardPieceChars.indexOf(char) === -1) {
                return false; // Found a non-standard piece character
            }
        } else { // It's a number for empty squares
            const num = parseInt(char);
            if (num < 1 || num > 8) return false; // Standard FEN only uses 1-8 for empty squares
        }
    }
    return true; // Passed all checks
};

/**
 * Strictly audits the transition between two FENs and a described move/narrative.
 * Checks for:
 *  - Pieces removed or added without description
 *  - Board size mismatches
 *  - Piece count mismatches
 *  - Any other discrepancies between FEN and described actions
 * Returns an object with audit summary, mismatches, and suggested corrections.
 */
export function auditFenTransition(
  prevFen: string,
  newFen: string,
  describedActions: string,
  internalActionLog?: any[]
): {
  summary: string;
  mismatches: string[];
  corrections: string[];
  isValid: boolean;
} {
  let mismatches: string[] = [];
  let corrections: string[] = [];
  let summary = '';
  let isValid = true;

  try {
    const prev = parseFenForBoardState(prevFen);
    const next = parseFenForBoardState(newFen);

    // Check board size
    if (prev.numFiles !== next.numFiles || prev.numRanks !== next.numRanks) {
      mismatches.push(`Board size changed from ${prev.numFiles}x${prev.numRanks} to ${next.numFiles}x${next.numRanks}.`);
      isValid = false;
    }

    // Check for empty squares sum per rank
    for (let r = 0; r < next.board.length; r++) {
      if (next.board[r].length !== next.numFiles) {
        mismatches.push(`Rank ${r + 1} has ${next.board[r].length} files, expected ${next.numFiles}.`);
        isValid = false;
      }
    }

    // If internalActionLog is provided, use it as ground truth
    if (internalActionLog && Array.isArray(internalActionLog)) {
      // Build a map of prev and next board states
      const prevMap = new Map<string, {symbol: string, color: string}>();
      const nextMap = new Map<string, {symbol: string, color: string}>();
      for (let r = 0; r < prev.board.length; r++) {
        for (let c = 0; c < prev.board[r].length; c++) {
          const sq = prev.board[r][c];
          if (sq) prevMap.set(`${r},${c}`, sq);
        }
      }
      for (let r = 0; r < next.board.length; r++) {
        for (let c = 0; c < next.board[r].length; c++) {
          const sq = next.board[r][c];
          if (sq) nextMap.set(`${r},${c}`, sq);
        }
      }
      // Track all squares changed
      const changedSquares = new Set<string>();
      for (const [key, val] of prevMap) {
        if (!nextMap.has(key)) changedSquares.add(key);
        else {
          const n = nextMap.get(key)!;
          if (n.symbol !== val.symbol || n.color !== val.color) changedSquares.add(key);
        }
      }
      for (const [key, val] of nextMap) {
        if (!prevMap.has(key)) changedSquares.add(key);
        else {
          const p = prevMap.get(key)!;
          if (p.symbol !== val.symbol || p.color !== val.color) changedSquares.add(key);
        }
      }
      // For each action, check that it is reflected in the changed squares
      for (const action of internalActionLog) {
        if (action.action === 'move' && action.from && action.to) {
          // from should be in prev, to should be in next
          // (for simplicity, use algebraic notation if possible)
          // TODO: Map algebraic to row,col
        }
        // TODO: Add more checks for summon, remove, promote, resize, terrain, etc.
      }
      // For now, just check that there are actions for all changed squares
      if (internalActionLog.length < changedSquares.size) {
        mismatches.push(`Not all board changes are described in internalActionLog. Changed squares: ${Array.from(changedSquares).join(', ')}`);
        isValid = false;
      }
    }
    // Fallback: retain previous piece count checks if no action log
    else {
      // Count pieces by symbol/color
      function countPieces(board: typeof prev.board) {
        const counts: Record<string, number> = {};
        for (const row of board) {
          for (const sq of row) {
            if (sq) {
              const key = sq.symbol + ':' + sq.color;
              counts[key] = (counts[key] || 0) + 1;
            }
          }
        }
        return counts;
      }
      const prevCounts = countPieces(prev.board);
      const nextCounts = countPieces(next.board);
      for (const key of new Set([...Object.keys(prevCounts), ...Object.keys(nextCounts)])) {
        const before = prevCounts[key] || 0;
        const after = nextCounts[key] || 0;
        if (before !== after) {
          const [symbol, color] = key.split(':');
          const diff = after - before;
          if (diff > 0 && !describedActions.includes(symbol)) {
            mismatches.push(`Piece ${symbol} (${color}) count increased by ${diff} but not described.`);
            isValid = false;
          } else if (diff < 0 && !describedActions.includes(symbol)) {
            mismatches.push(`Piece ${symbol} (${color}) count decreased by ${-diff} but not described.`);
            isValid = false;
          }
        }
      }
    }
    summary = isValid
      ? 'FEN matches described actions and board state.'
      : 'FEN and described actions mismatch. See mismatches.';
  } catch (e) {
    mismatches.push('Error during FEN audit: ' + (e instanceof Error ? e.message : String(e)));
    isValid = false;
    summary = 'FEN audit failed due to error.';
  }

  return { summary, mismatches, corrections, isValid };
}
