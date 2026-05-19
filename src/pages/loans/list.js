import db from '../../db';
import { displayProduct } from '../../utils/format';
import { Paginator } from '../../utils/pagination';

export function renderLoanList(container) {
  let activeFilter = '';
  let searchText = '';
  let pager;

  function render() {
    container.innerHTML = `
      <div class="page-header" style="animation: slideDown 0.4s ease-out;">
        <div class="page-header-left">
          <h1 class="page-title">Loan Applications</h1>
          <p class="page-subtitle">Track status and review history of client loan submissions</p>
        </div>
        <div class="page-header-right">
          <button id="apply-loan-btn" class="btn btn-primary" style="padding: 12px 24px; font-weight: 800; border-radius: 14px; box-shadow: 0 4px 12px rgba(18, 41, 79, 0.15);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right: 8px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Application
          </button>
        </div>
      </div>

      <!-- Advanced Filter Bar -->
      <div class="filter-bar" style="background: white; border: 1.5px solid #F1F5F9; padding: 1.25rem; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); margin-bottom: 24px; display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; position: sticky; top: 80px; z-index: 10;">
        <div class="filter-search-wrap" style="flex: 1; min-width: 280px; position: relative;">
          <svg style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #94A3B8;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="loan-search" class="filter-search" placeholder="Search by client name or ID..." value="${searchText}" style="padding-left: 48px; width: 100%; height: 50px; border-radius: 14px; border: 1.5px solid #E2E8F0; font-weight: 600; font-size: 15px; color: #1A2332; transition: all 0.2s;">
        </div>
        
        <div class="status-pills-scroll" style="display: flex; gap: 8px; overflow-x: auto; padding: 4px; scrollbar-width: none; -ms-overflow-style: none;">
          ${['', 'pending', 'approved', 'disbursed', 'declined'].map(v => `
            <button class="status-pill-btn ${activeFilter === v ? 'active' : ''}" data-value="${v}">
              ${v === '' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Main Display -->
      <div class="card" style="padding:0; border-radius: 20px; overflow: hidden; border: 1.5px solid #F1F5F9;">
        <!-- Desktop Table -->
        <div class="table-container hide-mobile" style="border:none; box-shadow:none; margin:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Client Details</th>
                <th>Principal Amount</th>
                <th>Product & Term</th>
                <th>Applied Date</th>
                <th style="text-align: right;">Review Status</th>
              </tr>
            </thead>
            <tbody id="loans-body">
              <tr><td colspan="5" style="text-align: center; padding: 4rem;">Loading...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile List Container -->
        <div id="loans-body-mobile" class="show-mobile" style="display: none;">
          <!-- Cards will render here -->
        </div>

        <div id="loans-pagination" class="pagination-bar" style="border-top: 1px solid #F1F5F9; padding: 1.5rem;"></div>
      </div>

      <style>
        .status-pill-btn {
          white-space: nowrap;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 13px;
          background: #F8FAFC;
          color: #64748B;
          border: 1.5px solid #E2E8F0;
          cursor: pointer;
          transition: all 0.2s;
        }
        .status-pill-btn.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
          box-shadow: 0 4px 12px rgba(18, 41, 79, 0.2);
        }
        .status-pill-btn:hover:not(.active) {
          background: #F1F5F9;
          border-color: #CBD5E1;
        }
        .loan-mobile-card {
          padding: 1.25rem;
          border-bottom: 1.5px solid #F1F5F9;
          background: white;
          transition: background 0.2s;
        }
        .loan-mobile-card:active { background: #F8FAFC; }
        .loan-mobile-card:last-child { border-bottom: none; }
      </style>
    `;

    const searchInput = document.getElementById('loan-search');
    const pillBtns = container.querySelectorAll('.status-pill-btn');

    searchInput.addEventListener('input', (e) => {
      searchText = e.target.value;
      loadLoans();
    });
    
    pillBtns.forEach(btn => {
      btn.onclick = () => {
        pillBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.value;
        loadLoans();
      };
    });

    document.getElementById('apply-loan-btn').onclick = () => {
      window.location.hash = '#/loans/new';
    };

    pager = new Paginator({
      data: [],
      pageSize: 12,
      containerId: 'loans-body',
      paginationId: 'loans-pagination',
      renderRow: (item) => {
        const initials = ((item.client?.first_name || '')[0] || '') + ((item.client?.surname || '')[0] || '');
        const badgeClass = getBadgeClass(item.status);
        const statusLabel = getStatusLabel(item.status);
        const navUrl = `#/loans/view?id=${item.id}`;

        // Update Desktop Table Row
        const row = `
          <tr onclick="window.location.hash = '${navUrl}'" class="clickable-row">
            <td>
              <div class="client-name-cell">
                <div class="client-avatar" style="background: rgba(18, 41, 79, 0.05); color: var(--color-primary); font-weight: 800;">${initials.toUpperCase() || '?'}</div>
                <div>
                  <div class="client-fullname" style="font-weight: 800; color: #1A2332;">${item.client?.first_name} ${item.client?.surname}</div>
                  <div class="client-id-small" style="color: #94A3B8; font-weight: 600;">ID: ${item.client?.national_id || '---'}</div>
                </div>
              </div>
            </td>
            <td>
              <div style="font-weight: 900; color: #1A2332; font-size: 15px;">KES ${(item.amount_requested || 0).toLocaleString()}</div>
            </td>
            <td>
              <div style="font-size: 13px; font-weight: 800; color: #1E6DC5;">${displayProduct(item.loan_product)}</div>
              <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">${item.repayment_weeks || 0} Weeks Plan</div>
            </td>
            <td>
              <div style="font-size: 13px; color: #475569; font-weight: 600;">${item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '---'}</div>
            </td>
            <td style="text-align: right;">
              <span class="badge ${badgeClass}" style="padding: 6px 14px; font-size: 12px;">
                ${statusLabel}
              </span>
            </td>
          </tr>
        `;

        return row;
      },
      renderEmpty: () => {
        const emptyHtml = `
          <div class="empty-state" style="padding: 4rem 2rem;">
            <div style="font-size: 64px; margin-bottom: 20px;">📂</div>
            <h3 class="empty-title">No applications found</h3>
            <p class="empty-text">We couldn't find any loan applications matching your criteria.</p>
          </div>
        `;
        document.getElementById('loans-body-mobile').innerHTML = emptyHtml;
        return `<tr><td colspan="5">${emptyHtml}</td></tr>`;
      },
      onUpdate: (paginatedData) => {
        // Sync mobile view
        const mobileContainer = document.getElementById('loans-body-mobile');
        if (!mobileContainer) return;
        
        if (paginatedData.length === 0) {
          mobileContainer.innerHTML = `
            <div style="padding: 4rem 2rem; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 1rem; opacity: 0.5;">📂</div>
              <h4 style="color: #64748B; font-weight: 600;">No records found</h4>
            </div>
          `;
          return;
        }

        mobileContainer.innerHTML = paginatedData.map(item => {
          const initials = ((item.client?.first_name || '')[0] || '') + ((item.client?.surname || '')[0] || '');
          const badgeClass = getBadgeClass(item.status);
          const statusLabel = getStatusLabel(item.status);
          const navUrl = `#/loans/view?id=${item.id}`;
          
          return `
            <div class="loan-mobile-card" onclick="window.location.hash = '${navUrl}'">
              <div style="display: flex; gap: 12px; margin-bottom: 12px; align-items: start;">
                <div class="client-avatar" style="width: 40px; height: 40px; border-radius: 12px; font-size: 13px; background: rgba(18, 41, 79, 0.05); color: var(--color-primary); font-weight: 800;">${initials.toUpperCase() || '?'}</div>
                <div style="flex:1">
                  <div style="font-weight: 800; color: #1A2332; font-size: 15px;">${item.client?.first_name} ${item.client?.surname}</div>
                  <div style="font-size: 12px; color: #94A3B8; font-weight: 600;">ID: ${item.client?.national_id || '---'}</div>
                </div>
                <span class="badge ${badgeClass}" style="font-size: 10px; padding: 4px 10px;">
                  ${statusLabel}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                 <div>
                    <p style="margin:0; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">Requested Amount</p>
                    <p style="margin:2px 0 0; font-size: 17px; font-weight: 900; color: var(--color-primary);">KES ${(item.amount_requested || 0).toLocaleString()}</p>
                 </div>
                 <div style="text-align: right;">
                    <p style="margin:0; font-size: 11px; font-weight: 700; color: #1E6DC5;">${displayProduct(item.loan_product)}</p>
                    <p style="margin:2px 0 0; font-size: 12px; color: #64748B; font-weight: 600;">${item.repayment_weeks || 0} Weeks Plan</p>
                 </div>
              </div>
            </div>
          `;
        }).join('');
      }
    });

    loadLoans();
  }

  async function loadLoans() {
    const filters = {
      search: searchText,
      status: activeFilter
    };

    try {
      const records = await db.getLoans(filters);
      pager.update(records);
    } catch (err) {
      console.error(err);
      document.getElementById('loans-body').innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: #EF4444; font-weight: 600;">Failed to synchronize application data.</td></tr>`;
    }
  }

  function getBadgeClass(status) {
    const classes = {
      pending: 'badge-warning',
      approved: 'badge-success',
      disbursed: 'badge-info',
      declined: 'badge-danger',
      partially_approved: 'badge-info'
    };
    return classes[status] || 'badge-gray';
  }

  function getStatusLabel(status) {
    const labels = {
      pending: 'Pending Review',
      approved: 'Approved',
      disbursed: 'Disbursed',
      declined: 'Declined',
      partially_approved: 'Partial Approval'
    };
    return labels[status] || status;
  }

  render();
}
