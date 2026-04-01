// Internal game resolution
export const WIDTH = 960;
export const HEIGHT = 540;

// Game area (below HUD)
export const HUD_HEIGHT = 50;
export const CONTROLS_HEIGHT = 100;
export const GAME_TOP = HUD_HEIGHT;
export const GAME_BOTTOM = HEIGHT - CONTROLS_HEIGHT;
export const GAME_HEIGHT = GAME_BOTTOM - GAME_TOP;

// Physics
export const GRAVITY = 0.15;
export const WIND_FACTOR = 0.001;
export const MAX_POWER = 1000;
export const PROJECTILE_SPEED = 0.5; // time scale

// Tank
export const TANK_WIDTH = 24;
export const TANK_HEIGHT = 12;
export const TANK_BARREL_LENGTH = 16;
export const STARTING_MEN = 100;

// Terrain
export const TERRAIN_MIN_HEIGHT = 80;
export const TERRAIN_MAX_HEIGHT = 280;
export const TERRAIN_ROUGHNESS = 3;

// Colors
export const COLORS = {
  sky: '#000000',
  ground: '#00CC00',
  groundDark: '#009900',
  groundLight: '#33FF33',
  hud: '#111',
  hudText: '#eee',
  hudBorder: '#444',
  player1: '#FF4444',
  player2: '#4488FF',
  fire: '#FF8800',
  explosion: ['#FFFFFF', '#FFFF00', '#FFAA00', '#FF4400', '#CC0000', '#880000', '#440000'],
  wind: '#88CCFF',
};

// Wall types
export const WALL_TYPES = {
  NONE: 0,
  STICKY: 1,
  ELASTIC: 2,
  ACCELERATING: 3,
  WARPING: 4,
  RANDOM: 5,
};

export const WALL_NAMES = ['None', 'Sticky', 'Elastic', 'Accelerating', 'Warping', 'Random'];

// Wind levels
export const WIND_LEVELS = {
  NONE: 0,
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  GALE: 4,
  RANDOM: 5,
};

export const WIND_LEVEL_NAMES = ['None', 'Low', 'Normal', 'High', 'Gale', 'Random'];

