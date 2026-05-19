import db from '../../db';

export function renderApprovalInbox(container) {
  // ... rest of template ...
  container.innerHTML = `
    <div class="card" style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
          <h2 style="margin: 0; color: var(--color-primary);">Loan Approval Portal</h2>
          <p style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-top: 0.25rem;">Review and action pending loan applications</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
           <span class="badge" style="background: rgba(243, 156, 18, 0.1); color: var(--color-warning);">Admin Access Only</span>
        </div>
      </div>

      <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #F8FAFC; padding: 1rem; border-radius: 0.75rem; border: 1px solid #E2E8F0;">
        <div style="flex: 1;">
          <select id="status-filter" class="search-input" style="width: 100%;">
            <option value="pending">Show: Pending Review</option>
            <option value="approved">Show: Approved</option>
            <option value="declined">Show: Declined</option>
            <option value="all">Show: All Applications</option>
          </select>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Loan Product</th>
              <th>Amount Requested</th>
              <th>Term</th>
              <th>Applied By</th>
              <th>Applied Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="approval-body">
            <tr><td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">Fetching applications...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  loadPendingLoans();

  async function loadPendingLoans() {
    const body = document.getElementById('approval-body');
    const filterValue = document.getElementById('status-filter').value;
    
    let filters = {};
    if (filterValue !== 'all') filters.status = filterValue;

    try {
      const records = await db.getLoans(filters);

      if (records.length === 0) {
        body.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">No applications matching this criteria.</td></tr>`;
        return;
      }

      const users = await db.getUsers();
      const getUserName = (id) => users.find(u => u.id === id)?.name || 'Officer';

      body.innerHTML = records.map(item => `
        <tr style="cursor: pointer;" onclick="window.location.hash = '#/loans/view?id=${item.id}'">
          <td style="font-weight: 600;">${item.client?.first_name || 'Unk.'} ${item.client?.surname || ''}</td>
          <td style="font-size: 11px;">${item.loan_product || 'N/A'}</td>
          <td style="font-weight: 700;">KSh ${(item.amount_requested || 0).toLocaleString()}</td>
          <td>${item.repayment_weeks || 0} wks</td>
          <td style="font-size: 11px;">${getUserName(item.applied_by)}</td>
          <td style="font-size: 11px; color: var(--text-muted);">${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}</td>
          <td>
            <span class="badge" style="background: ${getStatusColor(item.status, 'bg')}; color: ${getStatusColor(item.status, 'text')}">
              ${item.status.replace('_', ' ')}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary" style="font-size: 10px; padding: 0.4rem 0.75rem;">Review</button>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
      body.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error fetching portal data.</td></tr>`;
    }
  }

  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) statusFilter.onchange = loadPendingLoans;

  function getStatusColor(status, type) {
    const colors = {
      pending: { bg: 'rgba(243, 156, 18, 0.1)', text: 'var(--color-warning)' },
      approved: { bg: 'rgba(52, 152, 219, 0.1)', text: 'var(--color-info)' },
      disbursed: { bg: 'rgba(39, 174, 96, 0.1)', text: 'var(--color-success)' },
      declined: { bg: 'rgba(231, 76, 60, 0.1)', text: 'var(--color-danger)' },
      partially_approved: { bg: 'rgba(15, 201, 217, 0.1)', text: 'var(--color-secondary-accent)' }
    };
    return colors[status]?.[type] || '#f1f1f1';
  }
}
