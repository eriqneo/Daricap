import db from '../db';
import { currentUser } from '../auth';

export async function initNotifications() {
  const user = currentUser();
  if (!user) return;

  // Initial update
  await updateNotificationBadge();

  // Polling every 30 seconds
  setInterval(async () => {
    await updateNotificationBadge();
  }, 30000);
}

export async function updateNotificationBadge() {
  const user = currentUser();
  if (!user) return;

  try {
    const unreadCount = await db.getUnreadCount(user.id);
    const bellBtn = document.querySelector('.icon-btn');
    if (!bellBtn) return;

    // Set SVG icon if not already set or text
    if (bellBtn.textContent === '🔔') {
      bellBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      `;
    }

    let badge = bellBtn.querySelector('.notif-badge');
    if (unreadCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-badge';
        badge.style.cssText = `
          position: absolute;
          top: -2px;
          right: -2px;
          background: #EF4444;
          color: white;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 5px;
          border-radius: 10px;
          border: 2px solid white;
          min-width: 18px;
          text-align: center;
        `;
        bellBtn.style.position = 'relative';
        bellBtn.appendChild(badge);
      }
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    } else if (badge) {
      badge.remove();
    }
  } catch (err) {
    console.warn('Failed to update notification badge', err);
  }
}

export function renderNotificationDropdown() {
  const bellBtn = document.querySelector('.icon-btn');
  if (!bellBtn) return;

  let existing = document.getElementById('notif-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

  const dropdown = document.createElement('div');
  dropdown.id = 'notif-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: 55px;
    right: 0;
    width: 360px;
    max-height: 480px;
    background: white;
    border-radius: 12px;
    border: 1px solid #E2E8F0;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideDown 0.2s ease-out;
  `;

  dropdown.innerHTML = `
    <div style="padding: 1rem 1.25rem; border-bottom: 1px solid #F1F5F9; display: flex; justify-content: space-between; align-items: center; background: #fff;">
      <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #1E293B;">Notifications</h3>
      <button id="mark-all-read" style="background: none; border: none; color: #2563EB; font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px 8px; border-radius: 6px;">Mark all read</button>
    </div>
    <div id="notif-items" style="overflow-y: auto; flex: 1; min-height: 100px; background: #fff;">
      <div style="padding: 3rem 2rem; text-align: center; color: #94A3B8;">
         <div class="loading-spinner" style="width: 24px; height: 24px; margin: 0 auto;"></div>
      </div>
    </div>
    <div style="padding: 0.75rem; text-align: center; border-top: 1px solid #F1F5F9; background: #F8FAFC;">
      <a href="#/settings" style="font-size: 12px; font-weight: 700; color: #64748B; text-decoration: none;">View all notifications</a>
    </div>
  `;

  bellBtn.parentElement.style.position = 'relative';
  bellBtn.parentElement.appendChild(dropdown);

  const closeHandler = (e) => {
    if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('mousedown', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);

  // Mark all read listener
  dropdown.querySelector('#mark-all-read').onclick = async () => {
    const user = currentUser();
    if (!user) return;
    const items = await db.getNotifications(user.id);
    for (const item of items) {
      if (!item.read) await db.markNotificationRead(item.id);
    }
    await updateNotificationBadge();
    renderList();
  };

  async function renderList() {
    const user = currentUser();
    const items = await db.getNotifications(user.id);
    const list = document.getElementById('notif-items');
    if (!list) return;

    if (items.length === 0) {
      list.innerHTML = `
        <div style="padding: 4rem 2rem; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">🔔</div>
          <p style="color: #64748B; font-weight: 600; font-size: 14px;">No notifications yet</p>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(item => {
      const type = item.type || 'info';
      const colors = {
        info: '#2563EB',
        approved: '#10B981',
        declined: '#EF4444'
      };
      
      return `
        <div class="notif-item" data-id="${item.id}" data-loan="${item.loanId || ''}" 
             style="padding: 1rem 1.25rem; border-bottom: 1px solid #F8FAFC; cursor: pointer; display: flex; gap: 1rem; transition: background 0.2s;
                    ${!item.read ? 'background: #F8FAFF; border-left: 3px solid #2563EB;' : 'background: white; border-left: 3px solid transparent;'}">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: ${colors[type]}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${colors[type]};"></div>
          </div>
          <div style="flex: 1;">
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${!item.read ? '#1E293B' : '#64748B'}; font-weight: ${!item.read ? '600' : '500'};">
              ${item.message}
            </p>
            <p style="margin: 0.25rem 0 0; font-size: 12px; color: #94A3B8; font-weight: 500;">
              ${formatTimeAgo(item.createdAt)}
            </p>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.notif-item').forEach(el => {
      el.onclick = async () => {
        const id = el.dataset.id;
        const loanId = el.dataset.loan;
        await db.markNotificationRead(id);
        await updateNotificationBadge();
        dropdown.remove();
        if (loanId) {
          window.location.hash = `#/loans/view?id=${loanId}`;
        }
      };
    });
  }

  renderList();
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 172800) return 'Yesterday';
  return date.toLocaleDateString();
}
