import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

const style = document.createElement('style');
style.textContent = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
