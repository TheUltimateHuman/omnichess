
import React from 'react';
import { Square } from './Square';
import { getAlgebraicNotation } from '../utils/chessLogic';
import { PieceBoardState, TerrainObject } from '@/utils/types'; // Removed PlayerColor

interface DynamicPiecePrototype {
  displayChar: string;
  maxHp: number; 
}

interface BoardProps {
  pieceBoardState: PieceBoardState; 
  dynamicPiecePrototypes: Record<string, DynamicPiecePrototype>;
  boardTerrain: Record<string, TerrainObject | null>;
  numFiles: number;
  numRanks: number;
}

export const Board: React.FC<BoardProps> = ({ 
  pieceBoardState, 
  dynamicPiecePrototypes, 
  boardTerrain,
  numFiles,
  numRanks 
}) => {
  const fileLabels = Array.from({ length: numFiles }, (_, i) => String.fromCharCode('a'.charCodeAt(0) + i));
  const rankLabels = Array.from({ length: numRanks }, (_, i) => (numRanks - i).toString());

  const maxBoardDisplaySize = 800; 
  const squareSize = Math.min(60, maxBoardDisplaySize / Math.max(numFiles, numRanks, 8)); 
  
  const labelCellSize = squareSize * 0.6; // Increased from 0.5 for larger labels
  const boardWidth = squareSize * numFiles + labelCellSize; 
  const boardHeight = squareSize * numRanks + labelCellSize;

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${labelCellSize}px repeat(${numFiles}, 1fr)`, 
    gridTemplateRows: `${labelCellSize}px repeat(${numRanks}, 1fr)`,    
    width: `${boardWidth}px`,
    height: `${boardHeight}px`,
    minWidth: '320px', 
    minHeight: '320px',
  };

  return (
    <div 
      className="border border-neutral-700 shadow-2xl bg-black rounded-md p-2 sm:p-3" 
      style={gridStyle}
    >
      {/* Top-left empty cell for alignment */}
      <div /> 
      
      {/* File labels (top) */}
      {fileLabels.map(file => (
        <div 
            key={`file-label-top-${file}`} 
            className="flex items-center justify-center text-base font-bold text-neutral-100 select-none px-1"
        >
          {file}
        </div>
      ))}

      {/* Ranks and Squares */}
      {pieceBoardState.map((rowPieces, rowIndex) => (
        <React.Fragment key={`rank-fragment-${numRanks}-${rowIndex}`}>
          {/* Rank label (left) */}
          <div 
            className="flex items-center justify-center text-base font-bold text-neutral-100 select-none py-1"
          >
            {rankLabels[rowIndex]}
          </div>
          {/* Squares in the rank */}
          {rowPieces.map((piece, colIndex) => {
            const algebraicPos = getAlgebraicNotation(rowIndex, colIndex, numRanks);
            const terrainOnSquare = boardTerrain[algebraicPos] || null;
            const dynamicDisplayChar = piece ? dynamicPiecePrototypes[piece.symbol]?.displayChar : undefined;
            
            return (
              <Square
                key={`${algebraicPos}-${piece?.symbol || 'empty'}-${rowIndex}-${colIndex}`} // More unique key
                piece={piece} 
                terrain={terrainOnSquare}
                isDark={(rowIndex + colIndex) % 2 === 1}
                dynamicDisplayChar={dynamicDisplayChar}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