// Weapon definitions
export const WEAPONS = [
  {
    id: 'leadball',
    name: 'Lead Ball',
    shortName: 'Lead',
    cost: 0,
    startAmount: 100,
    perGame: false,
    blastRadius: 12,
    damage: 10,
    type: 'explosive',
    color: '#AAAAAA',
    projectileSize: 2,
  },
  {
    id: 'grenade',
    name: 'Hand Grenade',
    shortName: 'Grenade',
    cost: 5,
    startAmount: 10,
    perGame: true,
    blastRadius: 22,
    damage: 40,
    type: 'explosive',
    color: '#44AA44',
    projectileSize: 3,
  },
  {
    id: 'incinerator',
    name: 'Incinerator',
    shortName: 'Incin.',
    cost: 15,
    startAmount: 3,
    perGame: true,
    blastRadius: 38,
    damage: 65,
    type: 'explosive',
    color: '#FF6600',
    projectileSize: 3,
  },
  {
    id: 'mark2',
    name: 'Mark II Incinerator',
    shortName: 'Mk II',
    cost: 30,
    startAmount: 0,
    perGame: false,
    blastRadius: 55,
    damage: 85,
    type: 'explosive',
    color: '#FF3300',
    projectileSize: 4,
  },
  {
    id: 'nuke20k',
    name: '20 Kiloton Nuke',
    shortName: '20K Nuke',
    cost: 60,
    startAmount: 0,
    perGame: false,
    blastRadius: 80,
    damage: 120,
    type: 'explosive',
    color: '#FFFF00',
    projectileSize: 4,
  },
  {
    id: 'nuke5m',
    name: '5 Megaton Nuke',
    shortName: '5M Nuke',
    cost: 120,
    startAmount: 0,
    perGame: false,
    blastRadius: 130,
    damage: 150,
    type: 'explosive',
    color: '#FFFFFF',
    projectileSize: 5,
  },
  {
    id: 'mirv',
    name: 'MIRV',
    shortName: 'MIRV',
    cost: 80,
    startAmount: 0,
    perGame: false,
    blastRadius: 55,
    damage: 85,
    type: 'mirv',
    color: '#FF00FF',
    projectileSize: 5,
    subCount: 5,
  },
  {
    id: 'laser',
    name: 'Laser Blaster',
    shortName: 'Laser',
    cost: 50,
    startAmount: 0,
    perGame: false,
    blastRadius: 8,
    damage: 90,
    type: 'laser',
    color: '#00FF00',
    projectileSize: 2,
    energyPerPurchase: 1000,
  },
  {
    id: 'cri4d',
    name: 'CRI 4/D',
    shortName: 'CRI4D',
    cost: 25,
    startAmount: 0,
    perGame: false,
    blastRadius: 10,
    damage: 10,
    type: 'cri',
    color: '#00FFAA',
    projectileSize: 3,
    criStrength: 40,
    criDispersive: true,
  },
  {
    id: 'cri8d',
    name: 'CRI 8/D',
    shortName: 'CRI8D',
    cost: 40,
    startAmount: 0,
    perGame: false,
    blastRadius: 10,
    damage: 15,
    type: 'cri',
    color: '#00FFCC',
    projectileSize: 3,
    criStrength: 80,
    criDispersive: true,
  },
  {
    id: 'cri20nd',
    name: 'CRI 20/ND',
    shortName: 'CRI20N',
    cost: 55,
    startAmount: 0,
    perGame: false,
    blastRadius: 10,
    damage: 20,
    type: 'cri',
    color: '#00FFEE',
    projectileSize: 3,
    criStrength: 120,
    criDispersive: false,
  },
  {
    id: 'cri20d',
    name: 'CRI 20/D',
    shortName: 'CRI20D',
    cost: 70,
    startAmount: 0,
    perGame: false,
    blastRadius: 10,
    damage: 25,
    type: 'cri',
    color: '#00FFFF',
    projectileSize: 3,
    criStrength: 160,
    criDispersive: true,
  },
  {
    id: 'sonic',
    name: 'Sonic Blaster',
    shortName: 'Sonic',
    cost: 20,
    startAmount: 0,
    perGame: false,
    blastRadius: 30,
    damage: 5,
    type: 'sonic',
    color: '#8888FF',
    projectileSize: 4,
  },
  {
    id: 'dirt',
    name: "Ball o' Dirt",
    shortName: 'Dirt',
    cost: 10,
    startAmount: 0,
    perGame: false,
    blastRadius: 25,
    damage: 0,
    type: 'dirt',
    color: '#8B6914',
    projectileSize: 4,
  },
  {
    id: 'dirt2',
    name: "Mk II Dirt",
    shortName: 'DirtII',
    cost: 18,
    startAmount: 0,
    perGame: false,
    blastRadius: 40,
    damage: 0,
    type: 'dirt',
    color: '#A67C1A',
    projectileSize: 5,
  },
  {
    id: 'xdirt',
    name: 'Explosive Dirt',
    shortName: 'XDirt',
    cost: 22,
    startAmount: 0,
    perGame: false,
    blastRadius: 30,
    damage: 10,
    type: 'xdirt',
    color: '#BB9944',
    projectileSize: 4,
  },
];

// Defense definitions
export const DEFENSES = [
  {
    id: 'shield',
    name: 'Energy Shield',
    shortName: 'Shield',
    cost: 40,
    description: 'Absorbs explosion damage',
    absorption: 0.6,
  },
  {
    id: 'fall_protect',
    name: 'Inertia Dampener',
    shortName: 'FallProt',
    cost: 25,
    description: 'Prevents fall damage',
  },
  {
    id: 'repulser',
    name: 'Repulser',
    shortName: 'Repulse',
    cost: 50,
    description: 'Deflects incoming fire',
    deflectChance: 0.5,
  },
];

// Game states
export const STATES = {
  TITLE: 'title',
  MENU: 'menu',
  PLAYING: 'playing',
  AIMING: 'aiming',
  FIRING: 'firing',
  FLYING: 'flying',
  EXPLODING: 'exploding',
  CRUMBLING: 'crumbling',
  FALLING: 'falling',
  DEATH: 'death',
  TURN_END: 'turn_end',
  ROUND_END: 'round_end',
  SHOP: 'shop',
  GAME_OVER: 'game_over',
};
