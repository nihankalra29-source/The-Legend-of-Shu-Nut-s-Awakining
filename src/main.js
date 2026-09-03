const KEYMAP = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  confirm: ['KeyZ', 'Enter'],
  back: ['KeyX', 'ShiftLeft', 'ShiftRight', 'Escape'],
};

class Input {
  constructor() {
    this.keysDown = new Set();
    this.justPressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.keysDown.has(e.code)) this.justPressed.add(e.code);
      this.keysDown.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
  }
  held(action) { return KEYMAP[action].some(k => this.keysDown.has(k)); }
  pressed(action) { return KEYMAP[action].some(k => this.justPressed.has(k)); }
  endFrame() { this.justPressed.clear(); }
}

function isSolidTile(ch) {
  return ch === '#' || ch === ' ' || ch === undefined || ch === 'C';
}

const ROLE_COLORS = { owner: '#e8b23d', manager: '#ef8b3d', admin: '#e2503f', player: '#f2ead3' };
const ROLE_TAGS = { owner: '[OWNER]', manager: '[MANAGER]', admin: '[ADMIN]' };

class Game {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = new Input();
    this.state = 'title';
    this.dialogue = new DialogueBox();
    this.battle = null;
    this.defeated = new Set(); // ids like "grove:sprig"
    this.lastBattleId = null;
    this.endingKind = null;
    this.titleIndex = 0;
    this.titleOptions = ['Single Player', 'Multiplayer'];
    this.mp = null;
    this.mpError = '';
    registerGame(this);
    this.loadMap('village');
  }

  loadMap(id, spawnX, spawnY) {
    this.mapId = id;
    this.map = MAPS[id];
    const start = this.map.playerStart;
    this.player = {
      x: (spawnX !== undefined ? spawnX : start.x) * TILE_SIZE + TILE_SIZE / 2,
      y: (spawnY !== undefined ? spawnY : start.y) * TILE_SIZE + TILE_SIZE / 2,
      dir: 'down',
      moving: false,
    };
  }

  tileAt(tx, ty) {
    const row = this.map.tiles[ty];
    if (!row) return '#';
    return row[tx] || '#';
  }

  npcAt(tx, ty) {
    return this.map.npcs.find(n => n.x === tx && n.y === ty && !this.defeated.has(this.mapId + ':' + (n.battleId || n.name)));
  }
  chestAt(tx, ty) {
    return this.map.chests.find(c => c.x === tx && c.y === ty);
  }

  collides(px, py) {
    const half = 10;
    const points = [
      [px - half, py - half], [px + half, py - half],
      [px - half, py + half], [px + half, py + half],
    ];
    for (const [x, y] of points) {
      const tx = Math.floor(x / TILE_SIZE), ty = Math.floor(y / TILE_SIZE);
      const ch = this.tileAt(tx, ty);
      if (isSolidTile(ch)) return true;
      // In multiplayer, whether a chasm/door actually leads anywhere is the
      // server's call (it holds the real inventory) - the client just lets
      // you walk up to it.
      if (ch === '~' && this.state !== 'multiplayer' && !Story.hasFlag('acorn_key')) return true;
      if (this.state !== 'multiplayer' && this.npcAt(tx, ty)) return true;
    }
    return false;
  }

  update(dt) {
    if (this.state === 'title') {
      if (this.input.pressed('up') || this.input.pressed('down')) {
        this.titleIndex = 1 - this.titleIndex;
      }
      if (this.input.pressed('confirm')) {
        if (this.titleOptions[this.titleIndex] === 'Single Player') this.state = 'overworld';
        else this.enterMultiplayer();
      }
      this.input.endFrame();
      return;
    }

    if (this.state === 'overworld') this.updateOverworld(dt);
    else if (this.state === 'dialogue') {
      this.dialogue.update(dt);
      if (this.input.pressed('confirm')) this.dialogue.advance();
    }
    else if (this.state === 'battle') this.updateBattle(dt);
    else if (this.state === 'multiplayer') this.updateMultiplayer(dt);
    else if (this.state === 'mp-error') {
      if (this.input.pressed('confirm') || this.input.pressed('back')) this.state = 'title';
    }
    else if (this.state === 'ending' || this.state === 'gameover') {
      if (this.input.pressed('confirm')) location.reload();
    }

    this.input.endFrame();
  }

  // ---- Multiplayer ----

  async enterMultiplayer() {
    this.state = 'authgate';
    const auto = await AuthUI.tryAutoLogin();
    if (auto) {
      this.connectMultiplayer(auto.token, auto.user);
      return;
    }
    AuthUI.show({
      onSuccess: ({ token, user }) => this.connectMultiplayer(token, user),
      onCancel: () => { this.state = 'title'; },
    });
  }

  async connectMultiplayer(token, user) {
    this.state = 'connecting';
    this.mpUser = user;
    const mp = new MultiplayerClient(token, {
      onChat: (msg) => ChatUI.chat(msg),
      onSystem: (text) => ChatUI.system(text),
      onTpaRequest: (from) => ChatUI.system(`${from} wants to teleport to you! Type /tpaccept or /tpdeny.`),
      onTeleport: (msg) => { this.player.x = msg.x; this.player.y = msg.y; },
      onMapChanged: (msg) => {
        this.mapId = msg.map;
        this.map = MAPS[msg.map];
        this.player.x = msg.x;
        this.player.y = msg.y;
        ChatUI.system(`You arrive in ${this.map.name}.`);
      },
      onRoleUpdate: (role) => { if (this.mpUser) this.mpUser.role = role; },
      onPlayerJoined: (p) => ChatUI.system(`${p.username} joined the world.`),
      onPlayerLeft: (p) => ChatUI.system(`${p ? p.username : 'A player'} left the world.`),
      onKicked: (reason) => { this.mpError = reason; this.state = 'mp-error'; ChatUI.hide(); },
      onClose: (reason) => {
        if (this.state === 'multiplayer') {
          this.mpError = reason || 'Disconnected from the server.';
          this.state = 'mp-error';
          ChatUI.hide();
        }
      },
    });
    try {
      await mp.connect();
    } catch (err) {
      this.mpError = err.message;
      this.state = 'mp-error';
      return;
    }
    this.mp = mp;
    this.mapId = 'village';
    this.map = MAPS.village;
    this.player = { x: mp.you.x, y: mp.you.y, dir: mp.you.dir, moving: false };
    ChatUI.clearLog();
    ChatUI.show();
    ChatUI.system(`Welcome, ${user.username}! You are playing on the shared multiplayer world.`);
    ChatUI.onSubmit((text) => this.mp.sendChat(text));
    this.state = 'multiplayer';
  }

  updateMultiplayer(dt) {
    if (!this.mp || !this.mp.ws || this.mp.ws.readyState !== 1) return;
    if (ChatUI.isInputFocused()) return;

    if (this.input.pressed('confirm')) {
      ChatUI.focusInput();
      return;
    }
    if (this.input.pressed('back')) {
      this.leaveMultiplayer();
      return;
    }

    const speed = 110;
    const p = this.player;
    let dx = 0, dy = 0;
    if (this.input.held('left')) { dx -= 1; p.dir = 'left'; }
    if (this.input.held('right')) { dx += 1; p.dir = 'right'; }
    if (this.input.held('up')) { dy -= 1; p.dir = 'up'; }
    if (this.input.held('down')) { dy += 1; p.dir = 'down'; }
    p.moving = dx !== 0 || dy !== 0;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx = (dx / len) * speed * dt;
      dy = (dy / len) * speed * dt;
      if (!this.collides(p.x + dx, p.y)) p.x += dx;
      if (!this.collides(p.x, p.y + dy)) p.y += dy;
      this.mp.sendMove(p.x, p.y, p.dir);
    }
  }

  leaveMultiplayer() {
    if (this.mp) this.mp.close();
    this.mp = null;
    ChatUI.hide();
    this.state = 'title';
  }

  updateOverworld(dt) {
    const speed = 110;
    const p = this.player;
    let dx = 0, dy = 0;
    if (this.input.held('left')) { dx -= 1; p.dir = 'left'; }
    if (this.input.held('right')) { dx += 1; p.dir = 'right'; }
    if (this.input.held('up')) { dy -= 1; p.dir = 'up'; }
    if (this.input.held('down')) { dy += 1; p.dir = 'down'; }
    p.moving = dx !== 0 || dy !== 0;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx = (dx / len) * speed * dt;
      dy = (dy / len) * speed * dt;
      if (!this.collides(p.x + dx, p.y)) p.x += dx;
      if (!this.collides(p.x, p.y + dy)) p.y += dy;
    }

    const tx = Math.floor(p.x / TILE_SIZE), ty = Math.floor(p.y / TILE_SIZE);

    for (const t of this.map.transitions) {
      if (t.x === tx && t.y === ty) {
        if (t.requires && !Story.hasFlag(t.requires)) {
          if (t.lockedDialogue) this.startDialogue(t.lockedDialogue);
          const push = 6;
          if (p.dir === 'up') p.y += push;
          if (p.dir === 'down') p.y -= push;
          if (p.dir === 'left') p.x += push;
          if (p.dir === 'right') p.x -= push;
        } else {
          this.loadMap(t.toMap, t.toX, t.toY);
        }
        break;
      }
    }

    if (this.input.pressed('confirm')) this.tryInteract();
  }

  facingTile() {
    const p = this.player;
    const tx = Math.floor(p.x / TILE_SIZE), ty = Math.floor(p.y / TILE_SIZE);
    if (p.dir === 'up') return [tx, ty - 1];
    if (p.dir === 'down') return [tx, ty + 1];
    if (p.dir === 'left') return [tx - 1, ty];
    return [tx + 1, ty];
  }

  tryInteract() {
    const [fx, fy] = this.facingTile();
    const npc = this.npcAt(fx, fy);
    if (npc) {
      if (npc.isEnemy) {
        this.pendingBattleId = npc.battleId;
        this.pendingBattleMapKey = this.mapId + ':' + (npc.battleId || npc.name);
        if (npc.dialogueId) this.startDialogue(npc.dialogueId);
        else this.startBattle(npc.battleId, this.pendingBattleMapKey);
      } else if (npc.dialogueId) {
        this.startDialogue(npc.dialogueId);
      }
      return;
    }
    const chest = this.chestAt(fx, fy);
    if (chest && !chest.taken) {
      chest.taken = true;
      Story.setFlag(chest.itemId);
      this.startDialogue(chest.itemId === 'acorn_key' ? 'chest_key' : 'chest_lantern');
    }
  }

  startDialogue(id) {
    this.state = 'dialogue';
    this.dialogue.start(id, () => {
      if (this.state === 'dialogue') this.state = 'overworld';
    });
  }

  onDialogueAction(action) {
    if (action === 'start_king_battle') {
      this.startBattle(this.pendingBattleId || 'withered_king', this.pendingBattleMapKey);
    } else if (action === 'ending') {
      this.state = 'ending';
    }
  }

  startBattle(battleId, defeatKey) {
    this.lastBattleId = battleId;
    this.lastDefeatKey = defeatKey;
    this.battle = new Battle(battleId, null);
    this.state = 'battle';
  }

  updateBattle(dt) {
    this.battle.update(dt, this.input);
    if (this.battle.state === 'won' || this.battle.state === 'spared') {
      const kind = this.battle.state;
      if (this.lastDefeatKey) this.defeated.add(this.lastDefeatKey);
      this.state = 'overworld';
      if (this.lastBattleId === 'withered_king') {
        this.startDialogue(kind === 'spared' ? 'post_spare' : 'post_fight');
      } else {
        const def = BATTLES[this.lastBattleId];
        this.state = 'overworld';
        // brief flavor text via dialogue-free message: reuse dialogue box with a one-off line
        DIALOGUES.__temp = { lines: [{ speaker: 'Narrator', text: kind === 'spared' ? def.victorySpare : def.victoryFight }] };
        this.startDialogue('__temp');
      }
      this.battle = null;
    } else if (this.battle.state === 'lost') {
      this.state = 'gameover';
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    if (this.state === 'title' || this.state === 'authgate') return this.drawTitle();
    if (this.state === 'connecting') return this.drawMessageScreen('Connecting to the multiplayer world...');
    if (this.state === 'mp-error') return this.drawMessageScreen(this.mpError, true);
    if (this.state === 'ending') return this.drawEnding();
    if (this.state === 'gameover') return this.drawGameOver();
    if (this.state === 'battle' && this.battle) return this.battle.draw(ctx);

    if (this.state === 'multiplayer') this.drawMultiplayer();
    else this.drawOverworld();
    if (this.state === 'dialogue') this.dialogue.draw(ctx);
  }

  drawMessageScreen(text, showRestart) {
    const ctx = this.ctx;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2ead3';
    ctx.font = '12px "Press Start 2P", monospace';
    wrapText(ctx, text, w / 2, h / 2, w - 120, 22);
    ctx.textAlign = 'left';
    if (showRestart) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9a8fae';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('Press Z to return to the title', w / 2, h / 2 + 60);
      ctx.textAlign = 'left';
    }
  }

  drawMultiplayer() {
    this.drawOverworld();
    if (!this.mp) return;
    const ctx = this.ctx;
    for (const p of this.mp.players.values()) {
      const sprite = p.dir === 'up' ? SPR_SHU_UP : p.dir === 'down' ? SPR_SHU_DOWN : SPR_SHU_SIDE;
      drawSprite(ctx, sprite, p.x - 24, p.y - 30, 3);
      this.drawNameTag(p.username, p.role, p.x, p.y);
    }
    if (this.mpUser) {
      this.drawNameTag(this.mpUser.username, this.mpUser.role, this.player.x, this.player.y);
    }
  }

  drawNameTag(username, role, x, y) {
    const ctx = this.ctx;
    const color = ROLE_COLORS[role] || ROLE_COLORS.player;
    const tag = ROLE_TAGS[role] ? `${username} ${ROLE_TAGS[role]}` : username;
    ctx.textAlign = 'center';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = color;
    ctx.fillText(tag, x, y - 36);
    ctx.textAlign = 'left';
  }

  drawOverworld() {
    const ctx = this.ctx;
    const map = this.map;
    ctx.fillStyle = map.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let ty = 0; ty < map.tiles.length; ty++) {
      const row = map.tiles[ty];
      for (let tx = 0; tx < row.length; tx++) {
        const ch = row[tx];
        const x = tx * TILE_SIZE, y = ty * TILE_SIZE;
        if (ch === '#') {
          ctx.fillStyle = map.wall;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        } else {
          ctx.fillStyle = map.floor;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          if (ch === '~') {
            ctx.fillStyle = Story.hasFlag('acorn_key') ? '#2b1f45' : '#0a0612';
            ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
          } else if (ch === '^') {
            ctx.fillStyle = '#f2ead3';
            ctx.fillRect(x + 12, y + 12, 8, 8);
          } else if (ch === 'D') {
            ctx.fillStyle = '#e8b23d';
            ctx.fillRect(x + 6, y + 4, TILE_SIZE - 12, TILE_SIZE - 8);
          }
        }
      }
    }

    for (const chest of map.chests) {
      if (!chest.taken) drawSprite(ctx, SPR_CHEST, chest.x * TILE_SIZE + 2, chest.y * TILE_SIZE + 10, 4.5);
    }
    for (const npc of map.npcs) {
      if (this.defeated.has(this.mapId + ':' + (npc.battleId || npc.name))) continue;
      drawSprite(ctx, npc.sprite, npc.x * TILE_SIZE - 8, npc.y * TILE_SIZE - 16, 3);
    }

    const p = this.player;
    const sprite = p.dir === 'up' ? SPR_SHU_UP : p.dir === 'down' ? SPR_SHU_DOWN : SPR_SHU_SIDE;
    const flip = p.dir === 'left';
    ctx.save();
    if (flip) {
      ctx.translate(p.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-p.x, 0);
    }
    drawSprite(ctx, sprite, p.x - 24, p.y - 30, 3);
    ctx.restore();

    ctx.fillStyle = '#f2ead3';
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillText(map.name, 12, 20);
    let hy = 40;
    if (Story.hasFlag('acorn_key')) { ctx.fillText('* Acorn Key', 12, hy); hy += 16; }
    if (Story.hasFlag('husk_lantern')) { ctx.fillText('* Husk Lantern', 12, hy); hy += 16; }
  }

  drawTitle() {
    const ctx = this.ctx;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8b23d';
    ctx.font = '22px "Press Start 2P", monospace';
    ctx.fillText('THE LEGEND OF SHU', w / 2, h / 2 - 60);
    ctx.font = '13px "Press Start 2P", monospace';
    ctx.fillStyle = '#f2ead3';
    ctx.fillText('a Nut Between the Worlds', w / 2, h / 2 - 24);
    drawSprite(ctx, SPR_SHU_DOWN, w / 2 - 24, h / 2 - 20, 3);

    this.titleOptions.forEach((opt, i) => {
      ctx.font = '13px "Press Start 2P", monospace';
      ctx.fillStyle = i === this.titleIndex ? '#e8b23d' : '#f2ead3';
      ctx.fillText((i === this.titleIndex ? '> ' : '') + opt, w / 2, h / 2 + 100 + i * 30);
    });

    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#9a8fae';
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) ctx.fillText('Up/Down to choose - Z to confirm', w / 2, h / 2 + 175);
    ctx.textAlign = 'left';
  }

  drawEnding() {
    const ctx = this.ctx;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8b23d';
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillText('THE WORLDS ARE ONE AGAIN', w / 2, h / 2 - 30);
    ctx.fillStyle = '#f2ead3';
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillText('Thank you for playing.', w / 2, h / 2 + 10);
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) ctx.fillText('Press Z to Restart', w / 2, h / 2 + 60);
    ctx.textAlign = 'left';
  }

  drawGameOver() {
    const ctx = this.ctx;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c94f4f';
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillText('SHU WAS OVERWHELMED...', w / 2, h / 2 - 10);
    ctx.fillStyle = '#f2ead3';
    ctx.font = '11px "Press Start 2P", monospace';
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) ctx.fillText('Press Z to Restart', w / 2, h / 2 + 40);
    ctx.textAlign = 'left';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const game = new Game(ctx);
  window.__GAME__ = game;

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
