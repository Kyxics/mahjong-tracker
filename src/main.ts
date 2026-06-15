import './style.css';
import { initApp } from './ui/app.ts';

initApp(document.getElementById('app')!);

// PWA: register the service worker (added in the deploy milestone).
if ('serviceWorker' in navigator && !location.hostname.startsWith('localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
