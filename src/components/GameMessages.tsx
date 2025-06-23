import React, { useEffect, useRef } from 'react';
import { TeamColor, TeamInfo } from '../utils/types';
import { TEAM_INFOS } from '../../constants';

interface GameMessagesProps {
  messages: string[];
  winner: TeamColor | 'draw' | null;
  isGameOver: boolean;
}

export const GameMessages: React.FC<GameMessagesProps> = ({ messages, winner, isGameOver }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  let finalMessage = "";
  if (isGameOver) {
    if (winner && typeof winner === 'string' && TEAM_INFOS[winner]) finalMessage = `Game Over: ${TEAM_INFOS[winner].displayName} wins!`;
    else if (winner === 'draw') finalMessage = "Game Over: It's a draw!";
    else finalMessage = "Game Over!"; // Generic if winner somehow not set
  }

  return (
    <div className="w-full h-64 bg-neutral-900 border border-neutral-700 rounded-md shadow-inner p-4 overflow-y-auto">
      <ul className="space-y-2">
        {messages.map((msg, index) => (
          <li key={index} className={`text-sm ${
              msg.startsWith('You') ? 'text-blue-400'
            : (msg.startsWith('Error:') || msg.startsWith('ERROR:')) ? 'text-red-400 font-semibold'
            : (msg.toLowerCase().includes("wins!") || msg.toLowerCase().includes("draw!") || msg.toLowerCase().includes("game over")) && index === messages.length -1 && isGameOver ? 'text-green-400 font-bold text-lg' // Highlight final game over message
            : 'text-neutral-300'
            }`}>
            {msg}
          </li>
        ))}
        {isGameOver && messages[messages.length-1] !== finalMessage && finalMessage && (
             <li className="text-green-400 font-bold text-lg">{finalMessage}</li>
        )}
      </ul>
      <div ref={messagesEndRef} />
    </div>
  );
};
