import React from 'react';
import { createRoot } from 'react-dom/client';
import { view } from '@forge/bridge';
import App from './App.jsx';
import './styles.css';

async function start() {
  try {
    await view.theme.enable();
  } catch {
    // Theming is best effort; fall back to the default token values.
  }
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

start();
