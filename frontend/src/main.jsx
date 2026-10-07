import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles/variables.css';
import './styles/global.css';
import './styles/theme-dark.css';
import { applyCachedTheme } from './utils/theme';
import { installSpringEasings } from './utils/spring';
import { registerServiceWorker } from './utils/notifications';

applyCachedTheme();
installSpringEasings();
// The service worker handles notification clicks, so it is registered on every load (it does not cache anything).
registerServiceWorker();

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></StrictMode>);
