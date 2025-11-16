import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SavedQueries from './components/SavedQueries.tsx'

const Router = () => {
  const path = window.location.pathname;

  if (path === '/saved' || path === '/saved/' || path === '/saved/index.html') {
    return <SavedQueries />;
  }

  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
