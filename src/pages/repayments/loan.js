import db from '../../db';
import { currentUser } from '../../auth';

export async function renderRepaymentDetail(container) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const loanId = urlParams.get('id');

  if (!loanId) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center;">Loan ID required</div>';
    return;
  }

  let loan = null;
  let schedule = [];
  let totals = { paid: 0, remaining: 0, count: 0, total: 0 };
  let selectedRow = null;

  async function loadData() {
    loan = await db.getLoan(loanId);
    if (!loan) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center;">Loan not found</div>';
      return;
    }
    
    schedule = await db.getSchedule(loanId);
    
    // Calculate totals
    totals.paid = schedule.reduce((sum, s) => sum + (Number(s.amount_paid || s.amountPaid || 0)), 0);
    totals.total = loan.approved_amount || loan.amount_requested; // Note: db.js handles total repayable separately logic
    // Actually, total repayable is what we need
    totals.total = loan.total_repayable;
    totals.remaining = totals.total - totals.paid;
    totals.count = schedule.filter(s => s.status === 'paid').length;
    
    renderUI();
  }

  function renderUI() {
    const nextDue = schedule.find(s => s.status !== 'paid');
    const lastPaid = [...schedule].reverse().find(s => s.status === 'paid');
    const percent = Math.round((totals.count / schedule.length) * 100);

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2rem; animation: fadeIn 0.4s ease-out;">
        <!-- Header / Summary Card -->
        <div class="card" style="padding: 2.5rem; display: flex; flex-wrap: wrap; gap: 2rem; position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; right: 0; width: 150px; height: 150px; background: rgba(41, 128, 217, 0.05); border-radius: 50%; transform: translate(30%, -30%);"></div>
          
          <div style="display: flex; gap: 1.5rem; align-items: center; flex: 1; min-width: 300px; z-index: 1;">
            <div style="width: 80px; height: 80px; border-radius: 1.5rem; background: #eee; overflow: hidden; flex-shrink: 0; border: 4px solid #fff; box-shadow: var(--shadow-md);">
              <img src="${loan.client?.passport_photo || 'https://via.placeholder.com/80'}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.5rem; font-weight: 900; color: var(--color-primary);">${loan.client?.first_name} ${loan.client?.surname}</h2>
              <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                <p style="margin: 0; font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">ID: ${loan.client?.national_id}</p>
                <p style="margin: 0; font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Officer: ${loan.applied_by_name || 'Officer'}</p>
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; flex: 1; min-width: 300px; z-index: 1;">
            <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 800;">TOTAL REPAYABLE</p><p style="margin: 0.25rem 0 0; font-size: 1.25rem; font-weight: 900; color: var(--color-primary);">KES ${totals.total.toLocaleString()}</p></div>
            <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 800;">DISBURSED ON</p><p style="margin: 0.25rem 0 0; font-size: 1.25rem; font-weight: 900; color: var(--color-primary);">${new Date(loan.disbursed_at).toLocaleDateString()}</p></div>
            <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 800;">INTEREST RATE</p><p style="margin: 0.25rem 0 0; font-size: 1.125rem; font-weight: 800;">${(loan.interest_rate * 100)}%</p></div>
            <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 800;">PRINCIPAL</p><p style="margin: 0.25rem 0 0; font-size: 1.125rem; font-weight: 800;">KES ${(loan.approved_amount || loan.amount_requested).toLocaleString()}</p></div>
          </div>
        </div>

        <!-- Progress Bar Section -->
        <div class="card" style="padding: 1.5rem;">
           <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <p style="margin: 0; font-size: 13px; font-weight: 800;">Repayment Progress: <span style="color: var(--color-success);">${totals.count} of ${schedule.length}</span> installments paid</p>
              <span style="font-size: 14px; font-weight: 900; color: var(--color-primary);">${percent}%</span>
           </div>
           <div style="height: 10px; background: #F1F5F9; border-radius: 5px; overflow: hidden;">
              <div style="height: 100%; width: ${percent}%; background: ${percent === 100 ? 'var(--color-success)' : 'var(--color-primary)'}; transition: width 0.5s ease;"></div>
           </div>
        </div>

        ${percent === 100 && loan.status !== 'closed' ? `
          <div style="padding: 2rem; background: #ECFDF5; border: 2px solid #10B981; border-radius: 1rem; text-align: center; animation: bounceIn 0.8s ease;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🎊</div>
            <h2 style="font-weight: 850; color: #064E3B; margin: 0;">This loan is fully repaid!</h2>
            <p style="color: #065F46; margin-top: 0.5rem;">All installments have been cleared successfully.</p>
            <button id="close-loan-btn" class="btn btn-success" style="margin-top: 1.5rem; padding: 0.875rem 2rem; font-weight: 800;">Close Loan Record</button>
          </div>
        ` : ''}

        <!-- Schedule Table -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div class="table-container">
             <table class="data-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Due Date</th>
                    <th>Amount Due</th>
                    <th>Amount Paid</th>
                    <th>Date Paid</th>
                    <th>Status</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${schedule.map(row => {
                    const today = new Date();
                    const dueDate = new Date(row.due_date);
                    const isPaid = row.status === 'paid';
                    const isPast = dueDate < today;
                    const diffDays = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
                    
                    let rowStatus;
                    let badgeClass;
                    if (isPaid) {
                      rowStatus = 'Paid';
                      badgeClass = 'badge-success';
                    } else if (isPast) {
                      if (diffDays >= 7) {
                        rowStatus = 'Missed';
                        badgeClass = 'badge-danger';
                      } else {
                        rowStatus = `${diffDays} Day${diffDays > 1 ? 's' : ''} Overdue`;
                        badgeClass = 'badge-danger';
                      }
                    } else if (diffDays >= -1) {
                        rowStatus = 'Due';
                        badgeClass = 'badge-warning';
                    } else {
                        rowStatus = `Due in ${Math.abs(diffDays)} Days`;
                        badgeClass = 'badge-gray';
                    }

                    return `
                      <tr style="${isPaid ? 'background: #F0FFF4;' : isPast ? 'background: #FFF5F5;' : ''} transition: all 0.2s;">
                        <td style="font-weight: 800; font-size: 15px;"># ${row.week}</td>
                        <td style="font-size: 13px;">${new Date(row.due_date).toLocaleDateString()}</td>
                        <td style="font-weight: 800;">KES ${row.amount_due.toLocaleString()}</td>
                        <td style="font-weight: 800; color: ${row.amount_paid > 0 ? 'var(--color-success)' : 'var(--text-muted)'};">
                           ${row.amount_paid > 0 ? 'KES ' + row.amount_paid.toLocaleString() : '-'}
                        </td>
                        <td style="font-size: 12px; color: var(--text-muted);">${row.last_payment_at ? new Date(row.last_payment_at).toLocaleDateString() : '-'}</td>
                        <td>
                          <span class="badge ${badgeClass}" style="font-size: 10px;">
                            ${isPaid ? '✓ ' : ''}${rowStatus}
                          </span>
                        </td>
                        <td style="text-align: right;">
                          ${isPaid ? `
                            <button class="btn-edit" data-id="${row.id}" style="background: none; border: none; color: var(--color-accent); font-size: 11px; font-weight: 700; cursor: pointer; text-decoration: underline;">Edit</button>
                          ` : `
                            <button class="btn-record btn btn-sm btn-primary" data-id="${row.id}" style="font-size: 11px; padding: 0.4rem 0.8rem;">
                              ${rowStatus.includes('Overdue') || rowStatus === 'Missed' ? 'Record Late Payment' : 'Record Payment'}
                            </button>
                          `}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
             </table>
          </div>
        </div>

        <!-- Summary Statistics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
           <div class="card" style="padding: 1.5rem;">
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Paid</p>
              <p style="margin: 0.25rem 0 0; font-size: 1.5rem; font-weight: 900; color: var(--color-success);">KES ${totals.paid.toLocaleString()}</p>
           </div>
           <div class="card" style="padding: 1.5rem;">
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Remaining</p>
              <p style="margin: 0.25rem 0 0; font-size: 1.5rem; font-weight: 900; color: var(--color-danger);">KES ${totals.remaining.toLocaleString()}</p>
           </div>
           <div class="card" style="padding: 1.5rem;">
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Next Due Date</p>
              <p style="margin: 0.25rem 0 0; font-size: 1.25rem; font-weight: 900;">${nextDue ? new Date(nextDue.due_date).toLocaleDateString() : 'N/A'}</p>
           </div>
           <div class="card" style="padding: 1.5rem;">
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Last Payment</p>
              <p style="margin: 0.25rem 0 0; font-size: 1.25rem; font-weight: 900;">${lastPaid ? new Date(lastPaid.last_payment_at).toLocaleDateString() : 'None'}</p>
           </div>
        </div>
      </div>

      <!-- Payment Modal -->
      <div id="payment-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content" style="max-width: 450px;">
           <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
              <h3 id="modal-title" style="margin: 0; font-weight: 900; color: var(--color-primary);">Record Repayment</h3>
              <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
           </div>
           <div id="modal-body">
              <!-- Dynamically filled -->
           </div>
        </div>
      </div>

      <style>
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
          animation: fadeIn 0.2s ease-out;
        }
        .modal-content {
          background: white; border-radius: 1.5rem; padding: 2.5rem; width: 90%;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          animation: slideUp 0.3s ease-out;
        }
      </style>
    `;

    attachListeners();
  }

  function attachListeners() {
    const modal = container.querySelector('#payment-modal');
    const modalBody = container.querySelector('#modal-body');
    const closeBtn = container.querySelector('.modal-close');

    closeBtn.onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    container.querySelectorAll('.btn-record').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        selectedRow = schedule.find(s => s.id === id);
        openModal();
      };
    });

    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => {
         alert('Edit function disabled in preview - recording a new payment update will overwrite currently.');
         const id = btn.dataset.id;
         selectedRow = schedule.find(s => s.id === id);
         openModal(true);
      };
    });

    const closeLoanBtn = container.querySelector('#close-loan-btn');
    if (closeLoanBtn) {
      closeLoanBtn.onclick = async () => {
        if (confirm('Are you sure you want to close this loan? All payments are confirmed.')) {
          await db.updateLoan(loan.id, { status: 'closed', closedAt: new Date().toISOString() });
          alert('Loan record closed successfully.');
          loadData();
        }
      };
    }
  }

  function openModal(isEdit = false) {
    const modal = container.querySelector('#payment-modal');
    const modalBody = container.querySelector('#modal-body');

    modalBody.innerHTML = `
      <div style="background: #F0F9FF; padding: 1.25rem; border-radius: 1rem; margin-bottom: 2rem; border: 1px solid #BAE6FD;">
         <p style="margin: 0; font-size: 11px; font-weight: 800; color: #0369A1; text-transform: uppercase; letter-spacing: 0.05em;">Installment Details</p>
         <h4 style="margin: 0.25rem 0 0; font-weight: 900; color: #075985; font-size: 16px;">Week ${selectedRow.week} — Due ${new Date(selectedRow.due_date).toLocaleDateString()}</h4>
         <p style="margin: 0.25rem 0 0; font-size: 14px; font-weight: 700; color: #0C4A6E;">Amount Due: <span style="font-size: 16px; color: #0284C7; font-weight: 900;">KES ${selectedRow.amount_due.toLocaleString()}</span></p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="field-wrap">
           <input type="number" id="p-amount" class="field-input" placeholder=" " value="${selectedRow.amount_due}" step="0.01">
           <label class="field-label">Amount Received (KES) <span class="req">*</span></label>
        </div>
        <div class="field-wrap">
           <input type="date" id="p-date" class="field-input" placeholder=" " value="${new Date().toISOString().split('T')[0]}">
           <label class="field-label">Date Received <span class="req">*</span></label>
        </div>
        <div class="field-wrap" style="height: auto;">
           <textarea id="p-notes" class="field-input" placeholder=" " style="height: 80px; resize: none; padding-top: 24px;"></textarea>
           <label class="field-label">Payment Notes (Optional)</label>
        </div>
      </div>

      <div style="margin-top: 2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
         <button id="p-cancel" class="btn-back" style="width: 100%; justify-content: center; height: 52px; font-weight: 700;">Cancel</button>
         <button id="p-save" class="btn-primary" style="width: 100%; height: 52px; font-weight: 800; box-shadow: 0 10px 15px -3px rgba(3, 105, 161, 0.2);">Save Payment</button>
      </div>
    `;

    modal.style.display = 'flex';

    container.querySelector('#p-cancel').onclick = () => { modal.style.display = 'none'; };
    container.querySelector('#p-save').onclick = async () => {
      const amt = parseFloat(container.querySelector('#p-amount').value);
      const date = container.querySelector('#p-date').value;
      const notes = container.querySelector('#p-notes').value;

      if (!amt || !date) {
        alert('Please fill all required fields');
        return;
      }

      const saveBtn = container.querySelector('#p-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        await db.recordPayment(selectedRow.id, amt, date, currentUser().id);
        modal.style.display = 'none';
        alert(`Payment of KES ${amt.toLocaleString()} recorded for ${loan.client.first_name}`);
        loadData();
      } catch (err) {
        alert('Error recording payment: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Payment';
      }
    };
  }

  loadData();
}
