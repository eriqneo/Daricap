import db from '../db';
import { currentUser, logout, initAuth } from '../auth';
import { showToast } from '../components/toast';
import { navigate } from '../router';
import { formatDate } from '../utils/format';

export async function renderProfile(container) {
  const user = currentUser();
  if (!user) { navigate('#/login'); return; }
  
  // Get full user record from db
  const fullUser = await db.getUserById(user.id) || user;
  
  // Stats
  const myClients = await db.getClients({ officerId: user.id });
  const myLoans   = await db.getLoans({ officerId: user.id });
  const myPending = myLoans.filter(l => l.status === 'pending');
  const myActive = myLoans.filter(l => l.status === 'disbursed');

  const initials = getInitials(fullUser);

  container.innerHTML = `
    <style>
      .profile-page-wrapper {
        display: grid;
        grid-template-columns: 1fr 280px;
        gap: 2rem;
        animation: fadeIn 0.4s ease-out;
      }

      .profile-hero-card {
        background: #FFFFFF;
        border-radius: 16px;
        border: 1px solid #E4EDF8;
        overflow: hidden;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px rgba(18, 41, 79, 0.05);
      }
      .profile-cover {
        height: 80px;
        overflow: hidden;
        position: relative;
      }
      .profile-avatar-section {
        position: relative;
        margin: -40px 0 0 24px;
        display: inline-block;
        margin-bottom: 0;
      }
      .profile-avatar-xl {
        width: 80px;
        height: 80px;
        border-radius: 20px;
        background: linear-gradient(135deg, #1E6DC5, #00B8D4);
        color: #FFFFFF;
        font-size: 26px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 4px solid #FFFFFF;
        letter-spacing: -0.03em;
        box-shadow: 0 4px 12px rgba(26,61,107,0.15);
      }
      .avatar-change-btn {
        position: absolute;
        bottom: 2px;
        right: -6px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #1E6DC5;
        border: 2px solid #FFFFFF;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .avatar-change-btn:hover { background: #1558A8; transform: scale(1.05); }
      .profile-identity {
        padding: 12px 24px 24px;
      }
      .profile-display-name {
        font-size: 24px;
        font-weight: 700;
        color: #1A2332;
        letter-spacing: -0.02em;
        margin: 0 0 8px;
      }
      .profile-role-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .role-badge.role-admin {
        background: #EBF4FF;
        color: #1558A8;
        border: 1px solid #B5D4F4;
      }
      .role-badge.role-officer {
        background: #ECFDF5;
        color: #065F46;
        border: 1px solid #A7F3D0;
      }
      .profile-email-display {
        font-size: 14px;
        color: #6B7A90;
      }
      .profile-member-since {
        font-size: 12px;
        color: #A0AEBF;
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
      }

      .settings-section-card {
        background: #FFFFFF;
        border-radius: 16px;
        border: 1px solid #E4EDF8;
        margin-bottom: 24px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(18, 41, 79, 0.05);
      }
      .settings-section-header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 20px 24px;
        border-bottom: 1px solid #F0F5FB;
        background: #FAFCFF;
      }
      .settings-section-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #EBF4FF;
        border: 1px solid #B5D4F4;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #1E6DC5;
      }
      .settings-section-title {
        font-size: 15px;
        font-weight: 700;
        color: #1A2332;
        margin: 0 0 2px;
      }
      .settings-section-sub {
        font-size: 13px;
        color: #6B7A90;
        margin: 0;
      }
      .settings-section-body {
        padding: 24px;
      }

      .field-wrap {
        position: relative;
        margin-bottom: 0;
      }
      .field-input {
        width: 100%;
        padding: 22px 14px 6px;
        border-radius: 10px;
        border: 1px solid #E4EDF8;
        background: #FFFFFF;
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        color: #1A2332;
      }
      .field-input:focus {
        outline: none;
        border-color: #1E6DC5;
        box-shadow: 0 0 0 4px rgba(30, 109, 197, 0.1);
        background: #FFF;
      }
      .field-label {
        position: absolute;
        left: 14px;
        top: 15px;
        font-size: 14px;
        color: #6B7A90;
        transition: all 0.2s ease;
        pointer-events: none;
      }
      .field-input:focus + .field-label,
      .field-input:not(:placeholder-shown) + .field-label {
        top: 6px;
        font-size: 11px;
        color: #1E6DC5;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }

      .readonly-field {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: #F8FAFF;
        border-radius: 10px;
        border: 1px solid #E4EDF8;
        margin-top: 16px;
        flex-wrap: wrap;
      }
      .readonly-label {
        font-size: 13px;
        font-weight: 600;
        color: #6B7A90;
        min-width: 40px;
      }
      .readonly-hint {
        font-size: 12px;
        color: #A0AEBF;
        margin-left: auto;
      }

      .password-strength {
        display: flex;
        gap: 4px;
        margin-top: 12px;
      }
      .strength-seg {
        height: 4px;
        flex: 1;
        border-radius: 2px;
        background: #E4EDF8;
        transition: all 0.3s ease;
      }
      .strength-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 6px;
      }
      .strength-label {
        font-size: 11px;
        font-weight: 700;
        color: #6B7A90;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }

      .profile-save-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: #FFFFFF;
        border-radius: 16px;
        border: 1px solid #E4EDF8;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(18, 41, 79, 0.05);
      }
      .save-hint {
        font-size: 13px;
        color: #6B7A90;
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 20px;
      }
      .save-actions { display: flex; gap: 12px; }

      .profile-stats-card {
        background: #FFFFFF;
        border-radius: 16px;
        border: 1px solid #E4EDF8;
        overflow: hidden;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px rgba(18, 41, 79, 0.05);
      }
      .stats-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #F0F5FB;
        background: #FAFCFF;
      }
      .stats-card-title {
        font-size: 14px;
        font-weight: 700;
        color: #1A2332;
      }
      .stats-period {
        font-size: 11px;
        font-weight: 700;
        color: #6B7A90;
        background: #F4F8FF;
        padding: 2px 10px;
        border-radius: 20px;
        border: 1px solid #E4EDF8;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      .stat-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        border-bottom: 1px solid #F8FAFF;
        transition: all 0.15s;
      }
      .stat-row:last-child { border-bottom: none; }
      .stat-row:hover { background: #FAFCFF; }
      .stat-row-icon {
        width: 32px;
        height: 32px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .stat-row-icon.clients  { background: #EBF4FF; color: #1E6DC5; }
      .stat-row-icon.loans    { background: #F0FDF4; color: #1A7A4A; }
      .stat-row-icon.pending  { background: #FFFBEB; color: #B45309; }
      .stat-row-icon.active   { background: #ECFDF5; color: #065F46; }
      .stat-row-info { flex: 1; }
      .stat-row-label { font-size: 13px; color: #6B7A90; font-weight: 500; }
      .stat-row-value {
        font-size: 16px;
        font-weight: 700;
        color: #1A2332;
        min-width: 24px;
        text-align: right;
      }
      .stat-row.pending .stat-row-value { color: #B45309; }
      .stat-row.active .stat-row-value  { color: #065F46; }

      .session-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        color: #1A7A4A;
        background: #ECFDF5;
        padding: 2px 10px;
        border-radius: 20px;
        text-transform: uppercase;
      }
      .session-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #10B981;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
      }
      @keyframes pulse-green {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }
      .session-dot { animation: pulse-green 2s infinite; }

      .security-info-text {
        font-size: 13px;
        color: #6B7A90;
        line-height: 1.6;
        margin: 0 0 16px;
      }
      .session-info-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #F8FAFF;
        border-radius: 12px;
        border: 1px solid #E4EDF8;
        margin-bottom: 16px;
      }
      .session-device { font-size: 13px; font-weight: 700; color: #1A2332; }
      .session-time   { font-size: 12px; color: #A0AEBF; }
      .session-current-badge {
        margin-left: auto;
        font-size: 11px;
        font-weight: 700;
        color: #1E6DC5;
        background: #EBF4FF;
        padding: 2px 8px;
        border-radius: 8px;
        text-transform: uppercase;
      }
      .btn-secondary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: inherit;
        background: #FFFFFF;
        color: #6B7A90;
        border: 1px solid #E4EDF8;
      }
      .btn-secondary:hover {
        background: #F8FAFF;
        color: #1A2332;
        border-color: #D0DCF0;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(18, 41, 79, 0.05);
      }
      .btn-secondary:active {
        transform: translateY(0);
        box-shadow: none;
      }

      .btn-sign-out-all {
        width: 100%;
        padding: 12px;
        border-radius: 12px;
        border: 1.5px solid #FECACA;
        background: #FEF2F2;
        color: #991B1B;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.15s;
      }
      .btn-sign-out-all:hover {
        background: #FEE2E2;
        border-color: #FCA5A5;
      }

      @media (max-width: 900px) {
        .profile-page-wrapper {
          grid-template-columns: 1fr;
        }
        .profile-sidebar {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
      }
      @media (max-width: 600px) {
        .profile-sidebar { grid-template-columns: 1fr; }
        .form-row { grid-template-columns: 1fr; }
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .btn-password-toggle {
        position: absolute;
        right: 12px;
        top: 22px;
        background: none;
        border: none;
        cursor: pointer;
        color: #A0AEBF;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s;
      }
      .btn-password-toggle:hover { color: #1E6DC5; }
    </style>

    <div class="profile-page-wrapper">
      
      <!-- LEFT COLUMN -->
      <div class="profile-main">
        
        <!-- HERO CARD -->
        <div class="profile-hero-card">
          <div class="profile-cover">
            <svg width="100%" height="80" preserveAspectRatio="none">
              <rect width="100%" height="80" fill="#12294F"/>
              <circle cx="85%" cy="40" r="60" fill="#1E6DC5" opacity="0.25"/>
              <circle cx="10%" cy="10" r="40" fill="#00B8D4" opacity="0.15"/>
              <circle cx="60%" cy="70" r="50" fill="#1E6DC5" opacity="0.12"/>
              <rect x="0" y="68" width="100%" height="12" fill="#FFFFFF" opacity="0.04"/>
            </svg>
          </div>
          
          <div class="profile-avatar-section">
            <div class="profile-avatar-xl" id="profile-avatar">
              ${initials}
            </div>
            <button class="avatar-change-btn" title="Change photo">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M1 5.5A1.5 1.5 0 012.5 4h.879a1.5 1.5 0 001.06-.44l.622-.62A1.5 1.5 0 016.12 2.5h3.758a1.5 1.5 0 011.06.44l.622.62A1.5 1.5 0 0012.621 4H13.5A1.5 1.5 0 0115 5.5v7A1.5 1.5 0 0113.5 14h-11A1.5 1.5 0 011 12.5v-7z" 
                  stroke="white" stroke-width="1.2" fill="none"/>
                <circle cx="8" cy="9" r="2.5" stroke="white" stroke-width="1.2" fill="none"/>
              </svg>
            </button>
          </div>
          
          <div class="profile-identity">
            <h2 class="profile-display-name">${fullUser.name}</h2>
            <div class="profile-role-row">
              <span class="role-badge ${fullUser.role === 'admin' ? 'role-admin' : 'role-officer'}">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L2 4v4c0 3.3 2.5 6.4 6 7.3C12 14.4 14 11.3 14 8V4L8 1z" 
                    stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
                </svg>
                ${fullUser.role === 'admin' ? 'Administrator' : 'Loan Officer'}
              </span>
              <span class="profile-email-display">${fullUser.email}</span>
            </div>
            <p class="profile-member-since">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Member since ${formatDate(fullUser.createdAt)}
            </p>
          </div>
        </div>

        <!-- ACCOUNT DETAILS CARD -->
        <div class="settings-section-card">
          <div class="settings-section-header">
            <div class="settings-section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <h3 class="settings-section-title">Account Details</h3>
              <p class="settings-section-sub">Update your name and email address</p>
            </div>
          </div>
          
          <div class="settings-section-body">
            <div class="form-row">
              <div class="field-wrap">
                <input type="text" class="field-input" id="pf-name" placeholder=" " value="${fullUser.name}" />
                <label class="field-label" for="pf-name">Full Name</label>
              </div>
              <div class="field-wrap">
                <input type="email" class="field-input" id="pf-email" placeholder=" " value="${fullUser.email}" />
                <label class="field-label" for="pf-email">Email Address</label>
              </div>
            </div>
            
            <div class="readonly-field">
              <span class="readonly-label">Role</span>
              <span class="readonly-value">
                <span class="role-badge ${fullUser.role === 'admin' ? 'role-admin' : 'role-officer'}">
                  ${fullUser.role === 'admin' ? 'Administrator' : 'Loan Officer'}
                </span>
              </span>
              <span class="readonly-hint">Roles are managed by a system administrator</span>
            </div>
          </div>
        </div>

        <!-- CHANGE PASSWORD CARD -->
        <div class="settings-section-card">
          <div class="settings-section-header">
            <div class="settings-section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <h3 class="settings-section-title">Change Password</h3>
              <p class="settings-section-sub">Keep your account secure with a strong password</p>
            </div>
          </div>
          
          <div class="settings-section-body">
            <div class="field-wrap" style="margin-bottom: 24px;">
              <input type="password" class="field-input" id="pf-current-pw" placeholder=" " />
              <label class="field-label" for="pf-current-pw">Current Password</label>
              <button class="btn-password-toggle" type="button" onclick="window.togglePassword('pf-current-pw')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>

            <div class="form-row" style="margin-bottom: 0;">
              <div class="field-wrap">
                <input type="password" class="field-input" id="pf-new-pw" placeholder=" " />
                <label class="field-label" for="pf-new-pw">New Password</label>
                <button class="btn-password-toggle" type="button" onclick="window.togglePassword('pf-new-pw')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <div class="field-wrap">
                <input type="password" class="field-input" id="pf-confirm-pw" placeholder=" " />
                <label class="field-label" for="pf-confirm-pw">Confirm New Password</label>
              </div>
            </div>

            <div class="password-strength">
              <div class="strength-seg" id="seg-1"></div>
              <div class="strength-seg" id="seg-2"></div>
              <div class="strength-seg" id="seg-3"></div>
              <div class="strength-seg" id="seg-4"></div>
            </div>
            <div class="strength-info">
              <div class="strength-label" id="strength-txt">Strength: —</div>
              <div style="font-size: 11px; color: #A0AEBF;">Min. 8 characters</div>
            </div>
          </div>
        </div>

        <!-- SAVE FOOTER -->
        <div class="profile-save-footer">
          <span class="save-hint" id="profile-save-hint"></span>
          <div class="save-actions">
            <button class="btn-secondary" onclick="resetProfileForm()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              Discard
            </button>
            <button class="btn-primary" onclick="saveProfile()" id="pf-save-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"/></svg>
              Save Changes
            </button>
          </div>
        </div>

      </div>

      <!-- RIGHT SIDEBAR -->
      <div class="profile-sidebar">
        
        <div class="profile-stats-card">
          <div class="stats-card-header">
            <span class="stats-card-title">My Activity</span>
            <span class="stats-period">All time</span>
          </div>
          
          <div class="stat-row">
            <div class="stat-row-icon clients">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="stat-row-info">
              <span class="stat-row-label">Clients Registered</span>
            </div>
            <span class="stat-row-value">${myClients.length}</span>
          </div>

          <div class="stat-row">
            <div class="stat-row-icon loans">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div class="stat-row-info">
              <span class="stat-row-label">Loan Applications</span>
            </div>
            <span class="stat-row-value">${myLoans.length}</span>
          </div>

          <div class="stat-row pending">
            <div class="stat-row-icon pending">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-row-info">
              <span class="stat-row-label">Pending Approval</span>
            </div>
            <span class="stat-row-value">${myPending.length}</span>
          </div>

          <div class="stat-row active">
            <div class="stat-row-icon active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="stat-row-info">
              <span class="stat-row-label">Active Loans</span>
            </div>
            <span class="stat-row-value">${myActive.length}</span>
          </div>
        </div>

        <div class="profile-stats-card">
          <div class="stats-card-header">
            <span class="stats-card-title">Account Security</span>
            <span class="session-badge">
              <span class="session-dot"></span>
              Active
            </span>
          </div>
          
          <div style="padding: 16px 20px;">
            <p class="security-info-text">
              Signed in as <strong>${fullUser.email}</strong> on this device.
            </p>
            
            <div class="session-info-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E6DC5" stroke-width="2" style="flex-shrink:0;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <div>
                <div class="session-device">This browser session</div>
                <div class="session-time">Active now</div>
              </div>
              <span class="session-current-badge">Current</span>
            </div>
            
            <button class="btn-sign-out-all" id="profile-logout-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out everywhere
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  // Password Strength Logic
  const newPwInput = document.getElementById('pf-new-pw');
  if (newPwInput) {
    newPwInput.addEventListener('input', (e) => {
      const strength = checkStrength(e.target.value);
      updateStrengthUI(strength);
    });
  }

  function checkStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0-4
  }

  function updateStrengthUI(score) {
    const segments = [
      document.getElementById('seg-1'),
      document.getElementById('seg-2'),
      document.getElementById('seg-3'),
      document.getElementById('seg-4')
    ];
    const text = document.getElementById('strength-txt');
    const colors = ['#E4EDF8', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
    const labels = ['—', 'Weak', 'Fair', 'Good', 'Strong'];

    segments.forEach((seg, i) => {
      if (i < score) {
        seg.style.background = colors[score];
      } else {
        seg.style.background = '#E4EDF8';
      }
    });
    text.textContent = `Strength: ${labels[score]}`;
    text.style.color = score > 0 ? colors[score] : '#6B7A90';
  }

  // Password Toggle helper
  window.togglePassword = function(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  };

  // Actions
  window.saveProfile = async function() {
    const name  = document.getElementById('pf-name').value.trim();
    const email = document.getElementById('pf-email').value.trim();
    const currPw  = document.getElementById('pf-current-pw').value;
    const newPw   = document.getElementById('pf-new-pw').value;
    const confirmPw = document.getElementById('pf-confirm-pw').value;
    const saveBtn = document.getElementById('pf-save-btn');
    const hintBar = document.getElementById('profile-save-hint');
    
    if (!name || !email) {
      showToast('Name and email are required.', 'error');
      return;
    }
    
    if (currPw || newPw || confirmPw) {
      if (currPw !== fullUser.password) {
        showToast('Current password is incorrect.', 'error');
        return;
      }
      if (newPw.length < 8) {
        showToast('New password must be at least 8 characters.', 'error');
        return;
      }
      if (newPw !== confirmPw) {
        showToast('New passwords do not match.', 'error');
        return;
      }
    }
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-sm"></span> Updating...`;
    
    try {
      const updates = {
        name,
        email,
        ...(newPw ? { password: newPw } : {})
      };
      
      const updatedUser = await db.updateUser(fullUser.id, updates);
      await db.updateSession(updatedUser);
      await initAuth();
      
      // Feedback
      hintBar.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> <span style="color:#065F46; font-weight:600;">All changes saved</span>`;
      showToast('Profile updated successfully.', 'success');
      
      setTimeout(() => {
        hintBar.innerHTML = '';
      }, 3000);

      // Update topbar if present
      const topbarName = document.getElementById('topbar-username-display');
      if (topbarName) {
          const firstName = name.split(' ')[0];
          topbarName.textContent = firstName + (firstName.length < name.length ? '.' : '');
      }
      
      // Hot reload UI components
      const nameDisplay = document.querySelector('.profile-display-name');
      const emailDisplay = document.querySelector('.profile-email-display');
      const avatarDisplay = document.getElementById('profile-avatar');
      
      if (nameDisplay) nameDisplay.textContent = name;
      if (emailDisplay) emailDisplay.textContent = email;
      if (avatarDisplay) avatarDisplay.textContent = getInitials({ name });

      // Clear pw fields
      document.getElementById('pf-current-pw').value = '';
      document.getElementById('pf-new-pw').value = '';
      document.getElementById('pf-confirm-pw').value = '';
      updateStrengthUI(0);
      
    } catch {
      showToast('failed to update profile.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"/></svg> Save Changes`;
    }
  };
  
  window.resetProfileForm = function() {
    document.getElementById('pf-name').value = fullUser.name;
    document.getElementById('pf-email').value = fullUser.email;
    document.getElementById('pf-current-pw').value = '';
    document.getElementById('pf-new-pw').value = '';
    document.getElementById('pf-confirm-pw').value = '';
    updateStrengthUI(0);
    showToast('Changes discarded.', 'info');
  };

  document.getElementById('profile-logout-btn').onclick = () => {
    if (confirm('Are you sure you want to sign out from all sessions?')) logout();
  };
}

function getInitials(user) {
  if (!user || !user.name) return '?';
  return user.name.split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0,2)
    .join('')
    .toUpperCase();
}

