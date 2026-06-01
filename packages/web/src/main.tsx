import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from './App.js';
import { ProjectProvider } from './contexts/ProjectContext.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProjectProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </ProjectProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
