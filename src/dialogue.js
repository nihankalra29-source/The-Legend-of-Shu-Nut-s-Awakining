const DIALOGUES = {
  elder_intro: {
    lines: [
      { speaker: 'Elder Husque', text: 'Shu... little acorn, you finally woke up.' },
      { speaker: 'Elder Husque', text: 'Long ago the world was whole. Then the Withered King tried to seize both Sky and Root at once, and tore the world into two: the Canopy above, and the Hollow beneath.' },
      { speaker: 'Elder Husque', text: 'He shattered himself doing it. Half of him sleeps down in the Hollow. The other half waits in the Sundered Throne, deeper still.' },
      { speaker: 'Elder Husque', text: 'A hero fell from the sky the day the world split. The elders say... that hero was shaped just like you.' },
      { speaker: 'Elder Husque', text: 'There is a chest in the square with an Acorn Key inside. It will let you survive the fall through the chasm. Go on, little nut. The Hollow is waiting.' },
    ],
  },
  villager_1: {
    lines: [
      { speaker: 'Pip', text: "You're the one who fell from the sky shrine, huh? Cool cap." },
      { speaker: 'Pip', text: 'Everyone says the chasm in the square leads down to the Hollow. I would NEVER go down there. Absolutely not. Nope.' },
    ],
  },
  chasm_locked: {
    lines: [
      { speaker: '???', text: 'A cold wind rises from the chasm. Falling in unprepared seems like a very bad idea.' },
      { speaker: '???', text: '(Maybe the Elder knows something about surviving the fall.)' },
    ],
  },
  hollow_wanderer: {
    lines: [
      { speaker: 'Cinderbolt', text: 'Down here in the Hollow, the roots still remember the old world. Careful of the little Sprigs, they bite.' },
      { speaker: 'Cinderbolt', text: "There's a lantern in a chest nearby. You'll want its light before you knock on the Withered King's door." },
    ],
  },
  ruins_locked: {
    lines: [
      { speaker: '???', text: 'The throne door is sealed in rot. Only a light untouched by decay could open it.' },
    ],
  },
  king_pre_battle: {
    lines: [
      { speaker: 'The Withered King', text: 'A little acorn, all the way down here? How... quaint.' },
      { speaker: 'The Withered King', text: 'I split the sky from the root to hold BOTH in my hands forever. You would undo that, for these small, forgetful people?' },
      { speaker: 'Shu', text: '...' },
      { speaker: 'The Withered King', text: 'Then grow a spine, sapling. Let us see what a whole world is worth to you.' },
    ],
    onEnd: 'start_king_battle',
  },
  post_spare: {
    lines: [
      { speaker: 'The Withered King', text: '...Why. Why would you stay your hand.' },
      { speaker: 'Shu', text: "Because the world doesn't have to stay broken to be whole again. You don't, either." },
      { speaker: 'The Withered King', text: '...Foolish little nut. Take it, then. Both halves, root and sky, together.' },
      { speaker: 'Narrator', text: 'The chasm sealed. The Canopy and the Hollow breathed as one world again, for the first time since before the Withering.' },
      { speaker: 'Narrator', text: 'THE LEGEND OF SHU, A NUT BETWEEN THE WORLDS - MENDED ENDING' },
    ],
    onEnd: 'ending',
  },
  post_fight: {
    lines: [
      { speaker: 'Narrator', text: 'The Withered King crumbled to husk and root-dust.' },
      { speaker: 'Narrator', text: 'The chasm sealed. The worlds were one again -- but something in Shu felt the weight of the choice for a long, long time.' },
      { speaker: 'Narrator', text: 'THE LEGEND OF SHU, A NUT BETWEEN THE WORLDS - VICTOR\'S ENDING' },
    ],
    onEnd: 'ending',
  },
  chest_key: {
    lines: [{ speaker: 'Shu', text: 'You found the Acorn Key! It hums faintly, like it remembers falling once before.' }],
  },
  chest_lantern: {
    lines: [{ speaker: 'Shu', text: 'You found the Husk Lantern. Its light does not flicker, even down here.' }],
  },
};

class DialogueBox {
  constructor() {
    this.queue = [];
    this.lineIndex = 0;
    this.charIndex = 0;
    this.charTimer = 0;
    this.charSpeed = 0.018; // seconds per character
    this.active = false;
    this.onComplete = null;
  }

  start(id, onComplete) {
    const data = DIALOGUES[id];
    if (!data) return;
    this.queue = data.lines;
    this.lineIndex = 0;
    this.charIndex = 0;
    this.charTimer = 0;
    this.active = true;
    this.pendingAction = data.onEnd || null;
    this.onComplete = onComplete || null;
  }

  get currentLine() {
    return this.queue[this.lineIndex];
  }

  get fullyRevealed() {
    return this.currentLine && this.charIndex >= this.currentLine.text.length;
  }

  update(dt) {
    if (!this.active) return;
    if (!this.fullyRevealed) {
      this.charTimer += dt;
      while (this.charTimer >= this.charSpeed && !this.fullyRevealed) {
        this.charTimer -= this.charSpeed;
        this.charIndex++;
      }
    }
  }

  advance() {
    if (!this.active) return;
    if (!this.fullyRevealed) {
      this.charIndex = this.currentLine.text.length;
      return;
    }
    this.lineIndex++;
    this.charIndex = 0;
    this.charTimer = 0;
    if (this.lineIndex >= this.queue.length) {
      this.active = false;
      const action = this.pendingAction;
      const cb = this.onComplete;
      this.pendingAction = null;
      this.onComplete = null;
      if (action) handleDialogueAction(action);
      if (cb) cb();
    }
  }

  draw(ctx) {
    if (!this.active) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const boxH = 120;
    const pad = 18;
    ctx.fillStyle = '#100c18';
    ctx.strokeStyle = '#f2ead3';
    ctx.lineWidth = 3;
    ctx.fillRect(pad, h - boxH - pad, w - pad * 2, boxH);
    ctx.strokeRect(pad, h - boxH - pad, w - pad * 2, boxH);

    const line = this.currentLine;
    if (!line) return;
    ctx.fillStyle = '#e8b23d';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText(line.speaker, pad + 16, h - boxH - pad + 28);

    ctx.fillStyle = '#f2ead3';
    ctx.font = '13px "Press Start 2P", monospace';
    const shown = line.text.slice(0, this.charIndex);
    wrapText(ctx, shown, pad + 16, h - boxH - pad + 56, w - pad * 2 - 32, 20);

    if (this.fullyRevealed) {
      ctx.fillStyle = '#9a8fae';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('▼', w - pad - 28, h - pad - 14);
    }
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}
