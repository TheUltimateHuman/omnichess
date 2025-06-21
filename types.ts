
export enum PlayerColor {
  WHITE = 'white',
  BLACK = 'black',
}

export interface Piece {
  symbol: string; // FEN character for the piece, e.g., 'P', 'p', 'W', 'g'
  color: PlayerColor;
}

export type SquareState = Piece | null;
// BoardState[row][col] where row 0 is rank 8, row 7 is rank 1
// col 0 is file 'a', col 7 is file 'h'
export type BoardState = SquareState[][]; 

export interface ParsedMove {
  from: string; // e.g., "e2"
  to: string;   // e.g., "e4"
  pieceSymbol: string; // FEN character of the piece that moved (e.g., 'P')
  color: PlayerColor; 
  newType?: string; // For creative piece transformations, matches new FEN char if applicable
}

export interface LLMPlayerMoveAttempt {
  userInput: string;
  parsed: ParsedMove | null;
  isValidChessMove: boolean;
  reasonIfNotValid?: string | null;
  llmInterpretation: string;
}

export interface LLMOpponentMove {
  parsed: ParsedMove;
  llmInterpretation: string;
}

export interface NewPieceDefinition {
  fenChar: string;      // The FEN character for the new piece (e.g., "G", "g")
  displayChar: string;  // A unicode character/emoji for UI display (e.g., "🦅")
  description?: string; // A brief description of the piece
}

export interface LLMResponse {
  playerMoveAttempt: LLMPlayerMoveAttempt;
  boardAfterPlayerMoveFen: string;
  opponentMove: LLMOpponentMove | null;
  boardAfterOpponentMoveFen: string;
  gameMessage: string;
  newPieceDefinitions?: NewPieceDefinition[];
}