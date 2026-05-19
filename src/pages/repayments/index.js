import db from '../../db';
import { currentUser, isAdmin } from '../../auth';
import { Paginator } from '../../utils/pagination';

export async function renderRepaymentsList(container) {
  let activeFilter = 'all';
  let searchQuery = '';
  let officerFilter = 'all';
  let loans = [];
  let officers = [];
  let pager;

  const user = currentUser();
  const adminMode = isAdmin();

  async function loadData() {
    loans = await db.getLoans({ status: 'disbursed' });
    
    // For each loan, compute status and next due details
    for (const loan of loans) {
      const schedule = await db.getSchedule(loan.id);
      loan.schedule = schedule;
      
      const unpaid = schedule.filter(s => s.status !== 'paid');
      if (unpaid.length === 0) {
        loan._computedStatus = 'Completed';
        loan._nextDue = null;
      } else {
        const next = unpaid[0];
        loan._nextDue = next;
        
        const today = new Date();
        const dueDate = new Date(next.due_date);
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          loan._computedStatus = diffDays <= -7 ? 'Missed' : 'Overdue';
        } else if (diffDays <= 1) {
          loan._computedStatus = 'Due Today';
        } else if (diffDays <= 2) {
          loan._computedStatus = 'Due Soon';
        } else {
          loan._computedStatus = 'On Track';
        }
      }
      loan._weeksLeft = unpaid.length;
    }

    if (adminMode) {
      const allUsers = await db.getUsers();
      officers = allUsers.filter(u => u.role === 'loan_officer' || u.role === 'admin');
    }

    renderBaseUI();
    
    pager = new Paginator({
      data: [],
      pageSize: 15,
      containerId: 'repayments-tbody',
      paginationId: 'repayments-pagination',
      renderCustom: (items) => {
        const tbody = document.getElementById('repayments-tbody');
        const mobileTarget = document.getElementById('repayments-list-mobile');
        if (!tbody || !mobileTarget) return;

        if (items.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem">No data found</td></tr>`;
          mobileTarget.innerHTML = `<div style="text-align:center;padding:3rem;color:#64748B">No data found</div>`;
          return;
        }

        // Desktop
        tbody.innerHTML = items.map(loan => {
          const initials = ((loan.client?.first_name || '')[0] || '') + ((loan.client?.surname || '')[0] || '');
          const statusBadgeClass = getStatusBadgeClass(loan._computedStatus);
          const principal = loan.approved_amount || loan.amount_requested;
          const nextAmt = loan._nextDue?.amount_due || 0;
          return `
            <tr class="clickable-row" onclick="navigate('#/repayments/${loan.id}')">
              <td>
                <div class="client-name-cell">
                  <div class="client-avatar">${initials.toUpperCase() || '?'}</div>
                  <div>
                    <div class="client-fullname">${loan.client?.first_name} ${loan.client?.surname}</div>
                    <div class="client-id-small">ID: ${loan.client?.national_id || '---'}</div>
                  </div>
                </div>
              </td>
              <td><div style="font-weight:800;color:#1E293B">KES ${principal.toLocaleString()}</div></td>
              <td><div style="font-size:13px;color:#64748B">${new Date(loan.disbursed_at).toLocaleDateString()}</div></td>
              <td><div style="font-size:13px;font-weight:600">${loan._nextDue ? new Date(loan._nextDue.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '---'}</div></td>
              <td><div style="font-weight:700;color:#1E6DC5">${loan._nextDue ? 'KES ' + nextAmt.toLocaleString() : '---'}</div></td>
              <td style="text-align:center"><div style="font-weight:800;color:#64748B;font-size:15px">${loan._weeksLeft}</div></td>
              <td><span class="badge ${statusBadgeClass}">${loan._computedStatus}</span></td>
            </tr>
          `;
        }).join('');

        // Mobile
        mobileTarget.innerHTML = items.map(loan => {
          const initials = ((loan.client?.first_name || '')[0] || '') + ((loan.client?.surname || '')[0] || '');
          const statusBadgeClass = getStatusBadgeClass(loan._computedStatus);
          const principal = loan.approved_amount || loan.amount_requested;
          const nextAmt = loan._nextDue?.amount_due || 0;
          const nextDate = loan._nextDue ? new Date(loan._nextDue.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '---';
          return `
            <div class="mobile-card" onclick="navigate('#/repayments/${loan.id}')">
              <div class="card-header-main">
                <div class="client-avatar-small">${initials}</div>
                <div class="header-info">
                  <div class="client-fullname">${loan.client?.first_name} ${loan.client?.surname}</div>
                  <div class="client-id-small">ID: ${loan.client?.national_id}</div>
                </div>
                <span class="badge ${statusBadgeClass}">${loan._computedStatus}</span>
              </div>
              <div class="card-body-grid">
                <div class="stat-item"><div class="stat-label">Principal</div><div class="stat-value">KES ${principal.toLocaleString()}</div></div>
                <div class="stat-item"><div class="stat-label">Next Due</div><div class="stat-value">${nextDate}</div></div>
                <div class="stat-item"><div class="stat-label">Instalment</div><div class="stat-value">KES ${nextAmt.toLocaleString()}</div></div>
                <div class="stat-item"><div class="stat-label">Remaining</div><div class="stat-value">${loan._weeksLeft} Wks</div></div>
              </div>
              <div class="card-action-bar"><span>View Schedule</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></div>
            </div>
          `;
        }).join('');
      },
      emptyHtml: `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="#F8FAFC"/>
              <path d="M44 32c0-6.6-5.4-12-12-12s-12 5.4-12 12s5.4 12 12 12s12-5.4 12-12z" fill="#E2E8F0"/>
              <path d="M32 26v6l4 2" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h3 class="empty-title">No matching repayments</h3>
          <p class="empty-text">Adjust your search or filters to find specific loan repayments.</p>
        </div>
      `
    });

    applyFilters();
  }

  function applyFilters() {
    let filtered = [...loans];

    // Role-based filtering
    if (!adminMode) {
      filtered = filtered.filter(l => l.applied_by === user.id);
    } else if (officerFilter !== 'all') {
      filtered = filtered.filter(l => l.applied_by === officerFilter);
    }

    // Status filter
    if (activeFilter === 'completed') {
      filtered = filtered.filter(l => l._computedStatus === 'Completed');
    } else if (activeFilter === 'on_track') {
      filtered = filtered.filter(l => l._computedStatus === 'On Track');
    } else if (activeFilter === 'due_soon') {
      filtered = filtered.filter(l => l._computedStatus === 'Due Soon' || l._computedStatus === 'Due Today');
    } else if (activeFilter === 'overdue') {
      filtered = filtered.filter(l => l._computedStatus === 'Overdue');
    } else if (activeFilter === 'missed') {
      filtered = filtered.filter(l => l._computedStatus === 'Missed');
    }

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        (l.client?.first_name + ' ' + l.client?.surname).toLowerCase().includes(q) ||
        (l.client?.national_id && l.client.national_id.includes(q))
      );
    }

    pager.update(filtered);
  }

  function renderBaseUI() {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Loan Repayments</h1>
          <p class="page-subtitle">Monitor collections and manage repayment schedules</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar" style="display: grid; grid-template-columns: 1fr auto auto; gap: 1.5rem; align-items: center; background: #F8FAFC;">
        <div style="display: flex; gap: 12px; width: 100%;">
          <div class="filter-search-wrap" style="flex: 2;">
            <input type="text" id="loan-search" class="filter-search" placeholder="Search by name or ID...">
          </div>
          ${adminMode ? `
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 180px;">
              <span class="filter-label">Officer:</span>
              <select id="officer-filter" class="filter-select" style="width: 100%;">
                <option value="all">All Officers</option>
                ${officers.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>
        
        <div style="width: 1.5px; height: 32px; background: #E2E8F0;"></div>

        <div style="display: flex; gap: 8px; overflow-x: auto;" class="status-tabs hide-scrollbar">
          ${renderTab('all', 'All')}
          ${renderTab('on_track', 'On Track')}
          ${renderTab('due_soon', 'Due Soon')}
          ${renderTab('overdue', 'Overdue')}
          ${renderTab('missed', 'Missed')}
        </div>
      </div>

      <!-- Table Section -->
      <div class="responsive-view-container">
        <div class="table-container desktop-only">
          <table class="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Loan Principal</th>
                <th style="white-space: nowrap;">Disbursed On</th>
                <th>Next Due Date</th>
                <th>Next Instalment</th>
                <th style="text-align: center;">Remaining</th>
                <th>Collection Status</th>
              </tr>
            </thead>
            <tbody id="repayments-tbody">
              <tr><td colspan="7" style="text-align: center; padding: 3rem;">Loading schedules...</td></tr>
            </tbody>
          </table>
        </div>
        
        <!-- Mobile Target -->
        <div id="repayments-list-mobile" class="mobile-only repayments-card-list"></div>

        <div id="repayments-pagination" class="pagination-bar"></div>
      </div>

      <style>
        .responsive-view-container { margin-top: 1rem; }
        
        /* DESKTOP/MOBILE SWITCH */
        .mobile-only { display: none; }
        @media (max-width: 900px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }
          .filter-bar { grid-template-columns: 1fr !important; gap: 1rem !important; padding: 16px !important; }
          .filter-search-wrap { flex: 1 !important; }
          .status-tabs { width: 100%; border-top: 1px solid #E2E8F0; padding-top: 12px !important; }
          .page-header { flex-direction: column; align-items: flex-start !important; gap: 12px; }
        }

        /* MOBILE CARD STYLES */
        .repayments-card-list { display: flex; flex-direction: column; gap: 12px; }
        .mobile-card {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          padding: 16px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.02);
          transition: all 0.2s;
        }
        .mobile-card:active { transform: scale(0.98); background: #F8FAFC; }
        
        .card-header-main { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .client-avatar-small {
          width: 40px; height: 40px; border-radius: 10px; background: #F1F5F9;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 12px; color: #1E6DC5; border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .header-info { flex: 1; min-width: 0; }
        .client-fullname { font-weight: 800; color: #1E293B; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .client-id-small { font-size: 11px; color: #94A3B8; font-weight: 600; margin-top: 1px; }
        
        .card-body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px 0; border-top: 1px solid #F1F5F9; border-bottom: 1px solid #F1F5F9; margin-bottom: 12px; }
        .stat-item { display: flex; flex-direction: column; gap: 2px; }
        .stat-label { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em; }
        .stat-value { font-size: 13px; font-weight: 800; color: #1E293B; }
        
        .card-action-bar { display: flex; justify-content: space-between; align-items: center; color: #1E6DC5; font-size: 12px; font-weight: 800; }

        .status-tabs .tab-btn {
          padding: 8px 18px;
          border: 1px solid #E2E8F0;
          background: white;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 700;
          color: #64748B;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .status-tabs .tab-btn.active {
          background: #1E6DC5;
          color: white;
          border-color: #1E6DC5;
          box-shadow: 0 4px 12px rgba(30,109,197,0.2);
        }
        .status-tabs .tab-btn:hover:not(.active) {
          background: #F1F5F9;
          border-color: #CBD5E1;
        }
        .pulse-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #F59E0B;
          border-radius: 50%;
          margin-right: 6px;
          position: relative;
        }
        .pulse-dot::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          background: inherit;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      </style>
    `;

    // Attach Listeners
    const searchInput = container.querySelector('#loan-search');
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      applyFilters();
    };

    const offFilter = container.querySelector('#officer-filter');
    if (offFilter) {
      offFilter.onchange = (e) => {
        officerFilter = e.target.value;
        applyFilters();
      };
    }

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        applyFilters();
      };
    });
  }

  function renderTab(filter, label) {
    const isActive = activeFilter === filter;
    return `<button class="tab-btn ${isActive ? 'active' : ''}" data-filter="${filter}">${label}</button>`;
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'Completed': return 'badge-success';
      case 'On Track': return 'badge-success';
      case 'Due Soon': return 'badge-warning';
      case 'Due Today': return 'badge-warning';
      case 'Overdue': return 'badge-danger';
      case 'Missed': return 'badge-danger';
      default: return 'badge-gray';
    }
  }

  await loadData();
}
