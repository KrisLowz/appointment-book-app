import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Vite entry: mount React 18 with StrictMode.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
