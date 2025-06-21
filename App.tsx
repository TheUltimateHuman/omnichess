
import React, { useState, useEffect, useCallback } from 'react';
import { Board } from './components/Board';
import { MoveInput } from './components/MoveInput';
import { GameMessages } from './components/GameMessages';
import { processMove, initializeGeminiClient, isGeminiClientInitialized } from './services/geminiService';
import { getInitialBoardFen, getOpponentColor, parseFenForBoardState, isStandardChessSetup } from './utils/chessLogic';
import { PlayerColor, LLMResponse, TerrainObject, PieceBoardState, ParsedFenData, Piece } from '@/utils/types';
import { DEFAULT_NEW_PIECE_MAX_HP, PIECE_FROM_FEN_CHAR } from './constants';
import { Chess, Move as ChessJSMove } from 'chess.js';

interface DynamicPiecePrototype {
  displayChar: string;
  maxHp: number;
}

const App: React.FC = () => {
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

  // API Key Management for GitHub Pages
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(!process.env.API_KEY);
  const [geminiReady, setGeminiReady] = useState<boolean>(false);

  const [dynamicPiecePrototypes, setDynamicPiecePrototypes] = useState<Record<string, DynamicPiecePrototype>>({});
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winner, setWinner] = useState<PlayerColor | 'draw' | null>(null);
  const [gameHistoryForLLM, setGameHistoryForLLM] = useState<string[]>([]);


  useEffect(() => {
    if (apiKey && !isGeminiClientInitialized()) {
      try {
        initializeGeminiClient(apiKey);
        setGeminiReady(true);
        setShowApiKeyInput(false);
        setError(null); 
        console.log("Gemini client initialized successfully.");
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Failed to initialize Gemini client.";
        setError(`API Key Error: ${errorMsg}. Please ensure your API key is valid.`);
        setGeminiReady(false);
        console.error("Failed to initialize Gemini client:", e);
      }
    } else if (isGeminiClientInitialized()) {
        setGeminiReady(true);
        setShowApiKeyInput(false);
    }
  }, [apiKey]);


  useEffect(() => {
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
      if (!showApiKeyInput) setError(null); // Clear FEN errors if API key input is not showing
    } catch (e) {
      console.error("Error parsing FEN or building canonical piece state:", e, "FEN:", boardFen);
      const errorMsg = (e instanceof Error) ? e.message : "Invalid FEN string or board setup."
      setError(`Internal error: ${errorMsg} Cannot determine current player or board state from FEN: ${boardFen}. Board might not update correctly.`);
    }
  }, [boardFen, dynamicPiecePrototypes, showApiKeyInput]);

  const addMessage = useCallback((message: string) => {
    setGameMessages(prev => [...prev.slice(-15), message]); 
  }, []);

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
            addMessage("Error: API Key not configured or invalid. Cannot process move.");
        }
        return;
    }

    setIsLoading(true);
    setError(null);

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
                boardTerrain, 8, 8, gameHistoryForLLM, apiKey
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
                boardTerrain, canonicalNumFiles, canonicalNumRanks, gameHistoryForLLM, apiKey
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
      setError(errorMessage);
      addMessage(`Error: ${errorMessage}`);
      if (isStandardMovePath && fenAfterPlayerStdMove && playerStdMoveSan) {
        addMessage(`Game: An error occurred. Board is after your move: ${playerStdMoveSan}`);
        setBoardFen(fenAfterPlayerStdMove);
      }
    } finally {
      setIsLoading(false);
    }
  }, [boardFen, currentPlayer, addMessage, geminiReady, apiKey, boardTerrain, dynamicPiecePrototypes, canonicalNumFiles, canonicalNumRanks, applyLlmResponseSideEffects, isGameOver, gameHistoryForLLM]); 

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
    } else {
      setError("API Key cannot be empty.");
    }
  };

  if (showApiKeyInput && !geminiReady) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center min-h-screen bg-black text-white">
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-white">OMNICHESS</h1>
        </header>
        <div className="p-8 text-center bg-neutral-800 border border-neutral-600 text-neutral-100 rounded-lg shadow-xl max-w-md w-full"> 
          <h2 className="text-2xl font-bold mb-4">Gemini API Key Required</h2>
          <p className="mb-4">Please enter your Google Gemini API Key to play Omnichess. You can obtain a key from <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Google AI Studio</a>.</p>
          {error && <div className="mb-4 p-3 bg-red-900 text-red-100 border border-red-500 rounded-md" role="alert">{error}</div>}
          <form onSubmit={handleApiKeySubmit} className="space-y-4">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter your API Key"
              className="w-full p-3 bg-neutral-700 border border-neutral-500 text-neutral-100 rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
            />
            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md shadow-md transition-colors duration-150"
            >
              Set API Key
            </button>
          </form>
        </div>
      </div>
    );
  }

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
  }


  return (
    <div className="container mx-auto p-4 flex flex-col items-center min-h-screen bg-black text-white"> 
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-white">OMNICHESS</h1>
      </header>

      {error && <div className="mb-4 p-3 bg-red-900 text-red-100 border border-red-500 rounded-md shadow-lg" role="alert">{error}</div>} 
      
      <div className="flex flex-col items-center gap-8 w-full max-w-5xl">
        <div className="flex justify-center"> 
          <Board 
            pieceBoardState={displayPieceBoardState} 
            dynamicPiecePrototypes={dynamicPiecePrototypes} 
            boardTerrain={boardTerrain}
            numFiles={displayNumFiles}
            numRanks={displayNumRanks}
          />
        </div>
        <div className="w-full md:w-3/4 lg:w-1/2 flex flex-col space-y-6 flex-shrink-0 items-center" style={{maxWidth: '450px'}}>
          <MoveInput onMoveSubmit={handlePlayerMove} isLoading={isLoading || isGameOver || !geminiReady} />
          <GameMessages messages={gameMessages} winner={winner} isGameOver={isGameOver}/>
        </div>
      </div>
      
      {isLoading && geminiReady && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> 
          <div className="bg-neutral-800 p-6 rounded-lg shadow-xl flex items-center space-x-4 border border-neutral-600"> 
            <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg font-medium text-white">Gemini is thinking...</span> 
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
