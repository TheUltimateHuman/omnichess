import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { LLMResponse, PlayerColor, TerrainObject } from '../utils/types';

let ai: GoogleGenAI | null = null;

export function initializeGeminiClient(): void {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error("API Key is missing. In a browser environment, this usually means it's not set via a build process or dedicated environment configuration. For development, ensure API_KEY is available. For deployment, ensure it is configured in the execution environment.");
    throw new Error("API Key is missing. Cannot initialize Gemini client. Ensure API_KEY environment variable is set.");
  }
  try {
    ai = new GoogleGenAI({ apiKey }); // Direct usage of apiKey string
    console.log("Gemini client successfully initialized in service.");
  } catch (error) {
    console.error("Error initializing GoogleGenAI client in service:", error);
    ai = null; 
    if (error instanceof Error && (error.message.toLowerCase().includes("api key not valid") || error.message.toLowerCase().includes("api key invalid"))) {
        throw new Error("The API Key provided via environment variable is not valid. Please check the API_KEY.");
    }
    // Forward other types of errors
    throw new Error(`Failed to initialize Gemini client: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function isGeminiClientInitialized(): boolean {
  return !!ai;
}

const generatePrompt = (
  currentFen: string,
  playerInput: string,
  playerColor: PlayerColor,
  opponentColor: PlayerColor,
  currentTerrain: Record<string, TerrainObject | null>,
  currentNumFiles: number,
  currentNumRanks: number,
  gameHistory: string[]
): string => {
  const playerRole = playerColor;
  const opponentRole = opponentColor;
  const terrainContextString = currentTerrain ? JSON.stringify(currentTerrain) : '{}';
  const historyContextString = gameHistory.length > 0
    ? `\n\nRECENT GAME HISTORY (for context, most recent turn last):\n${gameHistory.join('\n---\n')}`
    : "\n\nNo prior game history for this session yet.";

  let systemInstructions = `
You are a highly adaptive chess game engine.
Your current role is to act as: ${playerRole}.
The FEN (${currentFen}) indicates it is ${playerRole}'s turn.
The current board dimensions are: ${currentNumFiles} files (columns) by ${currentNumRanks} ranks (rows).
The current terrain/objects on the board are: ${terrainContextString}
${historyContextString}

The input directive for ${playerRole}'s turn is: "${playerInput}"

SPECIAL INSTRUCTION BLOCK FOR THIS TURN:
`;

  if (playerInput.startsWith(`It is your turn (${playerRole}). Choose one of the following legal standard chess moves`)) {
    systemInstructions += `
It is YOUR (${playerRole}) turn to make a standard, strong chess move.
You have been provided with a list of legal moves available to you. The player input (directive) "${playerInput}" contains this list.
- Your task is to SELECT ONE move from the provided list. Choose a strategically sound move.
- In the JSON response you provide:
  - "playerMoveAttempt.llmInterpretation" MUST describe the standard chess move YOU (${playerRole}) chose from the list (e.g., "${playerRole} plays Knight to f3.").
  - "playerMoveAttempt.parsed" MUST detail this chosen move (e.g., from, to, pieceSymbol, and ideally the SAN of the chosen move).
  - "boardAfterPlayerMoveFen" MUST be the FEN string after YOUR (${playerRole}) chosen move. This FEN must be a valid chess FEN according to standard rules and accurately reflect the chosen move. The active player in this FEN should correctly be ${opponentRole}.
  - "opponentResponse.llmInterpretation" MUST simply acknowledge that it is now ${opponentRole}'s turn (e.g., "${opponentRole} to move."). "opponentResponse.parsed" should be null.
  - "boardAfterOpponentMoveFen" MUST be IDENTICAL to "boardAfterPlayerMoveFen".
  - "gameMessage" MUST clearly describe the standard move YOU (${playerRole}) made.
  - "newPieceDefinitions" and "terrainChanges" should be empty or null unless the chosen standard move results in pawn promotion (to Q, R, B, or N).
`;
  } else {
    systemInstructions += `
The player (${playerRole}) has issued the directive: "${playerInput}".
This directive is PARAMOUNT. Your primary goal is to EXECUTE THIS DIRECTIVE AS STATED by the player, using the game's mechanics as tools to make it happen. Do not refuse or overly restrict the directive based on standard chess rules if the directive implies those rules should be bent or overridden for this turn.

Interpret the player's directive literally and comprehensively.
- If the directive is "all pieces do X", then ALL specified pieces belonging to ${playerRole} MUST attempt to do X.
- For 'all at once' or 'simultaneous' player directives: Each piece's action decision (e.g., if it *can* move from S to T) MUST be based on the board state *before any piece involved in the simultaneous directive has moved*. If multiple pieces can legally move to the SAME target square T_TARGET based on this initial state, YOU MUST then decide and narrate the outcome (e.g., only one arrives, they merge, one is destroyed, one is displaced, others fail). Do not say piece A is 'blocked' by piece B if B is also part of the same 'all at once' move and B's 'blocking' position is its *destination*, not its starting square unless the directive implies such a bottleneck. YOUR NARRATIVE and the resulting "boardAfterPlayerMoveFen" MUST reflect this resolution for ALL involved pieces.
- Use the game's established mechanics (piece movement, HP, captures, summoning, terrain changes, board dimension changes, FEN string rules, new piece definitions, etc.) as the tools to realize the player's command.
- If the directive is ambiguous, make a reasonable interpretation that fulfills the command's core intent and allows the game to continue in an engaging way.

**CONSIDER GAME HISTORY FOR NARRATIVE CONTINUITY (VERY IMPORTANT!):**
The "RECENT GAME HISTORY" (provided above) details previous player actions and your interpretations/game messages.
Your response to the current player directive "${playerInput}" MUST logically follow and build upon this established narrative.
For example:
  - If history shows "Player (white): my pawns dig a moat. Gemini: White's pawns remain on the 2nd rank and dig a moat on the 3rd rank, creating a defensive barrier.",
  - And the current directive is "Player (white): my pawns release sharks into the moat.",
  - Then your "llmInterpretation" and "appliedEffects" should focus on adding sharks to the existing moat on rank 3 (e.g., by modifying the terrain properties of rank 3 squares, or by describing shark entities now occupying the moat terrain). The action should clearly be about populating the *already established moat* with sharks. It should NOT, for example, transform the player's pawns into sharks, or create a new, separate moat if one was just made.
Refer to the history to ensure your actions are consistent with prior events and the player's developing story.

When processing ${playerRole}'s directive:
- "playerMoveAttempt.llmInterpretation" should explain how you are interpreting ${playerRole}'s directive "${playerInput}" and ALL its effects, including how any conflicts or unusual situations arising from the directive were resolved. Critically, explain how this interpretation follows from the RECENT GAME HISTORY if applicable.
- "boardAfterPlayerMoveFen" is the FEN after all effects of ${playerRole}'s directive are applied. The active player in this FEN should usually be ${opponentRole}.
- Then, YOU (acting as the game engine for the opponent) determine ${opponentRole}'s counter-move. This can be a standard move or an interpretation of the new board state, also considering the game history.
- "opponentResponse.llmInterpretation" describes ${opponentRole}'s counter-move.
- "boardAfterOpponentMoveFen" is the FEN after ${opponentRole}'s counter-move. The active player in this FEN should be ${playerRole}.
- "gameMessage" should summarize both ${playerRole}'s action (and its consequences as you interpreted them, referencing history if it shaped the interpretation) and ${opponentRole}'s response. It may also declare a game end (e.g., "White's Dragon incinerates the Black King! White wins!").
`;
  }

  systemInstructions += `

SHARED RULES (Apply to all paths):

HEALTH POINTS (HP) & DESTRUCTION:
- The FEN string only tracks piece presence or absence, not current HP.
- Pieces have Health Points (HP). Standard pieces have pre-defined max HP (Pawn:1, Rook:5, Knight:3, Bishop:3, Queen:7, King:10).
- When you define a new piece in "newPieceDefinitions", you can specify its "maxHp". If not, it defaults to 3.
- When your actions cause a piece to take damage:
    - If the piece's conceptual HP drops to 0 or less, it is DESTROYED. You MUST remove its FEN character from its square in the "boardAfter...Fen" strings.
    - If a piece is damaged but NOT destroyed (its conceptual HP > 0 after damage), its FEN character REMAINS on its square. YOU MUST narrate the damage taken and remaining HP in "playerMoveAttempt.llmInterpretation", "opponentResponse.llmInterpretation", or "gameMessage". The UI relies on this narrative for showing damaged states.
- Do NOT invent new FEN characters or modifiers (e.g., 'P*') for damaged pieces. Standard FEN characters are used until destruction.

FEN STRING RULES - VERY IMPORTANT - ADHERE STRICTLY:
1.  The piece placement part of the FEN string describes all ranks, separated by '/'.
2.  DIMENSION CONSISTENCY (ABSOLUTELY CRITICAL): If your "llmInterpretation" or "appliedEffects" state that the board dimensions change (e.g., to N ranks and M files), then the piece placement part of your FEN strings ("boardAfterPlayerMoveFen" and "boardAfterOpponentMoveFen") MUST reflect these exact new dimensions.
        * It MUST contain exactly N rank strings (N segments separated by N-1 slashes).
        * Each of these N rank strings MUST describe exactly M files.
3.  Each rank string describes all squares for that rank, matching the current number of files.
4.  Piece characters (e.g., 'P', 'r', 'W') represent one occupied square.
5.  Numbers (e.g., 1-8, or higher if files > 8) represent that many CONSECUTIVE empty squares.
6.  RANK STRING ACCURACY AND COMPLETENESS (CRUCIAL!):
    a. SUM TO FILES (CRITICAL MISTAKE TO AVOID): For EACH rank string in the FEN, the total number of squares represented (sum of piece characters [each counts as 1] + the sum of numerical values [e.g., '3' counts as 3 empty squares]) MUST be exactly equal to the current/new number of files for the board.
        Example (8 files): 'rnbqkbnr' (8 pieces = 8 files). '8' (8 empty = 8 files). 'P7' (1 piece + 7 empty = 8 files). 'r3k2r' (1+3+1+2+1 = 8 files).
        INCORRECT (8 files): 'rnbqkbn' (7 pieces, WRONG). '3k3' (3+1+3 = 7 files, WRONG). 'p6p' (1+6+1=8, Correct).
    b. PRESERVE UNAFFECTED PIECES: When modifying a rank due to a piece moving, being captured, or created on that rank, ALL OTHER PIECES on that same rank that were NOT directly part of this specific action MUST RETAIN THEIR POSITIONS and be correctly included in the updated rank string. Do not accidentally omit them.
        Example for an 8-file board: If a rank is '5nAA' (5 empty, knight 'n' on file f, alien 'A' on file g, alien 'A' on file h) and the black knight 'n' at f6 captures the white alien 'A' at g6 (move nf6xAg6):
        - The 'n' moves from f6 to g6. The 'A' at g6 is removed. Square f6 becomes empty.
        - The white alien 'A' at h6 was NOT involved and MUST remain on h6.
        - The new rank string should be '6nA' (6 empty squares a-f, 'n' on g6, 'A' on h6).
        - An INCORRECT new rank string would be '6n' (because the 'A' on h6 was forgotten).
    c. SANITY CHECK FINAL FEN: Before outputting the JSON, mentally re-parse your generated "boardAfterPlayerMoveFen" and "boardAfterOpponentMoveFen" rank by rank. For each rank, count the pieces and sum the numbers. Does it match the current/new number of files? If not, YOU MUST CORRECT IT. This is the most common source of errors.
7.  If a piece summons another, the summoning piece typically REMAINS on its square unless your narrative explicitly states it is consumed, transformed, or moves. Ensure FEN reflects this.
8.  The FEN string you provide should ONLY reflect piece positions. Terrain is handled by "terrainChanges".
9.  PIECE MOVEMENT: When a piece moves from one square to another (including for a capture), its FEN character MUST be removed from its original square and placed on the new square. The original square must then be accounted for as empty (usually by adjusting a number or replacing with '1' if it was adjacent to other pieces). A piece cannot exist in two places simultaneously.
10. POSITIONAL ACCURACY: If your interpretation involves a piece moving to a specific square (e.g., "Knight moves to c6"), the final position of that piece's FEN character in the "boardAfterPlayerMoveFen" or "boardAfterOpponentMoveFen" MUST accurately reflect that target square.

NEW PIECE DEFINITIONS:
1. Assign it a unique single FEN character (uppercase for White, lowercase for Black).
2. For each new piece type, you MUST provide its definition as an object within the "newPieceDefinitions" array. Each definition object requires: "fenChar" (string), "displayChar" (string), "description" (string), and optionally "maxHp" (number, defaults to 3 if omitted).
3. IMPORTANT CONSISTENCY: Once a custom piece's "fenChar" (e.g., 'W') is defined with a "maxHp" and "displayChar", do NOT provide a "newPieceDefinition" for the *same* "fenChar" in subsequent turns to change these core attributes. Its initial "maxHp" and "displayChar" are fixed for that "fenChar". If a piece undergoes a fundamental change that alters these, it should conceptually become a *new* piece type with a *new, different* "fenChar" and its own definition. Narrate the transformation if needed.

TERRAIN/OBJECTS:
If the player's action implies creating, modifying, or removing terrain:
1. Describe these in the "terrainChanges" array: { "square", "terrainType", "displayChar", "effectsDescription", "action" }.
    "square" can be an algebraic coordinate (e.g., "e4", "j10"), "rank3", "filec". Coordinates must be valid for the current/new board dimensions.
    "effectsDescription" should specify any HP damage dealt by the terrain.
    "action" should be 'add' (or 'create') or 'remove'.

YOUR TASK (follow the specific instructions above for how to populate these fields):
You must return a single JSON object structured as follows:
{
  "playerMoveAttempt": {
    "userInput": "${playerInput}",
    "parsed": { "from": "sq", "to": "sq", "pieceSymbol": "X", "color": "${playerRole}", "san": "ChosenSAN" } | null,
    "isValidChessMove": true,
    "llmInterpretation": "...",
    "appliedEffects": [/* optional details of changes */]
  },
  "boardAfterPlayerMoveFen": "FEN_string",
  "newPieceDefinitions": [/* { fenChar, displayChar, description, maxHp? } */] | null,
  "terrainChanges": [/* { square, terrainType, displayChar, effectsDescription, action } */] | null,
  "opponentResponse": {
    "llmInterpretation": "...",
    "parsed": { "from": "sq", "to": "sq", "pieceSymbol": "x", "color": "${opponentRole}" } | null,
    "appliedEffects": [/* optional details of changes */]
  },
  "boardAfterOpponentMoveFen": "FEN_string",
  "gameMessage": "Descriptive summary of the turn."
}

Ensure the FEN strings correctly reflect the active player ('w' or 'b') for whose turn it is next.
For "boardAfterPlayerMoveFen", the active player should be ${opponentRole}.
For "boardAfterOpponentMoveFen", the active player should be ${playerRole}.
(If it's the "standard chess move" path for ${playerRole} where you chose from a list, "boardAfterOpponentMoveFen" is identical to "boardAfterPlayerMoveFen", so active player remains ${opponentRole}).

Respond ONLY with the JSON object. Do not use markdown like \`\`\`json.
`;
  return systemInstructions;
};

export const processMove = async (
  currentFen: string,
  playerInput: string,
  playerColor: PlayerColor,
  opponentColor: PlayerColor,
  currentTerrain: Record<string, TerrainObject | null>,
  currentNumFiles: number,
  currentNumRanks: number,
  gameHistory: string[]
): Promise<LLMResponse> => {
  if (!isGeminiClientInitialized()) {
    try {
      // Attempt to initialize if not already. This will use the safe API key access.
      initializeGeminiClient();
    } catch (initError) {
      console.error("Critical: Failed to initialize Gemini Client in processMove fallback:", initError);
      // Propagate error to stop further processing if initialization fails here.
      throw initError;
    }
  }

  if (!ai) {
    // This state should ideally not be reached if initializeGeminiClient throws on failure.
    console.error("Gemini client (ai instance) is null in processMove. This indicates an issue with initialization. The API_KEY might be missing or invalid.");
    throw new Error("Gemini client is not available. Please ensure API_KEY environment variable is set and client is initialized.");
  }

  const prompt = generatePrompt(currentFen, playerInput, playerColor, opponentColor, currentTerrain, currentNumFiles, currentNumRanks, gameHistory);
  let apiResponseText: string = '';

  try {
    console.log("Sending to Gemini - Current FEN:", currentFen, "Player Input:", playerInput, "Current Terrain:", currentTerrain, "Dimensions:", `${currentNumFiles}x${currentNumRanks}`, "History:", gameHistory);
    
    const geminiApiResponse: GenerateContentResponse = await ai.models.generateContent({ 
        model: 'gemini-pro',
        contents: prompt,
    });

    apiResponseText = geminiApiResponse.text; 
    
    console.log("Raw Gemini API response text:", apiResponseText);

    let jsonStr = apiResponseText.trim();
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    const parsedData = JSON.parse(jsonStr) as LLMResponse;
    console.log("Parsed Gemini JSON response:", parsedData);

    if (!parsedData.playerMoveAttempt ||
      typeof parsedData.boardAfterPlayerMoveFen !== 'string' ||
      typeof parsedData.boardAfterOpponentMoveFen !== 'string' ||
      !parsedData.opponentResponse ||
      typeof parsedData.opponentResponse.llmInterpretation !== 'string' ||
      typeof parsedData.gameMessage !== 'string'
    ) {
      console.error("LLM response missing critical fields or opponentResponse structure:", parsedData);
      throw new Error("LLM response structure is not as expected. Must include interpretations, FENs, gameMessage, and opponentResponse with llmInterpretation.");
    }

    parsedData.playerMoveAttempt.isValidChessMove = true;
    parsedData.playerMoveAttempt.userInput = playerInput;


    if (parsedData.newPieceDefinitions && !Array.isArray(parsedData.newPieceDefinitions)) {
      console.warn("LLM provided newPieceDefinitions but it's not an array. Ignoring.", parsedData.newPieceDefinitions);
      delete parsedData.newPieceDefinitions;
    }
    if (parsedData.terrainChanges && !Array.isArray(parsedData.terrainChanges)) {
      console.warn("LLM provided terrainChanges but it's not an array. Ignoring.", parsedData.terrainChanges);
      delete parsedData.terrainChanges;
    }

    if (parsedData.playerMoveAttempt.appliedEffects && !Array.isArray(parsedData.playerMoveAttempt.appliedEffects)) {
      parsedData.playerMoveAttempt.appliedEffects = [];
    } else if (!parsedData.playerMoveAttempt.appliedEffects) {
      parsedData.playerMoveAttempt.appliedEffects = [];
    }

    if (parsedData.opponentResponse.appliedEffects && !Array.isArray(parsedData.opponentResponse.appliedEffects)) {
      parsedData.opponentResponse.appliedEffects = [];
    } else if (!parsedData.opponentResponse.appliedEffects) {
      parsedData.opponentResponse.appliedEffects = [];
    }


    console.log("FEN after player's piece move (from LLM):", parsedData.boardAfterPlayerMoveFen);
    console.log("FEN after opponent's piece move (from LLM):", parsedData.boardAfterOpponentMoveFen);
    if (parsedData.newPieceDefinitions && parsedData.newPieceDefinitions.length > 0) {
      console.log("New piece definitions from LLM:", parsedData.newPieceDefinitions);
    }
    if (parsedData.terrainChanges && parsedData.terrainChanges.length > 0) {
      console.log("Terrain changes from LLM:", parsedData.terrainChanges);
    }

    return parsedData;

  } catch (error: any) {
    console.error("Error calling Gemini API or parsing response:", error);
    if (error.message && (error.message.toLowerCase().includes("api key not valid") || error.message.toLowerCase().includes("api key invalid"))) {
      throw new Error("Invalid Gemini API Key (obtained from environment variable). Please check your API_KEY.");
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse LLM JSON response. Content was: '${apiResponseText}'. Error: ${error.message}`);
    }
    if (apiResponseText && (apiResponseText.toLowerCase().includes("billing account not found") || apiResponseText.toLowerCase().includes("quota exceeded"))) {
      throw new Error(`Gemini API Error: ${apiResponseText}. Please check your Google Cloud project billing and API quotas.`);
    }
    // Fallback error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API error: ${errorMessage}`);
  }
};