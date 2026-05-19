import db from '../../db';
import { currentUser } from '../../auth';
import { formatDate, formatCurrency } from '../../utils/format';
import { showToast } from '../../components/toast';
import { displayLoanProduct } from '../../utils/formatters';

export async function renderRepaymentSchedule(container, loanId) {

  // ── LOAD ALL DATA ──────────────────────────────────────────
  const loan     = await db.getLoan(loanId);
  const client   = loan ? await db.getClient(loan.clientId) : null;
  const schedule = await db.getSchedule(loanId);   // array of week rows
  const payments = await db.getPaymentHistory(loanId);
  const companyName = await db.getCompanyName();

  if (!loan || !client) {
    container.innerHTML = `
      <div class="empty-state" style="padding:80px 24px">
        <div class="empty-state-icon">📋</div>
        <h3 class="empty-title">Loan not found</h3>
        <p class="empty-text">
          This loan record could not be found in the system.
        </p>
        <button class="btn-primary" onclick="navigate('#/repayments')">
          Back to Repayments
        </button>
      </div>`;
    return;
  }

  // ── COMPUTE SUMMARY FIGURES ────────────────────────────────
  const totalDue      = schedule.reduce((s, r) => s + (Number(r.amount_due || r.amountDue || 0)), 0);
  // Source of truth for recovered matches the schedule rows displayed to user
  const totalPaid     = schedule.reduce((s, r) => s + (Number(r.amount_paid || r.amountPaid || 0)), 0);
  const totalRemaining = Math.max(0, totalDue - totalPaid);
  const paidWeeks     = schedule.filter(r => r.status === 'paid' || (r.amount_paid || r.amountPaid) >= (r.amount_due || r.amountDue)).length;
  const totalWeeks    = schedule.length;
  const progressPct   = totalWeeks > 0 
    ? Math.round((paidWeeks / totalWeeks) * 100) : 0;

  // ── STATUS HELPERS ─────────────────────────────────────────
  function getRowStatus(row) {
    if (row.status === 'paid') return 'paid';
    const due  = new Date(row.due_date || row.dueDate);
    const now  = new Date();
    // Normalize dates to midnight for consistent day comparison
    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = nowMidnight - dueMidnight;
    const diffDays = Math.floor(diffTime / 86400000);
    
    if (diffDays > 7)  return 'missed';
    if (diffDays > 0)  return 'overdue';
    if (diffDays >= -1) return 'due'; // Due within 1 day or today
    return 'upcoming';
  }

  const statusConfig = {
    paid:     { badge: 'badge-success', label: 'Paid',     icon: '✓', rowBg: '#F0FDF4' },
    upcoming: { badge: 'badge-gray',    label: 'Upcoming', icon: '○', rowBg: '' },
    due:      { badge: 'badge-warning', label: 'Due Now',  icon: '!', rowBg: '#FFFBEB' },
    overdue:  { badge: 'badge-danger',  label: 'Overdue',  icon: '⚠', rowBg: '#FEF8F8' },
    missed:   { badge: 'badge-danger',  label: 'Missed',   icon: '✗', rowBg: '#FEF2F2' },
  };

  function daysLabel(row) {
    if (row.status === 'paid') return '';
    const due  = new Date(row.due_date || row.dueDate);
    const now  = new Date();
    
    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = nowMidnight - dueMidnight;
    const diff = Math.floor(diffTime / 86400000);
    
    if (diff < 0)  return `in ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''}`;
    if (diff === 0) return 'today';
    return `${diff} day${diff !== 1 ? 's' : ''} ago`;
  }

  // ── RENDER ─────────────────────────────────────────────────
  container.innerHTML = `

    <!-- Print-only header (Refined Premium) -->
    <div class="print-only" id="print-schedule-header" style="margin-bottom: 40px; border-bottom: 3px solid var(--color-primary); padding-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; color: var(--color-primary); font-size: 28px; font-weight: 900; letter-spacing: -0.02em;">${companyName}</h1>
          <p style="margin: 6px 0 0; font-size: 15px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Loan Repayment Schedule</p>
        </div>
        <div style="text-align: right;">
          <div style="background: #F1F5F9; padding: 10px 16px; border-radius: 8px; border: 1px solid #E2E8F0;">
            <p style="margin: 0; font-size: 10px; font-weight: 800; color: #64748B; text-transform: uppercase;">Reference Date</p>
            <p style="margin: 2px 0 0; font-size: 14px; font-weight: 800; color: #0F172A;">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 30px; padding: 20px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FAFBFF;">
        <div>
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">Client Name</p>
          <p style="margin: 4px 0 0; font-size: 16px; font-weight: 800; color: #1E293B;">${client.firstName} ${client.surname}</p>
        </div>
        <div>
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">ID Number</p>
          <p style="margin: 4px 0 0; font-size: 16px; font-weight: 800; color: #1E293B;">${client.idNumber || '—'}</p>
        </div>
        <div>
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">Loan Product</p>
          <p style="margin: 4px 0 0; font-size: 16px; font-weight: 800; color: var(--color-primary);">${displayLoanProduct(loan)}</p>
        </div>
        <div>
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">Total Repayable</p>
          <p style="margin: 4px 0 0; font-size: 16px; font-weight: 900; color: #1E293B;">${formatCurrency(totalDue)}</p>
        </div>
      </div>
    </div>

    <!-- Header Breadcrumbs -->
    <div class="schedule-breadcrumbs print-hide">
      <a href="#/repayments" class="breadcrumb-item">Repayments</a>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item" style="color:var(--color-primary)">${client.firstName} ${client.surname}</span>
    </div>

    <!-- Page header -->
    <div class="page-header" style="margin-bottom:24px">
      <div>
        <h1 class="page-title" style="margin:0">Repayment Schedule</h1>
        <div class="header-meta-pills">
           <span class="meta-pill">ID: ${loanId.substring(0,8).toUpperCase()}</span>
           <span class="meta-pill">${displayLoanProduct(loan)}</span>
           <span class="meta-pill">${loan.repaymentWeeks || 0} Week Plan</span>
        </div>
      </div>
      <div class="page-header-actions print-hide">
        <button class="btn-print-schedule" onclick="window.print()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/></svg>
          Print Schedule
        </button>
      </div>
    </div>

    <div class="schedule-layout">
      <!-- LEFT: main schedule -->
      <div class="schedule-main">
        
        <!-- Premium Progress Area -->
        <div class="premium-progress-area">
          <div class="progress-grid">
            <div class="prog-stat-card">
               <span class="prog-stat-label">Total Repayable</span>
               <span class="prog-stat-val">${formatCurrency(totalDue)}</span>
            </div>
            <div class="prog-stat-card">
               <span class="prog-stat-label">Amount Paid</span>
               <span class="prog-stat-val" style="color:#059669">${formatCurrency(totalPaid)}</span>
            </div>
            <div class="prog-stat-card">
               <span class="prog-stat-label">Remaining Balance</span>
               <span class="prog-stat-val" style="color:${totalRemaining > 0 ? '#1A2332' : '#059669'}">${totalRemaining > 0 ? formatCurrency(totalRemaining) : 'Nil'}</span>
            </div>
          </div>

          <div class="segmented-track-container">
            <div class="segmented-track">
              <div class="track-segment-fill" style="width:${progressPct}%"></div>
            </div>
            <div class="week-indicator-markers">
              ${schedule.map((row, i) => `
                <div class="marker-item ${row.status === 'paid' ? 'active' : ''}">
                  <div class="marker-dot"></div>
                  <span class="marker-label">Wk ${i+1}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Schedule table card -->
        <div class="card" style="padding:0; overflow:hidden; border-radius:16px">
           <div class="table-container hide-mobile" style="border:none; box-shadow:none">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:70px">Week</th>
                  <th>Installment Due</th>
                  <th>Amount Due</th>
                  <th>Amount Paid</th>
                  <th>Status</th>
                  <th style="width:140px; text-align:right" class="print-hide">Action</th>
                </tr>
              </thead>
              <tbody>
                ${schedule.map((row, i) => {
                  const st = getRowStatus(row);
                  const cfg = statusConfig[st];
                  // Use robust direct check for paid status
                  const isPaid = row.status === 'paid' || row.amount_paid > 0;
                  const amtPaid = row.amount_paid || row.amountPaid || 0;
                  
                  return `
                    <tr class="premium-schedule-row" style="background:${isPaid ? '#F0FDF4' : (st === 'overdue' ? '#FEF2F2' : 'white')}">
                      <td>
                        <div class="week-circle ${isPaid ? 'week-circle-paid' : (st === 'overdue' ? 'week-circle-overdue' : '')}">
                          ${i + 1}
                        </div>
                      </td>
                      <td>
                        <div style="font-weight:700; color:#1A2332">${formatDate(row.due_date || row.dueDate)}</div>
                        <div style="font-size:10px; font-weight:800; color:${st === 'overdue' ? '#DC2626' : '#64748B'}; text-transform:uppercase; letter-spacing:0.02em; margin-top:2px">
                           ${daysLabel(row)}
                        </div>
                      </td>
                      <td>
                        <div style="font-weight:800; color:#1A2332">${formatCurrency(row.amount_due || row.amountDue)}</div>
                      </td>
                      <td>
                        <div style="font-weight:900; color:${amtPaid > 0 ? '#059669' : '#CBD5E1'}">
                          ${amtPaid > 0 ? formatCurrency(amtPaid) : '—'}
                        </div>
                        ${isPaid && (row.paid_at || row.paidAt) ? `<div style="font-size:10px; color:#64748B; font-weight:600; margin-top:2px">Paid ${formatDate(row.paid_at || row.paidAt)}</div>` : ''}
                      </td>
                      <td>
                        <span class="badge ${cfg.badge}" style="padding:6px 12px; font-size:11px">${cfg.label}</span>
                      </td>
                      <td class="print-hide" style="text-align:right">
                        ${!isPaid ? `
                          <button class="btn btn-primary btn-sm" style="font-weight:800; padding:8px 16px" 
                            onclick="openPaymentModal('${row.id}', ${i+1}, ${row.amount_due || row.amountDue}, '${formatDate(row.due_date || row.dueDate)}')">
                            Record
                          </button>
                        ` : `
                          <button class="btn btn-secondary btn-sm" style="font-weight:700; color:#64748B; background:#F1F5F9; border:none"
                            onclick="openEditPayment('${row.id}', '${row.paymentId}')">
                            Edit
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
           </div>

           <!-- Mobile Card List -->
           <div class="show-mobile" style="display:none">
             ${schedule.map((row, i) => {
               const st = getRowStatus(row);
               const cfg = statusConfig[st];
               const isPaid = row.status === 'paid' || row.amount_paid > 0;
               const amtPaid = row.amount_paid || row.amountPaid || 0;
               
               return `
                 <div style="padding:1.5rem; border-bottom:1px solid #F1F5F9; background:${isPaid ? '#F0FDF4' : (st === 'overdue' ? '#FEF2F2' : 'white')}">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem">
                       <div style="display:flex; align-items:center; gap:12px">
                          <div class="week-circle ${isPaid ? 'week-circle-paid' : (st === 'overdue' ? 'week-circle-overdue' : '')}" style="width:32px; height:32px; font-size:12px">
                             ${i + 1}
                          </div>
                          <div>
                             <div style="font-weight:800; color:#1A2332; font-size:14px">${formatDate(row.due_date || row.dueDate)}</div>
                             <div style="font-size:10px; font-weight:800; color:${st === 'overdue' ? '#DC2626' : '#64748B'}; text-transform:uppercase; letter-spacing:0.02em">${daysLabel(row)}</div>
                          </div>
                       </div>
                       <span class="badge ${cfg.badge}" style="font-size:10px; padding:4px 10px">${cfg.label}</span>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem">
                       <div>
                          <p style="margin:0; font-size:10px; font-weight:800; color:#94A3B8; text-transform:uppercase">Expected</p>
                          <p style="margin:2px 0 0; font-weight:800; color:#1A2332">${formatCurrency(row.amount_due || row.amountDue)}</p>
                       </div>
                       <div style="text-align:right">
                          <p style="margin:0; font-size:10px; font-weight:800; color:#94A3B8; text-transform:uppercase">Actual Paid</p>
                          <p style="margin:2px 0 0; font-weight:900; color:${amtPaid > 0 ? '#059669' : '#CBD5E1'}">${amtPaid > 0 ? formatCurrency(amtPaid) : 'Not Paid'}</p>
                       </div>
                    </div>

                    ${!isPaid ? `
                       <button class="btn btn-primary" style="width:100%; height:44px; font-weight:800" 
                         onclick="openPaymentModal('${row.id}', ${i+1}, ${row.amount_due || row.amountDue}, '${formatDate(row.due_date || row.dueDate)}')">
                         Record Week ${i+1} Payment
                       </button>
                    ` : `
                       <button class="btn btn-secondary" style="width:100%; height:44px; font-weight:700; background:#F1F5F9; border:none"
                         onclick="openEditPayment('${row.id}', '${row.paymentId}')">
                         Edit Payment Record
                       </button>
                    `}
                 </div>
               `;
             }).join('')}
           </div>
        </div>

      </div><!-- /main -->

      <!-- RIGHT SIDEBAR -->
      <div class="schedule-sidebar">
        
        <!-- Summary Card -->
        <div class="card" style="padding:24px; border-radius:16px">
          <h3 style="margin:0 0 20px; font-size:13px; font-weight:800; color:#94A3B8; text-transform:uppercase; letter-spacing:0.05em">Repayment Overview</h3>
          
          <div class="sidebar-kv-list">
             <div class="kv-item">
                <span class="kv-label">Client</span>
                <span class="kv-value"><a href="#/clients/${client.id}" style="color:var(--color-primary); text-decoration:none">${client.firstName} ${client.surname}</a></span>
             </div>
             <div class="kv-item">
                <span class="kv-label">Phone</span>
                <span class="kv-value">${client.mobile}</span>
             </div>
             <div class="kv-item">
                <span class="kv-label">Loan Product</span>
                <span class="kv-value">${displayLoanProduct(loan)}</span>
             </div>
             <div class="kv-item">
                <span class="kv-label">Loan Amount</span>
                <span class="kv-value">${formatCurrency(loan.amount || loan.amount_requested)}</span>
             </div>
             <div class="kv-item" style="padding-top:12px; border-top:1px dashed #E2E8F0; margin-top:8px">
                <span class="kv-label">Interest Accrued</span>
                <span class="kv-value">${formatCurrency((loan.totalRepayable || loan.total_repayable) - (loan.amount || loan.amount_requested))}</span>
             </div>
             <div class="kv-item">
                <span class="kv-label" style="color:#1A2332; font-weight:800">Final Amount</span>
                <span class="kv-value" style="font-size:16px; font-weight:900; color:var(--color-primary)">${formatCurrency(loan.totalRepayable || loan.total_repayable)}</span>
             </div>
          </div>

          <div class="fin-summary-blocks">
             <div class="fin-block paid">
                <div class="fin-label">Recovered</div>
                <div class="fin-amount" style="color:#059669">${formatCurrency(totalPaid)}</div>
             </div>
             <div class="fin-block remaining">
                <div class="fin-label">Outstanding</div>
                <div class="fin-amount" style="color:${totalRemaining > 0 ? '#1A2332' : '#059669'}">${totalRemaining > 0 ? formatCurrency(totalRemaining) : 'Nil'}</div>
             </div>
          </div>
        </div>

        <!-- Next Payment Focus -->
        ${(() => {
          const nextRow = schedule.find(r => r.status !== 'paid');
          if (!nextRow) return `
            <div class="card" style="padding:24px; border-radius:16px; background:#ECFDF5; border:1.5px solid #10B981; text-align:center">
               <div style="font-size:32px; margin-bottom:8px">🎉</div>
               <h4 style="margin:0; font-weight:800; color:#064E3B">Fully Repaid</h4>
               <p style="margin:4px 0 0; font-size:12px; color:#065F46">This loan is completely cleared.</p>
               ${loan.status !== 'closed' ? `<button class="btn btn-primary btn-sm" style="width:100%; margin-top:16px; background:#059669; border:none" id="close-loan-btn">Close Loan Record</button>` : ''}
            </div>
          `;
          return `
            <div class="card" style="padding:24px; border-radius:16px; border-left:4px solid var(--color-primary)">
               <h3 style="margin:0; font-size:11px; font-weight:800; color:#94A3B8; text-transform:uppercase">Next Installment</h3>
               <div style="margin:12px 0; font-size:24px; font-weight:900; color:#1A2332">${formatCurrency(nextRow.amount_due || nextRow.amountDue)}</div>
               <div style="display:flex; align-items:center; gap:8px">
                  <span class="badge ${statusConfig[getRowStatus(nextRow)].badge}">${statusConfig[getRowStatus(nextRow)].label}</span>
                  <span style="font-size:12px; font-weight:600; color:#64748B">Due ${formatDate(nextRow.due_date || nextRow.dueDate)}</span>
               </div>
               <button class="btn btn-primary" style="width:100%; margin-top:20px; height:46px; font-weight:800"
                 onclick="openPaymentModal('${nextRow.id}', ${schedule.indexOf(nextRow)+1}, ${nextRow.amount_due || nextRow.amountDue}, '${formatDate(nextRow.due_date || nextRow.dueDate)}')">
                 Record Payment
               </button>
            </div>
          `;
        })()}

      </div>
    </div>

    <!-- RECORD PAYMENT MODAL -->
    <div class="modal-backdrop" id="payment-modal">
      <div class="modal modal-premium" style="max-width:480px">
        <div class="modal-header-premium">
          <div class="modal-header-content">
            <h2 class="modal-title-premium">Record Payment</h2>
            <div class="modal-subtitle-premium" id="modal-week-label">Week 1</div>
          </div>
        </div>
        
        <div class="modal-body modal-body-premium">

          <!-- Due amount block -->
          <div class="premium-due-block" id="modal-due-reminder">
            <div class="due-info">
              <span class="due-label">Installment Amount Due</span>
              <div class="due-amount-wrap">
                <span class="due-currency">KES</span>
                <span class="due-value" id="modal-due-amount">0</span>
              </div>
            </div>
            <div class="due-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <div class="premium-form-row">
            <!-- Amount received -->
            <div class="field-wrap-premium">
              <label class="field-label-premium" for="modal-amount">Amount Received (KES) <span class="req">*</span></label>
              <div class="input-icon-wrap">
                <span class="input-icon">KES</span>
                <input type="number" class="field-input-premium" id="modal-amount" placeholder="0.00" min="0" step="1" />
              </div>
            </div>

            <!-- Date received -->
            <div class="field-wrap-premium">
              <label class="field-label-premium" for="modal-date">Date Received <span class="req">*</span></label>
              <input type="date" class="field-input-premium" id="modal-date" />
            </div>
          </div>

          <!-- Shortfall warning -->
          <div class="premium-shortfall-alert" id="modal-shortfall" style="display:none">
            <div class="alert-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" fill="#FFFBEB" stroke="#F59E0B" stroke-width="2"/>
                <path d="M12 8v4M12 16h.01" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <span id="modal-shortfall-text" class="alert-text">Amount is less than due</span>
          </div>

          <!-- Received by -->
          <div class="field-wrap-premium" style="opacity:0.8">
            <label class="field-label-premium" for="modal-received-by">Received By</label>
            <div class="input-icon-wrap">
              <div class="input-icon" style="font-size:12px">👤</div>
              <input type="text" class="field-input-premium" id="modal-received-by" readonly style="background:#F8FAFF" />
            </div>
          </div>

          <!-- Notes -->
          <div class="field-wrap-premium">
            <label class="field-label-premium" for="modal-notes">Notes (optional)</label>
            <textarea class="field-input-premium" id="modal-notes" rows="3" placeholder="Add any details about the payment method or situation..."></textarea>
          </div>

        </div>

        <div class="modal-footer-premium">
          <button class="btn-cancel-premium" onclick="closePaymentModal()">
            Cancel
          </button>
          <button class="btn-save-premium" id="modal-save-btn" onclick="savePayment()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Save Payment
          </button>
        </div>
      </div>
    </div>

    <!-- Print-only footer for signatures -->
    <div class="print-only" style="margin-top: 60px; break-inside: avoid;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px;">
        <div style="border-top: 1px solid #1e293b; padding-top: 12px; text-align: center;">
          <p style="margin: 0; font-size: 12px; font-weight: 800; color: #1e293b;">Client Signature & Date</p>
          <p style="margin: 4px 0 0; font-size: 10px; color: #64748b;">(I acknowledge the above schedule)</p>
        </div>
        <div style="border-top: 1px solid #1e293b; padding-top: 12px; text-align: center;">
          <p style="margin: 0; font-size: 12px; font-weight: 800; color: #1e293b;">Officer Signature & Stamp</p>
          <p style="margin: 4px 0 0; font-size: 10px; color: #64748b;">Issued by ${currentUser()?.name || 'Authorized Officer'}</p>
        </div>
      </div>
      <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
        Generated by DariCap Microfinance System
      </div>
    </div>
  `;

  // ── ATTACH JS HANDLERS ────────────────────────────────────
  let activeScheduleRowId = null;
  let activeDueAmount     = 0;
  let activePaymentId      = null;

  window.openPaymentModal = function(rowId, weekNum, dueAmount, dueDateStr) {
    activeScheduleRowId = rowId;
    activeDueAmount     = dueAmount;
    activePaymentId      = null;

    // Populate modal
    document.getElementById('modal-week-label').textContent =
      `Week ${weekNum} — Due ${dueDateStr}`;
    document.getElementById('modal-due-amount').textContent =
      formatCurrency(dueAmount);
    document.getElementById('modal-amount').value = dueAmount;
    document.getElementById('modal-date').value =
      new Date().toISOString().split('T')[0];
    document.getElementById('modal-received-by').value =
      currentUser()?.name || 'Officer';
    document.getElementById('modal-notes').value = '';
    document.getElementById('modal-shortfall').style.display = 'none';

    // Reset button text
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Save Payment
      `;
    }

    // Open modal
    document.getElementById('payment-modal').classList.add('open');
    setTimeout(() => {
      document.getElementById('modal-amount').focus();
      document.getElementById('modal-amount').select();
    }, 200);
  };

  // Live shortfall check
  document.getElementById('modal-amount')?.addEventListener('input', (e) => {
    const entered = parseFloat(e.target.value) || 0;
    const shortfall = activeDueAmount - entered;
    const warnEl  = document.getElementById('modal-shortfall');
    const warnTxt = document.getElementById('modal-shortfall-text');
    if (shortfall > 0 && entered > 0) {
      warnEl.style.display = 'flex';
      warnTxt.textContent =
        `KES ${shortfall.toLocaleString('en-KE')} short of the required amount`;
    } else {
      warnEl.style.display = 'none';
    }
  });

  window.openEditPayment = async function(rowId, paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) {
      showToast('Payment record not found.', 'error');
      return;
    }

    const row = schedule.find(r => r.id === rowId);
    if (!row) return;
    const weekNum = schedule.indexOf(row) + 1;

    // Open standard payment modal with existing values
    window.openPaymentModal(
      rowId, 
      weekNum, 
      row.amount_due || row.amountDue, 
      formatDate(row.due_date || row.dueDate)
    );

    // Override values for editing
    activePaymentId = paymentId;
    document.getElementById('modal-amount').value = payment.amountPaid;
    document.getElementById('modal-date').value = new Date(payment.paidAt).toISOString().split('T')[0];
    document.getElementById('modal-notes').value = payment.notes || '';
    document.getElementById('modal-save-btn').innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Update Payment
    `;
  };

  window.closePaymentModal = function() {
    document.getElementById('payment-modal').classList.remove('open');
    activeScheduleRowId = null;
  };

  // Close on backdrop click
  document.getElementById('payment-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'payment-modal') window.closePaymentModal();
  });

  window.savePayment = async function() {
    const amount = parseFloat(document.getElementById('modal-amount').value);
    const date   = document.getElementById('modal-date').value;
    const notes  = document.getElementById('modal-notes').value.trim();
    const user   = currentUser();

    // Validate
    if (!amount || amount <= 0) {
      showToast('Please enter the amount received.', 'error');
      document.getElementById('modal-amount').focus();
      return;
    }
    if (!date) {
      showToast('Please enter the date the payment was received.', 'error');
      document.getElementById('modal-date').focus();
      return;
    }

    // Disable save button during save
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (activePaymentId) {
        await db.updatePayment(activePaymentId, amount, new Date(date).toISOString(), user?.id, notes);
      } else {
        await db.recordPayment(activeScheduleRowId, amount, new Date(date).toISOString(), user?.id, notes);
      }

      window.closePaymentModal();
      showToast(
        `Payment of ${formatCurrency(amount)} ${activePaymentId ? 'updated' : 'recorded'} successfully.`,
        'success'
      );

      // Re-render the schedule page to show updated state
      await renderRepaymentSchedule(container, loanId);

    } catch (err) {
      console.error('Save payment error:', err);
      showToast('Could not save the payment. Please try again.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Payment';
    }
  };

  const closeLoanBtn = document.getElementById('close-loan-btn');
  if (closeLoanBtn) {
    closeLoanBtn.onclick = async function() {
      await db.updateLoan(loanId, {
        status: 'closed',
        closedAt: new Date().toISOString()
      });
      showToast('Loan has been marked as fully repaid and closed.', 'success');
      await renderRepaymentSchedule(container, loanId);
    };
  }
}
