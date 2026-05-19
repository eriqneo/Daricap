import db from '../../db';
import { currentUser, isAdmin } from '../../auth';
import { seedClients } from '../../utils/seeder';
import { showToast } from '../../components/toast';
import { initLayout } from '../../layout';

export async function renderSettings(container) {
  if (!isAdmin()) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center;">Access Denied</div>';
    return;
  }

  let activeSection = 'loan-rules';
  let settings = await db.getSettings();
  let usersList = await db.getUsers();
  let branding = {
    name: await db.getCompanyName(),
    logo: await db.getCompanyLogo()
  };

  function render() {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 240px 1fr; gap: 2rem; animation: fadeIn 0.4s ease-out;">
        <!-- Left Mini Nav -->
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <button class="settings-nav-btn ${activeSection === 'loan-rules' ? 'active' : ''}" data-section="loan-rules">🛠 Loan Rules</button>
          <button class="settings-nav-btn ${activeSection === 'users' ? 'active' : ''}" data-section="users">👥 User Management</button>
          <button class="settings-nav-btn ${activeSection === 'app-info' ? 'active' : ''}" data-section="app-info">ℹ️ App Info</button>
        </div>

        <!-- Content Area -->
        <div id="settings-content">
          ${renderActiveSection()}
        </div>
      </div>

      <style>
        .settings-nav-btn {
          width: 100%;
          text-align: left;
          padding: 1rem 1.25rem;
          border-radius: 0.75rem;
          border: none;
          background: transparent;
          font-weight: 700;
          font-size: 14px;
          color: #64748B;
          cursor: pointer;
          transition: all 0.2s;
        }
        .settings-nav-btn:hover { background: #F1F5F9; color: var(--color-primary); }
        .settings-nav-btn.active { background: white; color: var(--color-primary); box-shadow: var(--shadow-sm); }
        
        .rule-card { padding: 2rem; }
        .rule-item { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 0; border-bottom: 1px solid #F1F5F9; }
        .rule-item:last-child { border-bottom: none; }
        
        .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #E2E8F0; transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--color-success); }
        input:checked + .slider:before { transform: translateX(20px); }
      </style>
    `;

    attachListeners();
  }

  function renderActiveSection() {
    switch (activeSection) {
      case 'loan-rules': return renderLoanRules();
      case 'users': return renderUserManagement();
      case 'app-info': return renderAppInfo();
      default: return '';
    }
  }

  function renderLoanRules() {
    return `
      <div class="card rule-card">
        <h2 style="font-weight: 900; color: var(--color-primary); margin: 0 0 0.5rem 0;">Loan & Fee Settings</h2>
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 2.5rem;">Configure global business rules and automated processing logic</p>

        <div style="display: flex; flex-direction: column; gap: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;">
            <div style="flex: 1;">
              <h4 style="margin: 0; font-weight: 800; color: #1E293B;">Registration Fee</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748B; line-height: 1.5;">Collected from every applicant during the onboarding stage to cover account activation and vetting costs.</p>
            </div>
            <div class="field-wrap" style="width: 180px; margin-bottom: 0;">
              <input type="number" id="reg-fee" class="field-input" placeholder=" " value="${settings.registrationFee || 150}" style="font-weight: 800; text-align: right; padding-right: 48px;">
              <label class="field-label">Amount (KES)</label>
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 800; color: #94A3B8; pointer-events: none;">KES</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;">
            <div style="flex: 1;">
              <h4 style="margin: 0; font-weight: 800; color: #1E293B;">Processing Fee</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748B; line-height: 1.5;">A flat administrative charge deducted or paid upon successful loan approval. Applied before disbursement.</p>
            </div>
            <div class="field-wrap" style="width: 180px; margin-bottom: 0;">
              <input type="number" id="proc-fee" class="field-input" placeholder=" " value="${settings.processingFee || 500}" style="font-weight: 800; text-align: right; padding-right: 48px;">
              <label class="field-label">Amount (KES)</label>
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 800; color: #94A3B8; pointer-events: none;">KES</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;">
            <div style="flex: 1;">
              <h4 style="margin: 0; font-weight: 800; color: #1E293B;">Dormancy Trigger</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748B; line-height: 1.5;">Automatically flag client accounts as "Inactive" or "Declined" after this period of no repayment activity.</p>
            </div>
            <div class="field-wrap" style="width: 180px; margin-bottom: 0;">
              <input type="number" id="declined-after" class="field-input" placeholder=" " value="${settings.declinedAfterMonths || 3}" style="font-weight: 800; text-align: right; padding-right: 64px;">
              <label class="field-label">Period</label>
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 800; color: #94A3B8; pointer-events: none;">MONTHS</span>
            </div>
          </div>
        </div>

        <div style="margin-top: 3rem; padding: 2rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px;">
           <h3 style="font-weight: 900; font-size: 14px; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">Active Loan Products</h3>
           <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
             <div class="card" style="padding: 1.5rem; background: white; border: 1.5px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm);">
               <div>
                 <h5 style="margin: 0; font-weight: 800; font-size: 15px;">Daricap Pesa</h5>
                 <p style="margin: 4px 0 0; font-size: 11px; color: #64748B;">Standard weekly repayments</p>
               </div>
               <label class="toggle-switch">
                 <input type="checkbox" id="pesa-active" checked>
                 <span class="slider"></span>
               </label>
             </div>
             <div class="card" style="padding: 1.5rem; background: white; border: 1.5px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm);">
               <div>
                 <h5 style="margin: 0; font-weight: 800; font-size: 15px;">Daricap Okoa</h5>
                 <p style="margin: 4px 0 0; font-size: 11px; color: #64748B;">30-day emergency advance</p>
               </div>
               <label class="toggle-switch">
                 <input type="checkbox" id="okoa-active" checked>
                 <span class="slider"></span>
               </label>
             </div>
           </div>
        </div>

        <div style="margin-top: 3rem; display: flex; justify-content: flex-end;">
           <button id="save-rules" class="btn-primary" style="padding: 1rem 3rem; font-weight: 900; height: 56px;">Save System Configuration</button>
        </div>
      </div>
    `;
  }

  function renderUserManagement() {
    return `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="font-weight: 900; color: var(--color-primary); margin: 0;">Employee Directory</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 0.25rem;">Manage system access and permissions for your team</p>
          </div>
          <button id="add-user-btn" class="btn-primary" style="padding: 0.75rem 1.5rem; font-weight: 800; height: 48px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Add New User
          </button>
        </div>

        <div class="card" style="padding: 0; overflow: hidden; border: 1.5px solid #E2E8F0; box-shadow: var(--shadow-sm);">
          <div class="table-container">
            <table class="data-table">
            <thead>
              <tr>
                <th>Officer Details</th>
                <th>Employee Email</th>
                <th>Access Role</th>
                <th>Status</th>
                <th style="text-align: right;">Management</th>
              </tr>
            </thead>
            <tbody>
              ${usersList.map(u => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div style="width: 36px; height: 36px; border-radius: 50%; background: #F1F5F9; color: #64748B; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        ${u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <span style="font-weight: 800; color: #1E293B;">${u.name}</span>
                    </div>
                  </td>
                  <td style="font-size: 13px; color: #64748B;">${u.email}</td>
                  <td>
                    <span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-gray'}" style="font-size: 10px; padding: 4px 10px;">${u.role === 'admin' ? 'ADMINISTRATOR' : 'FIELD OFFICER'}</span>
                  </td>
                  <td>
                    <span class="badge ${u.active !== false ? 'badge-success' : 'badge-danger'}" style="font-size: 10px; padding: 4px 10px;">
                      ${u.active !== false ? 'ACTIVE' : 'BLOCKED'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    ${u.role !== 'admin' ? `
                       <button class="deactivate-btn btn ${u.active !== false ? 'btn-danger' : 'btn-success'}" data-id="${u.id}" data-active="${u.active !== false}" style="padding: 0.5rem 1rem; font-size: 11px; font-weight: 800; border-radius: 8px;">
                         ${u.active !== false ? 'Block Access' : 'Restore Access'}
                       </button>
                    ` : '<span style="font-size: 11px; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">System Owner</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      <!-- Add User Modal -->
      <div id="user-modal" class="modal-overlay" style="display: none;">
         <div class="modal-content" style="max-width: 480px; padding: 3rem;">
           <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2.5rem;">
              <div>
                <h3 style="margin: 0; font-weight: 900; color: var(--color-primary); font-size: 1.25rem;">Create Officer Profile</h3>
                <p style="margin: 4px 0 0; font-size: 13px; color: #64748B;">Provision a new account for system access</p>
              </div>
              <button class="modal-close" style="background: #F1F5F9; border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748B;">&times;</button>
           </div>
           <form id="new-user-form" style="display: flex; flex-direction: column; gap: 20px;">
              <div class="field-wrap">
                <input type="text" id="u-name" class="field-input" placeholder=" " required>
                <label class="field-label">Full Employee Name <span class="req">*</span></label>
              </div>
              <div class="field-wrap">
                <input type="email" id="u-email" class="field-input" placeholder=" " required>
                <label class="field-label">Professional Email Address <span class="req">*</span></label>
              </div>
              <div class="field-wrap">
                <input type="password" id="u-password" class="field-input" placeholder=" " required>
                <label class="field-label">Account Password <span class="req">*</span></label>
                <p style="font-size: 10px; color: #64748B; margin-top: 6px; font-weight: 500;">Officer will be required to change this upon first login.</p>
              </div>
              <div class="field-wrap">
                <select id="u-role" class="field-input" required style="padding-top: 20px;">
                   <option value="loan_officer">Field Loan Officer</option>
                   <option value="admin">System Administrator</option>
                </select>
                <label class="field-label">Access Level / Role <span class="req">*</span></label>
              </div>
              <div style="margin-top: 1.5rem;">
                <button type="submit" class="btn-primary" style="width: 100%; height: 56px; font-weight: 900; box-shadow: 0 10px 15px -3px rgba(3, 105, 161, 0.2);">Create Employee Account</button>
              </div>
           </form>
         </div>
      </div>

      <style>
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; border-radius: 2rem; width: 90%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); animation: slideUp 0.4s ease-out; }
      </style>
    `;
  }

  function renderAppInfo() {
    return `
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        <div class="card" style="padding: 2.5rem;">
          <h2 style="font-weight: 900; color: var(--color-primary); margin: 0;">Company Branding</h2>
          <p style="color: var(--text-muted); font-size: 13px; margin: 0.25rem 0 2.5rem 0;">Personalize the system with your organization's identity</p>

          <div style="display: flex; gap: 2.5rem; flex-wrap: wrap;">
            <div style="flex: 0 0 120px; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
               <div id="logo-preview" style="width: 100px; height: 100px; border-radius: 16px; background: #F1F5F9; border: 1.5px dashed #CBD5E1; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                  ${branding.logo ? `<img src="${branding.logo}" style="width: 100%; height: 100%; object-fit: contain;">` : `<span style="font-size: 32px; font-weight: 900; color: #94A3B8;">${branding.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</span>`}
               </div>
               <button id="upload-logo-btn" class="btn btn-secondary" style="font-size: 11px; padding: 6px 12px; width: 100%;">Change Logo</button>
               <input type="file" id="logo-input" accept="image/*" style="display: none;">
            </div>
            <div style="flex: 1; min-width: 300px;">
               <div class="field-wrap">
                  <input type="text" id="co-name" class="field-input" placeholder=" " value="${branding.name}">
                  <label class="field-label">Company Legal Name</label>
               </div>
               <p style="font-size: 11px; color: #64748B; margin-top: 1rem;">This name will appear in the sidebar, dash greetings, and generated PDF reports.</p>
               <button id="save-branding" class="btn-primary" style="margin-top: 1.5rem; height: 48px; padding: 0 2rem; font-weight: 800;">Save Branding Changes</button>
            </div>
          </div>
        </div>

        <div class="card" style="padding: 2.5rem;">
          <h2 style="font-weight: 900; color: var(--color-primary); margin: 0;">App Information</h2>
          <p style="color: var(--text-muted); font-size: 13px; margin: 0.25rem 0 2.5rem 0;">System metadata and data portability tools</p>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-bottom: 2.5rem;">
            <div>
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">App Version</p>
              <p style="margin: 0.5rem 0 0; font-size: 15px; font-weight: 900; color: var(--color-accent);">1.0.0 (Alpha)</p>
            </div>
            <div>
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Runtime Mode</p>
              <p style="margin: 0.5rem 0 0; font-size: 15px; font-weight: 900; color: var(--color-success);">LOCAL (IndexedDB)</p>
            </div>
          </div>

          <div style="padding: 1.5rem; background: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 1rem; margin-bottom: 2.5rem;">
            <div style="display: flex; gap: 1rem; align-items: flex-start;">
              <span style="font-size: 1.5rem;">⚠️</span>
              <div>
                <h4 style="margin: 0; color: #9A3412; font-weight: 900; font-size: 14px;">Local Storage Warning</h4>
                <p style="margin: 0.5rem 0 0; font-size: 13px; color: #C2410C; line-height: 1.5;">
                  Data is stored only on this browser and device. Clearing browser history/cache or visiting in incognito will erase all records. 
                  Please regular export backups to prevent data loss.
                </p>
              </div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 2.5rem; padding-top: 2rem; border-top: 1px solid #F1F5F9;">
            <div>
              <h4 style="margin: 0; font-weight: 800; color: #1E293B;">Development & Testing</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748B; line-height: 1.5;">Populate the system with dummy data for interface testing and training purposes.</p>
            </div>
            <button id="seed-data-btn" class="btn btn-secondary" style="background: #F1F5F9; border: 1.5px solid #E2E8F0; color: #475569; padding: 1rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
              🌱 Seed 20 Random Clients
            </button>
          </div>

          <div style="display: flex; gap: 1.5rem; margin-top: 2.5rem;">
            <button id="export-data" class="btn btn-secondary" style="flex: 1; padding: 1.25rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
              📥 Export All Data (JSON)
            </button>
            <label class="btn btn-secondary" style="flex: 1; padding: 1.25rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer;">
              📤 Import From File
              <input type="file" id="import-data" style="display: none;" accept=".json">
            </label>
          </div>
        </div>

        <div style="text-align: center; padding: 2rem;">
           <p style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">DariCap Network — Digital Field Systems</p>
        </div>
      </div>
    `;
  }

  async function attachListeners() {
    container.querySelectorAll('.settings-nav-btn').forEach(btn => {
      btn.onclick = () => {
        activeSection = btn.dataset.section;
        render();
      };
    });

    // Loan Rules Listeners
    const saveRulesBtn = container.querySelector('#save-rules');
    if (saveRulesBtn) {
      saveRulesBtn.onclick = async () => {
        const regFee = parseFloat(container.querySelector('#reg-fee').value);
        const procFee = parseFloat(container.querySelector('#proc-fee').value);
        const declinedRule = parseInt(container.querySelector('#declined-after').value);
        
        await db.setSetting('registrationFee', regFee);
        await db.setSetting('processingFee', procFee);
        await db.setSetting('declinedAfterMonths', declinedRule);
        
        alert('Settings saved successfully!');
        settings = await db.getSettings();
        render();
      };
    }

    // User Management Listeners
    const addUserBtn = container.querySelector('#add-user-btn');
    const userModal = container.querySelector('#user-modal');
    if (addUserBtn) {
      addUserBtn.onclick = () => { userModal.style.display = 'flex'; };
    }
    if (userModal) {
       userModal.querySelector('.modal-close').onclick = () => { userModal.style.display = 'none'; };
       const form = userModal.querySelector('#new-user-form');
       form.onsubmit = async (e) => {
         e.preventDefault();
         const newUser = {
           name: form.querySelector('#u-name').value,
           email: form.querySelector('#u-email').value,
           password: form.querySelector('#u-password').value,
           role: form.querySelector('#u-role').value,
           active: true
         };
         await db.saveUser(newUser);
         alert('System user created successfully.');
         userModal.style.display = 'none';
         usersList = await db.getUsers();
         render();
       };
    }

    container.querySelectorAll('.deactivate-btn').forEach(btn => {
      btn.onclick = async () => {
         const id = btn.dataset.id;
         const isActive = btn.dataset.active === 'true';
         if (confirm(`Are you sure you want to ${isActive ? 'deactivate' : 'reactivate'} this user?`)) {
            const user = usersList.find(u => u.id === id);
            await db.saveUser({ ...user, active: !isActive });
            usersList = await db.getUsers();
            render();
         }
      };
    });

    const seedBtn = container.querySelector('#seed-data-btn');
    if (seedBtn) {
      seedBtn.onclick = async () => {
        try {
          seedBtn.disabled = true;
          seedBtn.textContent = '🌱 Seeding data...';
          await seedClients(20);
          showToast('Success! 20 random clients have been added to the system.');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          showToast(err.message, 'error');
          seedBtn.disabled = false;
          seedBtn.textContent = '🌱 Seed 20 Random Clients';
        }
      };
    }

    // App Info Listeners
    const exportBtn = container.querySelector('#export-data');
    if (exportBtn) {
      exportBtn.onclick = async () => {
        const json = await db.exportAll();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daricap_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      };
    }

    const importInput = container.querySelector('#import-data');
    if (importInput) {
      importInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (re) => {
           try {
              await db.importAll(re.target.result);
              alert('Data imported successfully! App will reload now.');
              window.location.reload();
           } catch (err) {
              alert('Import failed: ' + err.message);
           }
        };
        reader.readAsText(file);
      };
    }

    // Branding Listeners
    const logoInput = container.querySelector('#logo-input');
    const uploadBtn = container.querySelector('#upload-logo-btn');
    if (uploadBtn && logoInput) {
      uploadBtn.onclick = () => logoInput.click();
      logoInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          branding.logo = ev.target.result;
          render();
        };
        reader.readAsDataURL(file);
      };
    }

    const saveBrandingBtn = container.querySelector('#save-branding');
    if (saveBrandingBtn) {
      saveBrandingBtn.onclick = async () => {
        const name = container.querySelector('#co-name').value;
        await db.setCompanyName(name);
        await db.setCompanyLogo(branding.logo);
        showToast('Branding updated successfully!');
        await initLayout(); // Refresh sidebar/topbar
        branding.name = name;
        render();
      };
    }
  }

  render();
}
