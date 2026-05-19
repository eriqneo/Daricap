import db from './db';

let _currentUser = null;

export async function initAuth() {
    _currentUser = await db.getSession();
    return _currentUser;
}

export function requireAuth() {
    if (!_currentUser) {
        window.location.hash = '#/login';
        return false;
    }
    return true;
}

export function requireAdmin() {
    if (!requireAuth()) return false;
    if (_currentUser.role !== 'admin') {
        window.location.hash = '#/';
        return false;
    }
    return true;
}

export function currentUser() {
    return _currentUser;
}

export function isAdmin() {
    return _currentUser?.role === 'admin';
}

export function getRole() {
    return _currentUser?.role || 'guest';
}

export async function login(email, password) {
    const user = await db.login(email, password);
    _currentUser = user;
    return user;
}

export async function logout() {
    // Clear EVERY possible session storage location
    try {
        localStorage.removeItem('daricap_session');
        localStorage.removeItem('daricap_user');
        localStorage.removeItem('daricap_auth');
        localStorage.removeItem('currentUser');
        
        // SessionStorage too
        sessionStorage.clear();
        
        // Clear in-memory cache
        _currentUser = null;
        if (window._daricapSession) window._daricapSession = null;
        if (window._currentUser) window._currentUser = null;
        
    } catch (e) {
        console.error('Logout storage clear error:', e);
    }
    
    // Explicitly update db if possible, but don't wait forever
    try {
        await db.logout();
    } catch (e) {
        console.warn('DB logout failed during hard logout:', e);
    }

    // Hard redirect
    window.location.hash = '#/login';
    
    // Force a reload to clear all in-memory state completely
    window.location.reload();
}

// Export aliases
export { logout as handleLogout, logout as signOut };

// Attach to window for inline onclick fallback
window.handleLogout = logout;
window.signOut = logout;
window.logout = logout;
