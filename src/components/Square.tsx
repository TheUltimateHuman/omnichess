import React from 'react';
import { Piece, TerrainObject } from '../utils/types'; 
import { UNICODE_PIECES, TEAM_INFOS } from '../../constants';

interface SquareProps {
  piece: Piece | null; 
  terrain: TerrainObject | null;
  isDark: boolean;
  dynamicDisplayChar?: string; 
}

export const Square: React.FC<SquareProps> = ({ piece, terrain, isDark, dynamicDisplayChar }) => {
  let displaySymbol = '';
  let pieceStyleOverride: React.CSSProperties = {};

  if (piece) {
    if (dynamicDisplayChar) {
      displaySymbol = dynamicDisplayChar;
    } else {
      const unicodeKey = piece.symbol.toUpperCase(); // Ensure key is uppercase for UNICODE_PIECES
      const standardUnicode = UNICODE_PIECES[piece.color]?.[unicodeKey];
      if (standardUnicode) {
        displaySymbol = standardUnicode;
      } else {
        displaySymbol = piece.symbol; 
      }
    }
  }

  const showHp = piece && piece.maxHp > 0 && piece.currentHp < piece.maxHp;
  const hpPercentage = piece && piece.maxHp > 0 ? (piece.currentHp / piece.maxHp) * 100 : 0;

  const squareStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#404040' : '#a3a3a3', // neutral-700 and neutral-400
  };

  const pieceStyle: React.CSSProperties = {
    ...pieceStyleOverride,
    color: piece && piece.color && TEAM_INFOS[piece.color] ? TEAM_INFOS[piece.color].uiColor : (piece?.color === 'black' ? '#000000' : piece?.color === 'white' ? '#FFFFFF' : '#FF00FF'),
    fontSize: 'clamp(1.25rem, 7vw, 2.25rem)',
  };

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center transition-colors duration-150 relative select-none p-0.5"
      style={squareStyle}
    >
      {/* HP Bar */}
      {showHp && (
        <div className="w-full h-1.5 mb-0.5 bg-neutral-500 rounded-full overflow-hidden"> {/* Darker Grayscale HP bar background */}
          <div 
            className={`h-full ${hpPercentage > 66 ? 'bg-green-400' : hpPercentage > 33 ? 'bg-yellow-400' : 'bg-red-400'}`} // Brighter HP bar fill for visibility on gray
            style={{ width: `${hpPercentage}%` }}
            role="progressbar"
            aria-valuenow={piece?.currentHp}
            aria-valuemin={0}
            aria-valuemax={piece?.maxHp}
            aria-label={`${piece?.symbol || 'piece'} HP ${piece?.currentHp}/${piece?.maxHp}`}
          ></div>
        </div>
      )}
      
      {/* Terrain */}
      {terrain && (
        <span 
          className="absolute text-3xl sm:text-4xl opacity-50 pointer-events-none z-0" 
          style={{fontSize: 'clamp(1.5rem, 8vw, 2.5rem)'}} 
          aria-hidden="true"
        >
          {terrain.displayChar}
        </span>
      )}

      {/* Piece Symbol */}
      {piece && (
        <span 
          className="text-2xl sm:text-3xl relative z-10"
          style={pieceStyle} 
          aria-label={piece ? `${piece.color} ${piece.symbol}` : 'empty square'}
        >
          {displaySymbol}
        </span>
      )}
       {/* HP Text */}
      {showHp && (
         <div className={`text-xs mt-0.5 ${isDark ? 'text-neutral-300' : 'text-neutral-800'}`} style={{ lineHeight: '0.75rem'}}> {/* Adjusted for gray backgrounds */}
          {piece.currentHp}/{piece.maxHp}
        </div>
      )}

      {!piece && !terrain && (
         <span className="opacity-0 w-full h-full" aria-hidden="true">.</span> // Ensures empty squares take up space for grid
      )}
    </div>
  );
};
