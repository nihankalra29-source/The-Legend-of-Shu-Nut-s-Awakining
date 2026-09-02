const BATTLES = {
  sprig: {
    name: 'Snarl Sprig',
    sprite: SPR_CRITTER,
    maxHp: 18,
    spareHp: 999, // sprig can always be spared once talked to
    acts: [
      { label: 'Talk', text: 'You crouch down and talk to the Sprig about the weather. It seems confused, but flattered.', unlocksSpare: true },
      { label: 'Check', text: 'Snarl Sprig - ATK 3 DEF 1. Mostly just wants to be left alone.' },
    ],
    attackPatterns: ['fallingSeeds'],
    intro: 'A wild Snarl Sprig blocks the path!',
    victoryFight: 'The Sprig scurries off into the underbrush.',
    victorySpare: 'You let the Sprig go. It chitters what might be a thank-you.',
  },
  withered_king: {
    name: 'The Withered King',
    sprite: SPR_WITHERED_KING,
    maxHp: 100,
    spareHp: 25,
    requiresActForSpare: 'Remember',
    acts: [
      { label: 'Remember', text: 'You remind him of the world before the Withering -- root and sky, whole. Something in him falters.', unlocksSpare: true },
      { label: 'Challenge', text: 'You stand your ground. He seems almost... amused.' },
      { label: 'Check', text: 'The Withered King - a shattered tyrant. ATK 9 DEF 4. Still, somewhere, a person.' },
    ],
    attackPatterns: ['fallingSeeds', 'rootSweep', 'chaos'],
    intro: 'The Withered King rises from the broken throne!',
    victoryFight: 'The Withered King falls still.',
    victorySpare: 'The Withered King lowers what remains of his crown.',
  },
};

class Battle {
  constructor(battleId, onEnd) {
    this.def = BATTLES[battleId];
    this.onEnd = onEnd;
    this.enemyHp = this.def.maxHp;
    this.playerHp = 20;
    this.playerMaxHp = 20;
    this.state = 'intro';
    this.introTimer = 1.2;
    this.menuIndex = 0;
    this.menuOptions = ['FIGHT', 'ACT', 'SPARE'];
    this.actIndex = 0;
    this.message = '';
    this.messageTimer = 0;
    this.actsUsed = new Set();
    this.canSpare = this.def.spareHp >= this.def.maxHp; // sprig-style: needs unlock flag instead
    this.spareUnlocked = false;

    // fight timing minigame
    this.fightMarker = 0;
    this.fightDir = 1;

    // bullet box (enemy turn)
    this.box = { x: 220, y: 300, w: 200, h: 130 };
    this.heart = { x: 320, y: 365, r: 6 };
    this.bullets = [];
    this.bulletTimer = 0;
    this.bulletDuration = 0;
    this.hitCooldown = 0;

    this.turnCount = 0;
  }

  get spareReady() {
    if (this.def.requiresActForSpare) {
      return this.actsUsed.has(this.def.requiresActForSpare) && this.enemyHp <= this.def.spareHp;
    }
    return this.spareUnlocked;
  }

  currentPhaseAttack() {
    const patterns = this.def.attackPatterns;
    const pct = this.enemyHp / this.def.maxHp;
    if (patterns.length === 1) return patterns[0];
    if (pct > 0.66) return patterns[0];
    if (pct > 0.33) return patterns[1] || patterns[0];
    return patterns[2] || patterns[patterns.length - 1];
  }

  update(dt, input) {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    if (this.state === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.state = 'menu';
      return;
    }

    if (this.state === 'menu') {
      if (input.pressed('up') || input.pressed('left')) {
        this.menuIndex = (this.menuIndex - 1 + this.menuOptions.length) % this.menuOptions.length;
      }
      if (input.pressed('down') || input.pressed('right')) {
        this.menuIndex = (this.menuIndex + 1) % this.menuOptions.length;
      }
      if (input.pressed('confirm')) {
        const choice = this.menuOptions[this.menuIndex];
        if (choice === 'FIGHT') this.startFight();
        else if (choice === 'ACT') { this.state = 'act'; this.actIndex = 0; }
        else if (choice === 'SPARE') this.trySpare();
      }
      return;
    }

    if (this.state === 'act') {
      const acts = this.def.acts;
      if (input.pressed('up')) this.actIndex = (this.actIndex - 1 + acts.length) % acts.length;
      if (input.pressed('down')) this.actIndex = (this.actIndex + 1) % acts.length;
      if (input.pressed('back')) { this.state = 'menu'; return; }
      if (input.pressed('confirm')) {
        const act = acts[this.actIndex];
        this.actsUsed.add(act.label);
        if (act.unlocksSpare) this.spareUnlocked = true;
        this.showMessage(act.text, () => this.enemyTurn());
      }
      return;
    }

    if (this.state === 'fight') {
      this.fightMarker += this.fightDir * dt * 1.6;
      if (this.fightMarker >= 1) { this.fightMarker = 1; this.fightDir = -1; }
      if (this.fightMarker <= 0) { this.fightMarker = 0; this.fightDir = 1; }
      if (input.pressed('confirm')) {
        const distFromCenter = Math.abs(this.fightMarker - 0.5);
        const crit = distFromCenter < 0.08;
        const dmg = crit ? 12 : distFromCenter < 0.2 ? 7 : 3;
        this.enemyHp = Math.max(0, this.enemyHp - dmg);
        const msg = crit ? `Direct hit! ${dmg} damage!` : `You strike for ${dmg} damage.`;
        this.showMessage(msg, () => {
          if (this.enemyHp <= 0) this.win('fight');
          else this.enemyTurn();
        });
      }
      return;
    }

    if (this.state === 'message') {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 && (input.pressed('confirm') || this.messageTimer < -1.4)) {
        const cb = this._msgCallback;
        this._msgCallback = null;
        this.state = 'idle';
        if (cb) cb();
      }
      return;
    }

