import React, { useState } from 'react';

interface MoveInputProps {
  onMoveSubmit: (moveText: string) => void;
  isLoading: boolean;
}

export const MoveInput: React.FC<MoveInputProps> = ({ onMoveSubmit, isLoading }) => {
  const [inputText, setInputText] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading) {
      onMoveSubmit(inputText.trim());
      setInputText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col space-y-3 items-center">
        <label htmlFor="moveInput" className="text-sm font-medium text-neutral-300"> {/* text-black to text-neutral-300 */}
          Your Move:
        </label>
        <input
          id="moveInput"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your move here..."
          disabled={isLoading}
          className="p-3 bg-neutral-800 border border-neutral-600 text-neutral-100 rounded-md shadow-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400 outline-none transition-all w-1/3" // Dark theme styles
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-neutral-200 hover:bg-neutral-300 text-black font-semibold rounded-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-black w-1/6" // Contrasting button for dark theme
        >
          {isLoading ? 'Processing...' : 'Submit'}
        </button>
      </div>
    </form>
  );
};