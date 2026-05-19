import db from '../../db';
import { currentUser } from '../../auth';
import { showToast } from '../../components/toast';
import { toBase64 } from '../../utils/file';
import { updatePendingBadge } from '../../utils/notifications';
import { openCamera } from '../../components/camera';

export async function renderLoanApply(container) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const initialClientId = urlParams.get('clientId');

  let step = 1;
  const totalSteps = 5;
  const state = {
    selectedClient: initialClientId ? await db.getClient(initialClientId) : null,
    product: 'Daricap Pesa',
    repaymentPeriod: 4, // weeks
    interestRate: 0.20, // 20%
    amount: 0,
    borrowerCollateral: [
      { description: '', value: 0, serial: '', documents: null }
    ],
    guarantor: {
      name: '',
      national_id: '',
      mobile: '',
      relationship: '',
      photo: null,
      collateral: [
        { description: '', value: 0, serial: '', documents: null }
      ],
      eligible: null, // null = not checked, true = eligible, false = not eligible
      eligibilityReason: '',
      checkingEligibility: false
    },
    agreementAccepted: false
  };

  const settings = await db.getSettings();
  const maxLoanAmount = settings.maxLoanAmount || 500000;

  // Helper to render photo widget
  const renderPhotoWidget = (fieldName, type = 'passport', callback) => {
    const value = fieldName.includes('.') ? getNestedValue(state, fieldName) : state[fieldName];
    const isPortrait = type === 'passport';
    
    return `
      <div class="photo-capture-widget" id="widget-${fieldName.replace(/\./g, '-')}">
        <div class="photo-preview-area" id="preview-${fieldName.replace(/\./g, '-')}" style="aspect-ratio: ${isPortrait ? '4/3' : '16/9'};">
          ${value ? `
            <img src="${value}" alt="Captured photo" />
            <button type="button" class="photo-remove-btn" onclick="window.removePhotoField('${fieldName}')">✕ Remove</button>
          ` : `
            <div class="photo-placeholder">
              <div class="photo-placeholder-icon">
                ${isPortrait ? '👤' : '📄'}
              </div>
              <span class="photo-placeholder-text">No photo yet</span>
            </div>
          `}
        </div>
        <div class="photo-capture-btns">
          <button type="button" class="btn-cam" onclick="window.triggerCamera('${fieldName}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            Take Photo
          </button>
          <button type="button" class="btn-upload" onclick="window.triggerUpload('${fieldName}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload File
          </button>
        </div>
      </div>
    `;
  };

  function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => {
      if (part.includes('[')) {
        const [name, index] = part.split(/[[]]/);
        return acc && acc[name] ? acc[name][parseInt(index)] : undefined;
      }
      return acc ? acc[part] : undefined;
    }, obj);
  }

  function render() {
    container.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto; animation: slideUp 0.4s ease-out;">
        <!-- Step Progress Bar -->
        <div class="step-bar">
          ${Array(totalSteps).fill().map((_, i) => `
            <div class="step-item ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}">
              <div class="step-num"></div>
              <div class="step-name">${['CLIENT', 'DETAILS', 'SECURITY', 'GUARANTOR', 'REVIEW'][i]}</div>
            </div>
          `).join('')}
        </div>

        <!-- Form Card -->
        <div class="form-card">
          <form id="loan-apply-form" onsubmit="return false;">
            ${renderStepContent()}

            <div class="step-nav">
              <button type="button" id="prev-btn" class="btn-back" style="visibility: ${step === 1 ? 'hidden' : 'visible'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Back
              </button>
              <button type="button" id="next-btn" class="btn-primary">
                ${step === totalSteps ? 'Submit Application' : 'Continue'}
                ${step < totalSteps ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' : ''}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>
        .search-results { 
          position: absolute; 
          top: 100%; 
          left: 0; 
          right: 0; 
          background: white; 
          border: 1px solid #D0DCF0; 
          border-radius: 12px; 
          box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
          z-index: 100; 
          max-height: 250px; 
          overflow-y: auto;
          margin-top: 8px;
        }
        .search-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #F1F5F9; transition: background 0.2s; }
        .search-item:hover { background: #FAFCFF; }
        .file-upload-box { 
          border: 2px dashed #D0DCF0; 
          border-radius: 12px; 
          padding: 1rem; 
          text-align: center; 
          cursor: pointer; 
          transition: all 0.2s;
          background: #FAFCFF;
        }
        .file-upload-box:hover { border-color: var(--color-primary); background: #F1F5F9; }
        .collateral-card { background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; padding: 24px; margin-bottom: 16px; position: relative; }
        .remove-link { position: absolute; top: 1rem; right: 1.5rem; color: #DC2626; font-size: 11px; font-weight: 700; text-decoration: none; cursor: pointer; display: flex; align-items: center; gap: 4px; }
      </style>
    `;

    attachListeners();
  }

  function renderStepContent() {
    switch (step) {
      case 1:
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label" style="margin-top: 0;">Select Client</div>
            <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 24px;">Search for an existing client to start the loan application.</p>

            ${state.selectedClient ? `
              <div style="padding: 24px; border: 2px solid ${state.selectedClient.registration_status === 'complete' ? '#1E6DC5' : '#EF4444'}; border-radius: 16px; background: ${state.selectedClient.registration_status === 'complete' ? '#FAFCFF' : '#FEF2F2'}; display: flex; gap: 24px; align-items: center; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="width: 100px; height: 100px; border-radius: 12px; background: #eee; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 3px solid white;">
                  <img src="${state.selectedClient.passport_photo || 'https://via.placeholder.com/80'}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="flex-grow: 1;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4 style="margin: 0; font-size: 20px; font-weight: 800; color: #1E293B;">${state.selectedClient.first_name} ${state.selectedClient.surname}</h4>
                    <span class="badge" style="background: ${state.selectedClient.registration_status === 'complete' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${state.selectedClient.registration_status === 'complete' ? '#059669' : '#DC2626'}">
                      ${state.selectedClient.registration_status === 'complete' ? 'Registration Complete' : 'Registration Incomplete'}
                    </span>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                    <p style="margin: 0; font-size: 13px; color: #64748B;"><b>ID:</b> ${state.selectedClient.national_id}</p>
                    <p style="margin: 0; font-size: 13px; color: #64748B;"><b>Mobile:</b> ${state.selectedClient.mobile}</p>
                    <p style="margin: 0; font-size: 13px; color: #64748B;"><b>Officer:</b> ${state.selectedClient.created_by_name || 'System'}</p>
                  </div>
                  <button type="button" id="change-client" class="btn-back" style="margin-top: 12px; padding: 0;">Change client</button>
                </div>
              </div>

              ${state.selectedClient.registration_status === 'incomplete' ? `
                <div style="margin-top: 24px; padding: 24px; background: #FEF2F2; border: 2px solid #FCA5A5; border-radius: 16px; display: flex; flex-direction: column; gap: 16px;">
                  <div style="display: flex; gap: 12px; align-items: start;">
                    <span style="font-size: 24px;">❌</span>
                    <div>
                      <p style="margin: 0; font-size: 15px; font-weight: 800; color: #991B1B;">Cannot Proceed — Registration Incomplete</p>
                      <p style="margin: 4px 0 0; font-size: 13px; color: #B91C1C; line-height: 1.5;">${state.selectedClient.first_name}'s registration is not complete. The registration fee must be collected before a loan application can be submitted.</p>
                    </div>
                  </div>
                  <button type="button" class="btn-primary" style="background: #991B1B; border-color: #991B1B; padding: 12px; font-weight: 800;" onclick="window.location.hash='#/clients/view?id=${state.selectedClient.id}'">
                    Complete Their Registration
                  </button>
                </div>
              ` : ''}
            ` : `
              <div style="position: relative;">
                <div class="field-wrap" style="margin-bottom: 0;">
                  <input type="text" id="client-search" class="field-input" placeholder=" " style="padding-left: 44px;" />
                  <label for="client-search" class="field-label" style="left: 44px;">Search name or ID number...</label>
                  <svg style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #64748B;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <div id="search-results-container" class="search-results" style="display: none;"></div>
              </div>
            `}
          </div>
        `;
      case 2: {
        const totals = calculateLoan(state.amount, state.interestRate, state.repaymentPeriod);
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label" style="margin-top: 0;">Loan Configuration</div>
            <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 24px;">Configure the loan amount and repayment structures.</p>

            <div style="margin-bottom: 24px;">
              <div class="form-section-label" style="font-size: 10px; margin-top: 0;">Loan Product</div>
              <div class="select-group" id="product-group">
                ${['Daricap Pesa', 'Daricap Okoa'].map(p => `
                  <label class="select-tile">
                    <input type="radio" name="product" value="${p}" ${state.product === p ? 'checked' : ''} hidden />
                    <span class="tile-body" style="min-width: 140px;">
                      <span class="tile-label">${p}</span>
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div style="margin-bottom: 24px;">
              <div class="form-section-label" style="font-size: 10px; margin-top: 0;">Repayment Window</div>
              <div class="select-group" id="period-group">
                <label class="select-tile">
                  <input type="radio" name="repaymentPeriod" value="2" data-rate="0.15" ${state.repaymentPeriod === 2 ? 'checked' : ''} hidden />
                  <span class="tile-body" style="flex-direction: column; min-width: 120px; padding: 14px;">
                    <span style="font-size: 15px; font-weight: 700;">2 Weeks</span>
                    <span style="font-size: 11px; opacity: 0.7;">15% Interest</span>
                  </span>
                </label>
                <label class="select-tile">
                  <input type="radio" name="repaymentPeriod" value="4" data-rate="0.20" ${state.repaymentPeriod === 4 ? 'checked' : ''} hidden />
                  <span class="tile-body" style="flex-direction: column; min-width: 120px; padding: 14px;">
                    <span style="font-size: 15px; font-weight: 700;">4 Weeks</span>
                    <span style="font-size: 11px; opacity: 0.7;">20% Interest</span>
                  </span>
                </label>
                <label class="select-tile">
                  <input type="radio" name="repaymentPeriod" value="6" data-rate="0.30" ${state.repaymentPeriod === 6 ? 'checked' : ''} hidden />
                  <span class="tile-body" style="flex-direction: column; min-width: 120px; padding: 14px;">
                    <span style="font-size: 15px; font-weight: 700;">6 Weeks</span>
                    <span style="font-size: 11px; opacity: 0.7;">30% (Max)</span>
                  </span>
                </label>
              </div>
            </div>

            <div class="field-wrap">
              <input type="number" id="loan-amount" class="field-input" placeholder=" " value="${state.amount}" style="font-weight: 800; color: #1E6DC5; font-size: 18px;" />
              <label for="loan-amount" class="field-label">Loan Amount (KES) <span class="req">*</span></label>
              <p style="font-size: 11px; color: #64748B; margin-top: 6px; font-weight: 500;">Minimum KES 1,000 | Maximum KES ${maxLoanAmount.toLocaleString()}</p>
            </div>

            <!-- Calculation Panel -->
            <div id="calc-panel" style="background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%); border-radius: 16px; border: 1.5px solid #BAE6FD; padding: 24px; box-shadow: inset 0 2px 4px rgba(30,109,197,0.02);">
              <div class="form-section-label" style="color: #0369A1; margin-top: 0;">Application Summary</div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748B; font-size: 14px; font-weight: 500;">Principle Amount</span>
                  <span style="font-weight: 700; color: #1E293B;">KES ${(state.amount || 0).toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748B; font-size: 14px; font-weight: 500;">Interest Accrued (${(state.interestRate * 100)}%)</span>
                  <span style="font-weight: 700; color: #1E293B;">KES ${totals.interest.toLocaleString()}</span>
                </div>
                <div class="field-group-divider" style="margin: 8px 0; background: #BAE6FD;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: 800; color: #0369A1; font-size: 15px;">Total Repayable</span>
                  <span style="font-weight: 900; color: #0369A1; font-size: 18px;">KES ${totals.total.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748B; font-size: 14px; font-weight: 500;">Installment Schedule</span>
                  <span style="font-weight: 700; color: #1E293B;">${state.repaymentPeriod} Weekly Payments</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; padding: 12px 16px; border-radius: 10px; border: 1px solid #BAE6FD; margin-top: 4px;">
                  <span style="font-weight: 800; color: #1E6DC5; font-size: 14px;">Each Installment</span>
                  <span style="font-weight: 900; color: #1E6DC5; font-size: 18px;">KES ${totals.installment.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      case 3:
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label" style="margin-top: 0;">Borrower's Collateral</div>
            <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 24px;">Security items offered by the borrower. These will be audited before approval.</p>

            <div id="borrower-collateral-list">
              ${state.borrowerCollateral.map((item, index) => renderCollateralItem(item, index, 'borrower')).join('')}
            </div>

            ${state.borrowerCollateral.length < 3 ? `
              <button type="button" id="add-borrower-collateral" style="width: 100%; background: #FAFCFF; border: 2.5px dashed #D0DCF0; color: #1E6DC5; padding: 16px; border-radius: 16px; font-weight: 800; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Another Item
              </button>
            ` : ''}
          </div>
        `;
      case 4:
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label" style="margin-top: 0;">Guarantor Information</div>
            <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 24px;">The guarantor co-signs the loan and provides their own security.</p>

            <div class="field-wrap" style="grid-column: span 2; margin-bottom: 8px;">
              <input type="text" id="g-id" class="field-input" placeholder=" " value="${state.guarantor.national_id}" ${state.guarantor.checkingEligibility ? 'disabled' : ''} />
              <label for="g-id" class="field-label">Guarantor National ID <span class="req">*</span></label>
              
              <div id="eligibility-status" style="margin-top: 12px;">
                ${state.guarantor.checkingEligibility ? `
                  <div style="display: flex; align-items: center; gap: 8px; color: #1E6DC5; font-size: 13px; font-weight: 600;">
                    <span class="spinner-small"></span> Checking eligibility...
                  </div>
                ` : ''}
                ${state.guarantor.eligible === false ? `
                  <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; color: #991B1B; padding: 16px; border-radius: 12px; font-size: 13px; font-weight: 600; display: flex; align-items: start; gap: 10px; animation: slideIn 0.3s ease;">
                    <span style="font-size: 18px;">⚠️</span>
                    <div>
                      <div style="font-weight: 800; margin-bottom: 2px;">Not Eligible</div>
                      <div style="font-weight: 500; opacity: 0.9;">${state.guarantor.eligibilityReason}</div>
                    </div>
                  </div>
                ` : ''}
                ${state.guarantor.eligible === true ? `
                  <div style="background: #ECFDF5; border: 1.5px solid #6EE7B7; color: #065F46; padding: 14px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 10px; animation: slideIn 0.3s ease;">
                    <span style="font-size: 18px;">✓</span> Eligible to act as guarantor
                  </div>
                ` : ''}
              </div>

              ${state.guarantor.national_id.length >= 6 && !state.guarantor.eligible && !state.guarantor.checkingEligibility ? `
                <button type="button" id="check-g-eligibility" class="btn-primary" style="margin-top: 12px; height: 40px; font-size: 13px; background: #1E293B; border: none; padding: 0 20px;">
                  Check Eligibility
                </button>
              ` : ''}
            </div>

            ${state.guarantor.eligible ? `
              <div class="grid-responsive-2" style="grid-column: span 2; animation: fadeIn 0.4s ease;">
                <div class="field-wrap">
                  <input type="text" id="g-name" class="field-input" placeholder=" " value="${state.guarantor.name}" />
                  <label for="g-name" class="field-label">Full Name <span class="req">*</span></label>
                </div>
                <div class="field-wrap">
                  <input type="tel" id="g-mobile" class="field-input" placeholder=" " value="${state.guarantor.mobile}" />
                  <label for="g-mobile" class="field-label">Mobile Number <span class="req">*</span></label>
                </div>
                <div class="field-wrap" style="grid-column: span 1;">
                  <select id="g-rel" class="field-input" style="padding-top: 20px;">
                    <option value="">Select...</option>
                    <option value="Spouse" ${state.guarantor.relationship === 'Spouse' ? 'selected' : ''}>Spouse</option>
                    <option value="Sibling" ${state.guarantor.relationship === 'Sibling' ? 'selected' : ''}>Sibling</option>
                    <option value="Parent" ${state.guarantor.relationship === 'Parent' ? 'selected' : ''}>Parent</option>
                    <option value="Friend" ${state.guarantor.relationship === 'Friend' ? 'selected' : ''}>Friend</option>
                    <option value="Colleague" ${state.guarantor.relationship === 'Colleague' ? 'selected' : ''}>Colleague</option>
                    <option value="Other" ${state.guarantor.relationship === 'Other' ? 'selected' : ''}>Other</option>
                  </select>
                  <label for="g-rel" class="field-label">Relationship <span class="req">*</span></label>
                </div>
                
                <div style="grid-column: 1 / -1;">
                  <div class="form-section-label" style="font-size: 10px; margin-top: 0;">Guarantor Photo</div>
                  ${renderPhotoWidget('guarantor.photo', 'passport')}
                </div>
              </div>
            ` : ''}

            <div class="field-group-divider"></div>

            <div>
              <div class="form-section-label">Guarantor's Collateral</div>
              <div id="guarantor-collateral-list">
                ${state.guarantor.collateral.map((item, index) => renderCollateralItem(item, index, 'guarantor')).join('')}
              </div>
              ${state.guarantor.collateral.length < 3 ? `
                <button type="button" id="add-guarantor-collateral" style="width: 100%; background: #FAFCFF; border: 2.5px dashed #D0DCF0; color: #1E6DC5; padding: 16px; border-radius: 16px; font-weight: 800; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Another Guarantor Item
                </button>
              ` : ''}
            </div>
          </div>
        `;
      case 5: {
        const t = calculateLoan(state.amount, state.interestRate, state.repaymentPeriod);
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label" style="margin-top: 0;">Review & Submit</div>
            <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 24px;">Please review all information before submitting the loan for approval.</p>

            <!-- Client Section -->
            <div style="padding: 20px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 20px;">
                <div style="width: 64px; height: 64px; border-radius: 10px; overflow: hidden; border: 2px solid #F1F5F9;">
                   <img src="${state.selectedClient.passport_photo}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div>
                   <p style="margin: 0; font-size: 16px; font-weight: 800; color: #1E293B;">${state.selectedClient.first_name} ${state.selectedClient.surname}</p>
                   <p style="margin: 4px 0 0; font-size: 12px; color: #64748B;">Client ID: ${state.selectedClient.national_id} | Mobile: ${state.selectedClient.mobile}</p>
                </div>
                <div style="margin-left: auto;">
                   <span class="badge" style="background: #ECFDF5; color: #059669;">Verified Client</span>
                </div>
            </div>

            <!-- Loan Details Section -->
            <div style="padding: 24px; background: #FAFCFF; border: 1.5px solid #D0DCF0; border-radius: 16px; margin-bottom: 16px;">
              <div class="form-section-label" style="margin-top: 0;">Loan Structure</div>
              <div class="grid-responsive-2" style="gap: 20px;">
                <div><p style="margin: 0; font-size: 10px; color: #64748B; font-weight: 800; text-transform: uppercase;">Product</p><p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #1E293B;">${state.product}</p></div>
                <div><p style="margin: 0; font-size: 10px; color: #64748B; font-weight: 800; text-transform: uppercase;">Amount</p><p style="margin: 4px 0 0; font-size: 18px; font-weight: 800; color: #1E6DC5;">KES ${state.amount.toLocaleString()}</p></div>
                <div><p style="margin: 0; font-size: 10px; color: #64748B; font-weight: 800; text-transform: uppercase;">Interest Ret (${state.interestRate * 100}%)</p><p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #1E293B;">KES ${t.interest.toLocaleString()}</p></div>
                <div><p style="margin: 0; font-size: 10px; color: #64748B; font-weight: 800; text-transform: uppercase;">Total Repayable</p><p style="margin: 4px 0 0; font-size: 18px; font-weight: 800; color: #1E6DC5;">KES ${t.total.toLocaleString()}</p></div>
                <div style="grid-column: 1 / -1;"><p style="margin: 0; font-size: 10px; color: #64748B; font-weight: 800; text-transform: uppercase;">Installment Schedule</p><p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #1E293B;">${state.repaymentPeriod} Weekly × KES ${t.installment.toLocaleString()}</p></div>
              </div>
            </div>

            <!-- Security Section -->
            <div style="padding: 24px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; margin-bottom: 24px;">
              <div class="form-section-label" style="margin-top: 0;">Verified Security</div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${state.borrowerCollateral.map(c => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: #FAFCFF; border-radius: 12px; border: 1px solid #E2E8F0;">
                    <div>
                      <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1E293B;">${c.description}</p>
                      <p style="margin: 2px 0 0; font-size: 12px; color: #64748B;">Serial: ${c.serial || 'N/A'}</p>
                    </div>
                    <p style="margin: 0; font-size: 15px; font-weight: 800; color: #059669;">KES ${c.value.toLocaleString()}</p>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="display: flex; align-items: start; gap: 1rem; padding: 24px; background: #F8FAFC; border-radius: 16px; border: 2px solid #1E6DC5; box-shadow: 0 4px 14px rgba(30,109,197,0.08);">
              <div style="position: relative; width: 22px; height: 22px; flex-shrink: 0; margin-top: 2px;">
                <input type="checkbox" id="agreement-check" style="width: 22px; height: 22px; cursor: pointer; opacity: 0; position: absolute; z-index: 2;">
                <div class="check-ui" style="width: 22px; height: 22px; border: 2px solid #D0DCF0; border-radius: 6px; position: absolute; top: 0; left: 0; z-index: 1; transition: all 0.2s; background: white;"></div>
              </div>
              <label for="agreement-check" style="margin: 0; font-size: 14px; font-weight: 700; cursor: pointer; color: #1E293B; line-height: 1.4;">I confirm that all information provided is accurate and all security items have been physically verified by the reporting officer.</label>
            </div>
          </div>
          
          <style>
            input[type="checkbox"]:checked + .check-ui {
              background: #1E6DC5 !important;
              border-color: #1E6DC5 !important;
            }
            input[type="checkbox"]:checked + .check-ui::after {
              content: '✓';
              color: white;
              font-size: 14px;
              font-weight: 900;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
            }
          </style>
        `;
      }
    }
  }

  function renderCollateralItem(item, index, type) {
    return `
      <div class="collateral-card">
        ${index > 0 ? `<a class="remove-link" id="remove-${type}-${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          Remove Item
        </a>` : ''}
        <div class="grid-responsive-2" style="gap: 16px; margin-bottom: 20px;">
          <div class="field-wrap" style="margin-bottom: 0;">
            <input type="text" class="field-input coll-desc" data-type="${type}" data-idx="${index}" placeholder=" " value="${item.description}">
            <label class="field-label">Item Description <span class="req">*</span></label>
          </div>
          <div class="field-wrap" style="margin-bottom: 0;">
            <input type="number" class="field-input coll-val" data-type="${type}" data-idx="${index}" placeholder=" " value="${item.value}">
            <label class="field-label">Est. Value (KES) <span class="req">*</span></label>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 16px;">
          <div class="field-wrap" style="margin-bottom: 0;">
            <input type="text" class="field-input coll-serial" data-type="${type}" data-idx="${index}" placeholder=" " value="${item.serial}">
            <label class="field-label">Serial / Reg Number</label>
          </div>
          
          <div style="margin-top: 1rem;">
            <div class="form-section-label" style="font-size: 10px; margin-top: 0;">Security Document / Photo</div>
            ${type === 'borrower' 
              ? renderPhotoWidget(`borrowerCollateral[${index}].documents`, 'document')
              : renderPhotoWidget(`guarantor.collateral[${index}].documents`, 'document')
            }
          </div>
        </div>
      </div>
    `;
  }

  function attachListeners() {
    // Standard Photo Handlers attached to window for onclick
    window.triggerCamera = (fieldName) => {
      openCamera((base64) => {
        setNestedValue(state, fieldName, base64);
        render();
      });
    };

    window.triggerUpload = (fieldName) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          setNestedValue(state, fieldName, ev.target.result);
          render();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };

    window.removePhotoField = (fieldName) => {
      setNestedValue(state, fieldName, null);
      render();
    };

    function setNestedValue(obj, path, value) {
      if (!obj) return;
      const parts = path.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        let part = parts[i];
        if (part.includes('[')) {
          const [name, indexStr] = part.split(/[[]]/);
          const index = parseInt(indexStr);
          if (!current[name]) current[name] = [];
          if (!current[name][index]) current[name][index] = {};
          current = current[name][index];
        } else {
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      }
      
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('[')) {
        const [name, indexStr] = lastPart.split(/[[]]/);
        const index = parseInt(indexStr);
        if (!current[name]) current[name] = [];
        current[name][index] = value;
      } else {
        if (current) {
          current[lastPart] = value;
        }
      }
    }

    const form = document.getElementById('loan-apply-form');
    if (!form) return;

    // Search Client logic
    const searchInput = document.getElementById('client-search');
    const resultsContainer = document.getElementById('search-results-container');
    if (searchInput) {
      let debounceTimer;
      searchInput.oninput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const query = searchInput.value.trim();
          if (query.length < 2) { resultsContainer.style.display = 'none'; return; }
          const results = await db.getClients({ search: query });
          if (results.length > 0) {
            resultsContainer.innerHTML = results.map(c => `
              <div class="search-item" data-id="${c.id}">
                <div style="font-weight: 700; font-size: 14px;">${c.first_name} ${c.surname}</div>
                <div style="font-size: 11px; opacity: 0.7;">ID: ${c.national_id} | Mobile: ${c.mobile}</div>
              </div>
            `).join('');
            resultsContainer.style.display = 'block';
            resultsContainer.querySelectorAll('.search-item').forEach(item => {
              item.onclick = async () => {
                const id = item.dataset.id;
                state.selectedClient = await db.getClient(id);
                render();
              };
            });
          } else {
            resultsContainer.innerHTML = `<div style="padding: 12px; text-align: center; color: #64748B; font-size: 12px;">No clients found</div>`;
            resultsContainer.style.display = 'block';
          }
        }, 300);
      };
    }

    const changeClient = document.getElementById('change-client');
    if (changeClient) {
      changeClient.onclick = () => {
        state.selectedClient = null;
        render();
      };
    }

    // Step 2 Loan Details listeners
    const amountInput = document.getElementById('loan-amount');
    if (amountInput) {
      amountInput.oninput = () => {
        state.amount = parseInt(amountInput.value) || 0;
        updateCalcPanel();
      };
    }

    // Radio groups
    form.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.onchange = (e) => {
        if (e.target.name === 'product') {
          state.product = e.target.value;
        } else if (e.target.name === 'repaymentPeriod') {
          state.repaymentPeriod = parseInt(e.target.value);
          state.interestRate = parseFloat(e.target.dataset.rate);
        }
        updateCalcPanel();
      };
    });

    // Dynamic Collateral listeners
    form.querySelectorAll('.coll-desc, .coll-val, .coll-serial').forEach(el => {
      el.oninput = (e) => {
        const type = e.target.dataset.type;
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.classList.contains('coll-desc') ? 'description' : 
                      e.target.classList.contains('coll-val') ? 'value' : 'serial';
        
        if (type === 'borrower') {
          state.borrowerCollateral[idx][field] = field === 'value' ? (parseInt(e.target.value) || 0) : e.target.value;
        } else {
          state.guarantor.collateral[idx][field] = field === 'value' ? (parseInt(e.target.value) || 0) : e.target.value;
        }
      };
    });

    // Remove buttons
    form.querySelectorAll('.remove-link').forEach(link => {
      link.onclick = (e) => {
        const parts = link.id.split('-');
        const [_, type, idx] = parts;
        if (type === 'borrower') state.borrowerCollateral.splice(idx, 1);
        else state.guarantor.collateral.splice(idx, 1);
        render();
      };
    });

    // Add buttons
    const addB = document.getElementById('add-borrower-collateral');
    if (addB) addB.onclick = () => {
      state.borrowerCollateral.push({ description: '', value: 0, serial: '', documents: null });
      render();
    };
    const addG = document.getElementById('add-guarantor-collateral');
    if (addG) addG.onclick = () => {
      state.guarantor.collateral.push({ description: '', value: 0, serial: '', documents: null });
      render();
    };

    // Step-specific Button Visibility
    const nextBtn = document.getElementById('next-btn');
    if (step === 1 && state.selectedClient && state.selectedClient.registration_status !== 'complete') {
        nextBtn.style.display = 'none';
    } else {
        nextBtn.style.display = 'flex';
    }

    if (step === 4 && !state.guarantor.eligible) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
    } else {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
    }

    // Nav
    document.getElementById('prev-btn').onclick = () => {
      step--;
      render();
    };

    document.getElementById('next-btn').onclick = async () => {
      if (validate()) {
        if (step < totalSteps) {
          step++;
          render();
        } else {
          handleSubmit();
        }
      }
    };

    // Guarantor Fields
    ['g-id'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.oninput = (e) => {
          state.guarantor.national_id = e.target.value;
          state.guarantor.eligible = null;
          state.guarantor.eligibilityReason = '';
          // We don't render on every keystroke here to avoid focus loss, 
          // let the button or tab-out trigger it or use a separate status div
          const statusDiv = document.getElementById('eligibility-status');
          const checkBtn = document.getElementById('check-g-eligibility');
          if (state.guarantor.national_id.length >= 6) {
             if (checkBtn) checkBtn.style.display = 'block';
          } else {
             if (checkBtn) checkBtn.style.display = 'none';
          }
          if (statusDiv) statusDiv.innerHTML = '';
        };
      }
    });

    const checkEligibilityBtn = document.getElementById('check-g-eligibility');
    if (checkEligibilityBtn) {
      checkEligibilityBtn.onclick = async () => {
        if (!state.guarantor.national_id) return;
        state.guarantor.checkingEligibility = true;
        render();
        
        try {
          const res = await db.checkGuarantorEligibility(state.guarantor.national_id);
          state.guarantor.eligible = res.eligible;
          state.guarantor.eligibilityReason = res.reason;
        } catch (err) {
          showToast('Error checking eligibility', 'error');
        } finally {
          state.guarantor.checkingEligibility = false;
          render();
        }
      };
    }

    if (state.guarantor.eligible) {
      ['g-name', 'g-mobile', 'g-rel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.oninput = (e) => {
            const field = id === 'g-name' ? 'name' : id === 'g-mobile' ? 'mobile' : 'relationship';
            state.guarantor[field] = e.target.value;
          };
        }
      });
    }
  }

  function updateCalcPanel() {
    const totals = calculateLoan(state.amount, state.interestRate, state.repaymentPeriod);
    const panel = document.getElementById('calc-panel');
    if (!panel) return;
    
    panel.innerHTML = `
      <div class="form-section-label" style="color: #0369A1; margin-top: 0;">Application Summary</div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #64748B; font-size: 14px; font-weight: 500;">Principle Amount</span>
          <span style="font-weight: 700; color: #1E293B;">KES ${(state.amount || 0).toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #64748B; font-size: 14px; font-weight: 500;">Interest Accrued (${(state.interestRate * 100)}%)</span>
          <span style="font-weight: 700; color: #1E293B;">KES ${totals.interest.toLocaleString()}</span>
        </div>
        <div class="field-group-divider" style="margin: 8px 0; background: #BAE6FD;"></div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; color: #0369A1; font-size: 15px;">Total Repayable</span>
          <span style="font-weight: 900; color: #0369A1; font-size: 18px;">KES ${totals.total.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #64748B; font-size: 14px; font-weight: 500;">Installment Schedule</span>
          <span style="font-weight: 700; color: #1E293B;">${state.repaymentPeriod} Weekly Payments</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; padding: 12px 16px; border-radius: 10px; border: 1px solid #BAE6FD; margin-top: 4px;">
          <span style="font-weight: 800; color: #1E6DC5; font-size: 14px;">Each Installment</span>
          <span style="font-weight: 900; color: #1E6DC5; font-size: 18px;">KES ${totals.installment.toLocaleString()}</span>
        </div>
      </div>
    `;
  }

  function validate() {
    clearErrors();
    let valid = true;

    if (step === 1) {
      if (!state.selectedClient) {
        alert("Please select a client to continue.");
        return false;
      }
      if (state.selectedClient.registration_status !== 'complete') {
        alert("This client's registration is incomplete. Please resolve the registration fee first.");
        return false;
      }
    }

    if (step === 2) {
      if (!state.amount || state.amount < 1000) {
        showError('loan-amount', "Minimum loan amount is KES 1,000");
        valid = false;
      }
      if (state.amount > maxLoanAmount) {
        showError('loan-amount', `Maximum limit for first loan is KES ${maxLoanAmount.toLocaleString()}`);
        valid = false;
      }
    }

    if (step === 3) {
      state.borrowerCollateral.forEach((item, idx) => {
        if (!item.description || !item.value) {
          valid = false;
        }
      });
      if (!valid) alert("Please complete all security item details.");
    }

    if (step === 4) {
      const g = state.guarantor;
      if (!g.name) { showError('g-name', "Required"); valid = false; }
      if (!g.national_id) { showError('g-id', "Required"); valid = false; }
      if (!g.mobile) { showError('g-mobile', "Required"); valid = false; }
      if (!g.relationship) { showError('g-rel', "Required"); valid = false; }
      if (!g.photo) { valid = false; }
      
      g.collateral.forEach((item) => {
        if (!item.description || !item.value) { valid = false; }
      });
      if (!valid) alert("Please complete guarantor details and security.");
    }

    if (step === 5) {
      const check = document.getElementById('agreement-check');
      if (!check || !check.checked) {
        alert("You must confirm that all information is accurate.");
        valid = false;
      }
    }

    return valid;
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    const wrap = el.closest('.field-wrap');
    if (wrap) {
      wrap.classList.add('has-error');
      const err = document.createElement('div');
      err.className = 'field-error-msg';
      err.textContent = msg;
      wrap.appendChild(err);
    }
  }

  function clearErrors() {
    container.querySelectorAll('.field-wrap').forEach(w => {
      w.classList.remove('has-error');
      const err = w.querySelector('.field-error-msg');
      if (err) err.remove();
    });
  }

  async function handleSubmit() {
    const nextBtn = document.getElementById('next-btn');
    nextBtn.disabled = true;
    nextBtn.textContent = 'Submitting...';

    const t = calculateLoan(state.amount, state.interestRate, state.repaymentPeriod);
    const user = currentUser();
    
    try {
      // 1. Save Loan
      const loanData = {
        clientId: state.selectedClient.id,
        loan_product: state.product,
        amount_requested: state.amount,
        repayment_weeks: state.repaymentPeriod,
        interest_rate: state.interestRate,
        total_repayable: t.total,
        installment_amount: t.installment,
        applied_by: user.id,
        applied_at: new Date().toISOString()
      };

      // Validate product
      const VALID_PRODUCTS = ['Daricap Pesa', 'Daricap Okoa'];
      if (!VALID_PRODUCTS.includes(loanData.loan_product)) {
        throw new Error(`Please select a valid loan product (Daricap Pesa or Daricap Okoa). Selected: "${loanData.loan_product || 'none'}"`);
      }

      const loan = await db.saveLoan(loanData);

      // 2. Save Collaterals
      for (const c of state.borrowerCollateral) {
        await db.saveCollateral({ ...c, loanId: loan.id, ownerType: 'borrower' });
      }
      for (const c of state.guarantor.collateral) {
        await db.saveCollateral({ ...c, loanId: loan.id, ownerType: 'guarantor' });
      }

      // 3. Save Guarantor
      await db.saveGuarantor({ ...state.guarantor, loanId: loan.id, collateral: undefined });

      // 4. Notification for admin
      const allUsers = await db.getUsers();
      const admins = allUsers.filter(u => u.role === 'admin');
      for (const admin of admins) {
        await db.addNotification(
          admin.id, 
          `New loan application from ${user.name} for ${state.selectedClient.first_name} — KES ${state.amount.toLocaleString()}`, 
          loan.id
        );
      }

      // Success
      showToast('Application submitted successfully!');
      updatePendingBadge();
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem; animation: zoomIn 0.5s ease;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: #27AE60; color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 1.5rem; box-shadow: 0 10px 20px rgba(39, 174, 96, 0.2);">✓</div>
          <h2 style="font-weight: 800; color: var(--color-primary);">Application submitted for review</h2>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">The application is now pending admin approval.</p>
        </div>
      `;

      setTimeout(() => {
        window.location.hash = '#/loans';
      }, 2000);

    } catch (err) {
      showToast(err.message || 'Error submitting application', 'error');
      console.error('Submission error:', err);
      nextBtn.disabled = false;
      nextBtn.textContent = 'Submit Application';
    }
  }

  function calculateLoan(amount, rate, weeks) {
    const amt = parseFloat(amount) || 0;
    const interest = amt * rate;
    const total = amt + interest;
    const installment = weeks > 0 ? total / weeks : 0;
    return { interest, total, installment };
  }

  render();
}
