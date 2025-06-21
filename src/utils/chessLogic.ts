import { BasicPieceBoardState, PlayerColor, ParsedFenData } from './types';
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
          const color = (char === char.toUpperCase()) ? PlayerColor.WHITE : PlayerColor.BLACK;
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

const getPlayerColorFromFenPart = (activeColorPart: string): PlayerColor => {
  if (activeColorPart === 'w') return PlayerColor.WHITE;
  if (activeColorPart === 'b') return PlayerColor.BLACK;
  throw new Error("Invalid FEN: Active color is not 'w' or 'b'.");
};

export const getPlayerColorFromFen = (fen: string): PlayerColor => {
  const fenParts = fen.split(' ');
  if (fenParts.length < 2) throw new Error("Invalid FEN: Missing active color part.");
  return getPlayerColorFromFenPart(fenParts[1].toLowerCase());
};


export const getOpponentColor = (playerColor: PlayerColor): PlayerColor => {
  return playerColor === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
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
