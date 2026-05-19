import db from '../../db';
import { currentUser } from '../../auth';
import { formatDate } from '../../utils/format';
import { navigate } from '../../router';
import { showToast } from '../../components/toast';
import { displayLoanProduct, formatLoanStatus, getLoanStatusBadge } from '../../utils/formatters';

function renderLoanHistoryRow(loan) {
  return `
    <tr class="clickable-row hide-mobile" onclick="navigate('#/loans/view?id=${loan.id}')">
      <td>
        <div class="history-date">${formatDate(loan.appliedAt || loan.createdAt)}</div>
      </td>
      <td>
        <div class="history-product-name">${displayLoanProduct(loan)}</div>
      </td>
      <td>
        <div class="history-amount">KES ${Number(loan.amountRequested || loan.amount_requested || 0).toLocaleString('en-KE')}</div>
      </td>
      <td>
        <div style="font-size: 13px; font-weight: 700; color: #475569;">${(loan.repaymentWeeks || loan.repayment_weeks || '?')} Weeks</div>
      </td>
      <td style="text-align: center;">
        <span class="badge ${getLoanStatusBadge(loan.status)}" style="padding: 6px 12px; font-size: 11px;">
          ${formatLoanStatus(loan.status)}
        </span>
      </td>
      <td style="text-align: right;">
        <button class="btn btn-secondary btn-sm" 
           style="background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 700; color: #64748B;"
           onclick="event.stopPropagation(); navigate('#/loans/view?id=${loan.id}')">
          View
        </button>
      </td>
    </tr>
  `;
}

function renderLoanHistoryCard(loan) {
  return `
    <div class="loan-history-card-p show-mobile" onclick="navigate('#/loans/view?id=${loan.id}')" style="padding: 1.25rem; border-bottom: 1px solid #F1F5F9; background: white;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <div>
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">${formatDate(loan.appliedAt || loan.createdAt)}</p>
          <p style="margin: 2px 0 0; font-size: 14px; font-weight: 800; color: #1A2332;">${displayLoanProduct(loan)} / ${loan.repaymentWeeks || loan.repayment_weeks || '?'} Wks</p>
        </div>
        <span class="badge ${getLoanStatusBadge(loan.status)}" style="font-size: 10px; padding: 4px 10px;">
          ${formatLoanStatus(loan.status)}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">Amount Requested</p>
          <p style="margin: 2px 0 0; font-size: 17px; font-weight: 900; color: var(--color-primary);">KES ${Number(loan.amountRequested || loan.amount_requested || 0).toLocaleString()}</p>
        </div>
        <button class="btn btn-secondary btn-sm" style="background:#F8FAFF; border:none; height:32px; font-size:11px; font-weight:800; color:var(--color-primary)">View Details</button>
      </div>
    </div>
  `;
}

function isRegistrationComplete(client) {
  if (!client) return false;
  
  // Check all possible field name variants
  const feePaidVariants = [
    client.registrationFeePaid,
    client.registration_fee_paid,
    client.fee_status === 'paid'
  ];
  const feePaid = feePaidVariants.some(v => v === true);
  
  const statusVariants = [
    client.registrationStatus,
    client.registration_status,
  ];
  const statusComplete = statusVariants.some(v => v === 'complete');

  const hasRequiredFields = !!(
    (client.firstName || client.first_name) &&
    (client.surname || client.lastName || client.surname) &&
    (client.nationalId || client.national_id) &&
    (client.mobile || client.mobileNumber || client.phone || client.mobile)
  );

  console.log('isRegistrationComplete check:', {
    clientId: client.id,
    clientName: client.firstName || client.first_name,
    feePaidVariants,
    feePaid,
    statusVariants,
    statusComplete,
    hasRequiredFields,
    finalResult: feePaid || statusComplete
  });
  
  // Registration is complete if EITHER fee is paid OR status is complete
  // (being lenient catches data saved before normalization fix)
  return feePaid || statusComplete;
}

