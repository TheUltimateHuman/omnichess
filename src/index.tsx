try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: sans-serif;">Fatal Error: #root element not found.</div>';
    throw new Error("Could not find root element to mount to");
  }

  // All imports are moved inside the try block
  const React = (await import('react')).default;
  const ReactDOM = (await import('react-dom/client')).default;
  const App = (await import('./App')).default;

  console.log('index.tsx: Script running, attempting to render App.');

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('index.tsx: React render call complete.');

} catch (e) {
  const rootEl = document.getElementById('root');
  const errorMsg = e instanceof Error ? e.message : String(e);
  const stackTrace = e instanceof Error ? e.stack : 'No stack trace available.';
  
  const errorHtml = `
    <div style="color: red; background-color: #111; padding: 20px; font-family: monospace; white-space: pre-wrap;">
      <h1 style="font-size: 1.5em; margin-bottom: 1em;">Fatal Error During Application Load</h1>
      <p style="font-weight: bold;">Message:</p>
      <p style="margin-bottom: 1em;">${errorMsg}</p>
      <p style="font-weight: bold;">Stack Trace:</p>
      <p>${stackTrace}</p>
    </div>
  `;
  
  if (rootEl) {
    rootEl.innerHTML = errorHtml;
  } else {
    document.body.innerHTML = errorHtml;
  }
  console.error("Fatal Error during initial React render or import:", e);
}
