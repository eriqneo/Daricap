import db from '../db';
import { isAdmin, getRole, currentUser } from '../auth';
import { getGreeting, getMotivationalSub } from '../utils/greeting';

export async function renderDashboard(container) {
  const role = getRole();
  const user = currentUser();
  const firstName = user.name.split(' ')[0];
  
  // 1. Initial Skeleton/Loading State
  renderSkeletons(container, role);

  // 2. Concurrent Data Fetching
  const [
    clients, 
    loans, 
    activeLoans, 
    pendingLoans, 
    arrears,
    weeklyCollections
  ] = await Promise.all([
    db.getClients().catch(() => []),
    db.getLoans().catch(() => []),
    db.getActiveLoans().catch(() => []),
    db.getPendingLoans().catch(() => []),
    db.getArrearsReport().catch(() => []),
    db.getWeeklyCollections().catch(() => [0,0,0,0,0,0,0]),
  ]);

  // Derived data
  const outstandingTotal = activeLoans.reduce((sum, l) => sum + (l.amount_requested || 0), 0);
  const overdueCount = arrears.length;

  const todayDate = new Date().toLocaleDateString('en-KE', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const headerHtml = `
    <div class="dashboard-greeting">
      <h1 class="greeting-title">${getGreeting(firstName)}</h1>
      <p class="greeting-sub">${getMotivationalSub(role)}</p>
      <div class="greeting-date">${todayDate}</div>
    </div>
  `;

  // Render content
  if (role === 'admin') {
    renderAdminLayout(container, {
      headerHtml,
      clients,
      activeLoans,
      pendingLoans,
      arrears,
      outstandingTotal,
      overdueCount,
      weeklyCollections
    });
  } else {
    const myClients = clients.filter(c => c.created_by === user?.id);
    const myLoans = loans.filter(l => l.applied_by === user?.id);
    const myPending = myLoans.filter(l => l.status === 'pending');
    const myOverdue = arrears.filter(a => a.loan?.applied_by === user?.id);

    renderOfficerLayout(container, {
      headerHtml,
      myClients,
      myLoans,
      myPending,
      myOverdue,
      weeklyCollections
    });
  }

  // 3. Trigger Animations
  setTimeout(() => animateStats(), 100);
}

function renderAdminLayout(container, data) {
  const { headerHtml, clients, pendingLoans, overdueCount, outstandingTotal, weeklyCollections } = data;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 2rem; animation: fadeIn 0.4s ease-out;">
      <header>
        ${headerHtml}
      </header>

      <!-- Row 1: Stat Cards -->
      <div class="dashboard-grid-stats">
        ${renderStatCard('Total Clients', clients.length, `+${clients.filter(c => isThisMonth(c.createdAt)).length} this month`, 'user')}
        ${renderStatCard('Active Loans', data.activeLoans.length, `KES ${outstandingTotal.toLocaleString()} outstanding`, 'loan')}
        ${renderStatCard('Pending Review', pendingLoans.length, 'Awaiting your approval', 'pending')}
        ${renderStatCard('Overdue Accounts', overdueCount, 'Requires visit', 'alert', overdueCount > 0)}
      </div>

      <!-- Row 2: Secondary Content -->
      <div class="dashboard-main-layout">
        <!-- Pending Applications -->
        <div class="card" style="padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1rem; font-weight: 800;">Pending Loan Applications</h3>
            <a href="#/admin/approval" style="font-size: 11px; font-weight: 700; color: var(--color-accent); text-decoration: none;">View All</a>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${pendingLoans.length > 0 ? pendingLoans.slice(0, 5).map(loan => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #F8FAFC; border-radius: 0.75rem; border: 1px solid #F1F5F9;">
                <div style="display: flex; gap: 1rem; align-items: center;">
                  <div class="client-avatar-small" style="width: 36px; height: 36px; font-size: 11px;">${(loan.client?.first_name || 'U').substring(0,1)}</div>
                  <div>
                    <p style="margin: 0; font-size: 13px; font-weight: 800; color: #1E293B;">${loan.client?.first_name} ${loan.client?.surname}</p>
                    <p style="margin: 0; font-size: 10px; font-weight: 600; color: #64748B;">KES ${loan.amount_requested?.toLocaleString()} • ${loan.client?.created_by_name || 'System'}</p>
                  </div>
                </div>
                <div style="text-align: right;">
                  <p style="margin: 0; font-size: 10px; font-weight: 700; color: #94A3B8;">${formatTimeAgo(loan.createdAt)}</p>
                  <button class="btn btn-sm btn-primary" onclick="window.location.hash = '#/admin/loans/detail?id=${loan.id}'" style="margin-top: 0.25rem; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">Review</button>
                </div>
              </div>
            `).join('') : `
              <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <div style="font-size: 2.5rem; margin-bottom: 1rem;">✅</div>
                <p style="font-size: 0.875rem; font-weight: 600;">No applications waiting for review</p>
              </div>
            `}
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card" style="padding: 1.5rem; background-color: var(--color-primary); color: white; display: flex; flex-direction: column;">
          <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 1.5rem;">Quick Actions</h3>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button onclick="window.location.hash = '#/clients/new'" class="action-btn-styled" style="background: white; color: var(--color-primary);">+ Register New Client</button>
            <button onclick="window.location.hash = '#/loans/new'" class="action-btn-styled" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">+ New Loan Application</button>
            <button onclick="window.location.hash = '#/repayments'" class="action-btn-styled" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">Record a Payment</button>
          </div>
          <div style="margin-top: auto; padding-top: 2rem; opacity: 0.8; font-size: 11px; font-weight: 500; line-height: 1.6;">
            <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-bottom: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              Use these shortcuts to access primary workflows quickly during field visits.
            </div>
          </div>
        </div>
      </div>

      <!-- Row 3: History & Activity -->
      <div class="dashboard-secondary-layout">
        <div class="card" style="padding: 1.5rem;">
          <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 1.5rem;">Recent Registrations</h3>
          <div class="table-container hide-mobile">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                ${clients.slice(0, 5).map(c => `
                  <tr>
                    <td style="font-weight: 700;">${c.first_name} ${c.surname}</td>
                    <td style="font-size: 12px; color: var(--text-muted); font-weight: 600;">${new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span class="badge" style="background: ${c.fee_status === 'paid' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)'}; color: ${c.fee_status === 'paid' ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 10px; font-weight: 800;">
                        ${c.fee_status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <!-- Mobile view for recent registrations -->
          <div class="show-mobile" style="display: none; flex-direction: column; gap: 0.75rem;">
            ${clients.slice(0, 5).map(c => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: 8px;">
                <div>
                  <p style="margin: 0; font-size: 13px; font-weight: 800; color: #1E293B;">${c.first_name} ${c.surname}</p>
                  <p style="margin: 0; font-size: 11px; color: #94A3B8; font-weight: 600;">${new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <span class="badge" style="background: ${c.fee_status === 'paid' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)'}; color: ${c.fee_status === 'paid' ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 10px; font-weight: 800;">
                  ${c.fee_status.toUpperCase()}
                </span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card" style="padding: 1.5rem;">
          <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.25rem;">This Week's Activity</h3>
          <p style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 1.5rem;">Volume of registrations, loans & payments</p>
          <div class="activity-chart-mobile">
            <div class="activity-chart-inner" style="height: 120px; padding: 0 0.5rem; align-items: flex-end;">
              ${renderActivityCircles(weeklyCollections)}
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      .action-btn-styled {
        width: 100%;
        padding: 0.875rem;
        border-radius: 0.75rem;
        border: none;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        transition: transform 0.2s;
        text-align: left;
      }
      .action-btn-styled:hover {
        transform: translateX(4px);
      }
      @media (max-width: 768px) {
        .responsive-stack {
          grid-template-columns: 1fr !important;
        }
      }
    </style>
  `;
}

function renderOfficerLayout(container, data) {
  const { headerHtml, myClients, myLoans, myPending, myOverdue, weeklyCollections } = data;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 2rem; animation: fadeIn 0.4s ease-out;">
      <header>
        ${headerHtml}
      </header>

      <!-- Row 1: Stat Cards -->
      <div class="dashboard-grid-stats">
        ${renderStatCard('My Clients', myClients.length, `Total managed by you`, 'user')}
        ${renderStatCard('My Applications', myLoans.length, `${myPending.length} awaiting review`, 'loan')}
        ${renderStatCard('Collections (W)', weeklyCollections.reduce((a,b)=>a+b, 0), 'Your collection target', 'payment')}
      </div>

      <!-- Quick Actions for Officer -->
      <div class="dashboard-grid-stats" style="gap: 1rem;">
        <button onclick="window.location.hash = '#/clients/new'" class="btn btn-primary" style="padding: 1.15rem; font-weight: 800; border-radius: 14px; font-size: 14px;">+ Register Client</button>
        <button onclick="window.location.hash = '#/loans/new'" class="btn btn-secondary" style="padding: 1.15rem; font-weight: 800; border-radius: 14px; background: white; border: 1.5px solid var(--color-primary); color: var(--color-primary); font-size: 14px;">+ Apply for Loan</button>
        <button onclick="window.location.hash = '#/repayments'" class="btn btn-secondary" style="padding: 1.15rem; font-weight: 800; border-radius: 14px; background: white; border: 1.5px solid var(--color-primary); color: var(--color-primary); font-size: 14px;">💰 Record Payment</button>
      </div>

      <!-- Row 2 -->
      <div class="dashboard-main-layout">
        <div class="card" style="padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
             <h3 style="font-size: 1rem; font-weight: 800;">My Recent Applications</h3>
             <a href="#/loans" style="font-size: 11px; font-weight: 700; color: var(--color-accent); text-decoration: none;">View History</a>
          </div>
          
          <div class="table-container hide-mobile">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${myLoans.slice(0, 5).map(l => `
                  <tr>
                    <td style="font-weight: 700;">${l.client?.first_name} ${l.client?.surname}</td>
                    <td style="font-weight: 800; color: #1E293B;">KES ${l.amount_requested?.toLocaleString()}</td>
                    <td>
                      <span class="badge" style="background: ${getStatusColor(l.status, 'bg')}; color: ${getStatusColor(l.status, 'text')}; font-size: 10px; font-weight: 800;">
                        ${l.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile Recent Apps -->
          <div class="show-mobile" style="display: none; flex-direction: column; gap: 0.75rem;">
            ${myLoans.slice(0, 5).map(l => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #F8FAFC; border-radius: 10px; border: 1px solid #F1F5F9;">
                <div>
                  <p style="margin: 0; font-size: 13px; font-weight: 800; color: #1E293B;">${l.client?.first_name} ${l.client?.surname}</p>
                  <p style="margin: 0; font-size: 11px; font-weight: 700; color: var(--color-primary); opacity: 0.8;">KES ${l.amount_requested?.toLocaleString()}</p>
                </div>
                <span class="badge" style="background: ${getStatusColor(l.status, 'bg')}; color: ${getStatusColor(l.status, 'text')}; font-size: 10px; font-weight: 800;">
                  ${l.status.toUpperCase()}
                </span>
              </div>
            `).join('')}
            ${myLoans.length === 0 ? '<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 13px; font-weight: 600;">No applications yet.</div>' : ''}
          </div>
        </div>

        <div class="card" style="padding: 1.5rem; border: 1.5px solid #FEE2E2; background: rgba(231, 76, 60, 0.01);">
          <h3 style="font-size: 1rem; font-weight: 800; color: var(--color-danger); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Overdue Alerts
          </h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${myOverdue.length > 0 ? myOverdue.slice(0, 5).map(a => `
              <div style="background: white; padding: 1rem; border-radius: 0.875rem; border: 1px solid #FEE2E2; border-left: 5px solid var(--color-danger); box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <p style="margin: 0; font-size: 13px; font-weight: 800; color: #1E293B;">${a.loan?.client?.first_name} ${a.loan?.client?.surname}</p>
                    <p style="margin: 0.25rem 0 0; font-size: 11px; color: var(--color-danger); font-weight: 800;">KES ${a.amount_due?.toLocaleString()} OVERDUE</p>
                  </div>
                  <button onclick="navigate('#/repayments/${a.loan?.id}')" style="background: var(--color-primary); color: white; border: none; font-size: 10px; font-weight: 800; padding: 6px 12px; border-radius: 6px; cursor: pointer;">COLLECT</button>
                </div>
              </div>
            `).join('') : `
              <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🛡️</div>
                <p style="font-size: 13px; font-weight: 700;">Clean Record</p>
                <p style="font-size: 11px; margin-top: 4px;">None of your clients (Total ${myClients.length}) are currently overdue.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
    
    <style>
      @media (max-width: 768px) {
        .responsive-stack {
          grid-template-columns: 1fr !important;
        }
      }
    </style>
  `;
}

function renderStatCard(title, value, sub, iconType, isAlert = false) {
  const icon = getIcon(iconType);
  return `
    <div class="card stat-card" style="padding: 1.5rem; position: relative; overflow: hidden; border: ${isAlert ? '1px solid var(--color-danger)' : '1px solid #E2E8F0'}; background: ${isAlert ? 'rgba(231, 76, 60, 0.05)' : 'white'};">
      <div style="position: absolute; top: 1rem; right: 1rem; color: ${isAlert ? 'var(--color-danger)' : 'var(--color-primary)'}; opacity: 0.2;">
        ${icon}
      </div>
      <p style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">${title}</p>
      <div style="display: flex; flex-direction: column; gap: 0.25rem;">
        <h2 class="animate-number" data-target="${value}" style="font-size: 1.75rem; font-weight: 900; color: ${isAlert ? 'var(--color-danger)' : 'var(--color-primary)'}; margin: 0;">0</h2>
        <p style="font-size: 0.75rem; font-weight: 600; color: ${isAlert ? 'var(--color-danger)' : 'var(--text-muted)'};">${sub}</p>
      </div>
    </div>
  `;
}

function renderActivityCircles(data) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const max = Math.max(...data, 1);
  
  return days.map((day, i) => {
    const val = data[i] || 0;
    const opacity = 0.2 + (val / max) * 0.8;
    const size = 32 + (val / max) * 12;
    
    return `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: var(--color-secondary-accent); opacity: ${val > 0 ? opacity : 0.1}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: var(--color-primary); transition: all 0.3s ease;">
          ${val > 0 ? val : ''}
        </div>
        <span style="font-size: 10px; font-weight: 800; color: var(--text-muted);">${day}</span>
      </div>
    `;
  }).join('');
}

function renderSkeletons(container, role) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 2rem;">
      <div class="skeleton" style="width: 250px; height: 32px; border-radius: 8px;"></div>
      <div class="dashboard-grid-stats">
        ${Array(4).fill().map(() => `<div class="skeleton" style="height: 120px; border-radius: 1rem;"></div>`).join('')}
      </div>
      <div class="dashboard-main-layout">
        <div class="skeleton" style="height: 300px; border-radius: 1rem;"></div>
        <div class="skeleton" style="height: 300px; border-radius: 1rem;"></div>
      </div>
    </div>
  `;
}

function getIcon(type) {
  const icons = {
    user: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    loan: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`,
    pending: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    alert: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    payment: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`
  };
  return icons[type] || icons.user;
}

function animateStats() {
  const elements = document.querySelectorAll('.animate-number');
  elements.forEach(el => {
    const target = parseInt(el.dataset.target);
    if (isNaN(target)) return;
    
    let current = 0;
    const duration = 1000;
    const increment = target / (duration / 16); 
    
    function update() {
      current += increment;
      if (current >= target) {
        el.textContent = target.toLocaleString();
      } else {
        el.textContent = Math.floor(current).toLocaleString();
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  });
}

function isThisMonth(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function getStatusColor(status, type) {
  const colors = {
    pending: { bg: 'rgba(243, 156, 18, 0.1)', text: 'var(--color-warning)' },
    approved: { bg: 'rgba(52, 152, 219, 0.1)', text: 'var(--color-info)' },
    disbursed: { bg: 'rgba(39, 174, 96, 0.1)', text: 'var(--color-success)' },
    declined: { bg: 'rgba(231, 76, 60, 0.1)', text: 'var(--color-danger)' }
  };
  return colors[status]?.[type] || '#f1f1f1';
}