export async function renderClientProfile(container) {
  const [path, query] = window.location.hash.substring(1).split('?');
  const params = new URLSearchParams(query);
  const clientId = params.get('id');

  if (!clientId) {
    container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;"><h3>Error</h3><p>Client ID is missing.</p><button class="btn btn-secondary" onclick="window.history.back()">Back</button></div>';
    return;
  }

  const client = await db.getClient(clientId);
  if (!client) {
    container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;"><h3>Client Not Found</h3><p>The client you requested does not exist in browser storage.</p><button class="btn btn-secondary" onclick="window.location.hash = \'#/clients\'">Back to List</button></div>';
    return;
  }

  const loans = await db.getLoans({ clientId });
  const settings = await db.getSettings();
  const user = currentUser();

  // DERIVED DATA FOR SIDEBAR STATS
  const totalBorrowed = loans.filter(l => l.status !== 'declined' && l.status !== 'pending').reduce((sum, l) => sum + (l.amount_requested || 0), 0);
  const activeLoans = loans.filter(l => l.status === 'disbursed');
  
  // Repayment Rate calculation
  let totalDue = 0;
  let totalPaid = 0;
  for (const loan of loans) {
    if (loan.status === 'disbursed' || loan.status === 'completed') {
      const schedule = await db.getSchedule(loan.id);
      schedule.forEach(s => {
        totalDue += (s.amount_due || 0);
        totalPaid += (s.amount_paid || 0);
      });
    }
  }
  const repaymentRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  const complete = isRegistrationComplete(client);
  
  // Registration Fee Modal Logic
  window.openFeeModal = function(id) {
    const modal = document.getElementById('reg-fee-modal');
    if (modal) modal.style.display = 'flex';
  };

  async function onFeeCollected(clientId, amount, date) {
    try {
      await db.markRegistrationComplete(clientId, amount, date, user.id);
      showToast(`Registration fee recorded. ${client.first_name} is now fully registered.`, 'success');
      await renderClientProfile(container); // Re-render this page
    } catch (err) {
      showToast('Error recording registration fee: ' + err.message, 'error');
    }
  }

  // Conditionally show/hide the banner
  const bannerHtml = complete ? '' : `
    <div class="registration-incomplete-banner" style="margin-bottom: 2rem; padding: 24px; border: 2.5px solid #EF4444; background: #FEF2F2; display: flex; gap: 16px; align-items: start; border-radius: 1rem; animation: slideIn 0.4s ease-out;">
      <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); color: #B91C1C; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">⚠</div>
      <div style="flex: 1;">
        <strong style="display: block; font-size: 16px; font-weight: 900; color: #991B1B;">Registration Incomplete</strong>
        <p style="margin: 4px 0 0; font-size: 13px; color: #B91C1C; line-height: 1.5; font-weight: 600;">This client cannot apply for a loan until the registration fee 
           has been collected and their profile is fully verified.</p>
      </div>
      <button class="btn btn-primary" style="background: #991B1B; border-color: #991B1B; font-weight: 800;" onclick="openFeeModal('${client.id}')">
        Collect Registration Fee
      </button>
    </div>
  `;

  // Apply for Loan button — shown only when complete
  const applyBtnHtml = complete 
    ? `<button class="btn-new-app-premium" onclick="navigate('#/loans/new?clientId=${client.id}')" style="padding: 12px 24px;">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right: 4px;"><path d="M12 5v14M5 12h14"/></svg>
         Apply for Loan
       </button>`
    : `<button class="btn-disabled" disabled title="Complete registration first" style="padding: 12px 24px; display: inline-flex; align-items: center; gap: 8px; font-weight: 800; opacity: 0.5;">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
         Apply for Loan
       </button>`;

  function render() {
    container.innerHTML = `
      ${bannerHtml}
      <div class="profile-responsive-grid">
        
        <!-- LEFT COLUMN -->
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          
          <!-- CLIENT HEADER -->
          <div class="card client-header-p" style="padding: 2.5rem; display: flex; gap: 2.5rem; align-items: start; position: relative; overflow: hidden;">
            <!-- Background Decorative Accent -->
            <div style="position: absolute; top: 0; right: 0; width: 150px; height: 150px; background: var(--color-primary); opacity: 0.03; border-radius: 0 0 0 100%; pointer-events: none;"></div>
            
            <!-- Avatar -->
            <div style="flex-shrink: 0;">
              ${client.passport_photo ? 
                `<img src="${client.passport_photo}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid white; box-shadow: var(--shadow-md);">` :
                `<div style="width: 120px; height: 120px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-size: 42px; font-weight: 800; color: #94A3B8; border: 4px solid white; box-shadow: var(--shadow-md);">
                   ${(client.first_name || 'C')[0]}${(client.surname || '')[0]}
                 </div>`
              }
            </div>

            <!-- Details -->
            <div style="flex: 1; width: 100%;">
              <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem;">
                <div>
                  <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: var(--color-primary);">${client.title} ${client.first_name} ${client.middle_name ? client.middle_name + ' ' : ''}${client.surname}</h1>
                  <p style="margin: 0.25rem 0 0; color: var(--text-muted); font-weight: 700; font-size: 13px;">Member ID: <span style="color: var(--color-accent);">${client.id.toUpperCase().substring(0, 8)}</span></p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  <span class="badge badge-success" style="padding: 0.5rem 1rem;">Registered</span>
                  <span class="badge ${client.fee_status === 'paid' ? 'badge-primary' : 'badge-danger'}" style="padding: 0.5rem 1rem;">
                    Fee: ${client.fee_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>

              <div class="client-info-grid-p" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin: 1.5rem 0; padding: 1.5rem; background: #F8FAFC; border-radius: 1rem; border: 1px solid #F1F5F9;">
                <div>
                  <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">National ID</p>
                  <p style="margin: 0.25rem 0 0; font-weight: 800; font-size: 14px;">${client.national_id}</p>
                </div>
                <div>
                  <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">KRA PIN</p>
                  <p style="margin: 0.25rem 0 0; font-weight: 800; font-size: 14px;">${client.kra_pin || 'Not provided'}</p>
                </div>
                <div>
                  <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">Phone Number</p>
                  <p style="margin: 0.25rem 0 0; font-weight: 800; font-size: 14px;">${client.mobile} ${client.alt_mobile ? ' | ' + client.alt_mobile : ''}</p>
                </div>
                <div>
                  <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">Residence</p>
                  <p style="margin: 0.25rem 0 0; font-weight: 800; font-size: 14px;">${client.residence || 'N/A'}</p>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <p style="margin: 0; font-size: 12px; color: var(--text-muted); font-weight: 500;">
                  By <span style="font-weight: 800; color: var(--color-primary);">${client.created_by_name || 'System'}</span> on ${new Date(client.createdAt).toLocaleDateString()}
                </p>
                <div class="client-header-actions" style="display: flex; gap: 0.75rem;">
                  <button class="btn btn-secondary" id="edit-client-btn" style="padding: 10px 20px; border-radius: 10px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Edit
                  </button>
                  ${applyBtnHtml}
                </div>
              </div>
            </div>
          </div>

          <!-- REFEREES -->
          <div class="card" style="padding: 2rem;">
            <h3 style="margin: 0 0 1.5rem; font-weight: 900; font-size: 1rem; color: var(--color-primary); display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">🤝</span> Community Referees
            </h3>
            <div class="client-info-grid-p" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
              <div style="padding: 1.25rem; background: #F8FAFC; border-radius: 1rem; border: 1px solid #F1F5F9;">
                <h5 style="margin: 0 0 0.75rem; font-size: 11px; font-weight: 800; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.05em;">Referee One</h5>
                <p style="margin: 0; font-weight: 800; font-size: 14px;">${client.r1_name || 'Not provided'}</p>
                <div style="display: flex; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap;">
                  <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Rel: ${client.r1_rel || 'N/A'}</span>
                  <span style="font-size: 12px; color: var(--color-primary); font-weight: 800;">${client.r1_phone || ''}</span>
                </div>
              </div>
              <div style="padding: 1.25rem; background: #F8FAFC; border-radius: 1rem; border: 1px solid #F1F5F9;">
                <h5 style="margin: 0 0 0.75rem; font-size: 11px; font-weight: 800; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.05em;">Referee Two</h5>
                <p style="margin: 0; font-weight: 800; font-size: 14px;">${client.r2_name || 'Not provided'}</p>
                <div style="display: flex; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap;">
                  <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Rel: ${client.r2_rel || 'N/A'}</span>
                  <span style="font-size: 12px; color: var(--color-primary); font-weight: 800;">${client.r2_phone || ''}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- LOAN HISTORY -->
          <div class="card" style="padding: 0; overflow: hidden; border-radius: 20px;">
            <div class="history-header">
              <div class="history-title-wrap">
                <div class="history-icon-box">💰</div>
                <div>
                  <h3 class="history-title">Loan Application History</h3>
                  <div style="display: flex; gap: 8px; margin-top: 2px;">
                    <span class="history-count-badge">${loans.length} Records</span>
                    ${activeLoans.length > 0 ? `<span class="badge badge-accent" style="font-size: 9px; padding: 2px 6px;">${activeLoans.length} Active</span>` : ''}
                  </div>
                </div>
              </div>
              ${loans.length > 0 && complete ? `
                <button class="btn-new-app-premium" onclick="navigate('#/loans/new?clientId=${client.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  New Application
                </button>
              ` : ''}
            </div>
            
            ${loans.length === 0 ? `
              <div class="history-empty-container">
                <div class="empty-graphic">📑</div>
                <h4 class="history-empty-title">No applications yet</h4>
                <p class="history-empty-text">This client hasn't applied for any loans in the past. Start a new application to see it here.</p>
                ${complete ? `
                  <button class="btn-new-app-premium" onclick="navigate('#/loans/new?clientId=${client.id}')">
                    Create First Application
                  </button>
                ` : `
                  <p style="font-size: 12px; font-weight: 700; color: #EF4444; background: #FEF2F2; padding: 8px 16px; border-radius: 8px; border: 1px solid #FEE2E2;">
                    Complete registration to enable applications
                  </p>
                `}
              </div>
            ` : `
              <div class="table-container hide-mobile" style="border:none; border-radius:0; box-shadow:none;">
                <table class="data-table history-table">
                  <thead>
                    <tr>
                      <th>Applied Date</th>
                      <th>Loan Product</th>
                      <th>Principal Amount</th>
                      <th>Duration</th>
                      <th style="text-align: center;">Review Status</th>
                      <th style="text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${loans.map(loan => renderLoanHistoryRow(loan)).join('')}
                  </tbody>
                </table>
              </div>
              <div class="mobile-history-list show-mobile" style="display: none;">
                ${loans.map(loan => renderLoanHistoryCard(loan)).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- QUICK STATS -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
             <div class="card" style="padding: 1.25rem; text-align: center; border-bottom: 4px solid var(--color-primary);">
                <p style="margin: 0; font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Loans Applied</p>
                <h4 style="margin: 0.5rem 0 0; font-weight: 900; font-size: 20px;">${loans.length}</h4>
             </div>
             <div class="card" style="padding: 1.25rem; text-align: center; border-bottom: 4px solid var(--color-accent);">
                <p style="margin: 0; font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Active Loans</p>
                <h4 style="margin: 0.5rem 0 0; font-weight: 900; font-size: 20px; color: var(--color-accent);">${activeLoans.length}</h4>
             </div>
             <div class="card" style="padding: 1.25rem; text-align: center; border-bottom: 4px solid var(--color-success); grid-column: span 2;">
                <div style="display: flex; justify-content: space-between; align-items: end;">
                  <div style="text-align: left;">
                    <p style="margin: 0; font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Repayment Health</p>
                    <h4 style="margin: 0.25rem 0 0; font-weight: 900; font-size: 18px;">${repaymentRate}% Rate</h4>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Borrowed</p>
                    <p style="margin: 0.25rem 0 0; font-weight: 900; font-size: 14px; color: var(--color-primary);">KES ${totalBorrowed.toLocaleString()}</p>
                  </div>
                </div>
                <div style="height: 6px; background: #E2E8F0; border-radius: 3px; margin-top: 1rem; overflow: hidden;">
                  <div style="width: ${repaymentRate}%; height: 100%; background: var(--color-success); transition: width 1s ease-out;"></div>
                </div>
             </div>
          </div>

          <!-- PROCESSING FEE CARD -->
          ${client.processing_fee_paid ? '' : `
          <div class="card fee-card-unpaid" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="margin: 0; font-weight: 900; font-size: 13px; color: #92400E; text-transform: uppercase; letter-spacing: 0.05em;">
                Processing Fee
              </h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 8px; color: #92400E; font-weight: 700; font-size: 13px;">
                 <span style="font-size: 18px;">⚠️</span> Not yet collected
              </div>
              <p style="margin: 0; font-size: 11px; color: #B45309; line-height: 1.4;">The processing fee (KES ${settings.processingFee || 500}) must be paid before loan approval.</p>
              <button id="collect-fee-btn" class="btn-primary" style="width: 100%; height: 44px; font-size: 13px; font-weight: 800;">Collect Processing Fee</button>
            </div>
          </div>
          `}

          <!-- DOCUMENT GALLERY -->
          <div class="card" style="padding: 1.5rem;">
            <h3 style="margin: 0 0 1.25rem; font-weight: 900; font-size: 13px; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.05em;">Uploaded Documents</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
              ${renderDocThumbnail(client.passport_photo, 'Passport')}
              ${renderDocThumbnail(client.id_front, 'ID Front')}
              ${renderDocThumbnail(client.id_back, 'ID Back')}
            </div>
            <p style="margin: 1rem 0 0; font-size: 11px; color: var(--text-muted); font-style: italic; line-height: 1.4;">Click document thumbnail to view full-size scan.</p>
          </div>

          <!-- ACTIVITY LOG -->
          <div class="card" style="padding: 1.5rem;">
            <h3 style="margin: 0 0 1.5rem; font-weight: 900; font-size: 13px; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.05em;">Timeline Activity</h3>
            <div style="display: flex; flex-direction: column; gap: 0; position: relative;">
               <div style="position: absolute; top: 0; bottom: 0; left: 6px; width: 2px; background: #F1F5F9;"></div>
               
               ${generateActivityLog(client, loans).map(log => `
                 <div style="display: flex; gap: 1rem; padding: 0.75rem 0; position: relative; z-index: 1;">
                   <div style="width: 14px; height: 14px; border-radius: 50%; background: ${log.color}; border: 3px solid white; box-shadow: 0 0 0 1px #F1F5F9; flex-shrink: 0; margin-top: 2px;"></div>
                   <div>
                     <p style="margin: 0; font-size: 12px; font-weight: 800; line-height: 1.2;">${log.message}</p>
                     <p style="margin: 0.25rem 0 0; font-size: 10px; font-weight: 700; color: #94A3B8;">${new Date(log.date).toLocaleDateString()} — ${formatTime(log.date)}</p>
                   </div>
                 </div>
               `).join('')}
            </div>
          </div>

        </div>
      </div>

      <!-- EDIT MODAL -->
      <div id="edit-modal" class="modal-overlay" style="display: none;">
         <div class="modal-content" style="max-width: 720px; overflow: visible;">
            <!-- Modal Header -->
            <div class="modal-header-premium">
               <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(18, 41, 79, 0.1); display: flex; align-items: center; justify-content: center; color: var(--color-primary);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </div>
                  <div>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #1A2332;">Edit Client Profile</h3>
                    <p style="margin: 2px 0 0; font-size: 12px; color: #64748B; font-weight: 500;">Update personal and contact information</p>
                  </div>
               </div>
               <button class="modal-close-btn-premium">&times;</button>
            </div>

            <!-- Modal Body -->
            <div style="padding: 24px 32px; max-height: 70vh; overflow-y: auto;">
               <form id="edit-form">
                  <div class="form-grid-premium">
                     <!-- Group: Basic Info -->
                     <div style="grid-column: span 2; margin-bottom: 8px;">
                        <span style="font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em;">Personal Information</span>
                     </div>
                     <div class="field-wrap-premium"><label>First Name</label><input type="text" id="edit-first_name" value="${client.first_name}" required></div>
                     <div class="field-wrap-premium"><label>Surname</label><input type="text" id="edit-surname" value="${client.surname}" required></div>
                     <div class="field-wrap-premium"><label>National ID</label><input type="text" id="edit-national_id" value="${client.national_id}" required></div>
                     <div class="field-wrap-premium"><label>Phone Number</label><input type="text" id="edit-mobile" value="${client.mobile}" required></div>
                     <div class="field-wrap-premium" style="grid-column: span 2;"><label>Residential Address</label><input type="text" id="edit-residence" value="${client.residence}" required></div>
                     
                     <div style="grid-column: span 2; margin-top: 24px; margin-bottom: 8px; border-top: 1px solid #F1F5F9; padding-top: 24px;">
                        <span style="font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em;">Referee Information</span>
                     </div>
                     <div class="field-wrap-premium"><label>Referee 1 Name</label><input type="text" id="edit-r1_name" value="${client.r1_name || ''}"></div>
                     <div class="field-wrap-premium"><label>Referee 1 Phone</label><input type="text" id="edit-r1_phone" value="${client.r1_phone || ''}"></div>
                  </div>
               </form>
            </div>

            <!-- Modal Footer -->
            <div class="modal-footer-premium">
               <button type="button" class="btn-discard-premium" id="edit-modal-discard">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  Discard
               </button>
               <button type="button" class="btn-save-premium" id="edit-modal-save">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Save Changes
               </button>
            </div>
         </div>
      </div>

      <!-- LIGHTBOX MODAL -->
      <div id="lightbox-modal" class="modal-overlay" style="display: none; background: rgba(0,0,0,0.9); z-index: 2000;">
         <div style="position: absolute; top: 2rem; right: 2rem; color: white; font-size: 42px; cursor: pointer;" onclick="document.getElementById('lightbox-modal').style.display = 'none'">&times;</div>
         <img id="lightbox-img" style="max-width: 90%; max-height: 90vh; border-radius: 4px; box-shadow: 0 0 50px rgba(0,0,0,0.5);">
      </div>

      <!-- REGISTRATION FEE MODAL -->
      <div id="reg-fee-modal" class="modal-overlay" style="display: none;">
         <div class="modal-content" style="max-width: 480px; padding: 0; overflow: hidden;">
            <div style="padding: 1.5rem 2rem; background: #991B1B; color: white; display: flex; justify-content: space-between; align-items: center;">
               <h3 style="margin: 0; font-weight: 900; font-size: 1.125rem;">Record Registration Fee</h3>
               <button type="button" class="modal-close-reg" style="background: none; border: none; font-size: 28px; color: white; cursor: pointer;">&times;</button>
            </div>
            <div style="padding: 2rem;">
               <form id="reg-fee-form">
                  <div style="display: flex; flex-direction: column; gap: 20px;">
                     <div class="field-wrap">
                        <input type="number" id="reg-fee-amount" class="field-input" placeholder=" " value="${settings.registrationFee || 500}" required>
                        <label class="field-label">Amount (KES) <span class="req">*</span></label>
                     </div>
                     <div class="field-wrap">
                        <input type="date" id="reg-fee-date" class="field-input" placeholder=" " value="${new Date().toISOString().split('T')[0]}" required>
                        <label class="field-label">Date Received <span class="req">*</span></label>
                     </div>
                  </div>
                  
                  <div style="margin-top: 2rem;">
                     <button type="submit" class="btn-primary" style="width: 100%; height: 50px; font-weight: 800; background: #991B1B; border-color: #991B1B;">
                        Complete Registration
                     </button>
                  </div>
               </form>
            </div>
         </div>
      </div>

      <!-- PROCESSING FEE MODAL -->
      <div id="fee-modal" class="modal-overlay" style="display: none;">
         <div class="modal-content" style="max-width: 480px; padding: 0; overflow: hidden;">
            <div style="padding: 1.5rem 2rem; background: #1E293B; color: white; display: flex; justify-content: space-between; align-items: center;">
               <h3 style="margin: 0; font-weight: 900; font-size: 1.125rem;">Record Processing Fee</h3>
               <button type="button" class="modal-close" style="background: none; border: none; font-size: 28px; color: white; cursor: pointer;">&times;</button>
            </div>
            <div style="padding: 2rem;">
               <form id="fee-form">
                  <div style="display: flex; flex-direction: column; gap: 20px;">
                     <div class="field-wrap">
                        <input type="number" id="fee-amount" class="field-input" placeholder=" " value="${client.processing_fee_amount || settings.processingFee || 500}" required>
                        <label class="field-label">Amount (KES) <span class="req">*</span></label>
                     </div>
                     <div class="field-wrap">
                        <input type="date" id="fee-date" class="field-input" placeholder=" " value="${new Date().toISOString().split('T')[0]}" required>
                        <label class="field-label">Date Received <span class="req">*</span></label>
                     </div>
                     <div class="field-wrap">
                        <input type="text" id="fee-officer" class="field-input" placeholder=" " value="${user?.name || ''}" disabled>
                        <label class="field-label">Received By</label>
                     </div>
                     <div class="field-wrap">
                        <textarea id="fee-notes" class="field-input" placeholder=" " style="height: 80px; resize: none;"></textarea>
                        <label class="field-label">Optional Notes</label>
                     </div>
                  </div>
                  
                  <div style="margin-top: 2rem;">
                     <button type="submit" class="btn-primary" style="width: 100%; height: 50px; font-weight: 800;">
                        Confirm Payment Received
                     </button>
                  </div>
               </form>
            </div>
         </div>
      </div>

      <style>
        .modal-overlay { 
          position: fixed; 
          top: 0; 
          left: 0; 
          right: 0; 
          bottom: 0; 
          background: rgba(15, 23, 42, 0.4); 
          backdrop-filter: blur(8px); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          z-index: 1000;
          animation: overlayFadeIn 0.3s ease-out;
        }
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal-content { 
          background: white; 
          border-radius: 20px; 
          width: 95%; 
          box-shadow: 0 25px 50px -12px rgba(18, 41, 79, 0.25); 
          animation: modalPopUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1px solid #EDF2F7;
        }
        @keyframes modalPopUp { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        /* Premium Modal Parts */
        .modal-header-premium {
          padding: 24px 32px;
          border-bottom: 1px solid #F1F5F9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-close-btn-premium {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #F8FAFC;
          border: 1px solid #E4EDF8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #64748B;
          cursor: pointer;
          transition: all 0.2s;
        }
        .modal-close-btn-premium:hover {
          background: #FEF2F2;
          color: #EF4444;
          border-color: #FEE2E2;
        }
        
        .modal-footer-premium {
          padding: 20px 32px;
          background: #F8FAFC;
          border-top: 1px solid #F1F5F9;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-radius: 0 0 20px 20px;
        }

        .form-grid-premium {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .field-wrap-premium {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field-wrap-premium label {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }
        .field-wrap-premium input {
          height: 44px;
          padding: 0 16px;
          border-radius: 10px;
          border: 1px solid #E2E8F0;
          font-size: 14px;
          font-weight: 600;
          color: #1A2332;
          transition: all 0.2s;
          background: #FFFFFF;
        }
        .field-wrap-premium input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 4px rgba(18, 41, 79, 0.08);
          outline: none;
          background: white;
        }

        .btn-discard-premium {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: white;
          border: 1px solid #E4EDF8;
          color: #64748B;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-discard-premium:hover {
          background: #F1F5F9;
          color: #1F2937;
          border-color: #CBD5E1;
        }

        .btn-save-premium {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          background: var(--color-primary);
          border: 1px solid var(--color-primary);
          color: white;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(18, 41, 79, 0.2);
        }
        .btn-save-premium:hover {
          background: #1e3a8a;
          transform: translateY(-1px);
          box-shadow: 0 6px 15px rgba(18, 41, 79, 0.25);
        }
        .btn-save-premium:active {
          transform: translateY(0);
        }
        
        .thumb-box { 
          aspect-ratio: 1; 
          border-radius: 0.75rem; 
          border: 2px solid #F1F5F9; 
          overflow: hidden; 
          cursor: pointer; 
          transition: transform 0.2s, border-color 0.2s;
          background: #F8FAFC;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
        }
        .thumb-box:hover { transform: scale(1.05); border-color: var(--color-primary); }
        .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
        .thumb-label { font-size: 8px; font-weight: 800; color: #94A3B8; text-transform: uppercase; margin-bottom: 4px; }
      </style>
    `;

    attachListeners();
  }

  function renderDocThumbnail(data, label) {
    if (!data) return `
      <div class="thumb-box" style="opacity: 0.5; cursor: default;">
        <div style="font-size: 16px;">📂</div>
        <span class="thumb-label">${label}</span>
        <span style="font-size: 8px; font-weight: 600; color: #94A3B8;">Missing</span>
      </div>
    `;

    return `
      <div class="thumb-box" onclick="document.getElementById('lightbox-img').src='${data}'; document.getElementById('lightbox-modal').style.display='flex'">
        <img src="${data}">
        <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 4px; background: rgba(255,255,255,0.9); text-align: center;">
           <span class="thumb-label" style="color: var(--color-primary);">${label}</span>
        </div>
      </div>
    `;
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function generateActivityLog(client, loans) {
    const logs = [];
    
    // Registration
    logs.push({
      date: client.createdAt,
      message: `Registered by ${client.created_by_name || 'Loan Officer'}`,
      color: '#3B82F6' // Blue
    });

    // Processing Fee
    if (client.processing_fee_paid) {
      logs.push({
        date: client.processing_fee_date,
        message: `Processing fee collected (KES ${client.processing_fee_amount?.toLocaleString()})`,
        color: '#10B981' // Green
      });
    }

    // Loans
    for (const loan of loans) {
      logs.push({
        date: loan.createdAt,
        message: `Loan application submitted (KES ${loan.amount_requested?.toLocaleString()})`,
        color: '#F59E0B' // Amber
      });

      if (loan.approved_at) {
        logs.push({
          date: loan.approved_at,
          message: `Loan approved by administrator`,
          color: '#10B981' // Green
        });
      }

      if (loan.disbursed_at) {
        logs.push({
          date: loan.disbursed_at,
          message: `Loan disbursed (Ref: ${loan.id.substring(0,6).toUpperCase()})`,
          color: '#10B981'
        });
      }

      if (loan.status === 'declined' && loan.updatedAt) {
        logs.push({
          date: loan.updatedAt,
          message: `Loan application declined`,
          color: '#EF4444' // Red
        });
      }
    }

    return logs.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function attachListeners() {
    const editBtn = container.querySelector('#edit-client-btn');
    const editModal = container.querySelector('#edit-modal');
    if (editBtn) {
      editBtn.onclick = () => { editModal.style.display = 'flex'; };
    }

    const closeModal = () => {
      if (editModal) editModal.style.display = 'none';
      const modalReg = document.getElementById('reg-fee-modal');
      if (modalReg) modalReg.style.display = 'none';
      const lightbox = document.getElementById('lightbox-modal');
      if (lightbox) lightbox.style.display = 'none';
      const feeModal = document.getElementById('fee-modal');
      if (feeModal) feeModal.style.display = 'none';
    };

    container.querySelectorAll('.modal-close, .modal-close-reg, .modal-close-btn-premium, #edit-modal-discard').forEach(btn => {
      btn.onclick = closeModal;
    });

    const editSaveBtn = container.querySelector('#edit-modal-save');
    if (editSaveBtn) {
      editSaveBtn.onclick = async (e) => {
        const editForm = container.querySelector('#edit-form');
        // Trigger generic form submit logic
        const event = new Event('submit', { cancelable: true });
        editForm.dispatchEvent(event);
      };
    }

    const editForm = container.querySelector('#edit-form');
    if (editForm) {
      editForm.onsubmit = async (e) => {
        e.preventDefault();
        const changes = {
          first_name: editForm.querySelector('#edit-first_name').value,
          surname: editForm.querySelector('#edit-surname').value,
          national_id: editForm.querySelector('#edit-national_id').value,
          mobile: editForm.querySelector('#edit-mobile').value,
          residence: editForm.querySelector('#edit-residence').value,
          r1_name: editForm.querySelector('#edit-r1_name').value,
          r1_phone: editForm.querySelector('#edit-r1_phone').value,
        };

        try {
          // Visual feedback
          const saveBtn = container.querySelector('#edit-modal-save');
          const originalText = saveBtn.innerHTML;
          saveBtn.disabled = true;
          saveBtn.innerHTML = 'Saving...';

          await db.updateClient(clientId, changes);
          showToast('Client profile updated successfully!', 'success');
          
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          showToast('Update failed: ' + err.message, 'error');
          const saveBtn = container.querySelector('#edit-modal-save');
          saveBtn.disabled = false;
          saveBtn.innerHTML = 'Save Changes';
        }
      };
    }

    // Registration Fee Modal Listeners
    const regFeeModal = container.querySelector('#reg-fee-modal');
    if (regFeeModal) {
      const regFeeForm = regFeeModal.querySelector('#reg-fee-form');
      regFeeForm.onsubmit = async (e) => {
        e.preventDefault();
        const amount = parseFloat(regFeeForm.querySelector('#reg-fee-amount').value);
        const date = regFeeForm.querySelector('#reg-fee-date').value;
        await onFeeCollected(clientId, amount, date);
        regFeeModal.style.display = 'none';
      };
    }

    // Fee Modal Listeners
    const feeModal = container.querySelector('#fee-modal');
    const collectFeeBtn = container.querySelector('#collect-fee-btn');
    const editFeeBtn = container.querySelector('#edit-fee-btn');

    if (collectFeeBtn) collectFeeBtn.onclick = () => { feeModal.style.display = 'flex'; };
    if (editFeeBtn) editFeeBtn.onclick = () => { feeModal.style.display = 'flex'; };

    if (feeModal) {
      feeModal.querySelector('.modal-close').onclick = () => { feeModal.style.display = 'none'; };
      const feeForm = feeModal.querySelector('#fee-form');
      feeForm.onsubmit = async (e) => {
        e.preventDefault();
        const amount = parseFloat(feeForm.querySelector('#fee-amount').value);
        const date = feeForm.querySelector('#fee-date').value;
        const notes = feeForm.querySelector('#fee-notes').value;
        
        try {
          await db.recordProcessingFee(clientId, amount, date, user.id);
          showToast(`Processing fee of KES ${amount.toLocaleString()} recorded.`, 'success');
          feeModal.style.display = 'none';
          await renderClientProfile(container);
        } catch (err) {
          showToast('Failed to record fee: ' + err.message, 'error');
        }
      };
    }

    // Handle initial action
    if (params.get('action') === 'fee' && feeModal) {
      feeModal.style.display = 'flex';
    }
  }

  render();
}
