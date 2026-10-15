import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/app';
import { initI18n } from './i18n';
import './styles.css';

async function bootstrap() {
  await initI18n();

  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
