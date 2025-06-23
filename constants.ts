import { PlayerColor, BasicPiece } from './src/utils/types'; // Removed Piece import

// UNICODE_PIECES keys are now uppercase FEN characters
export const UNICODE_PIECES: Record<PlayerColor, Partial<Record<string, string>>> = {
  [PlayerColor.WHITE]: {
    'K': '♔',
    'Q': '♕',
    'R': '♖',
    'B': '♗',
    'N': '♘',
    'P': '♙',
    'W': '🐺', 
  },
  [PlayerColor.BLACK]: {
    'K': '♚\uFE0E',
    'Q': '♛\uFE0E',
    'R': '♜\uFE0E',
    'B': '♝\uFE0E',
    'N': '♞\uFE0E',
    'P': '♟︎\uFE0E',
    'W': '🐺\uFE0E', 
  },
  [PlayerColor.RED]: {},
  [PlayerColor.BLUE]: {},
};

export const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// PIECE_FROM_FEN_CHAR maps FEN characters directly to Piece objects.
// The `symbol` in the Piece object is the FEN character itself.
// This provides the base definition (symbol, color, maxHp). CurrentHp is set in App.tsx.
export const PIECE_FROM_FEN_CHAR: Record<string, Omit<BasicPiece, 'currentHp'> & {maxHp: number}> = {
  'p': { symbol: 'p', color: PlayerColor.BLACK, maxHp: 1 },
  'r': { symbol: 'r', color: PlayerColor.BLACK, maxHp: 5 },
  'n': { symbol: 'n', color: PlayerColor.BLACK, maxHp: 3 },
  'b': { symbol: 'b', color: PlayerColor.BLACK, maxHp: 3 },
  'q': { symbol: 'q', color: PlayerColor.BLACK, maxHp: 7 },
  'k': { symbol: 'k', color: PlayerColor.BLACK, maxHp: 10 },
  'w': { symbol: 'w', color: PlayerColor.BLACK, maxHp: 4 }, // Black Werewolf
  'P': { symbol: 'P', color: PlayerColor.WHITE, maxHp: 1 },
  'R': { symbol: 'R', color: PlayerColor.WHITE, maxHp: 5 },
  'N': { symbol: 'N', color: PlayerColor.WHITE, maxHp: 3 },
  'B': { symbol: 'B', color: PlayerColor.WHITE, maxHp: 3 },
  'Q': { symbol: 'Q', color: PlayerColor.WHITE, maxHp: 7 },
  'K': { symbol: 'K', color: PlayerColor.WHITE, maxHp: 10 },
  'W': { symbol: 'W', color: PlayerColor.WHITE, maxHp: 4 }, // White Werewolf
  // Do not include Red or Blue team pieces by default
};

export const DEFAULT_NEW_PIECE_MAX_HP = 3;

// Static FILES and RANKS are removed as board size is now dynamic.
// Components/utils will generate them as needed.
