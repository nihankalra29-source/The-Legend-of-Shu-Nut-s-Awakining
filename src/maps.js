// Tile legend:
// '#' wall/tree   '.' floor   '~' chasm (needs canDescend)   '^' rift back up
// 'D' door to another map   'C' chest   ' ' void (also solid)

const TILE_SIZE = 32;

const MAPS = {
  village: {
    name: 'Hearth Hollow Village',
    bg: '#1c2b1a',
    floor: '#2f5233',
    wall: '#12200f',
    tiles: [
      '####################',
      '#..................#',
      '#..#####....#####..#',
      '#..#...#....#...#..#',
      '#..#...#....#...#..#',
      '#..##.##....##.##..#',
      '#..................#',
      '#........C.........#',
      '#..................#',
      '#..................#',
      '#.......####.......#',
      '#.......#~~#.......#',
      '#.......####.......#',
      '#..................#',
      '####################',
    ],
    npcs: [
      { x: 5, y: 4, sprite: SPR_ELDER, dialogueId: 'elder_intro', name: 'Elder Husque' },
      { x: 14, y: 4, sprite: SPR_VILLAGER, dialogueId: 'villager_1', name: 'Pip' },
    ],
    chests: [
      { x: 10, y: 7, itemId: 'acorn_key', taken: false },
    ],
    transitions: [
      // chasm in the middle drops to the Hollow, once the player has the key
      { x: 8, y: 11, toMap: 'hollow', toX: 10, toY: 1, requires: 'acorn_key', lockedDialogue: 'chasm_locked' },
      { x: 9, y: 11, toMap: 'hollow', toX: 10, toY: 1, requires: 'acorn_key', lockedDialogue: 'chasm_locked' },
      { x: 0, y: 7, toMap: 'grove', toX: 18, toY: 7 },
    ],
    encounters: [],
    playerStart: { x: 10, y: 8 },
  },

  grove: {
    name: 'The Waning Grove',
    bg: '#16241d',
    floor: '#274a34',
    wall: '#0f1a13',
    tiles: [
      '####################',
      '#..................#',
      '#..#............#..#',
      '#..#..#######...#..#',
      '#..#..#.....#...#..#',
      '#........#..#......#',
      '#..#..#..#..#...#..#',
      '#..................#',
      '#..#..#..#..#...#..#',
      '#..#..#..#..#...#..#',
      '#..................#',
      '#..#############...#',
      '#..................#',
      '#..................#',
      '####################',
    ],
    npcs: [
      { x: 6, y: 9, sprite: SPR_CRITTER, dialogueId: null, name: 'Snarl Sprig', isEnemy: true, battleId: 'sprig' },
    ],
    chests: [],
    transitions: [
      { x: 19, y: 7, toMap: 'village', toX: 1, toY: 7 },
    ],
    encounters: [],
    playerStart: { x: 17, y: 7 },
  },

  hollow: {
    name: 'The Hollow Beneath',
    bg: '#0c0a16',
    floor: '#1d1830',
    wall: '#060512',
    tiles: [
      '####################',
      '#........^.........#',
      '#..................#',
      '#..####......####..#',
      '#..#..#......#..#..#',
      '#..#..#......#..#..#',
      '#..####......####..#',
      '#..................#',
      '#........C.........#',
      '#..................#',
      '#..................#',
      '#.......####.......#',
      '#.......#DD#.......#',
      '#.......####.......#',
      '####################',
    ],
    npcs: [
      { x: 3, y: 8, sprite: SPR_VILLAGER, dialogueId: 'hollow_wanderer', name: 'Cinderbolt' },
    ],
    chests: [
      { x: 10, y: 8, itemId: 'husk_lantern', taken: false },
    ],
    transitions: [
      { x: 10, y: 1, toMap: 'village', toX: 8, toY: 10 },
      { x: 9, y: 12, toMap: 'ruins', toX: 10, toY: 12, requires: 'husk_lantern', lockedDialogue: 'ruins_locked' },
      { x: 10, y: 12, toMap: 'ruins', toX: 10, toY: 12, requires: 'husk_lantern', lockedDialogue: 'ruins_locked' },
    ],
    encounters: [],
    playerStart: { x: 10, y: 2 },
  },

  ruins: {
    name: 'The Sundered Throne',
    bg: '#150a12',
    floor: '#2a1020',
    wall: '#0a0508',
    tiles: [
      '####################',
      '#..................#',
      '#..................#',
      '#..................#',
      '#....############..#',
      '#....#..........#..#',
      '#....#..........#..#',
      '#....#....K.....#..#',
      '#....#..........#..#',
      '#....#####..#####..#',
      '#..................#',
      '#..................#',
      '#........DD........#',
      '####################',
    ],
    npcs: [
      { x: 10, y: 7, sprite: SPR_WITHERED_KING, dialogueId: 'king_pre_battle', name: 'The Withered King', isEnemy: true, battleId: 'withered_king' },
    ],
    chests: [],
    transitions: [
      { x: 9, y: 12, toMap: 'hollow', toX: 9, toY: 11 },
      { x: 10, y: 12, toMap: 'hollow', toX: 10, toY: 11 },
    ],
    encounters: [],
    playerStart: { x: 10, y: 11 },
  },
};
