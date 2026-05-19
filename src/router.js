import { renderDashboard } from './pages/dashboard';
import { renderLogin } from './pages/login';
import { requireAuth, isAdmin, currentUser } from './auth';

import { renderClientRegister } from './pages/clients/register';
import { renderClientList } from './pages/clients/list';
import { renderClientProfile } from './pages/clients/profile';
import { renderLoanApply } from './pages/loans/apply';
import { renderLoanList } from './pages/loans/list';
import { renderLoanApprove } from './pages/loans/approve';
import { renderLoanDetail } from './pages/loans/detail';
import { renderRepaymentsList } from './pages/repayments/index';
import { renderRepaymentSchedule } from './pages/repayments/schedule';
import { renderReports } from './pages/reports/index';
import { renderSettings } from './pages/settings/index';
import { renderProfile } from './pages/profile';
import { initNotifications, renderNotificationDropdown } from './components/notifications';
import { updateLayoutState } from './layout';

/**
 * Simple Hash-based Router
 */
export const navigate = (hash) => { window.location.hash = hash; };
window.navigate = navigate;

export const routes = {
  '/': { title: 'Dashboard', render: renderDashboard },
  '/dashboard': { title: 'Dashboard', render: renderDashboard },
  '/login': { title: 'Login', render: renderLogin },
  '/clients': { title: 'Clients', render: renderClientList },
  '/clients/new': { title: 'Register Client', render: renderClientRegister },
  '/clients/view': { title: 'Client Profile', render: renderClientProfile },
  '/loans': { title: 'Portfolio', render: renderLoanList },
  '/loans/new': { title: 'Apply for Loan', render: renderLoanApply },
  '/admin/approval': { title: 'Loan Applications', render: renderLoanApprove, admin: true },
  '/loans/view': { title: 'Application Review', render: renderLoanDetail },
  '/admin/loans/detail': { title: 'Application Review', render: renderLoanDetail, admin: true },
  '/repayments': { title: 'Loan Repayments', render: renderRepaymentsList },
  '#/repayments/:loanId': { title: 'Repayment Schedule', render: renderRepaymentSchedule, auth: true },
  '/reports': { title: 'Reports', render: renderReports },
  '/settings': { title: 'Settings', render: renderSettings },
  '/profile': { title: 'My Profile', render: renderProfile },
};

export function initRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  handleRouteChange();
}

async function handleRouteChange() {
  const hash = window.location.hash || '#/dashboard';
  if (hash !== '#/login' && !requireAuth()) {
    return;
  }

  const [pathWithQuery] = hash.substring(1).split('?');
  const path = pathWithQuery || '/';

  // Handle dynamic routes
  const loanIdMatch = hash.match(/^#\/repayments\/(.+)$/);
  if (loanIdMatch) {
    const loanId = loanIdMatch[1];
    const route = { title: 'Repayment Schedule', render: (container) => renderRepaymentSchedule(container, loanId), auth: true };
    
    if (route.auth && !requireAuth()) return;

    const sidebar = document.getElementById('sidebar');
    const topBar = document.querySelector('.topbar');
    const viewContainer = document.getElementById('router-view');
    if (!viewContainer) return;

    if (sidebar) sidebar.style.display = 'flex';
    if (topBar) topBar.style.display = 'flex';
    const layout = document.querySelector('.layout');
    if (layout) layout.style.display = 'flex';
    
    const user = currentUser();
    if (user) {
      if (!window._notificationsInitialized) {
        initNotifications();
        window._notificationsInitialized = true;
      }
      await updateLayoutState();
    }

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = route.title;
    
    await route.render(viewContainer);
    return;
  }

  const route = routes[path] || routes['/'];

  if (route.admin && !isAdmin()) {
    alert('Access Denied: Administrative permissions required.');
    window.location.hash = '#/dashboard';
    return;
  }
  
  const sidebar = document.getElementById('sidebar');
  const topBar = document.querySelector('.topbar');
  const viewContainer = document.getElementById('router-view');

  if (!viewContainer) return;

  if (path === '/login') {
    if (sidebar) sidebar.style.display = 'none';
    if (topBar) topBar.style.display = 'none';
    const layout = document.querySelector('.layout');
    if (layout) layout.style.display = 'block';
  } else {
    if (sidebar) sidebar.style.display = 'flex';
    if (topBar) topBar.style.display = 'flex';
    const layout = document.querySelector('.layout');
    if (layout) layout.style.display = 'flex';
    
    const user = currentUser();
    if (user) {
      if (!window._notificationsInitialized) {
        initNotifications();
        window._notificationsInitialized = true;
      }
      
      // Update page title context
      if (path === '/' || path === '/dashboard') {
        route.title = user.role === 'admin' ? 'Administrator Portal' : 'Officer Dashboard';
      }

      // Sidebar & Topbar UI state
      await updateLayoutState();
    }

    // Bell Listener
    const bellBtn = document.getElementById('notif-bell');
    if (bellBtn && !bellBtn.dataset.listenerAttached) {
      bellBtn.onclick = () => renderNotificationDropdown();
      bellBtn.dataset.listenerAttached = 'true';
    }
  }

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = route.title;
  
  try {
    await route.render(viewContainer);
  } catch (err) {
    console.error('Router render error:', err);
    viewContainer.innerHTML = `
      <div style="padding: 5rem; text-align: center;">
        <h2 style="color: var(--color-danger);">Something went wrong.</h2>
        <p style="color: var(--text-muted); margin-top: 1rem;">${err.message || String(err)}</p>
        <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center;">
          <button class="btn btn-primary" onclick="window.location.hash = '#/dashboard'">Back to Dashboard</button>
          <button class="btn btn-secondary" onclick="window.location.reload()">Reload App</button>
        </div>
      </div>
    `;
  }
}

// Route Renderers (Mock content for now)
