const AuthUI = (() => {
  const apiBase = () => (window.SHU_SERVER_URL || '').replace(/\/$/, '');

  async function api(path, body) {
    const res = await fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  async function tryAutoLogin() {
    const token = localStorage.getItem('shu_token');
    if (!token) return null;
    try {
      const res = await fetch(apiBase() + '/api/me', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) { localStorage.removeItem('shu_token'); return null; }
      const data = await res.json();
      return { token, user: data.user };
    } catch {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem('shu_token');
  }

  let els = null;
  function bindElements() {
    if (els) return els;
    els = {
      overlay: document.getElementById('auth-overlay'),
      tabs: document.querySelectorAll('#auth-overlay .tab'),
      loginForm: document.getElementById('login-form'),
      signupForm: document.getElementById('signup-form'),
      loginError: document.getElementById('login-error'),
      signupError: document.getElementById('signup-error'),
      cancelBtn: document.getElementById('auth-cancel'),
    };
    els.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        els.tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const isLogin = tab.dataset.tab === 'login';
        els.loginForm.hidden = !isLogin;
        els.signupForm.hidden = isLogin;
      });
    });
    return els;
  }

  function show({ onSuccess, onCancel }) {
    const e = bindElements();
    e.overlay.hidden = false;
    e.loginError.textContent = '';
    e.signupError.textContent = '';

    function finish(result) {
      e.overlay.hidden = true;
      e.loginForm.onsubmit = null;
      e.signupForm.onsubmit = null;
      e.cancelBtn.onclick = null;
      if (result) onSuccess(result);
    }

    e.loginForm.onsubmit = async (ev) => {
      ev.preventDefault();
      e.loginError.textContent = '';
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        const data = await api('/api/login', { username, password });
        localStorage.setItem('shu_token', data.token);
        finish({ token: data.token, user: data.user });
      } catch (err) {
        e.loginError.textContent = err.message;
      }
    };

    e.signupForm.onsubmit = async (ev) => {
      ev.preventDefault();
      e.signupError.textContent = '';
      const username = document.getElementById('signup-username').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      try {
        const data = await api('/api/signup', { username, email, password });
        localStorage.setItem('shu_token', data.token);
        finish({ token: data.token, user: data.user });
      } catch (err) {
        e.signupError.textContent = err.message;
      }
    };

    e.cancelBtn.onclick = () => {
      finish(null);
      if (onCancel) onCancel();
    };
  }

  return { show, tryAutoLogin, logout, apiBase };
})();
