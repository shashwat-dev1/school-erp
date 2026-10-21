import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataContextProvider } from './context/DataContext';
import { App } from './App';
import './styles/designSystem.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root DOM element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DataContextProvider>
          <App />
        </DataContextProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
