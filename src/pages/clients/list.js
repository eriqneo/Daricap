import db from '../../db';
import { isAdmin, currentUser } from '../../auth';
import { showToast } from '../../components/toast';
import { Paginator } from '../../utils/pagination';
import { navigate } from '../../router';

export async function renderClientList(container) {
  let allRecords = [];
  let currentSort = { field: 'createdAt', direction: 'desc' };
  let pager;

  const roleIsAdmin = isAdmin();
  const user = currentUser();
  const officers = roleIsAdmin ? await db.getUsers().catch(() => []) : [];

  container.innerHTML = `
    <div class="page-header" style="margin-bottom: 24px;">
      <div class="page-header-left">
        <h1 class="page-title">Client Directory</h1>
        <p class="page-subtitle">Manage and monitor all borrowers in the network</p>
      </div>
      <div class="page-header-right">
        <button id="add-client-btn" class="btn-new-app-premium" style="padding: 12px 24px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Register New Client
        </button>
      </div>
    </div>

    <!-- Premium Search & Filter -->
    <div style="margin-bottom: 32px; display: flex; flex-direction: column; gap: 16px;">
      <div class="premium-search-container">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="client-search" class="search-input-premium" placeholder="Search by name, phone or National ID...">
        <button id="apply-filters-btn" class="btn btn-primary" style="border-radius: 14px; height: 38px; padding: 0 20px; font-weight: 800; font-size: 13px;">
          Search
        </button>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
        <span style="font-size: 12px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">Quick Filters:</span>
        
        <select id="fee-filter" class="filter-pill-trigger">
          <option value="">Registration Fee (All)</option>
          <option value="paid">Fee Paid</option>
          <option value="unpaid">Fee Pending</option>
        </select>

        <input type="month" id="month-filter" class="filter-pill-trigger">

        ${roleIsAdmin ? `
          <select id="officer-filter" class="filter-pill-trigger">
            <option value="">All Officers</option>
            ${officers.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
          </select>
        ` : ''}
      </div>
    </div>

    <div class="table-container desktop-only">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable" data-sort="first_name">Client</th>
            <th class="sortable" data-sort="national_id">National ID</th>
            <th>Phone & Officer</th>
            <th class="sortable" data-sort="createdAt">Joined</th>
            <th>Fee Status</th>
            <th style="width: 60px; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody id="clients-tbody-desktop">
          <tr><td colspan="6" style="text-align: center; padding: 4rem;">Loading borrowers...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View -->
    <div id="clients-tbody-mobile" class="client-mobile-cards">
       <div style="text-align: center; padding: 4rem; grid-column: 1/-1;">Loading borrowers...</div>
    </div>
    
    <div id="clients-pagination" class="pagination-bar"></div>
  `;

  document.getElementById('add-client-btn').onclick = () => navigate('#/clients/new');

  // Wire up filters as requested
  const applyBtn = document.getElementById('apply-filters-btn');
  applyBtn.addEventListener('click', () => filterAndRender());
  
  // Also filter on change for selects
  const selects = ['fee-filter', 'month-filter', 'officer-filter'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => filterAndRender());
  });

  // Trigger search on Enter key in search box
  document.getElementById('client-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyBtn.click();
  });

  // Dual-Paginator Implementation
  const renderItem = (item) => {
    const initials = ((item.first_name || '')[0] || '') + ((item.surname || '')[0] || '');
    const isPaid = item.fee_status === 'paid';
    const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    
    // Desktop Row
    const desktopRow = `
      <tr onclick="navigate('#/clients/view?id=${item.id}')" style="cursor: pointer;">
        <td>
          <div class="client-name-cell">
            <div class="card-avatar-box" style="width: 36px; height: 36px; font-size: 13px;">${initials.toUpperCase() || '?'}</div>
            <div>
              <div style="font-weight: 800; color: #1A2332;">${item.first_name} ${item.surname}</div>
              <div style="font-size: 11px; color: #64748B; font-weight: 600;">#${item.id.substring(0,8).toUpperCase()}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight: 700; color: #1A2332;">${item.national_id || '---'}</div>
          <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase;">Identity ID</div>
        </td>
        <td>
          <div style="font-weight: 700; color: #1A2332;">${item.mobile}</div>
          <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase;">By ${item.created_by_name || 'Staff'}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #1A2332;">${dateStr}</div>
        </td>
        <td>
          <span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}" style="padding: 6px 12px; font-size: 11px;">
            ${isPaid ? 'Paid' : 'Pending'}
          </span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" style="border: none; background: #F1F5F9; color: #64748B; font-weight: 700;">View</button>
        </td>
      </tr>
    `;

    // Mobile Card
    const mobileCard = `
      <div class="client-p-card" onclick="navigate('#/clients/view?id=${item.id}')">
        <div class="card-top">
          <div class="card-avatar-box">${initials.toUpperCase() || '?'}</div>
          <div class="card-title-group">
            <div class="card-name">${item.first_name} ${item.surname}</div>
            <div class="card-id">ID: ${item.national_id || '---'}</div>
          </div>
          <span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}" style="padding: 4px 10px; font-size: 10px;">
            ${isPaid ? 'Paid' : 'Pending'}
          </span>
        </div>
        <div class="card-meta-grid">
          <div class="meta-item">
            <span class="meta-l">Mobile</span>
            <span class="meta-v">${item.mobile}</span>
          </div>
          <div class="meta-item">
            <span class="meta-l">Registered</span>
            <span class="meta-v">${dateStr}</span>
          </div>
        </div>
        <div style="margin-top: 16px; font-size: 11px; color: #94A3B8; font-weight: 600; display: flex; align-items: center; gap: 4px;">
           <span style="font-size: 14px;">👤</span> Managed by ${item.created_by_name || 'Staff Member'}
        </div>
      </div>
    `;

    return { desktopRow, mobileCard };
  };

  pager = new Paginator({
    data: [],
    pageSize: 15,
    containerId: 'clients-tbody-desktop', // This will be handled manually for dual render
    paginationId: 'clients-pagination',
    renderCustom: (items) => {
      const desktopTarget = document.getElementById('clients-tbody-desktop');
      const mobileTarget = document.getElementById('clients-tbody-mobile');
      
      if (!desktopTarget || !mobileTarget) return;

      if (items.length === 0) {
        const empty = `<tr><td colspan="6" style="text-align: center; padding: 4rem;">No matching clients found.</td></tr>`;
        desktopTarget.innerHTML = empty;
        mobileTarget.innerHTML = `<div style="text-align: center; padding: 4rem; grid-column: 1/-1;">No matching clients found.</div>`;
        return;
      }

      let dRows = '';
      let mCards = '';
      items.forEach(item => {
        const { desktopRow, mobileCard } = renderItem(item);
        dRows += desktopRow;
        mCards += mobileCard;
      });
      desktopTarget.innerHTML = dRows;
      mobileTarget.innerHTML = mCards;
    }
  });

  // Load Initial Data
  loadData();

  async function loadData() {
    const filters = {};
    if (!roleIsAdmin) filters.officerId = user.id;
    allRecords = await db.getClients(filters).catch(() => []);
    filterAndRender();
  }

  function filterAndRender() {
    const q = document.getElementById('client-search').value.toLowerCase().trim();
    const fee = document.getElementById('fee-filter')?.value;
    const month = document.getElementById('month-filter')?.value;
    const officer = roleIsAdmin ? document.getElementById('officer-filter')?.value : user.id;

    let filtered = allRecords.filter(c => {
      const matchSearch = (c.first_name + ' ' + c.surname).toLowerCase().includes(q) || 
                          (c.national_id || '').includes(q) || 
                          (c.mobile || '').includes(q);
      const matchFee = !fee || c.fee_status === fee;
      const matchOfficer = !officer || c.created_by === officer;
      
      let matchMonth = true;
      if (month) {
        const cDate = new Date(c.createdAt);
        const [y, m] = month.split('-');
        matchMonth = cDate.getFullYear() == y && (cDate.getMonth() + 1) == m;
      }

      return matchSearch && matchFee && matchOfficer && matchMonth;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA = a[currentSort.field] || '';
      let valB = b[currentSort.field] || '';
      if (currentSort.field === 'createdAt') {
        valA = new Date(valA);
        valB = new Date(valB);
      }
      if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    pager.update(filtered);
  }

  // Sorting handlers for desktop
  container.querySelectorAll('th.sortable').forEach(th => {
    th.onclick = () => {
      const field = th.dataset.sort;
      currentSort.direction = (currentSort.field === field && currentSort.direction === 'asc') ? 'desc' : 'asc';
      currentSort.field = field;
      
      container.querySelectorAll('th.sortable').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
      filterAndRender();
    };
  });
}

