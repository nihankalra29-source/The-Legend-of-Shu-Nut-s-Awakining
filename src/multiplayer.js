function wsUrl() {
  const base = window.SHU_SERVER_URL || location.origin;
  return base.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function badgeHtml(role) {
  if (role === 'owner') return ' <span class="owner-badge">[OWNER]</span>';
  if (role === 'manager') return ' <span class="manager-badge">[MANAGER]</span>';
  if (role === 'admin') return ' <span class="admin-badge">[ADMIN]</span>';
  return '';
}

class MultiplayerClient {
  constructor(token, handlers) {
    this.token = token;
    this.handlers = handlers;
    this.ws = null;
    this.you = null;
    this.players = new Map(); // id -> {id, username, role, x, y, dir}
    this.lastSent = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl());
      let settled = false;
      this.ws.onopen = () => this.ws.send(JSON.stringify({ type: 'auth', token: this.token }));
      this.ws.onerror = () => {
        if (!settled) { settled = true; reject(new Error('Could not reach the multiplayer server.')); }
      };
      this.ws.onclose = (ev) => {
        if (!settled) { settled = true; reject(new Error('Connection closed before joining.')); }
        if (this.handlers.onClose) this.handlers.onClose(ev.reason || 'Disconnected.');
      };
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'welcome' && !settled) {
          settled = true;
          this.you = msg.you;
          for (const p of msg.players) this.players.set(p.id, p);
          resolve(this);
        }
        this.handleMessage(msg);
      };
    });
  }

  handleMessage(msg) {
    const h = this.handlers;
    switch (msg.type) {
      case 'playerJoined':
        this.players.set(msg.player.id, msg.player);
        if (h.onPlayerJoined) h.onPlayerJoined(msg.player);
        break;
      case 'playerLeft': {
        const p = this.players.get(msg.id);
        this.players.delete(msg.id);
        if (h.onPlayerLeft) h.onPlayerLeft(p);
        break;
      }
      case 'playerMoved': {
        const p = this.players.get(msg.id);
        if (p) { p.x = msg.x; p.y = msg.y; p.dir = msg.dir; }
        break;
      }
      case 'playerUpdate': {
        const p = this.players.get(msg.id);
        if (p && msg.role) p.role = msg.role;
        break;
      }
      case 'roleUpdate':
        if (this.you) this.you.role = msg.role;
        if (h.onRoleUpdate) h.onRoleUpdate(msg.role);
        if (h.onSystem) h.onSystem(`Your role is now ${msg.role.toUpperCase()}.`);
        break;
      case 'chat':
        if (h.onChat) h.onChat(msg);
        break;
      case 'system':
        if (h.onSystem) h.onSystem(msg.text);
        break;
      case 'tpaRequest':
        if (h.onTpaRequest) h.onTpaRequest(msg.from);
        break;
      case 'teleport':
        if (this.you) { this.you.x = msg.x; this.you.y = msg.y; }
        if (h.onTeleport) h.onTeleport(msg);
        break;
      case 'mapChanged':
        this.players.clear();
        for (const p of msg.players) this.players.set(p.id, p);
        if (this.you) { this.you.map = msg.map; this.you.x = msg.x; this.you.y = msg.y; }
        if (h.onMapChanged) h.onMapChanged(msg);
        break;
      case 'kicked':
        if (h.onKicked) h.onKicked(msg.reason);
        this.close();
        break;
    }
  }

  sendMove(x, y, dir) {
    const now = performance.now();
    if (now - this.lastSent < 60) return;
    this.lastSent = now;
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'move', x, y, dir }));
  }

  sendChat(text) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'chat', text }));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

const ChatUI = (() => {
  let els = null;
  function bind() {
    if (els) return els;
    els = {
      overlay: document.getElementById('chat-overlay'),
      log: document.getElementById('chat-log'),
      input: document.getElementById('chat-input'),
    };
    return els;
  }

  function show() { bind().overlay.hidden = false; }
  function hide() { bind().overlay.hidden = true; }

  function line(html) {
    const e = bind();
    const div = document.createElement('div');
    div.innerHTML = html;
    e.log.appendChild(div);
    while (e.log.children.length > 50) e.log.removeChild(e.log.firstChild);
    e.log.scrollTop = e.log.scrollHeight;
  }

  function system(text) { line(`<span class="sys-line">* ${escapeHtml(text).replace(/\n/g, '<br>* ')}</span>`); }
  function chat(msg) { line(`<b>${escapeHtml(msg.from)}</b>${badgeHtml(msg.role)}: ${escapeHtml(msg.text)}`); }

  function focusInput() { bind().input.focus(); }
  function isInputFocused() { return document.activeElement === bind().input; }
  function clearLog() { bind().log.innerHTML = ''; }

  function onSubmit(callback) {
    const e = bind();
    e.input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const text = e.input.value.trim();
        e.input.value = '';
        e.input.blur();
        if (text) callback(text);
      } else if (ev.key === 'Escape') {
        e.input.value = '';
        e.input.blur();
      }
      ev.stopPropagation();
    });
  }

  return { show, hide, system, chat, focusInput, isInputFocused, onSubmit, clearLog };
})();
