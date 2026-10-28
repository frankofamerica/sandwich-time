// =====================================================================
//  SANDWICH TIME — easy-to-edit game configuration
//  Swap any PNG path / name here. See README.md for sprite specs.
// =====================================================================
window.GAME_CONFIG = {
  title: {
    image: 'assets/title/title.png',   // replace with your own title art
    text: 'Sandwich Time',              // used only if the image fails to load
  },

  // 7 playable characters. Sprites should face RIGHT (the game flips them).
  // `frames` > 1 means the PNG is a horizontal strip of walk-cycle frames.
  characters: [
    { name: 'Soppressauter',   sprite: 'assets/characters/sopressauter.png', frames: 1, color: '#e63946' },
    { name: 'Joevolone',     sprite: 'assets/characters/joevolone.png', frames: 1, color: '#457bf5' },
    { name: 'Rusciutto',   sprite: 'assets/characters/rusciutto.png', frames: 1, color: '#2a9d8f' },
    { name: 'Roast Frank',    sprite: 'assets/characters/roast_frank.png', frames: 1, color: '#f4a261' },
    { name: 'Feldham',     sprite: 'assets/characters/feldham.png', frames: 1, color: '#9b5de5' },
    { name: 'Axisalami', sprite: 'assets/characters/axisalami.png', frames: 1, color: '#06d6a0' },
    { name: 'Billogna',  sprite: 'assets/characters/billogna.png', frames: 1, color: '#ffd166' },
  ],

  // 3 villains. speed = movement multiplier, smart = 0..1 chance to chase you.
  villains: {
    soda:    { name: 'Tab Soda Can', sprite: 'assets/villains/soda-can.png',    frames: 1, color: '#d62828', speed: 1.05, smart: 0.65 },
    onion:   { name: 'Onion',    sprite: 'assets/villains/onion.png',   frames: 1, color: '#d7b4e6', speed: 0.95, smart: 0.80 },
    cupcake: { name: 'Cupcake',  sprite: 'assets/villains/cupcake.png', frames: 1, color: '#ff8fc7', speed: 0.90, smart: 0.90 },
  },

  // Bonus item (+1 pepper and points). Drawn bottom-center on the floor.
  bonus: { name: 'Coffee', sprite: 'assets/bonus/coffee.png', size: 24 },

  spriteSize: 32,       // on-screen size (game pixels) of characters/villains
  playerSpeed: 78,       // pixels per second
  enemySpeed: 52,        // base villain pixels per second (scaled by level)
  startingLives: 3,
  startingPepper: 5,
  extraLifeAt: 20000,
};
