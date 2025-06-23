export enum PlayerColor {
  WHITE = 'white',
  BLACK = 'black',
  RED = 'red', // Third-party/Red team
  BLUE = 'blue', // Fourth-party/Blue team
}

export interface BasicPiece { // Piece info directly from FEN parsing, without HP
  symbol: string; 
  color: PlayerColor;
}

export interface Piece extends BasicPiece { // Full piece info including HP
  currentHp: number;
  maxHp: number;
}

export type SquareBaseState = BasicPiece | null;
export type SquarePieceState = Piece | null; 

// BoardState representing just symbol and color, as parsed directly from FEN
export type BasicPieceBoardState = SquareBaseState[][]; 
// BoardState representing full Piece objects, including HP, derived in App.tsx
export type PieceBoardState = SquarePieceState[][]; 

export interface ParsedFenData {
  board: BasicPieceBoardState;
  activePlayer: PlayerColor;
  numFiles: number;
  numRanks: number;
  // Could include castling, en passant etc. if needed later
}

export interface ParsedMove {
  from: string | null; 
  to: string;   
  pieceSymbol: string; 
  color: PlayerColor; 
  newType?: string; 
}

export interface LLMPlayerMoveAttempt {
  userInput: string;
  parsed: ParsedMove | null;
  isValidChessMove: boolean; // This will be forced to true client-side
  reasonIfNotValid?: string | null;
  llmInterpretation: string;
  appliedEffects?: any[]; // Optional: For LLM to detail its actions
}

// Renamed LLMOpponentMove to OpponentParsedMove for clarity
export interface OpponentParsedMove {
  from?: string | null; // From can be null for piece creation by opponent
  to?: string | null;   // To can be null if a piece is just removed/affected
  pieceSymbol?: string; 
  color?: PlayerColor; 
}

export interface OpponentResponseData {
  llmInterpretation: string;
  parsed?: OpponentParsedMove | null; // For simple moves
  appliedEffects?: any[]; // For complex actions or detailed effects
}

export interface NewPieceDefinition {
  fenChar: string;      
  displayChar: string;  
  description?: string; 
  maxHp?: number;       
}

export interface TerrainObject {
  type: string;
  displayChar: string;
  effectsDescription: string;
}

export interface TerrainChangeDefinition {
  square: string; 
  terrainType: string;
  displayChar: string;
  effectsDescription: string;
  action: 'add' | 'remove' | 'create'; // Added 'create'
}

export interface LLMResponse {
  playerMoveAttempt: LLMPlayerMoveAttempt;
  boardAfterPlayerMoveFen: string; 
  opponentResponse: OpponentResponseData; // Changed from opponentMove
  boardAfterOpponentMoveFen: string; 
  gameMessage: string;
  newPieceDefinitions?: NewPieceDefinition[];
  terrainChanges?: TerrainChangeDefinition[];
}