    if (this.state === 'bulletbox') {
      this.updateBulletBox(dt, input);
      return;
    }
  }

  startFight() {
    this.fightMarker = 0;
    this.fightDir = 1;
    this.state = 'fight';
  }

  trySpare() {
    if (this.spareReady) {
      this.win('spare');
    } else {
      this.showMessage("It doesn't feel right to spare them yet.", () => { this.state = 'menu'; });
    }
  }

  showMessage(text, callback) {
    this.message = text;
    this.messageTimer = 1.6;
    this._msgCallback = callback;
    this.state = 'message';
  }

  enemyTurn() {
    this.turnCount++;
    this.bullets = [];
    this.bulletTimer = 0;
    this.bulletDuration = 4.5;
    this.heart.x = this.box.x + this.box.w / 2;
    this.heart.y = this.box.y + this.box.h / 2;
    this.attackPattern = this.currentPhaseAttack();
    this.state = 'bulletbox';
  }

  updateBulletBox(dt, input) {
    const speed = 140;
    if (input.held('left')) this.heart.x -= speed * dt;
    if (input.held('right')) this.heart.x += speed * dt;
    if (input.held('up')) this.heart.y -= speed * dt;
    if (input.held('down')) this.heart.y += speed * dt;
    this.heart.x = Math.max(this.box.x + 6, Math.min(this.box.x + this.box.w - 6, this.heart.x));
    this.heart.y = Math.max(this.box.y + 6, Math.min(this.box.y + this.box.h - 6, this.heart.y));

    this.bulletTimer += dt;
    this.bulletDuration -= dt;
    spawnBullets(this);

    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bullets = this.bullets.filter(b =>
      b.x > this.box.x - 20 && b.x < this.box.x + this.box.w + 20 &&
      b.y > this.box.y - 20 && b.y < this.box.y + this.box.h + 20
    );

    if (this.hitCooldown <= 0) {
      for (const b of this.bullets) {
        const dx = b.x - this.heart.x;
        const dy = b.y - this.heart.y;
        if (Math.hypot(dx, dy) < b.r + this.heart.r) {
          this.playerHp = Math.max(0, this.playerHp - b.dmg);
          this.hitCooldown = 0.8;
          break;
        }
      }
    }

    if (this.bulletDuration <= 0) {
      if (this.playerHp <= 0) {
        this.state = 'lost';
      } else {
        this.state = 'menu';
      }
    }
  }

  win(kind) {
    this.state = kind === 'spare' ? 'spared' : 'won';
  }

  draw(ctx) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = '#050308';
    ctx.fillRect(0, 0, w, h);

    // enemy
    drawSprite(ctx, this.def.sprite, w / 2 - spriteWidth(this.def.sprite, 6) / 2, 60, 6);
    ctx.fillStyle = '#f2ead3';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText(this.def.name, 24, 30);

    // enemy hp bar
    const barW = 200;
    ctx.strokeStyle = '#f2ead3';
    ctx.strokeRect(w - barW - 24, 20, barW, 12);
    ctx.fillStyle = '#c94f4f';
    ctx.fillRect(w - barW - 24, 20, barW * (this.enemyHp / this.def.maxHp), 12);

    if (this.state === 'intro') {
      ctx.fillStyle = '#f2ead3';
      ctx.font = '13px "Press Start 2P", monospace';
      ctx.fillText(this.def.intro, 24, h - 60);
      this.drawPlayerStatus(ctx);
      return;
    }

    if (this.state === 'bulletbox') {
      ctx.strokeStyle = '#f2ead3';
      ctx.lineWidth = 3;
      ctx.strokeRect(this.box.x, this.box.y, this.box.w, this.box.h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.box.x, this.box.y, this.box.w, this.box.h);
      ctx.clip();
      ctx.fillStyle = '#e8b23d';
      for (const b of this.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      const flashing = this.hitCooldown > 0 && Math.floor(this.hitCooldown * 12) % 2 === 0;
      if (!flashing) drawSprite(ctx, SPR_HEART, this.heart.x - 12, this.heart.y - 10, 4);
      this.drawPlayerStatus(ctx);
      return;
    }

    if (this.state === 'menu' || this.state === 'idle') {
      this.drawMenu(ctx);
      this.drawPlayerStatus(ctx);
      return;
    }

    if (this.state === 'act') {
      this.drawActMenu(ctx);
      this.drawPlayerStatus(ctx);
      return;
    }

    if (this.state === 'fight') {
      const barX = 60, barY = h - 150, barW2 = w - 120;
      ctx.strokeStyle = '#f2ead3';
      ctx.strokeRect(barX, barY, barW2, 20);
      ctx.fillStyle = '#4f9e6b';
      ctx.fillRect(barX + barW2 * 0.42, barY, barW2 * 0.16, 20);
      const mx = barX + this.fightMarker * barW2;
      ctx.fillStyle = '#c94f4f';
      ctx.fillRect(mx - 3, barY - 6, 6, 32);
      ctx.fillStyle = '#f2ead3';
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.fillText('Press Z when the striker hits the green zone!', barX, barY - 20);
      this.drawPlayerStatus(ctx);
      return;
    }

    if (this.state === 'message') {
      ctx.fillStyle = '#100c18';
      ctx.strokeStyle = '#f2ead3';
      ctx.lineWidth = 3;
      ctx.fillRect(24, h - 130, w - 48, 100);
      ctx.strokeRect(24, h - 130, w - 48, 100);
      ctx.fillStyle = '#f2ead3';
      ctx.font = '13px "Press Start 2P", monospace';
      wrapText(ctx, this.message, 44, h - 100, w - 88, 20);
      this.drawPlayerStatus(ctx);
      return;
    }
  }

  drawPlayerStatus(ctx) {
    const h = ctx.canvas.height;
    ctx.fillStyle = '#f2ead3';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText(`SHU  HP ${this.playerHp}/${this.playerMaxHp}`, 24, h - 145);
  }

  drawMenu(ctx) {
    const h = ctx.canvas.height, w = ctx.canvas.width;
    ctx.fillStyle = '#100c18';
    ctx.strokeStyle = '#f2ead3';
    ctx.lineWidth = 3;
    ctx.fillRect(24, h - 130, w - 48, 100);
    ctx.strokeRect(24, h - 130, w - 48, 100);
    this.menuOptions.forEach((opt, i) => {
      const disabled = opt === 'SPARE' && !this.spareReady;
      ctx.fillStyle = i === this.menuIndex ? '#e8b23d' : (disabled ? '#5a5468' : '#f2ead3');
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillText((i === this.menuIndex ? '> ' : '  ') + opt, 50, h - 90 + i * 26);
    });
  }

  drawActMenu(ctx) {
    const h = ctx.canvas.height, w = ctx.canvas.width;
    ctx.fillStyle = '#100c18';
    ctx.strokeStyle = '#f2ead3';
    ctx.lineWidth = 3;
    ctx.fillRect(24, h - 130, w - 48, 100);
    ctx.strokeRect(24, h - 130, w - 48, 100);
    this.def.acts.forEach((act, i) => {
      ctx.fillStyle = i === this.actIndex ? '#e8b23d' : '#f2ead3';
      ctx.font = '13px "Press Start 2P", monospace';
      ctx.fillText((i === this.actIndex ? '> ' : '  ') + act.label, 50, h - 100 + i * 22);
    });
  }
}

