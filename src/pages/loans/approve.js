import db from '../../db';
import { Paginator } from '../../utils/pagination';
import { displayLoanProduct, formatLoanStatus, getLoanStatusBadge } from '../../utils/formatters';

export async function renderLoanApprove(container) {
  let activeFilter = 'pending'; // Default
  let allLoans = [];
  let pager;

  const summary = {
    pending: 0,
    approvedToday: 0,
    disbursedMonth: 0,
    declined: 0
  };

  async function loadData() {
    allLoans = await db.getLoans();
    
    // Calculate Stats
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    summary.pending = allLoans.filter(l => l.status === 'pending').length;
    summary.approvedToday = allLoans.filter(l => (l.status === 'approved' || l.status === 'partially_approved') && (l.updatedAt || l.createdAt).startsWith(today)).length;
    summary.disbursedMonth = allLoans
      .filter(l => l.status === 'disbursed' && l.disbursed_at >= monthStart)
      .reduce((sum, l) => sum + (l.approved_amount || l.amount_requested), 0);
    summary.declined = allLoans.filter(l => l.status === 'declined').length;

    renderBaseUI();
    
    pager = new Paginator({
      data: [],
      pageSize: 15,
      containerId: 'loans-tbody',
      paginationId: 'loans-pagination',
      renderRow: (loan) => {
        const initials = ((loan.client?.first_name || '')[0] || '') + ((loan.client?.surname || '')[0] || '');
        const statusClass = getLoanStatusBadge(loan.status);
        const statusLabel = formatLoanStatus(loan.status);

        const appliedAt = new Date(loan.applied_at || loan.createdAt);
        const waitingTime = getWaitingTime(appliedAt);
        const hoursWaiting = (new Date() - appliedAt) / (1000 * 60 * 60);
        
        let rowUrgencyClass = '';
        if (loan.status === 'pending') {
          if (hoursWaiting > 48) rowUrgencyClass = 'urgent-row';
          else if (hoursWaiting > 24) rowUrgencyClass = 'stale-row';
        }

        return `
          <tr class="${rowUrgencyClass}" onclick="window.location.hash = '#/admin/loans/detail?id=${loan.id}'">
            <td>
              <div class="client-name-cell">
                <div class="client-avatar">${initials.toUpperCase() || '?'}</div>
                <div>
                  <div class="client-fullname">${loan.client?.first_name} ${loan.client?.surname}</div>
                  <div class="client-id-small">${loan.client?.mobile || 'No contact'}</div>
                </div>
              </div>
            </td>
            <td>
              <div style="font-weight: 600; color: #1A2332;">${loan.client?.national_id || '---'}</div>
            </td>
            <td>
              <div>${displayLoanProduct(loan)}</div>
            </td>
            <td>
              <div style="font-weight: 800; color: #1E293B;">KES ${loan.amount_requested?.toLocaleString()}</div>
            </td>
            <td>
              <div style="font-size: 13px; font-weight: 500;">${loan.repayment_weeks} Weeks</div>
            </td>
            <td>
              <div style="font-size: 13px; color: ${hoursWaiting > 48 ? '#DC2626' : hoursWaiting > 24 ? '#92400E' : '#10B981'}; font-weight: 700;">${waitingTime}</div>
            </td>
            <td style="font-size: 13px; color: #64748B; font-weight: 500;">${loan.applied_by_name || 'Field Officer'}</td>
            <td style="text-align: right;">
              <span class="badge ${statusClass}">${statusLabel}</span>
            </td>
          </tr>
        `;
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
          <h3 class="empty-title">Queue is clear</h3>
          <p class="empty-text">There are currently no applications to display in this category.</p>
        </div>
      `
    });

    filterData();
  }

  function filterData() {
    let filtered;
    if (activeFilter === 'all') {
      filtered = allLoans;
    } else {
      filtered = allLoans.filter(l => l.status === activeFilter);
    }

    // Sort by oldest first if pending for urgency
    if (activeFilter === 'pending') {
      filtered.sort((a, b) => new Date(a.applied_at || a.createdAt) - new Date(b.applied_at || b.createdAt));
    } else {
      filtered.sort((a, b) => new Date(b.applied_at || b.createdAt) - new Date(a.applied_at || a.createdAt));
    }

    pager.update(filtered);
    
    // Update active tab state
    container.querySelectorAll('.tab-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.filter === activeFilter);
    });
  }

  function renderBaseUI() {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Loan Applications</h1>
          <p class="page-subtitle">Review and approve pending loan requests from the field</p>
        </div>
      </div>

      ${summary.pending > 0 ? `
        <div id="pending-alert" style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; animation: slideIn 0.3s ease-out;">
           <span style="font-size: 20px;">📅</span>
           <div style="flex: 1;">
              <p style="margin: 0; font-size: 14px; font-weight: 800; color: #92400E;">${summary.pending} applications need your attention</p>
              <p style="margin: 2px 0 0; font-size: 12px; color: #B45309;">Review the oldest cases first to maintain DariCap service standards.</p>
           </div>
        </div>
      ` : ''}

      <!-- Summary Strip -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 24px;">
        <div class="card" style="padding: 20px; border-bottom: 4px solid #F59E0B; cursor: pointer;" onclick="document.querySelector('[data-filter=pending]').click()">
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">Pending Review</p>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 8px;">
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #1E293B;">${summary.pending}</p>
            <span style="font-size: 12px; color: #64748B; font-weight: 600;">Applications</span>
          </div>
        </div>
        <div class="card" style="padding: 20px; border-bottom: 4px solid #10B981;">
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">Approved Today</p>
           <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 8px;">
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #1E293B;">${summary.approvedToday}</p>
            <span style="font-size: 12px; color: #64748B; font-weight: 600;">Settled</span>
          </div>
        </div>
        <div class="card" style="padding: 20px; border-bottom: 4px solid #3B82F6;">
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">Disbursed (Month)</p>
          <div style="display: flex; align-items: baseline; gap: 4px; margin-top: 8px;">
            <span style="font-size: 14px; font-weight: 800; color: #64748B;">KES</span>
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #1E293B;">${summary.disbursedMonth.toLocaleString()}</p>
          </div>
        </div>
        <div class="card" style="padding: 20px; border-bottom: 4px solid #EF4444;">
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">Declined Cases</p>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 8px;">
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #1E293B;">${summary.declined}</p>
            <span style="font-size: 12px; color: #64748B; font-weight: 600;">Total</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 16px; margin-bottom: 8px;" class="hide-scrollbar">
        ${renderTab('all', 'All Applications')}
        ${renderTab('pending', 'Pending Review')}
        ${renderTab('approved', 'Approved')}
        ${renderTab('partially_approved', 'Partial Approvals')}
        ${renderTab('declined', 'Declined')}
        ${renderTab('disbursed', 'Disbursed')}
      </div>

      <!-- Table Section -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Client Details</th>
              <th>Applicant ID</th>
              <th>Loan Product</th>
              <th>Principal Amount</th>
              <th>Repayment Term</th>
              <th>Waiting Time</th>
              <th>Requested By</th>
              <th style="text-align: right;">Status</th>
            </tr>
          </thead>
          <tbody id="loans-tbody">
            <tr><td colspan="8" style="text-align: center; padding: 3rem;">Loading applications...</td></tr>
          </tbody>
        </table>

        <div id="loans-pagination" class="pagination-bar"></div>
      </div>

      <style>
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .tab-pill {
          flex-shrink: 0;
          padding: 8px 18px;
          border: 1px solid #E2E8F0;
          border-radius: 99px;
          background: white;
          color: #64748B;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .tab-pill.active {
          background: #1E6DC5;
          color: white;
          border-color: #1E6DC5;
          box-shadow: 0 4px 12px rgba(30,109,197,0.2);
        }
        .tab-pill:hover:not(.active) {
          background: #F1F5F9;
          border-color: #CBD5E1;
        }
      </style>
    `;

    // Attach tab listeners
    container.querySelectorAll('.tab-pill').forEach(pill => {
      pill.onclick = () => {
        activeFilter = pill.dataset.filter;
        filterData();
        const alert = container.querySelector('#pending-alert');
        if (alert) alert.style.display = activeFilter === 'pending' ? 'flex' : 'none';
      };
    });
  }

  function getWaitingTime(date) {
    const diffHours = (new Date() - date) / (1000 * 60 * 60);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)} hrs ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }

  function renderTab(filter, label) {
    const isActive = activeFilter === filter;
    return `
      <button class="tab-pill ${isActive ? 'active' : ''}" data-filter="${filter}">
        ${label}
      </button>
    `;
  }

  loadData();
}
