import db from '../db';
import { currentUser } from '../auth';

export async function updatePendingBadge() {
  const user = currentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'loan_manager')) {
    const badge = document.getElementById('pending-badge');
    if (badge) badge.style.display = 'none';
    const container = document.getElementById('topbar-pending-container');
    if (container) container.innerHTML = '';
    return;
  }
  
  const pending = await db.getPendingLoans();
  const count = pending.length;
  
  // Sidebar Badge
  const badge = document.getElementById('pending-badge');
  if (badge) {
    if (count === 0) {
      badge.style.display = 'none';
    } else {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'inline-flex';
      badge.classList.toggle('urgent', count >= 3);
      
      // Reset animation by cloning if it's a new count or first time
      if (badge.dataset.lastCount !== String(count)) {
        const newBadge = badge.cloneNode(true);
        badge.parentNode.replaceChild(newBadge, badge);
        newBadge.dataset.lastCount = String(count);
      }
    }
  }

  // Topbar Pill
  const container = document.getElementById('topbar-pending-container');
  if (container) {
    if (count === 0) {
      container.innerHTML = '';
    } else {
      container.innerHTML = `
        <a href="#/admin/approval" class="topbar-pending-pill">
          ${count} application${count > 1 ? 's' : ''} awaiting review
        </a>
      `;
    }
  }
}

// Background refresh every 60 seconds
setInterval(updatePendingBadge, 60000);
