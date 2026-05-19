import { login } from '../auth';
import { showToast } from '../components/toast';

export function renderLogin(container) {
  // ... rest of template ...
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 2rem; background-color: var(--color-bg);">
      <div class="card" style="width: 100%; max-width: 400px; padding: 2.5rem; border-radius: 1.5rem; background: white;">
        <div style="text-align: center; margin-bottom: 2.5rem;">
          <div class="logo-mark" style="margin: 0 auto 1.25rem;">DN</div>
          <h1 style="color: var(--color-primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem;">Welcome back</h1>
          <p style="color: var(--text-muted); font-size: 0.875rem; font-weight: 500;">Sign in to your DariCap account</p>
        </div>

        <div id="login-error" style="display: none; padding: 0.875rem; background-color: rgba(231, 76, 60, 0.1); border: 1px solid rgba(231, 76, 60, 0.2); border-radius: 0.75rem; color: var(--color-danger); font-size: 0.875rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center;">
          Incorrect email or password. Please try again.
        </div>

        <form id="login-form">
          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.625rem;">Email Address</label>
            <input type="email" id="email" required placeholder="name@example.com" class="search-input" style="width: 100%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 0.75rem; padding: 0.875rem 1rem; color: var(--text-main); font-weight: 500;">
          </div>
          <div class="form-group" style="margin-bottom: 2rem;">
            <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.625rem;">Password</label>
            <input type="password" id="password" required placeholder="••••••••" class="search-input" style="width: 100%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 0.75rem; padding: 0.875rem 1rem; color: var(--text-main); font-weight: 500;">
          </div>
          <button type="submit" id="login-btn" class="action-btn" style="padding: 1rem; font-size: 0.875rem; border-radius: 0.75rem; background-color: var(--color-primary); box-shadow: 0 10px 15px -3px rgba(26, 75, 140, 0.2);">Sign in</button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';
    btn.textContent = 'Signing in...';
    btn.disabled = true;

    try {
      const email = document.getElementById('email').value;
      const pass = document.getElementById('password').value;
      
      await login(email, pass);
      showToast('Welcome back to DariCap Network!');
      window.location.hash = '#/';
    } catch (err) {
      console.error('Login failed:', err);
      showToast(err.message || 'Identity verification failed.', 'error');
      errorDiv.textContent = err.message || 'Incorrect email or password.';
      errorDiv.style.display = 'block';
      btn.textContent = 'Sign in';
      btn.disabled = false;
    }
  });
}
