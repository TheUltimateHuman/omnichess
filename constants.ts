import { TeamColor, BasicPiece, TeamInfo } from './src/utils/types';

// Add a TEAM_INFOS mapping for dynamic teams
export const TEAM_INFOS: Record<TeamColor, TeamInfo> = {
  white: { color: 'white', displayName: 'White', fenChar: 'w', uiColor: '#FFFFFF' },
  black: { color: 'black', displayName: 'Black', fenChar: 'b', uiColor: '#000000' },
  // Add more teams dynamically as needed (e.g., demon: { ... })
};

// UNICODE_PIECES keys are now uppercase FEN characters
export const UNICODE_PIECES: Record<TeamColor, Partial<Record<string, string>>> = {
  white: {
    'K': '\u2654',
    'Q': '\u2655',
    'R': '\u2656',
    'B': '\u2657',
    'N': '\u2658',
    'P': '\u2659',
    'W': '\ud83d\udc3a', 
  },
  black: {
    'K': '\u265a\uFE0E',
    'Q': '\u265b\uFE0E',
    'R': '\u265c\uFE0E',
    'B': '\u265d\uFE0E',
    'N': '\u265e\uFE0E',
    'P': '\u265f\ufe0e\uFE0E',
    'W': '\ud83d\udc3a\uFE0E', 
  },
  // Add more teams dynamically as needed
};

export const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// PIECE_FROM_FEN_CHAR maps FEN characters directly to Piece objects.
// The `symbol` in the Piece object is the FEN character itself.
// This provides the base definition (symbol, color, maxHp). CurrentHp is set in App.tsx.
export const PIECE_FROM_FEN_CHAR: Record<string, Omit<BasicPiece, 'currentHp'> & {maxHp: number}> = {
  'p': { symbol: 'p', color: 'black', maxHp: 1 },
  'r': { symbol: 'r', color: 'black', maxHp: 5 },
  'n': { symbol: 'n', color: 'black', maxHp: 3 },
  'b': { symbol: 'b', color: 'black', maxHp: 3 },
  'q': { symbol: 'q', color: 'black', maxHp: 7 },
  'k': { symbol: 'k', color: 'black', maxHp: 10 },
  'w': { symbol: 'w', color: 'black', maxHp: 4 }, // Black Werewolf
  'P': { symbol: 'P', color: 'white', maxHp: 1 },
  'R': { symbol: 'R', color: 'white', maxHp: 5 },
  'N': { symbol: 'N', color: 'white', maxHp: 3 },
  'B': { symbol: 'B', color: 'white', maxHp: 3 },
  'Q': { symbol: 'Q', color: 'white', maxHp: 7 },
  'K': { symbol: 'K', color: 'white', maxHp: 10 },
  'W': { symbol: 'W', color: 'white', maxHp: 4 }, // White Werewolf
  // Add more as needed for dynamic teams
};

export const DEFAULT_NEW_PIECE_MAX_HP = 3;

// Static FILES and RANKS are removed as board size is now dynamic.
// Components/utils will generate them as needed.
