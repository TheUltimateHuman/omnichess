import React, { useState, useEffect, useCallback } from 'react';
import { Board } from './components/Board';
import { MoveInput } from './components/MoveInput';
import { GameMessages } from './components/GameMessages';
import { processMove, initializeGeminiClient, isGeminiClientInitialized } from './services/geminiService';
import { getInitialBoardFen, getOpponentColor, parseFenForBoardState, isStandardChessSetup } from './utils/chessLogic';
import { PlayerColor, LLMResponse, TerrainObject, PieceBoardState, ParsedFenData, Piece } from './utils/types';
import { DEFAULT_NEW_PIECE_MAX_HP, PIECE_FROM_FEN_CHAR } from '../constants';
import { Chess, Move as ChessJSMove } from 'chess.js';

interface DynamicPiecePrototype {
  displayChar: string;
  maxHp: number;
}

const App: React.FC = () => {
  console.log('App.tsx: Component function body executing.');
  const initialFen = getInitialBoardFen();
  const [boardFen, setBoardFen] = useState<string>(initialFen);
  
  const [canonicalPieceBoardState, setCanonicalPieceBoardState] = useState<PieceBoardState>([]);
  const [canonicalNumFiles, setCanonicalNumFiles] = useState<number>(8);
  const [canonicalNumRanks, setCanonicalNumRanks] = useState<number>(8);
  
  const [boardTerrain, setBoardTerrain] = useState<Record<string, TerrainObject | null>>({});
  const [currentPlayer, setCurrentPlayer] = useState<PlayerColor>(PlayerColor.WHITE);
  const [gameMessages, setGameMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [geminiReady, setGeminiReady] = useState<boolean>(false);

  const [dynamicPiecePrototypes, setDynamicPiecePrototypes] = useState<Record<string, DynamicPiecePrototype>>({});
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winner, setWinner] = useState<PlayerColor | 'draw' | null>(null);
  const [gameHistoryForLLM, setGameHistoryForLLM] = useState<string[]>([]);

  const addMessage = useCallback((message: string) => {
    setGameMessages(prev => [...prev.slice(-15), message]); 
  }, []);

  useEffect(() => {
    console.log("App.tsx: Initial Gemini client initialization useEffect running.");
    if (!isGeminiClientInitialized()) {
      try {
        console.log("Attempting to initialize Gemini client...");
        initializeGeminiClient(); // API key will be sourced from process.env.API_KEY by the service
        setGeminiReady(true);
        setError(null);
        console.log("Gemini client initialized successfully.");
        // addMessage("Gemini client initialized. Ready to play."); // Optional: user-facing message
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Unknown error during initialization.";
        setError(`Gemini Client Initialization Error: ${errorMsg}. Please ensure the API_KEY environment variable is correctly configured.`);
        setGeminiReady(false);
        console.error("Failed to initialize Gemini client:", e);
      }
    } else {
        setGeminiReady(true);
        setError(null);
        console.log("Gemini client was already initialized.");
    }
  }, []); // Runs once on mount


  useEffect(() => {
    console.log("App.tsx: FEN parsing useEffect running. FEN:", boardFen, "GeminiReady:", geminiReady, "CurrentError:", error);
    try {
      const parsedFenData: ParsedFenData = parseFenForBoardState(boardFen);
      
      setCanonicalNumFiles(parsedFenData.numFiles);
      setCanonicalNumRanks(parsedFenData.numRanks);
      setCurrentPlayer(parsedFenData.activePlayer);

      const newPieceBoardState: PieceBoardState = parsedFenData.board.map(row =>
        row.map(squarePiece => {
          if (!squarePiece) return null;
          
          const standardPieceProto = PIECE_FROM_FEN_CHAR[squarePiece.symbol];
          const dynamicProto = dynamicPiecePrototypes[squarePiece.symbol];
          let maxHp = DEFAULT_NEW_PIECE_MAX_HP;
          let currentHp = maxHp; 

          if (dynamicProto) {
            maxHp = dynamicProto.maxHp;
            currentHp = dynamicProto.maxHp; 
          } else if (standardPieceProto) {
            maxHp = standardPieceProto.maxHp;
            currentHp = standardPieceProto.maxHp;
          } else {
            if (!Object.keys(PIECE_FROM_FEN_CHAR).includes(squarePiece.symbol) && !dynamicProto) { 
                 console.warn(`No HP definition for piece symbol ${squarePiece.symbol} in constants or dynamic prototypes. Using default HP.`);
            }
          }
          
          const fullPiece: Piece = { 
            symbol: squarePiece.symbol,
            color: squarePiece.color,
            maxHp: maxHp, 
            currentHp: currentHp 
          };
          return fullPiece;
        })
      );
      setCanonicalPieceBoardState(newPieceBoardState);
      // Do not clear FEN error if gemini is not ready (initialization error might be present)
      if (geminiReady && (!error || !error.toLowerCase().includes("gemini client initialization error"))) {
        // Clear only non-Gemini-init errors if Gemini is ready
        setError(null); 
      }
    } catch (e) {
      console.error("Error parsing FEN or building canonical piece state:", e, "FEN:", boardFen);
      const errorMsg = (e instanceof Error) ? e.message : "Invalid FEN string or board setup."
      // Avoid overwriting a more critical Gemini initialization error
      if (!error || !error.toLowerCase().includes("gemini client initialization error")) {
        setError(`Internal error: ${errorMsg} Cannot determine current player or board state from FEN: ${boardFen}. Board might not update correctly.`);
      }
    }
  }, [boardFen, dynamicPiecePrototypes, geminiReady, error]); // Added geminiReady and error to dependency

  useEffect(() => {
    if (!geminiReady || isGameOver) return; 

    let gameActuallyOver = false;
    let gameOverMessage = "";
    let determinedWinner: PlayerColor | 'draw' | null = null;

    const standardSetup = isStandardChessSetup(boardFen, canonicalNumFiles, canonicalNumRanks);

    if (standardSetup) {
        try {
            const game = new Chess(boardFen);
            const nextTurnPlayerColor = game.turn() === 'w' ? PlayerColor.WHITE : PlayerColor.BLACK;

            if (game.isCheckmate()) {
                determinedWinner = getOpponentColor(nextTurnPlayerColor);
                gameOverMessage = `Checkmate! ${determinedWinner.charAt(0).toUpperCase() + determinedWinner.slice(1)} wins.`;
                gameActuallyOver = true;
            } else if (game.isStalemate()) {
                determinedWinner = 'draw';
                gameOverMessage = "Stalemate! The game is a draw.";
                gameActuallyOver = true;
            } else if (game.isDraw()) {
                determinedWinner = 'draw';
                gameOverMessage = "Draw! (Threefold repetition, insufficient material, or 50-move rule).";
                gameActuallyOver = true;
            }
        } catch (e) {
            console.warn("chess.js could not process FEN for game status (expected for custom pieces/FENs):", boardFen, e);
        }
    } else { 
        const lastMessage = gameMessages.length > 0 ? gameMessages[gameMessages.length - 1] : "";
        if (lastMessage) {
            const lowerLastMessage = lastMessage.toLowerCase();
            if (lowerLastMessage.includes("checkmate") || lowerLastMessage.includes("king captured")) {
                 if (lowerLastMessage.includes("white wins")) determinedWinner = PlayerColor.WHITE;
                 else if (lowerLastMessage.includes("black wins")) determinedWinner = PlayerColor.BLACK;
                 else { 
                    const lastPlayer = currentPlayer === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE; 
                    if (lowerLastMessage.includes(lastPlayer)) determinedWinner = lastPlayer;
                 }
                 gameOverMessage = lastMessage; 
                 gameActuallyOver = true;
            } else if (lowerLastMessage.includes("stalemate") || (lowerLastMessage.includes("draw") && !lowerLastMessage.includes("threefold repetition"))) { 
                determinedWinner = 'draw';
                gameOverMessage = lastMessage;
                gameActuallyOver = true;
            } else if (lowerLastMessage.includes("game over")) {
                gameOverMessage = lastMessage;
                gameActuallyOver = true;
                if (lowerLastMessage.includes("white wins")) determinedWinner = PlayerColor.WHITE;
                else if (lowerLastMessage.includes("black wins")) determinedWinner = PlayerColor.BLACK;
                else if (lowerLastMessage.includes("draw")) determinedWinner = 'draw';
            }
        }
    }
    
    if (gameActuallyOver) {
        if (!isGameOver) {
          addMessage(gameOverMessage);
          setWinner(determinedWinner);
          setIsGameOver(true);
        }
    }
  }, [boardFen, currentPlayer, addMessage, isGameOver, geminiReady, gameMessages, canonicalNumFiles, canonicalNumRanks]);


  const applyLlmResponseSideEffects = useCallback((
    response: LLMResponse, 
    newBaseFenForTerrainContext: string
  ) => {
    if (response.newPieceDefinitions && Array.isArray(response.newPieceDefinitions)) {
      setDynamicPiecePrototypes(prevPrototypes => {
        const newPrototypes = { ...prevPrototypes };
        for (const def of response.newPieceDefinitions!) {
          if (def.fenChar && def.displayChar) {
            if (newPrototypes[def.fenChar]) {
              console.warn(`LLM attempted to redefine piece prototype for '${def.fenChar}'. Ignoring redefinition. Original:`, newPrototypes[def.fenChar], "New:", def);
              continue;
            }
            newPrototypes[def.fenChar] = {
              displayChar: def.displayChar,
              maxHp: def.maxHp ?? DEFAULT_NEW_PIECE_MAX_HP
            };
            console.log(`Registered new piece prototype: ${def.fenChar} -> ${def.displayChar}, HP: ${newPrototypes[def.fenChar].maxHp}`);
          }
        }
        return newPrototypes;
      });
    }

    if (response.terrainChanges && Array.isArray(response.terrainChanges)) {
      let effectiveNumFiles = canonicalNumFiles; 
      let effectiveNumRanks = canonicalNumRanks; 
      try {
          const parsedFenForTerrain = parseFenForBoardState(newBaseFenForTerrainContext);
          effectiveNumFiles = parsedFenForTerrain.numFiles;
          effectiveNumRanks = parsedFenForTerrain.numRanks;
      } catch (e) {
          console.error("Cannot apply terrain changes, FEN for dimensions is invalid:", newBaseFenForTerrainContext, e);
          addMessage("Error: Could not apply terrain changes due to FEN issue with: " + newBaseFenForTerrainContext);
          return; 
      }

      setBoardTerrain(prevTerrain => {
        const newTerrain = { ...prevTerrain };
        const allFiles = Array.from({ length: effectiveNumFiles }, (_, i) => String.fromCharCode('a'.charCodeAt(0) + i));
        const allRankNumbers = Array.from({ length: effectiveNumRanks }, (_, i) => (i + 1).toString());

        for (const change of response.terrainChanges!) {
          const squaresToUpdate: string[] = [];
          if (/^[a-z][1-9]\d*$/.test(change.square)) { 
            squaresToUpdate.push(change.square);
          } else if (change.square.startsWith("rank")) { 
            const rankNumStr = change.square.replace("rank", ""); 
            if (allRankNumbers.includes(rankNumStr) ) {
               allFiles.forEach(file => squaresToUpdate.push(file + rankNumStr));
            } else {
              console.warn("Invalid rank in terrainChange:", change.square, "Current ranks:", allRankNumbers);
            }
          } else if (change.square.startsWith("file")) { 
            const fileChar = change.square.replace("file", ""); 
            if (/^[a-z]$/.test(fileChar) && allFiles.includes(fileChar)) {
              allRankNumbers.forEach(rank => squaresToUpdate.push(fileChar + rank));
            } else {
              console.warn("Invalid file in terrainChange:", change.square, "Current files:", allFiles);
            }
          } else {
              console.warn("Unhandled square/region format in terrainChange:", change.square);
          }

          for (const sqKey of squaresToUpdate) {
            if (change.action === 'add' || change.action === 'create') {
              newTerrain[sqKey] = { 
                type: change.terrainType, 
                displayChar: change.displayChar, 
                effectsDescription: change.effectsDescription 
              };
              console.log(`Terrain: Added ${change.terrainType} ('${change.displayChar}') to ${sqKey}`);
            } else if (change.action === 'remove') {
              delete newTerrain[sqKey]; 
              console.log(`Terrain: Removed from ${sqKey}`);
            }
          }
        }
        return newTerrain;
      });
    }
  }, [canonicalNumFiles, canonicalNumRanks, addMessage]);


  const handlePlayerMove = useCallback(async (inputText: string) => {
    if (!geminiReady || isGameOver) {
        if (!geminiReady) {
            addMessage("Error: Gemini client not ready. Cannot process move. Check console for API Key errors.");
        }
        return;
    }

    setIsLoading(true);
    setError(null); // Clear previous move/processing errors

    let isStandardMovePath = false;
    let fenAfterPlayerStdMove: string | null = null;
    let playerStdMoveSan: string | null = null;
    let humanPlayerActualColor = currentPlayer; 

    const standardSetup = isStandardChessSetup(boardFen, canonicalNumFiles, canonicalNumRanks);

    if (standardSetup) {
        try {
            const game = new Chess(boardFen); 
            let legalMoveResult: ChessJSMove | null = null;
            const coordinateMoveRegex = /^([a-h][1-8])\s*(?:to|-|takes|x)\s*([a-h][1-8])\s*=?\s*([qrbn])?/i;
            const coordMatch = inputText.trim().match(coordinateMoveRegex);

            if (coordMatch) {
                const moveObject: { from: string; to: string; promotion?: string } = {
                    from: coordMatch[1].toLowerCase(), to: coordMatch[2].toLowerCase(),
                };
                if (coordMatch[3]) moveObject.promotion = coordMatch[3].toLowerCase();
                try {
                    const tempGame = new Chess(boardFen); 
                    const testMove = tempGame.move(moveObject); 
                    if (testMove) legalMoveResult = game.move(moveObject);
                    else addMessage(`Game: "${inputText}" is not a valid standard chess move. Asking Gemini for interpretation.`);
                } catch (e) {
                    console.warn(`chess.js rejected move object ${JSON.stringify(moveObject)}:`, e);
                    addMessage(`Game: "${inputText}" is not recognized as a valid standard chess move. Asking Gemini...`);
                }
            }

            if (!legalMoveResult) {
                try {
                    const tempGame = new Chess(boardFen);
                    const testMove = tempGame.move(inputText);
                    if (testMove) legalMoveResult = game.move(inputText);
                    else if (!coordMatch) console.log(`Input "${inputText}" not recognized by chess.js SAN. Proceeding to Gemini.`);
                } catch (e) {
                     console.warn(`chess.js move failed for input "${inputText}":`, e);
                }
            }

            if (legalMoveResult) {
                isStandardMovePath = true;
                fenAfterPlayerStdMove = game.fen();
                playerStdMoveSan = legalMoveResult.san;
            }
        } catch (e) {
            console.warn("chess.js FEN validation/initialization failed during player move. Expected for custom pieces/FENs. Falling back to Gemini. Error:", e, "FEN:", boardFen);
        }
    }


    try {
        let finalFenForTurn: string = boardFen;
        let llmResponseForSideEffects: LLMResponse | null = null;
        let currentTurnPlayerInputForHistory = inputText;


        if (isStandardMovePath && fenAfterPlayerStdMove && playerStdMoveSan) {
            addMessage(`You (${humanPlayerActualColor}): ${playerStdMoveSan}`);
            currentTurnPlayerInputForHistory = playerStdMoveSan; 
            setBoardFen(fenAfterPlayerStdMove); 

            const gameAfterPlayer = new Chess(fenAfterPlayerStdMove);
             if (gameAfterPlayer.isCheckmate() || gameAfterPlayer.isStalemate() || gameAfterPlayer.isDraw()) {
                setIsLoading(false); return; 
            }

            const aiPlayerColor = getOpponentColor(humanPlayerActualColor);
            
            const gameForAiTurn = new Chess(fenAfterPlayerStdMove);
            const legalAiMovesSan = gameForAiTurn.moves();

            if (legalAiMovesSan.length === 0) {
                console.warn("AI has no legal moves after player's standard move. Game should end (handled by useEffect).");
                setIsLoading(false); return; 
            }
            
            const aiPromptInput = `It is your turn (${aiPlayerColor}). Choose one of the following legal standard chess moves for ${aiPlayerColor} from this list: ${JSON.stringify(legalAiMovesSan)}. Select a strong move. Your response must select one of these moves and provide the resulting FEN. Ensure your playerMoveAttempt.parsed accurately reflects your chosen move.`;

            const response: LLMResponse = await processMove(
                fenAfterPlayerStdMove, aiPromptInput, aiPlayerColor, humanPlayerActualColor,
                boardTerrain, 8, 8, gameHistoryForLLM
            );
            llmResponseForSideEffects = response;
            addMessage(`Gemini (${aiPlayerColor}): ${response.gameMessage}`);
            
            try { 
                new Chess(response.boardAfterOpponentMoveFen); 
                finalFenForTurn = response.boardAfterOpponentMoveFen;
            } catch (e_fen_ai) {
                const fenErrorMsg = e_fen_ai instanceof Error ? e_fen_ai.message : "Unknown FEN processing error for AI move.";
                console.error("Error processing AI's FEN in standard move path:", fenErrorMsg, "AI FEN:", response.boardAfterOpponentMoveFen);
                addMessage(`Error: AI returned an invalid board state (${fenErrorMsg}). Board is now after your move: ${playerStdMoveSan}`);
                finalFenForTurn = fenAfterPlayerStdMove; 
                llmResponseForSideEffects = null; 
            }

        } else { 
            addMessage(`You (${humanPlayerActualColor}): ${inputText}`);
            currentTurnPlayerInputForHistory = inputText;
            const opponentColor = getOpponentColor(humanPlayerActualColor);
            console.log(`Current FEN before player '${humanPlayerActualColor}' input ('${inputText}'): ${boardFen}`);
            
            const response: LLMResponse = await processMove(
                boardFen, inputText, humanPlayerActualColor, opponentColor, 
                boardTerrain, canonicalNumFiles, canonicalNumRanks, gameHistoryForLLM
            );
            llmResponseForSideEffects = response;
            addMessage(`Gemini: ${response.gameMessage}`); 

            if (!response.boardAfterOpponentMoveFen) {
              const msg = "Gemini's response did not include an updated board FEN. Board unchanged.";
              console.error("LLM response missing boardAfterOpponentMoveFen:", response);
              setError(msg); addMessage(`Error: ${msg}`); setIsLoading(false); return;
            }
            finalFenForTurn = response.boardAfterOpponentMoveFen;
        }

        setBoardFen(finalFenForTurn);
        if (llmResponseForSideEffects) {
            applyLlmResponseSideEffects(llmResponseForSideEffects, finalFenForTurn);
            const historyEntry = `Player (${humanPlayerActualColor}): ${currentTurnPlayerInputForHistory}\nGemini: ${llmResponseForSideEffects.gameMessage}`;
            setGameHistoryForLLM(prevHistory => [...prevHistory.slice(-4), historyEntry]); 
        }

    } catch (e: any) { 
      console.error("Error processing move in App.tsx:", e);
      const errorMessage = (e instanceof Error) ? e.message : "An unexpected error occurred.";
      setError(errorMessage); // This will display the error to the user
      addMessage(`Error: ${errorMessage}`);
      // If a standard move was made by player before AI error, revert to that state
      if (isStandardMovePath && fenAfterPlayerStdMove && playerStdMoveSan) {
        addMessage(`Game: An error occurred. Board is after your move: ${playerStdMoveSan}`);
        setBoardFen(fenAfterPlayerStdMove);
      }
    } finally {
      setIsLoading(false);
    }
  }, [boardFen, currentPlayer, addMessage, geminiReady, boardTerrain, dynamicPiecePrototypes, canonicalNumFiles, canonicalNumRanks, applyLlmResponseSideEffects, isGameOver, gameHistoryForLLM]); 


  let displayNumFiles = canonicalNumFiles;
  let displayNumRanks = canonicalNumRanks;
  let displayPieceBoardState: PieceBoardState = canonicalPieceBoardState;

  try {
    const parsedDataForRender: ParsedFenData = parseFenForBoardState(boardFen);
    displayNumFiles = parsedDataForRender.numFiles;
    displayNumRanks = parsedDataForRender.numRanks;

    displayPieceBoardState = parsedDataForRender.board.map(row =>
      row.map(squarePiece => {
        if (!squarePiece) return null;
        
        const standardPieceProto = PIECE_FROM_FEN_CHAR[squarePiece.symbol];
        const dynamicProto = dynamicPiecePrototypes[squarePiece.symbol];
        let maxHp = DEFAULT_NEW_PIECE_MAX_HP;
        let currentHp = maxHp; 

        if (dynamicProto) {
          maxHp = dynamicProto.maxHp;
          currentHp = dynamicProto.maxHp;
        } else if (standardPieceProto) {
          maxHp = standardPieceProto.maxHp;
          currentHp = standardPieceProto.maxHp;
        } else if (!Object.keys(PIECE_FROM_FEN_CHAR).includes(squarePiece.symbol) && !dynamicProto) {
             console.warn(`Render: No HP definition for piece symbol ${squarePiece.symbol}. Using default HP.`);
        }
        return { symbol: squarePiece.symbol, color: squarePiece.color, maxHp: maxHp, currentHp: currentHp };
      })
    );
  } catch (renderParseError) {
    console.error("FEN parsing error during direct render preparation for Board:", renderParseError, "Using canonical/fallback values.");
    // Avoid overwriting a more critical Gemini initialization error
    if (!error || !error.toLowerCase().includes("gemini client initialization error")) {
        const errorMsg = (renderParseError instanceof Error) ? renderParseError.message : "Invalid FEN string."
        setError(`FEN Parsing Error (Render): ${errorMsg}`);
    }
  }

  if (!geminiReady && error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Initialization Failed</h1>
        <p className="text-neutral-300 max-w-md">{error}</p>
        <p className="text-neutral-400 mt-4 text-sm">Please check your environment variables and ensure your API key is configured correctly.</p>
      </div>
    );
  }

  if (!geminiReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold text-neutral-300">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 flex flex-col md:flex-row md:space-x-4">
      {/* Left Column: Board and Messages */}
      <div className="w-full md:w-2/3 space-y-4">
        <h1 className="text-4xl font-bold text-center mb-4 text-neutral-100">OMNICHESS</h1>
        {error && <div className="p-3 bg-red-800 border border-red-600 text-white rounded-md my-4">{error}</div>}
        <div className="flex justify-center"> 
          <Board 
            pieceBoardState={displayPieceBoardState} 
            dynamicPiecePrototypes={dynamicPiecePrototypes} 
            boardTerrain={boardTerrain}
            numFiles={displayNumFiles}
            numRanks={displayNumRanks}
          />
        </div>
        <GameMessages messages={gameMessages} winner={winner} isGameOver={isGameOver}/>
      </div>

      {/* Right Column: Move Input and Controls */}
      <div className="w-full md:w-1/3 space-y-4 mt-4 md:mt-0">
        <h1 className="text-4xl font-bold text-center mb-4 text-neutral-100">OMNICHESS</h1>
        {error && <div className="p-3 bg-red-800 border border-red-600 text-white rounded-md my-4">{error}</div>}
        <MoveInput onMoveSubmit={handlePlayerMove} isLoading={isLoading} />
        {/* Game Controls can go here if needed */}
      </div>
    </div>
  );
};

export default App;
