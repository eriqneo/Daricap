import { initRouter } from './router';
import db from './db';
import { initAuth, logout } from './auth';
import { initLayout } from './layout';
import './style.css';

// Initialize App Admin & Auth
window.handleLogout = logout;
window.signOut = logout;
window.logout = logout;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Seed DB and Auth
  await db.seedUsers();
  await db.migrateClientStatuses();
  await initAuth();
  
  // 2. Initialize Layout (sidebar, topbar, etc)
  await initLayout();

  // 3. Start Router
  initRouter();
  
  // Monitoring Online/Offline status
  const updateOnlineStatus = () => {
    const statusBadge = document.getElementById('online-status');
    const statusDot = statusBadge?.querySelector('.status-dot');
    const text = document.getElementById('status-text');
    
    if (navigator.onLine) {
      if (statusBadge) {
        statusBadge.className = 'system-status online';
      }
      if (statusDot) {
        statusDot.className = 'status-dot online';
      }
      if (text) {
        text.textContent = 'System Online';
      }
    } else {
      if (statusBadge) {
        statusBadge.className = 'system-status offline';
      }
      if (statusDot) {
        statusDot.className = 'status-dot'; // offline look
      }
      if (text) {
        text.textContent = 'Offline Mode';
      }
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Redundant logout and sidebar user listeners removed as handled in layout.js
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
