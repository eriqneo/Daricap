import db from '../../db';
import { currentUser } from '../../auth';
import { formatLoanStatus, getLoanStatusBadge } from '../../utils/formatters';

export async function renderLoanDetail(container) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const appId = urlParams.get('id');

  if (!appId) {
    container.innerHTML = '<div class="card">No application ID provided.</div>';
    return;
  }

  container.innerHTML = `<div style="text-align: center; padding: 5rem;">Loading application details...</div>`;

  try {
    const loan = await db.getLoan(appId);
    if (!loan) {
      container.innerHTML = '<div class="card">Application not found.</div>';
      return;
    }

    const guarantors = await db.getGuarantor(appId);
    const collaterals = await db.getCollaterals(appId);
    const users = await db.getUsers();

    const client = loan.client || {};
    const officer = users.find(u => u.id === loan.applied_by) || {};
    const reviewer = users.find(u => u.id === loan.reviewed_by) || {};

    container.innerHTML = `
      <div style="max-width: 1100px; margin: 0 auto; animation: fadeIn 0.4s ease-out;">
        
        <!-- Premium Header -->
        <div class="page-header" style="margin-bottom: 24px; align-items: start;">
           <div>
             <h1 class="page-title">Application Review</h1>
             <p class="page-subtitle">File #${appId.substring(0,8).toUpperCase()} • Submitted ${loan.createdAt ? new Date(loan.createdAt).toLocaleDateString() : '---'}</p>
           </div>
           <div style="display: flex; gap: 8px;">
              <span class="badge ${getLoanStatusBadge(loan.status)}" style="padding: 10px 20px; font-size: 13px;">
                ${formatLoanStatus(loan.status)}
              </span>
           </div>
        </div>

        <div class="detail-responsive-grid">
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            
            <!-- Section 1: Client Summary -->
            <div class="card" style="border-radius: 20px; overflow: hidden;">
              <div style="padding: 1.5rem 2rem; background: #F8FAFC; border-bottom: 1px solid #F1F5F9; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #1A2332;">Borrower Record</h3>
                <button class="btn btn-secondary btn-sm" onclick="navigate('#/clients/${client.id}')" style="font-weight: 700; background: white; border: 1.5px solid #E2E8F0;">View Full Profile</button>
              </div>
              <div class="card-body client-header-p" style="display: flex; gap: 2rem; align-items: center; padding: 2.5rem;">
                <div style="width: 100px; height: 100px; background: #F1F5F9; border-radius: 20px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.05); flex-shrink: 0;">
                  ${client.passport_photo ? `<img src="${client.passport_photo}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="font-size: 32px;">👤</span>'}
                </div>
                <div class="client-info-grid-p" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; flex: 1;">
                  <div>
                    <p style="font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Full Legal Name</p>
                    <p style="font-weight: 800; color: #1A2332; font-size: 16px;">${client.title || ''} ${client.first_name || 'N/A'} ${client.surname || ''}</p>
                  </div>
                  <div>
                    <p style="font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">National ID</p>
                    <p style="font-weight: 800; color: #1A2332; font-size: 16px;">${client.national_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p style="font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Verified Mobile</p>
                    <p style="font-weight: 800; color: #1A2332; font-size: 16px;">${client.mobile || 'N/A'}</p>
                  </div>
                  <div>
                    <p style="font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Registration Status</p>
                    <span class="badge ${client.fee_status === 'paid' ? 'badge-success' : 'badge-danger'}" style="padding: 4px 10px; font-size: 11px;">
                      ${client.fee_status === 'paid' ? 'Registration Fee Paid' : 'Fee Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 2: Loan Details -->
            <div class="card" style="border-radius: 20px; overflow: hidden;">
              <div style="padding: 1.5rem 2rem; background: #FFF; border-bottom: 1px solid #F1F5F9;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #1A2332;">Financial Request</h3>
              </div>
              <div class="card-body" style="padding: 2rem;">
                <div class="detail-stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;">
                  <div style="background: #F0F9FF; padding: 1.5rem; border-radius: 16px; border: 1px solid #E0F2FE;">
                     <p style="font-size: 10px; font-weight: 800; color: #0369A1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Principal</p>
                     <p style="font-size: 1.5rem; font-weight: 900; color: #0C4A6E; letter-spacing: -0.02em;">KSh ${(loan.amount_requested || 0).toLocaleString()}</p>
                  </div>
                  <div style="background: #F8FAFC; padding: 1.5rem; border-radius: 16px; border: 1px solid #F1F5F9;">
                     <p style="font-size: 10px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Product</p>
                     <p style="font-size: 15px; font-weight: 800; color: #1A2332;">${loan.loan_product || 'N/A'}</p>
                  </div>
                  <div style="background: #F8FAFC; padding: 1.5rem; border-radius: 16px; border: 1px solid #F1F5F9;">
                     <p style="font-size: 10px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Term</p>
                     <p style="font-size: 15px; font-weight: 800; color: #1A2332;">${loan.repayment_weeks || 0} Weeks</p>
                  </div>
                  <div style="background: #F0FDF4; padding: 1.5rem; border-radius: 16px; border: 1px solid #DCFCE7;">
                     <p style="font-size: 10px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Installment</p>
                     <p style="font-size: 1.125rem; font-weight: 900; color: #14532D;">KSh ${(loan.weekly_installment || 0).toLocaleString()}/wk</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 3: Collateral -->
            <div class="card" style="border-radius: 20px; overflow: hidden;">
               <div style="padding: 1.5rem 2rem; border-bottom: 1px solid #F1F5F9; display: flex; justify-content: space-between; align-items: center;">
                 <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #1A2332;">Security & Collateral</h3>
                 <span class="badge badge-gray" style="font-size: 10px;">${collaterals.length} Items</span>
               </div>
               ${collaterals.length === 0 ? `
                 <div style="padding: 3rem; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">🔒</div>
                    <p style="color: #64748B; font-weight: 600;">No collateral items provided for this application.</p>
                 </div>
               ` : `
                 <div class="table-container" style="border:none; box-shadow:none;">
                   <table class="data-table">
                     <thead>
                       <tr><th>Description</th><th>Sl/No</th><th>Est. Value</th><th>Owner</th><th style="text-align: right;">Photos</th></tr>
                     </thead>
                     <tbody>
                       ${collaterals.map(c => `
                          <tr>
                            <td><div style="font-weight: 800; color: #1A2332;">${c.item_description || 'N/A'}</div></td>
                            <td><div style="font-size: 12px; font-weight: 600; color: #64748B;">${c.serial_number || '---'}</div></td>
                            <td><div style="font-weight: 900; color: #166534;">KSh ${(c.estimated_value || 0).toLocaleString()}</div></td>
                            <td><span class="badge badge-gray" style="font-size: 10px; padding: 4px 8px;">${c.owner_type || 'Self'}</span></td>
                            <td style="text-align: right;"><button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 4px 10px;">View Files</button></td>
                          </tr>
                       `).join('')}
                     </tbody>
                   </table>
                 </div>
               `}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            
            <!-- Actions Panel -->
            ${(currentUser().role === 'admin' || currentUser().role === 'staff') ? `
              <div class="card" id="admin-actions-card" style="border-radius: 20px; border: 2px solid #F1F5F9; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);">
                <div style="padding: 1.25rem 1.5rem; background: #F8FAFC; border-bottom: 1px solid #F1F5F9;">
                   <h3 style="margin: 0; font-size: 13px; font-weight: 900; color: #1E293B; text-transform: uppercase; letter-spacing: 0.05em;">Review Actions</h3>
                </div>
                <div class="card-body" style="display: flex; flex-direction: column; gap: 12px; padding: 1.5rem;">
                  ${renderActions(loan)}
                </div>
              </div>
            ` : ''}

            <!-- Section 4: Guarantor -->
            <div class="card" style="border-radius: 20px;">
              <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #F1F5F9;">
                 <h3 style="margin: 0; font-size: 13px; font-weight: 900; color: #1E293B; text-transform: uppercase; letter-spacing: 0.05em;">Legal Guarantor</h3>
              </div>
              <div class="card-body" style="padding: 1.5rem;">
                ${!guarantors ? `
                  <div style="text-align: center; padding: 1.5rem;">
                    <p style="color: #94A3B8; font-size: 13px; font-weight: 600;">No guarantor required/provided.</p>
                  </div>
                ` : `
                    <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                      <div style="width: 44px; height: 44px; border-radius: 12px; background: #F1F5F9; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #475569; font-size: 16px;">${(guarantors.full_name || 'G').substring(0,1)}</div>
                      <div style="flex: 1;">
                        <p style="font-weight: 800; font-size: 15px; margin: 0; color: #1A2332;">${guarantors.full_name}</p>
                        <p style="font-size: 11px; color: #64748B; margin-top: 2px; font-weight: 600;">ID: ${guarantors.national_id} • ${guarantors.relationship_to_borrower}</p>
                      </div>
                    </div>
                    <div style="background: #FFFBEB; padding: 1rem; border-radius: 12px; border: 1px solid #FEF3C7;">
                      <p style="font-size: 10px; font-weight: 800; color: #92400E; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Security Pledged</p>
                      <p style="font-size: 12px; color: #78350F; font-weight: 600; line-height: 1.4;">${guarantors.collateral_description || 'Personal Guarantee'}</p>
                    </div>
                `}
              </div>
            </div>

            <!-- Section 5: Metadata -->
            <div class="card" style="background: #F8FAFC; border: 1.5px dashed #E2E8F0; border-radius: 20px;">
              <div class="card-body" style="padding: 1.5rem;">
                <p style="font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Submission Audit</p>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                   <div style="width: 36px; height: 36px; border-radius: 50%; background: #1E293B; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800;">${officer.name?.substring(0,1) || 'O'}</div>
                   <div>
                     <p style="font-size: 13px; font-weight: 800; color: #1A2332;">${officer.name || officer.email || 'System'}</p>
                     <p style="font-size: 11px; color: #64748B; font-weight: 600;">Filed on ${loan.createdAt ? new Date(loan.createdAt).toLocaleString() : 'N/A'}</p>
                   </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>
        .action-btn {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          border: none;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .action-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .action-btn:active { transform: translateY(0); }
        .action-btn-secondary {
          background: white;
          border: 1.5px solid #E2E8F0;
          color: #475569;
        }
        .action-btn-secondary:hover { background: #F8FAFC; }
      </style>
    `;

    attachActionListeners(loan);

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="card" style="color: var(--color-danger); text-align: center; padding: 5rem;">Error loading detail: ${err.message}</div>`;
  }
}

function renderActions(loan) {
  if (loan.status === 'pending') {
    return `
      <button class="action-btn" id="approve-all-btn" style="background: var(--color-success);">Approve Full Amount</button>
      <button class="action-btn action-btn-secondary" id="partial-trigger-btn" style="color: var(--color-primary);">Approve Partial Amount</button>
      <button class="action-btn action-btn-secondary" id="decline-trigger-btn" style="color: var(--color-danger); background: rgba(231, 76, 60, 0.05);">Decline Application</button>
      
      <div id="partial-form" style="display: none; padding-top: 1rem; border-top: 1px solid #F1F5F9;">
        <label>Approved Amount (KES)</label>
        <input type="number" id="partial-amount" class="search-input" value="${loan.amount_requested}" style="margin-bottom: 0.5rem;">
        <button class="action-btn" id="partial-confirm-btn">Confirm Partial Approval</button>
      </div>

      <div id="decline-form" style="display: none; padding-top: 1rem; border-top: 1px solid #F1F5F9;">
        <label>Reason for decline</label>
        <textarea id="decline-reason" class="search-input" style="height: 80px; margin-bottom: 0.5rem; padding: 0.75rem;"></textarea>
        <button class="action-btn" id="decline-confirm-btn" style="background: var(--color-danger);">Confirm Decline</button>
      </div>
    `;
  }

  if (loan.status === 'approved' || loan.status === 'partially_approved') {
    return `
      <div style="text-align: center; padding-bottom: 1rem;">
        <div class="badge" style="background: rgba(39, 174, 96, 0.1); color: var(--color-success); font-size: 12px; padding: 0.5rem 1rem;">
          ${(loan.status || '').replace('_', ' ').toUpperCase()}: KSh ${(loan.approved_amount || 0).toLocaleString()}
        </div>
      </div>
      
      <button class="action-btn" id="fee-paid-btn" style="background: var(--color-info);" ${loan.processing_fee_paid ? 'disabled' : ''}>
        ${loan.processing_fee_paid ? '✓ Processing Fee Paid' : 'Mark Processing Fee Paid'}
      </button>
      
      <button class="action-btn" id="disburse-btn" style="background: var(--color-primary); ${!loan.processing_fee_paid ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${!loan.processing_fee_paid ? 'disabled' : ''}>
        Mark as Disbursed
      </button>

      <p style="font-size: 10px; color: var(--text-muted); text-align: center; margin-top: 0.5rem;">
        ${!loan.processing_fee_paid ? 'Waiting for processing fee payment before disbursement.' : 'Fees confirmed. Ready for disbursement.'}
      </p>
    `;
  }

  if (loan.status === 'disbursed') {
    return `
      <div style="text-align: center; padding: 1rem;">
        <div class="badge" style="background: #27AE60; color: white; padding: 1rem; width: 100%; border-radius: 0.5rem;">
          ✓ DISBURSED
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: 1rem;">Funds released on: ${loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString() : 'N/A'}</p>
      </div>
    `;
  }

  return `<div class="badge" style="background: #f1f1f1; color: var(--text-muted); width: 100%; text-align: center; padding: 1rem;">Finalized Status: ${loan.status}</div>`;
}

async function attachActionListeners(loan) {
  const partialTrigger = document.getElementById('partial-trigger-btn');
  const partialForm = document.getElementById('partial-form');
  const declineTrigger = document.getElementById('decline-trigger-btn');
  const declineForm = document.getElementById('decline-form');

  if (partialTrigger) {
    partialTrigger.onclick = () => {
      partialForm.style.display = 'block';
      declineForm.style.display = 'none';
    };
  }

  if (declineTrigger) {
    declineTrigger.onclick = () => {
      declineForm.style.display = 'block';
      partialForm.style.display = 'none';
    };
  }

  // Action: Approve Full
  const approveFull = document.getElementById('approve-all-btn');
  if (approveFull) {
    approveFull.onclick = async () => {
      if (!confirm('Approve full requested amount?')) return;
      try {
        const user = currentUser();
        await db.updateLoan(loan.id, {
          status: 'approved',
          approved_amount: loan.amount_requested,
          reviewed_by: user.id
        });
        window.location.reload();
      } catch (e) { alert(e.message); }
    };
  }

  // Action: Confirm Partial
  const partialConfirm = document.getElementById('partial-confirm-btn');
  if (partialConfirm) {
    partialConfirm.onclick = async () => {
      const amt = parseFloat(document.getElementById('partial-amount').value);
      if (!amt || amt <= 0) return alert('Provide valid amount');
      try {
        const user = currentUser();
        await db.updateLoan(loan.id, {
          status: 'partially_approved',
          approved_amount: amt,
          reviewed_by: user.id
        });
        window.location.reload();
      } catch (e) { alert(e.message); }
    };
  }

  // Action: Confirm Decline
  const declineConfirm = document.getElementById('decline-confirm-btn');
  if (declineConfirm) {
    declineConfirm.onclick = async () => {
      const reason = document.getElementById('decline-reason').value;
      if (!reason) return alert('Please state reason for decline');
      try {
        const user = currentUser();
        await db.updateLoan(loan.id, {
          status: 'declined',
          decline_reason: reason,
          reviewed_by: user.id
        });
        window.location.reload();
      } catch (e) { alert(e.message); }
    };
  }

  // Action: Fee Paid
  const feeBtn = document.getElementById('fee-paid-btn');
  if (feeBtn && !loan.processing_fee_paid) {
    feeBtn.onclick = async () => {
      try {
        await db.updateLoan(loan.id, {
          processing_fee_paid: true
        });
        window.location.reload();
      } catch (e) { alert(e.message); }
    };
  }

  // Action: Disburse
  const disburseBtn = document.getElementById('disburse-btn');
  if (disburseBtn && loan.processing_fee_paid && loan.status !== 'disbursed') {
    disburseBtn.onclick = async () => {
      if (!confirm('Confirm disbursement? This action is irreversible.')) return;
      try {
        await db.updateLoan(loan.id, {
          status: 'disbursed',
          disbursedAt: new Date().toISOString()
        });
        
        // Generate schedule
        await db.generateSchedule(loan.id);
        
        window.location.reload();
      } catch (e) { alert(e.message); }
    };
  }
}
