import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('index.tsx: Script running, attempting to render App.');

const rootElement = document.getElementById('root');
if (!rootElement) {
  // This error will be thrown if the root element is not found, good for debugging.
  console.error("Fatal Error: Could not find root element to mount to. Ensure an element with ID 'root' exists in your HTML.");
  throw new Error("Could not find root element to mount to");
}

try {
  console.log('index.tsx: Creating React root...');
  const root = ReactDOM.createRoot(rootElement);
  console.log('index.tsx: Rendering App component...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('index.tsx: React render call complete.');
} catch (e) {
  console.error("Fatal Error: Error during initial React render:", e);
  // Optionally display a message to the user in the DOM
  rootElement.innerHTML = '<div style="color: red; padding: 20px;">An error occurred while loading the application. Please check the console.</div>';
}