function spawnBullets(battle) {
  const pattern = battle.attackPattern;
  const box = battle.box;

  if (pattern === 'fallingSeeds') {
    if (battle.bulletTimer > 0.25) {
      battle.bulletTimer = 0;
      battle.bullets.push({
        x: box.x + Math.random() * box.w,
        y: box.y - 10,
        vx: 0, vy: 90 + Math.random() * 40,
        r: 5, dmg: 2,
      });
    }
  } else if (pattern === 'rootSweep') {
    if (battle.bulletTimer > 0.5) {
      battle.bulletTimer = 0;
      const fromLeft = Math.random() < 0.5;
      const y = box.y + Math.random() * box.h;
      battle.bullets.push({
        x: fromLeft ? box.x - 10 : box.x + box.w + 10,
        y, vx: fromLeft ? 110 : -110, vy: 0,
        r: 6, dmg: 3,
      });
    }
  } else if (pattern === 'chaos') {
    if (battle.bulletTimer > 0.18) {
      battle.bulletTimer = 0;
      const r = Math.random();
      if (r < 0.5) {
        battle.bullets.push({ x: box.x + Math.random() * box.w, y: box.y - 10, vx: 0, vy: 110 + Math.random() * 50, r: 5, dmg: 2 });
      } else {
        const fromLeft = Math.random() < 0.5;
        battle.bullets.push({
          x: fromLeft ? box.x - 10 : box.x + box.w + 10,
          y: box.y + Math.random() * box.h,
          vx: fromLeft ? 130 : -130, vy: 0, r: 6, dmg: 3,
        });
      }
    }
  }
}
