
import db from './db';
import { currentUser } from './auth';

export async function initLayout() {
  const user = currentUser();
  if (!user) return;

  const companyName = await db.getCompanyName();
  const companyLogo = await db.getCompanyLogo();
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

  // 1. Sidebar Branding
  const logoMark = document.getElementById('sidebar-logo-img');
  const coNameEl = document.getElementById('sidebar-co-name');
  const coSubEl  = document.getElementById('sidebar-co-sub');
  
  if (companyLogo && logoMark) {
    logoMark.innerHTML = `<img src="${companyLogo}" alt="Logo">`;
  } else if (logoMark) {
    const monogram = companyName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const monogramSpan = logoMark.querySelector('#sidebar-monogram');
    if (monogramSpan) monogramSpan.textContent = monogram;
  }

  if (coNameEl) {
    const words = companyName.split(' ');
    coNameEl.textContent = words[0];
    if (coSubEl) coSubEl.textContent = words.slice(1).join(' ') || 'Network';
  }

  // 2. Sidebar User Info
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarRole = document.getElementById('sidebar-user-role');
  const sidebarUserInfo = document.getElementById('sidebar-user-info');

  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarRole) sidebarRole.textContent = user.role.replace('_', ' ');
  if (sidebarUserInfo) {
    sidebarUserInfo.onclick = () => navigate('#/profile');
  }

  // 3. Setup Logout
  initSignOutButtons();

  // 4. Topbar
  const topbarAvatar = document.getElementById('topbar-avatar-display');
  const topbarName = document.getElementById('topbar-username-display');
  if (topbarAvatar) topbarAvatar.textContent = initials;
  if (topbarName) topbarName.textContent = user.name.split(' ')[0];

  // 5. Setup Topbar Dropdown
  const topbarUserPill = document.querySelector('.topbar-user');
  if (topbarUserPill) {
    topbarUserPill.onclick = (e) => {
      e.stopPropagation();
      toggleDropdown();
    };
  }

  // 6. Mobile Menu Logic
  const hamBtn = document.getElementById('ham-btn');
  const sidebarEl = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const navItems = document.querySelectorAll('.nav-item');

  if (hamBtn && sidebarEl && overlay) {
    hamBtn.onclick = (e) => {
      e.stopPropagation();
      sidebarEl.classList.toggle('open');
      overlay.classList.toggle('visible');
    };

    overlay.onclick = () => {
      sidebarEl.classList.remove('open');
      overlay.classList.remove('visible');
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        sidebarEl.classList.remove('open');
        overlay.classList.remove('visible');
      });
    });
  }

  // Initial state update
  await updateLayoutState();
}

/**
 * Updates dynamic parts of the layout that change on navigation
 * (Active links, badges, visibility)
 */
export async function updateLayoutState() {
  const user = currentUser();
  if (!user) return;

  const currentHash = window.location.hash || '#/dashboard';
  const navItems = document.querySelectorAll('.nav-item');
  const role = user.role;

  // Update active state and visibility
  navItems.forEach(item => {
    // Role visibility
    if (item.classList.contains('admin-only')) {
      item.style.display = role === 'admin' ? 'flex' : 'none';
    }

    // Active Highlight
    const href = item.getAttribute('href');
    if (currentHash === href || (href !== '#/dashboard' && currentHash.startsWith(href + '/'))) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update Pending Count
  if (role === 'admin') {
    const loans = await db.getLoans();
    const pendingCount = loans.filter(l => l.status === 'pending').length;
    const badge = document.getElementById('nav-pending-badge');
    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }
}

function toggleDropdown() {
  const existing = document.querySelector('.user-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

  const user = currentUser();
  const dropdown = document.createElement('div');
  dropdown.className = 'user-dropdown';
  dropdown.innerHTML = `
    <div class="dropdown-header">
      <div class="dropdown-user-name">${user.name}</div>
      <div class="dropdown-user-role">${user.role.replace('_', ' ')}</div>
    </div>
    <div class="dropdown-item" onclick="navigate('#/profile')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      My Profile
    </div>
    ${user.role === 'admin' ? `
      <a href="#/settings" class="dropdown-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        Settings
      </a>
    ` : ''}
    <div style="height: 1px; background: #F0F5FB; margin: 4px 0;"></div>
    <div class="dropdown-item danger" id="topbar-signout-btn" data-action="signout">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
      Sign Out
    </div>
  `;

  document.querySelector('.topbar-user').appendChild(dropdown);
  
  // Re-init buttons for the newly created dropdown
  initSignOutButtons();
}

/**
 * Robust sign out button wiring
 */
export function initSignOutButtons() {
    // 1. Sidebar Button
    const sidebarBtn = document.getElementById('signout-btn');
    if (sidebarBtn && !sidebarBtn.dataset.listenerAttached) {
        sidebarBtn.dataset.listenerAttached = 'true';
        sidebarBtn.onclick = (e) => {
            e.preventDefault();
            showSignOutConfirm(() => window.handleLogout());
        };
    }

    // 2. Topbar dropdown button
    const topbarBtn = document.getElementById('topbar-signout-btn');
    if (topbarBtn && !topbarBtn.dataset.listenerAttached) {
        topbarBtn.dataset.listenerAttached = 'true';
        topbarBtn.onclick = (e) => {
            e.preventDefault();
            showSignOutConfirm(() => window.handleLogout());
        };
    }
}

/**
 * Custom Confirmation Modal for Sign Out
 */
function showSignOutConfirm(onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
      <div class="modal" style="max-width:380px; animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
        <div class="modal-header">
          <span style="font-size:16px; font-weight:700; color:#1A2332">
            Sign out?
          </span>
        </div>
        <div class="modal-body" style="padding:20px 24px">
          <p style="font-size:14px; color:#6B7A90; margin:0; line-height:1.6">
            You will be returned to the login screen. 
            Any unsaved changes will be lost.
          </p>
        </div>
        <div class="modal-footer" style="padding: 12px 24px; background: #F9FAFB; border-top: 1px solid #EDF2F7; display: flex; justify-content: flex-end; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="signout-cancel" style="padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;">
            Cancel
          </button>
          <button class="btn btn-danger btn-sm" id="signout-confirm" style="padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; background: #DC2626; color: white;">
            Yes, sign out
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('signout-cancel').onclick = () => modal.remove();
    document.getElementById('signout-confirm').onclick = () => {
      modal.remove();
      onConfirm();
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
}
