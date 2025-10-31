import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeSwapAccessibility } from './utils/swapAccessibility';

// Initialize swap accessibility features
initializeSwapAccessibility();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
