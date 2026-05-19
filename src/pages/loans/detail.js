import db from '../../db';
import { currentUser } from '../../auth';
import { updatePendingBadge } from '../../utils/notifications';
import { displayLoanProduct, formatLoanStatus, getLoanStatusBadge } from '../../utils/formatters';

export async function renderLoanDetail(container) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const loanId = urlParams.get('id');

  if (!loanId) {
    container.innerHTML = '<div style="text-align: center; padding: 4rem;">Loan ID not specified.</div>';
    return;
  }

  let loan = null;
  let collaterals = [];
  let guarantor = null;
  
  // State for expands
  let partialMode = false;
  let declineMode = false;

  async function loadData() {
    loan = await db.getLoan(loanId);
    if (!loan) {
      container.innerHTML = '<div style="text-align: center; padding: 4rem;">Loan not found.</div>';
      return;
    }
    collaterals = await db.getCollaterals(loanId);
    guarantor = await db.getGuarantor(loanId);
    
    renderUI();
  }

  function renderUI() {
    const totals = calculateLoan(loan.amountRequested || loan.amount_requested, loan.interestRate || loan.interest_rate, loan.repaymentWeeks || loan.repayment_weeks);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 2rem; animation: fadeIn 0.4s ease-out;" class="detail-grid">
        <!-- Left: Content -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
             <a href="#/admin/approval" style="color: var(--text-muted); text-decoration: none; font-size: 13px; font-weight: 700;">← Back to Applications</a>
          </div>

          <!-- 1. Client Card -->
          <div class="card" style="padding: 1.5rem; display: flex; gap: 1.5rem; align-items: center;">
            <img src="${loan.client?.passport_photo}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #F1F5F9;">
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h2 style="margin: 0; font-size: 1.5rem; font-weight: 900; color: var(--color-primary);">${loan.client?.first_name} ${loan.client?.surname}</h2>
                <span class="badge" style="background: ${loan.client?.fee_status === 'paid' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)'}; color: ${loan.client?.fee_status === 'paid' ? 'var(--color-success)' : 'var(--color-danger)'}">
                  Fee ${loan.client?.fee_status === 'paid' ? 'Paid' : 'Pending'}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 0.75rem;">
                <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 700;">ID NUMBER</p><p style="margin: 0.25rem 0 0; font-size: 13px; font-weight: 700;">${loan.client?.national_id}</p></div>
                <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 700;">MOBILE</p><p style="margin: 0.25rem 0 0; font-size: 13px; font-weight: 700;">${loan.client?.mobile}</p></div>
                <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 700;">RESIDENCE</p><p style="margin: 0.25rem 0 0; font-size: 13px; font-weight: 700;">${loan.client?.residence}</p></div>
              </div>
              <p style="margin: 1rem 0 0; font-size: 11px; color: var(--text-muted);">Registered by <b>${loan.client?.created_by_name || 'System'}</b> on <b>${new Date(loan.client?.createdAt).toLocaleDateString()}</b></p>
            </div>
          </div>

          <!-- 2. Loan Request -->
          <div class="card" style="padding: 1.5rem;">
            <h3 style="margin: 0 0 1.5rem; font-size: 14px; font-weight: 800; color: var(--color-primary); text-transform: uppercase;">Loan Request Detail</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                 ${renderDataRow('Product', displayLoanProduct(loan))}
                 ${renderDataRow('Amount Requested', `KES ${Number(loan.amountRequested || loan.amount_requested).toLocaleString()}`, true)}
                 ${renderDataRow('Period', `${loan.repaymentWeeks || loan.repayment_weeks} Weeks`)}
                 ${renderDataRow('Interest Rate', `${(loan.interestRate || loan.interest_rate) * 100}%`)}
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                 ${renderDataRow('Interest Amount', `KES ${totals.interest.toLocaleString()}`)}
                 ${renderDataRow('Total to Repay', `KES ${totals.total.toLocaleString()}`, true)}
                 ${renderDataRow('Each Installment', `KES ${totals.installment.toLocaleString()}`, true)}
                 ${renderDataRow('Application Date', new Date(loan.appliedAt || loan.applied_at || loan.createdAt).toLocaleDateString())}
              </div>
            </div>
            <div style="margin-top: 1.5rem; padding: 1.25rem; background: #EEF7FF; border-radius: 0.75rem; border: 1px solid #BAE6FD;">
              <p style="margin: 0; font-size: 12px; color: #0369A1; font-weight: 700;">
                The client requested <b>KES ${Number(loan.amountRequested || loan.amount_requested).toLocaleString()}</b>. 
                If approved, they will repay a total of <b>KES ${totals.total.toLocaleString()}</b> in weekly installments.
              </p>
            </div>
          </div>

          <!-- 3. Collateral -->
          <div class="card" style="padding: 1.5rem;">
            <h3 style="margin: 0 0 1.5rem; font-size: 14px; font-weight: 800; color: var(--color-primary); text-transform: uppercase;">Borrower Collateral</h3>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Est. Value</th>
                    <th>Serial No</th>
                    <th>Document</th>
                  </tr>
                </thead>
                <tbody>
                  ${collaterals.filter(c => c.ownerType === 'borrower').map(c => `
                    <tr>
                      <td style="font-weight: 700;">${c.description}</td>
                      <td style="font-weight: 800; color: var(--color-success);">KES ${(parseFloat(c.value) || 0).toLocaleString()}</td>
                      <td style="font-size: 12px;">${c.serial || '-'}</td>
                      <td>
                        ${c.documents ? (c.documents.startsWith('data:image') ? `<img src="${c.documents}" style="height: 30px; cursor: pointer;" onclick="window.open('${c.documents}')">` : '<a href="#" onclick="alert(\'PDF/Doc Preview not available in simple view\')">View Doc</a>') : '<span style="color: #ccc;">No doc</span>'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4. Guarantor -->
          <div class="card" style="padding: 1.5rem;">
            <h3 style="margin: 0 0 1.5rem; font-size: 14px; font-weight: 800; color: var(--color-primary); text-transform: uppercase;">Guarantor Details</h3>
            ${guarantor ? `
              <div style="display: flex; gap: 1.5rem; margin-bottom: 2rem;">
                <img src="${guarantor.photo}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #F1F5F9;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; flex: 1;">
                   <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 700;">NAME</p><p style="margin: 0.25rem 0 0; font-size: 13px; font-weight: 800;">${guarantor.name}</p></div>
                   <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 700;">ID NUMBER</p><p style="margin: 0.25rem 0 0; font-size: 13px; font-weight: 700;">${guarantor.national_id}</p></div>
                   <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 700;">MOBILE</p><p style="margin: 0.25rem 0 0; font-size: 13px; font-weight: 700;">${guarantor.mobile}</p></div>
                   <div><p style="margin: 0; font-size: 10px; color: var(--text-muted); font-weight: 700;">RELATIONSHIP</p><p style="margin: 0.25rem 0 0; font-size: 13px; font-weight: 700;">${guarantor.relationship}</p></div>
                </div>
              </div>
              <h4 style="margin: 0 0 1rem; font-size: 12px; font-weight: 800; color: var(--text-muted);">Guarantor Collateral</h4>
              <div class="table-container">
                <table class="data-table">
                  <tbody>
                    ${collaterals.filter(c => c.ownerType === 'guarantor').map(c => `
                      <tr>
                        <td style="font-weight: 700;">${c.description}</td>
                        <td style="font-weight: 800; color: var(--color-success)">KES ${(parseFloat(c.value) || 0).toLocaleString()}</td>
                        <td style="font-size: 12px;">${c.serial || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p style="text-align: center; color: var(--text-muted);">No guarantor details provided.</p>'}
          </div>
        </div>

        <!-- Right: Actions Sidebar -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div class="card" style="padding: 1.5rem; position: sticky; top: 1rem;">
             <div style="text-align: center; margin-bottom: 1.5rem;">
               <span class="badge ${getLoanStatusBadge(loan.status)}" style="padding: 0.5rem 1rem; font-size: 14px;">
                  ${formatLoanStatus(loan.status)}
               </span>
               <p style="margin: 1rem 0 0; font-size: 12px; color: var(--text-muted);">Applied by <b>${loan.applied_by_name || 'Officer'}</b><br>${new Date(loan.applied_at || loan.createdAt).toLocaleString()}</p>
             </div>

             ${renderActions(loan, totals, partialMode, declineMode)}
          </div>
        </div>
      </div>

      <style>
        @media (max-width: 992px) {
          .detail-grid { grid-template-columns: 1fr !important; }
        }
      </style>
    `;

    attachActionListeners();
  }

  function renderDataRow(label, value, highlight = false) {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
        <span style="color: var(--text-muted); font-weight: 600;">${label}</span>
        <span style="font-weight: ${highlight ? '800' : '700'}; color: ${highlight ? 'var(--color-primary)' : 'var(--text-main)'};">${value}</span>
      </div>
    `;
  }

  function renderActions(loan, totals, partialMode, declineMode) {
    const feePaid = loan.client?.processing_fee_paid === true;

    if (loan.status === 'pending') {
      if (!feePaid) {
        return `
          <div class="approval-locked">
            <span class="approval-locked-icon">🔒</span>
            <h3>Approval Locked</h3>
            <p>The processing fee for this client has not been collected. Before this loan can be approved, the loan officer must collect the fee.</p>
            <button class="btn btn-secondary" style="width: 100%; height: 44px; font-weight: 800;" onclick="window.location.hash = '#/clients/view?id=${loan.clientId}&action=fee'">
              Go to Client Profile
            </button>
          </div>
        `;
      }

      return `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px; color: #059669; font-weight: 800; font-size: 12px; margin-bottom: 0.5rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ✓ Processing fee collected
          </div>
          
          <button id="approve-full-btn" class="btn btn-primary" style="width: 100%; padding: 1rem;">Approve Full Amount</button>
          <p style="margin: -0.5rem 0 0; text-align: center; font-size: 11px; font-weight: 700; color: var(--color-success);">KES ${loan.amount_requested.toLocaleString()}</p>
          
          <div style="text-align: center;">
            <a href="#" id="partial-link" style="font-size: 12px; font-weight: 700; color: var(--color-accent); text-decoration: none;">Approve a Different Amount</a>
          </div>

          ${partialMode ? `
            <div style="padding: 1.5rem; background: #F0F9FF; border-radius: 1rem; border: 1.5px solid #BAE6FD; margin-top: 1rem; animation: slideDown 0.3s ease-out; display: flex; flex-direction: column; gap: 16px;">
              <div class="field-wrap" style="margin-bottom: 0;">
                <input type="number" id="partial-amount-input" class="field-input" placeholder=" " value="${loan.amount_requested}" style="font-weight: 800;">
                <label class="field-label">Approved Amount (KES)</label>
              </div>
              <button id="partial-confirm-btn" class="btn-primary" style="width: 100%; height: 48px; font-weight: 800;">Confirm Partial Approval</button>
            </div>
          ` : ''}

          <div style="text-align: center; margin-top: 1rem;">
            <a href="#" id="decline-link" style="font-size: 12px; font-weight: 700; color: #DC2626; text-decoration: none; border-bottom: 1.5px solid rgba(220, 38, 38, 0.2);">Decline This Application</a>
          </div>

          ${declineMode ? `
            <div style="padding: 1.5rem; background: #FFF1F2; border-radius: 1rem; border: 1.5px solid #FECACA; margin-top: 1rem; animation: slideDown 0.3s ease-out; display: flex; flex-direction: column; gap: 16px;">
              <div class="field-wrap" style="height: auto; margin-bottom: 0;">
                <textarea id="decline-reason" class="field-input" placeholder=" " style="height: 100px; resize: none; padding-top: 24px;"></textarea>
                <label class="field-label">Official Reason for Decline</label>
              </div>
              <button id="decline-confirm-btn" class="btn-danger" style="width: 100%; height: 48px; font-weight: 800; background: #E11D48;">Confirm Decline</button>
            </div>
          ` : ''}
        </div>
      `;
    }

    if (loan.status === 'approved' || loan.status === 'partially_approved') {
      return `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div style="padding: 1.25rem; background: #F0FFF4; border: 1px solid #C6F6D5; border-radius: 0.75rem; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #38A169; font-weight: 800;">APPROVED FOR</p>
            <h3 style="margin: 0.25rem 0 0; font-size: 1.5rem; font-weight: 900; color: #2F855A;">KES ${loan.approved_amount?.toLocaleString() || loan.amount_requested?.toLocaleString()}</h3>
          </div>

          <div style="background: #F8FAFC; padding: 1.25rem; border-radius: 0.75rem; border: 1px solid #E2E8F0;">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div class="field-wrap" style="margin-bottom: 0;">
                <input type="date" id="disburse-date" class="field-input" placeholder=" " value="${new Date().toISOString().split('T')[0]}">
                <label class="field-label">Actual Disbursement Date</label>
              </div>
              <button id="disburse-btn" class="btn-primary" style="width: 100%; padding: 1rem; height: 52px; font-weight: 800;">Finalize & Disburse Funds</button>
            </div>
          </div>
        </div>
      `;
    }

    if (loan.status === 'disbursed') {
      return `
        <div style="padding: 1.5rem; background: #F1F5F9; border-radius: 0.75rem; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: var(--text-muted); font-weight: 700;">DISBURSED ON</p>
          <p style="margin: 0.25rem 0 0; font-size: 14px; font-weight: 800;">${new Date(loan.disbursed_at).toLocaleDateString()}</p>
          <hr style="border: 0; border-top: 1px solid #CBD5E1; margin: 1.25rem 0;">
          <button 
            class="btn-primary btn-repayment-schedule"
            onclick="navigate('#/repayments/${loan.id}')"
            id="view-schedule-btn"
            style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" 
                stroke="currentColor" stroke-width="2" fill="none"/>
              <path d="M16 2v4M8 2v4M3 10h18" 
                stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" 
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            View Repayment Schedule
          </button>
        </div>
      `;
    }

    if (loan.status === 'declined') {
      return `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="padding: 1.25rem; background: #FFF5F5; border: 1px solid #FED7D7; border-radius: 0.75rem;">
            <p style="margin: 0; font-size: 11px; color: var(--color-danger); font-weight: 800;">DECLINE REASON</p>
            <p style="margin: 0.5rem 0 0; font-size: 13px; line-height: 1.5; color: #9B2C2C;">${loan.decline_reason || 'No reason provided.'}</p>
          </div>
          <button id="reconsider-btn" class="btn btn-secondary" style="width: 100%;">Reconsider Application</button>
        </div>
      `;
    }

    return '';
  }

  function attachActionListeners() {
    // Basic toggles
    const pLink = document.getElementById('partial-link');
    if (pLink) pLink.onclick = (e) => { e.preventDefault(); partialMode = !partialMode; declineMode = false; renderUI(); };

    const dLink = document.getElementById('decline-link');
    if (dLink) dLink.onclick = (e) => { e.preventDefault(); declineMode = !declineMode; partialMode = false; renderUI(); };

    // Core buttons
    const fullBtn = document.getElementById('approve-full-btn');
    if (fullBtn) fullBtn.onclick = () => updateStatus('approved', loan.amount_requested);

    const partBtn = document.getElementById('partial-confirm-btn');
    if (partBtn) partBtn.onclick = () => {
      const amt = parseFloat(document.getElementById('partial-amount-input').value);
      if (!amt || amt <= 0) { alert('Enter valid amount'); return; }
      updateStatus('partially_approved', amt);
    };

    const decBtn = document.getElementById('decline-confirm-btn');
    if (decBtn) decBtn.onclick = () => {
      const reason = document.getElementById('decline-reason').value;
      if (!reason) { alert('Please provide a reason'); return; }
      updateStatus('declined', null, reason);
    };

    const reconBtn = document.getElementById('reconsider-btn');
    if (reconBtn) reconBtn.onclick = () => updateStatus('pending');

    // Disbursement
    const disBtn = document.getElementById('disburse-btn');
    if (disBtn) disBtn.onclick = async () => {
      const date = document.getElementById('disburse-date').value;
      const finalAmt = loan.approved_amount || loan.amount_requested;
      
      await db.updateLoan(loan.id, { 
        status: 'disbursed', 
        disbursed_at: date,
        disbursement_officer: currentUser().id
      });
      updatePendingBadge();
      
      await db.generateSchedule(loan.id);
      
      await db.addNotification(
        loan.applied_by, 
        `Loan for ${loan.client.first_name} ${loan.client.surname} has been disbursed! (KES ${finalAmt.toLocaleString()})`, 
        loan.id
      );
      
      alert('Loan Disbursed Successfully!');
      loadData();
    };
  }

  async function updateStatus(status, approvedAmount = null, reason = null) {
    const data = { status };
    if (approvedAmount) data.approved_amount = approvedAmount;
    if (reason) data.decline_reason = reason;

    await db.updateLoan(loan.id, data);
    updatePendingBadge();
    
    let msg = `Loan application for ${loan.client.first_name} was ${status.replace('_', ' ')}`;
    if (approvedAmount) msg += ` (KES ${approvedAmount.toLocaleString()})`;
    await db.addNotification(loan.applied_by, msg, loan.id);
    
    partialMode = false;
    declineMode = false;
    loadData();
  }

  function calculateLoan(amount, rate, weeks) {
    const amt = parseFloat(amount) || 0;
    const interest = amt * rate;
    const total = amt + interest;
    const installment = weeks > 0 ? total / weeks : 0;
    return { interest, total, installment };
  }

  loadData();
}
