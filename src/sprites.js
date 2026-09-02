// Procedural pixel-art sprites. Every character is drawn from a small
// string grid instead of an image file, so the whole game ships as code.

const PAL = {
  '.': null,
  'o': '#1a1420',
  'c': '#8a5a2b',
  'C': '#b47b3f',
  'b': '#e8d9a8',
  'B': '#f5ecc9',
  'e': '#f2ead3',
  'p': '#1a1420',
  'l': '#5c3a1a',
  'r': '#c94f4f',
  'g': '#4f9e6b',
  'G': '#6fc98a',
  'k': '#2a2438',
  'K': '#3d3550',
  'y': '#e8b23d',
  'w': '#7d6fa8',
  'W': '#9c8fd1',
  'h': '#e0507a',
};

function makeSprite(rows) {
  return rows;
}

// Shu the Nut — an acorn hero with a jaunty cap-shell and stubby legs.
const SPR_SHU_DOWN = makeSprite([
  '....occcc......',
  '...occCCco.....',
  '..occCCCCco....',
  '.obbbbbbbbbo...',
  '.obBeoooeBbo...',
  '.obBpo..opBo...',
  '.obbbbbbbbbo...',
  '.obbbbbbbbbo...',
  '..obbbbbbbo....',
  '...obbbbbo.....',
  '....o...o......',
  '...ll...ll.....',
  '..oll...llo....',
  '................',
]);

const SPR_SHU_UP = makeSprite([
  '....occcc......',
  '...occCCco.....',
  '..occCCCCco....',
  '.obbbbbbbbbo...',
  '.obbbbbbbbbo...',
  '.obbbbbbbbbo...',
  '.obbbbbbbbbo...',
  '.obbbbbbbbbo...',
  '..obbbbbbbo....',
  '...obbbbbo.....',
  '....o...o......',
  '...ll...ll.....',
  '..oll...llo....',
  '................',
]);

const SPR_SHU_SIDE = makeSprite([
  '.....occcc......',
  '....occCCco.....',
  '...occCCCCco....',
  '..obbbbbbbo.....',
  '..obBeoo.o......',
  '..obBpo.........',
  '..obbbbbbbo.....',
  '..obbbbbbbo.....',
  '...obbbbbo......',
  '....obbbo.......',
  '.....o.o........',
  '....ll.ll.......',
  '...oll..llo.....',
  '................',
]);

const SPR_VILLAGER = makeSprite([
  '.....gggg.......',
  '....gGGGGg......',
  '...gGoeeoGg.....',
  '...oGeppeGo.....',
  '...oGGGGGGo.....',
  '..oGGGGGGGGo....',
  '..oGgggggGo.....',
  '..oGgggggGo.....',
  '...oGggGGo......',
  '....o....o......',
  '...oo....oo.....',
  '................',
]);

const SPR_ELDER = makeSprite([
  '.....wwww.......',
  '....wWWWWw......',
  '...wWoeeoWw.....',
  '...WWWWWWWW.....',
  '...oWeppeWo.....',
  '..oWWWWWWWWo....',
  '..oWwwwwwWo.....',
  '..oWwwwwwWo.....',
  '...oWwwwWo......',
  '....o....o......',
  '...oo....oo.....',
  '................',
]);

const SPR_CRITTER = makeSprite([
  '................',
  '...kkkkkkkk.....',
  '..kKKKKKKKKk....',
  '.kKeoKKKKoeKk...',
  '.kKKKKKKKKKKk...',
  '.kKKrrrrKKKKk...',
  '..kKKKKKKKKk....',
  '...kk.KK.kk.....',
  '................',
]);

const SPR_WITHERED_KING = makeSprite([
  '......oyyyyyo.......',
  '.....oyKKKKKyo......',
  '....oyKKrrrrKyo.....',
  '...oyKKreoerKKyo....',
  '...oyKKKrrrKKKyo....',
  '..oyKKKKKKKKKKKyo...',
  '..oyKK.KKKKK.KKyo...',
  '..oyKKKKKKKKKKKyo...',
  '...oyyKKKKKKKyyo....',
  '....oy.KKKKK.yo.....',
  '.....o..KKK..o......',
  '.....o...K...o......',
  '....oo...K...oo.....',
]);

const SPR_HEART = makeSprite([
  '..h.h..',
  '.hhhhh.',
  '.hhhhh.',
  '..hhh..',
  '...h...',
]);

const SPR_CHEST = makeSprite([
  '.oCCCCCCo..',
  'oCcccccccOo',
  'oCyCCCCCyCo',
  'oCCCCCCCCCo',
  '.oooooooo..',
]);

function drawSprite(ctx, sprite, x, y, scale) {
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const color = PAL[line[col]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x + col * scale), Math.round(y + row * scale), scale, scale);
    }
  }
}

function spriteWidth(sprite, scale) {
  return sprite[0].length * scale;
}
function spriteHeight(sprite, scale) {
  return sprite.length * scale;
}
