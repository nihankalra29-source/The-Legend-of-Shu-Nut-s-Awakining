// Server-authoritative copy of the map transitions in src/maps.js.
// Only what's needed to validate a player crossing between shared-world
// maps (and to gate it on an inventory item) lives here - keep this in
// sync by hand if src/maps.js transitions ever change.

const TILE_SIZE = 32;

const TRANSITIONS = {
  village: [
    { x: 9, y: 11, toMap: 'hollow', toX: 10, toY: 2, requires: 'acorn_key' },
    { x: 10, y: 11, toMap: 'hollow', toX: 10, toY: 2, requires: 'acorn_key' },
    { x: 0, y: 7, toMap: 'grove', toX: 18, toY: 7 },
  ],
  grove: [
    { x: 19, y: 7, toMap: 'village', toX: 1, toY: 7 },
  ],
  hollow: [
    { x: 10, y: 1, toMap: 'village', toX: 8, toY: 10 },
    { x: 9, y: 12, toMap: 'ruins', toX: 10, toY: 11, requires: 'husk_lantern' },
    { x: 10, y: 12, toMap: 'ruins', toX: 10, toY: 11, requires: 'husk_lantern' },
  ],
  ruins: [
    { x: 9, y: 12, toMap: 'hollow', toX: 9, toY: 11 },
    { x: 10, y: 12, toMap: 'hollow', toX: 10, toY: 11 },
  ],
};

function findTransition(mapId, tx, ty) {
  const list = TRANSITIONS[mapId];
  if (!list) return null;
  return list.find(t => t.x === tx && t.y === ty) || null;
}

module.exports = { TILE_SIZE, TRANSITIONS, findTransition };
