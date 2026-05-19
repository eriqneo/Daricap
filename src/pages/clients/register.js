import db from '../../db';
import { currentUser } from '../../auth';
import { toBase64 } from '../../utils/file';
import { openCamera } from '../../components/camera';

export async function renderClientRegister(container) {
  let step = 1;
  const totalSteps = 4;
  const state = {
    title: '',
    first_name: '',
    middle_name: '',
    surname: '',
    gender: '',
    national_id: '',
    kra_pin: '',
    residence: '',
    mobile: '',
    alt_mobile: '',
    passport_photo: null,
    id_front: null,
    id_back: null,
    r1_name: '',
    r1_rel: '',
    r1_phone: '',
    r2_name: '',
    r2_rel: '',
    r2_phone: '',
    fee_paid: false,
    fee_date: new Date().toISOString().split('T')[0],
    notes: ''
  };

  const settings = await db.getSettings();
  const regFee = settings.registrationFee || 150;

  // Helper to render photo widget
  const renderPhotoWidget = (fieldName, type = 'passport') => {
    const value = state[fieldName];
    const isPortrait = type === 'passport';
    
    return `
      <div class="photo-capture-widget" id="widget-${fieldName}">
        <div class="photo-preview-area" id="preview-${fieldName}" style="aspect-ratio: ${isPortrait ? '4/3' : '16/9'};">
          ${value ? `
            <img src="${value}" alt="Captured photo" />
            <button type="button" class="photo-remove-btn" onclick="window.removePhotoField('${fieldName}')">✕ Remove</button>
          ` : `
            <div class="photo-placeholder">
              <div class="photo-placeholder-icon">
                ${isPortrait ? '👤' : '🪪'}
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

  function render() {
    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; animation: slideUp 0.4s ease-out;">
        <!-- Step Progress Bar -->
        <div class="step-bar">
          ${Array(totalSteps).fill().map((_, i) => `
            <div class="step-item ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}">
              <div class="step-num"></div>
              <div class="step-name">${['PERSONAL', 'MEDIA', 'REFEREES', 'FEE'][i]}</div>
            </div>
          `).join('')}
        </div>

        <!-- Form Card -->
        <div class="form-card">
          <form id="register-form" onsubmit="return false;">
            ${renderStepContent()}

            <div class="step-nav">
              <button type="button" id="prev-btn" class="btn-back" style="visibility: ${step === 1 ? 'hidden' : 'visible'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Back
              </button>
              <button type="button" id="next-btn" class="btn-primary">
                ${step === totalSteps ? 'Complete Registration' : 'Continue'}
                ${step < totalSteps ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' : ''}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>
        .file-box { 
          border: 2px dashed #D0DCF0; 
          border-radius: 12px; 
          padding: 2rem; 
          text-align: center; 
          cursor: pointer; 
          transition: all 0.2s;
          background: #FAFCFF;
        }
        .file-box:hover { border-color: var(--color-primary); background: #F1F5F9; }
        .preview-img { width: 100px; height: 100px; border-radius: 12px; object-fit: cover; border: 3px solid white; box-shadow: var(--shadow-md); margin-bottom: 1rem; }
      </style>
    `;

    attachListeners();
  }

  function renderStepContent() {
    switch (step) {
      case 1:
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label">Identity & Title</div>
            
            <div style="margin-bottom: 32px;">
              <div class="select-group" id="title-group" style="display: flex; flex-wrap: wrap; gap: 12px;">
                ${['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'].map(t => `
                  <label class="select-tile" style="flex: 1; min-width: 80px;">
                    <input type="radio" name="title" value="${t}" ${state.title === t ? 'checked' : ''} hidden />
                    <span class="tile-body" style="padding: 16px;">
                      <span class="tile-label" style="font-size: 15px; font-weight: 700;">${t}.</span>
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="grid-responsive-3" style="margin-bottom: 8px;">
              <div class="field-wrap">
                <input type="text" id="first_name" class="field-input" placeholder=" " value="${state.first_name}" />
                <label class="field-label">First Name <span class="req">*</span></label>
              </div>
              <div class="field-wrap">
                <input type="text" id="middle_name" class="field-input" placeholder=" " value="${state.middle_name}" />
                <label class="field-label">Middle Name</label>
              </div>
              <div class="field-wrap">
                <input type="text" id="surname" class="field-input" placeholder=" " value="${state.surname}" />
                <label class="field-label">Surname <span class="req">*</span></label>
              </div>
            </div>

            <div class="field-group-divider" style="margin: 24px 0;"></div>
            <div class="form-section-label">Personal Background</div>

            <div class="grid-responsive-2" style="margin-bottom: 24px; align-items: start;">
              <div class="select-group" id="gender-group" style="display: flex; gap: 12px;">
                <label class="select-tile" style="flex: 1;">
                  <input type="radio" name="gender" value="Male" ${state.gender === 'Male' ? 'checked' : ''} hidden />
                  <span class="tile-body" style="padding: 16px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; opacity: 0.7;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span class="tile-label">Male</span>
                  </span>
                </label>
                <label class="select-tile" style="flex: 1;">
                  <input type="radio" name="gender" value="Female" ${state.gender === 'Female' ? 'checked' : ''} hidden />
                  <span class="tile-body" style="padding: 16px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; opacity: 0.7;"><path d="M16 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/><path d="M12 15H6a4 4 0 0 0-4 4v2"/></svg>
                    <span class="tile-label">Female</span>
                  </span>
                </label>
              </div>
              <div class="field-wrap" style="margin-bottom: 0;">
                <input type="text" id="national_id" class="field-input" placeholder=" " value="${state.national_id}" />
                <label class="field-label">National ID Number <span class="req">*</span></label>
              </div>
            </div>

            <div class="grid-responsive-2" style="margin-bottom: 20px;">
              <div class="field-wrap">
                <input type="text" id="kra_pin" class="field-input" placeholder=" " value="${state.kra_pin}" />
                <label class="field-label">KRA PIN (Optional)</label>
              </div>
              <div class="field-wrap">
                <input type="text" id="residence" class="field-input" placeholder=" " value="${state.residence}" />
                <label class="field-label">Exact Physical Residence <span class="req">*</span></label>
              </div>
            </div>

            <div class="grid-responsive-2">
              <div class="field-wrap">
                <input type="tel" id="mobile" class="field-input" placeholder=" " value="${state.mobile}" />
                <label class="field-label">Mobile Number <span class="req">*</span></label>
              </div>
              <div class="field-wrap">
                <input type="tel" id="alt_mobile" class="field-input" placeholder=" " value="${state.alt_mobile}" />
                <label class="field-label">Alternative Contact</label>
              </div>
            </div>
          </div>
        `;
      case 2:
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label">Identity Verification</div>
            <p style="font-size: 13px; color: var(--text-muted); font-weight: 500; margin-bottom: 24px;">Clear photos ensure faster loan approvals. High resolution preferred.</p>
            
            <div class="photo-capture-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
              <div>
                <h5 style="font-size: 14px; font-weight: 800; color: #1E293B; margin-bottom: 12px;">Passport Photo <span class="req">*</span></h5>
                ${renderPhotoWidget('passport_photo', 'passport')}
              </div>
              <div>
                <h5 style="font-size: 14px; font-weight: 800; color: #1E293B; margin-bottom: 12px;">ID Front</h5>
                ${renderPhotoWidget('id_front', 'document')}
              </div>
            </div>

            <div>
              <h5 style="font-size: 14px; font-weight: 800; color: #1E293B; margin-bottom: 12px;">ID Back Side</h5>
              ${renderPhotoWidget('id_back', 'document')}
            </div>
          </div>
        `;
      case 3:
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label">Accountability Referees</div>
            <p style="font-size: 13px; color: var(--text-muted); font-weight: 500; margin-bottom: 24px;">Two referees are required for community vetting.</p>
            
            <div style="padding: 24px; background: #F8FAFC; border-radius: 16px; border: 1px solid #E2E8F0; margin-bottom: 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #0369A1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <span style="width: 20px; height: 2px; background: #0369A1;"></span> Referee #1
              </div>
              <div class="grid-responsive-3" style="gap: 16px;">
                <div class="field-wrap">
                  <input type="text" id="r1_name" class="field-input" placeholder=" " value="${state.r1_name}" />
                  <label class="field-label">Full Name</label>
                </div>
                <div class="field-wrap">
                  <input type="text" id="r1_rel" class="field-input" placeholder=" " value="${state.r1_rel}" />
                  <label class="field-label">Relationship</label>
                </div>
                <div class="field-wrap">
                  <input type="tel" id="r1_phone" class="field-input" placeholder=" " value="${state.r1_phone}" />
                  <label class="field-label">Phone Number</label>
                </div>
              </div>
            </div>

            <div style="padding: 24px; background: #F8FAFC; border-radius: 16px; border: 1px solid #E2E8F0;">
              <div style="font-size: 11px; font-weight: 800; color: #0369A1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <span style="width: 20px; height: 2px; background: #0369A1;"></span> Referee #2
              </div>
              <div class="grid-responsive-3" style="gap: 16px;">
                <div class="field-wrap">
                  <input type="text" id="r2_name" class="field-input" placeholder=" " value="${state.r2_name}" />
                  <label class="field-label">Full Name</label>
                </div>
                <div class="field-wrap">
                  <input type="text" id="r2_rel" class="field-input" placeholder=" " value="${state.r2_rel}" />
                  <label class="field-label">Relationship</label>
                </div>
                <div class="field-wrap">
                  <input type="tel" id="r2_phone" class="field-input" placeholder=" " value="${state.r2_phone}" />
                  <label class="field-label">Phone Number</label>
                </div>
              </div>
            </div>
          </div>
        `;
      case 4:
        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="form-section-label">Fee Settlement</div>

            <div style="background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%); border: 1.5px solid #BAE6FD; padding: 2.5rem; border-radius: 20px; text-align: center; margin-bottom: 32px; box-shadow: 0 10px 25px -5px rgba(3, 105, 161, 0.1);">
              <p style="font-size: 12px; font-weight: 800; color: #0369A1; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">New Registration Fee</p>
              <h2 style="font-size: 3.5rem; font-weight: 900; color: #075985; margin: 0; letter-spacing: -0.04em;">KES ${regFee.toLocaleString()}</h2>
            </div>
            
            <div style="margin-bottom: 32px; padding: 24px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px;">
                <div class="premium-checkbox">
                  <input type="checkbox" id="fee_paid" ${state.fee_paid ? 'checked' : ''}>
                  <div class="check-box"></div>
                </div>
                <div>
                  <label for="fee_paid" style="font-weight: 800; font-size: 15px; display: block; color: #1E293B; cursor: pointer;">Payment Received Upfront</label>
                  <p style="font-size: 13px; color: #64748B; margin: 4px 0 0; line-height: 1.5;">Confirm that the client has physically paid or transferred the registration fee to the local office.</p>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
                <div class="field-wrap">
                  <input type="date" id="fee_date" class="field-input" placeholder=" " value="${state.fee_date}" />
                  <label class="field-label">Date of Payment</label>
                </div>
                
                <div class="field-wrap" style="height: auto;">
                  <textarea id="notes" class="field-input" placeholder=" " style="height: 100px; resize: none; padding-top: 24px;">${state.notes}</textarea>
                  <label class="field-label">Internal Registration Notes</label>
                </div>
              </div>
            </div>

            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
               <div>
                 <p style="font-size: 11px; color: #64748B; font-weight: 800; text-transform: uppercase;">Registering as</p>
                 <p style="font-size: 16px; font-weight: 800; color: #1E293B; margin-top: 2px;">${state.title} ${state.first_name} ${state.surname}</p>
               </div>
               <div style="text-align: right;">
                 <p style="font-size: 11px; color: #64748B; font-weight: 800; text-transform: uppercase;">ID Details</p>
                 <p style="font-size: 16px; font-weight: 800; color: #1E293B; margin-top: 2px;">${state.national_id}</p>
               </div>
            </div>
          </div>
        `;
    }
  }

  function attachListeners() {
    // Standard Photo Handlers attached to window for onclick
    window.triggerCamera = (fieldName) => {
      openCamera((base64) => {
        state[fieldName] = base64;
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
          state[fieldName] = ev.target.result;
          render();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };

    window.removePhotoField = (fieldName) => {
      state[fieldName] = null;
      render();
    };

    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');

    if (prevBtn) prevBtn.onclick = () => { syncState(); step--; render(); };
    if (nextBtn) nextBtn.onclick = () => {
      syncState();
      if (validate()) {
        if (step < totalSteps) {
          step++;
          render();
        } else {
          handleSubmit();
        }
      }
    };
  }

  function syncState() {
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.type === 'radio') {
        if (input.checked) {
          state[input.name] = input.value;
        }
      } else if (Object.prototype.hasOwnProperty.call(state, input.id)) {
        if (input.type === 'checkbox') {
          state[input.id] = input.checked;
        } else if (input.type !== 'file') {
          state[input.id] = input.value;
        }
      }
    });
  }

  function validate() {
    let valid = true;
    const hideErrors = () => {
      document.querySelectorAll('.field-error-msg').forEach(e => e.style.display = 'none');
      document.querySelectorAll('.field-wrap').forEach(e => e.classList.remove('has-error'));
    };
    
    const showError = (id, wrapId = null) => { 
      const el = document.getElementById(id + '-error'); 
      if (el) el.style.display = 'flex'; 
      const wrapper = document.getElementById((wrapId || id) + '-wrap');
      if (wrapper) wrapper.classList.add('has-error');
      valid = false; 
    };

    hideErrors();

    if (step === 1) {
      if (!state.title) {
        const err = document.getElementById('title-error');
        if (err) err.style.display = 'flex';
        valid = false;
      }
      if (!state.gender) {
        const err = document.getElementById('gender-error');
        if (err) err.style.display = 'flex';
        valid = false;
      }
      if (!state.first_name) showError('first_name');
      if (!state.surname) showError('surname');
      if (!state.national_id) showError('national_id');
      if (!state.residence) showError('residence');
      
      const mobileRegex = /^(07|01)[0-9]{8}$/;
      if (!mobileRegex.test(state.mobile)) showError('mobile');
    }

    if (step === 2) {
      if (!state.passport_photo) showError('passport');
    }

    if (step === 4) {
      if (!state.fee_paid) {
        alert('Please confirm that the registration fee has been received.');
        valid = false;
      }
    }

    return valid;
  }

  async function handleSubmit() {
    const btn = document.getElementById('next-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const user = currentUser();
    const feePaid = state.fee_paid === true;
    const feeDate = state.fee_date || new Date().toISOString().split('T')[0];

    const finalData = {
      ...state,
      // Status variants for robustness
      registrationFeePaid: feePaid,
      registration_fee_paid: feePaid,
      fee_status: feePaid ? 'paid' : 'unpaid',
      
      registrationFeeAmount: regFee,
      registration_fee_amount: regFee,
      registrationFeeDate: feeDate,
      registrationFeeReceivedBy: user?.id || '',
      
      // Explicitly set status
      registrationStatus: feePaid ? 'complete' : 'incomplete',
      registration_status: feePaid ? 'complete' : 'incomplete',

      created_by: user?.id,
      created_by_name: user?.name,
      registeredBy: user?.id || '',
      registeredByName: user?.name || '',
      createdAt: new Date().toISOString()
    };

    console.log('Saving client with registration status:', {
      feePaid: finalData.registrationFeePaid,
      status: finalData.registrationStatus
    });

    try {
      await db.saveClient(finalData);
      
      // Success Notification
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem; animation: zoomIn 0.5s ease;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: #27AE60; color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 1.5rem; box-shadow: 0 10px 20px rgba(39, 174, 96, 0.2);">✓</div>
          <h2 style="font-weight: 800; color: var(--color-primary);">${state.first_name} ${state.surname} successfully registered!</h2>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">Redirecting to client directory...</p>
        </div>
      `;

      setTimeout(() => {
        window.location.hash = '#/clients';
      }, 1500);

    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Complete Registration';
    }
  }

  render();
}

