(() => {
  'use strict';
  const CFG = window.GAME_CONFIG;
  const { T, W, H, FLOOR_Y, PLATE_Y, SUB_W, LAYER_H } = window.Level;
  const Sfx = window.Sfx, Input = window.Input;
  const DT = 1 / 60;
  const FALL_SPEED = 210;
  const FONT = '"sandwich-pixel","Press Start 2P", "Courier New", monospace';
  const VILLAIN_ORDER = ['soda', 'onion', 'cupcake'];

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let scale = 1;

  // ------------------------------------------------------------ storage
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('sandwichtime.' + k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem('sandwichtime.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  try { localStorage.removeItem('sandwichtime.hi'); } catch (e) { /* ignore */ } // hi-score now comes from the leaderboard

  // ------------------------------------------------------------ assets
  const sprites = { characters: [], villains: {}, title: null, bonuses: {} };
  const loadImage = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn('Sandwich Time: could not load', src); resolve(null); };
    img.src = src;
  });
  function loadAssets() {
    const jobs = CFG.characters.map((c, i) => loadImage(c.sprite).then(img => { sprites.characters[i] = img; }));
    for (const key of Object.keys(CFG.villains))
      jobs.push(loadImage(CFG.villains[key].sprite).then(img => { sprites.villains[key] = img; }));
    jobs.push(loadImage(CFG.title.image).then(img => { sprites.title = img; }));
    for (const key of Object.keys(CFG.bonuses))
      jobs.push(loadImage(CFG.bonuses[key].sprite).then(img => { sprites.bonuses[key] = img; }));
    return Promise.all(jobs);
  }

  // ------------------------------------------------------------ state
  const G = {
    state: 'loading', t: 0, timer: 0, prevState: null,
    score: 0, lives: 0, pepper: 0, levelNum: 1, nextLifeAt: 0,
    charIndex: Math.min(store.get('char', 0), CFG.characters.length - 1), 
    level: null, subs: [], ingredients: [], enemies: [], player: null,
    cloud: null, popups: [], bonus: null, dropCount: 0,
    modal: false,      // a high-score dialog is open; the game ignores input
    place: null,       // game over: null while checking the leaderboard, then 1..10 or 0 (didn't place)
  };
  Sfx.setMuted(store.get('muted', false));

  // ------------------------------------------------------------ grid movement
  const colOf = x => Math.floor(x / T);
  const centerX = c => c * T + T / 2;
  const onFloorRow = y => y % T === 0 && FLOOR_Y.includes(y);
  const REVERSE = { L: 'R', R: 'L', U: 'D', D: 'U' };

  function canMove(e, dir) {
    const lvl = G.level, c = colOf(e.x);
    if (dir === 'L' || dir === 'R') {
      if (!onFloorRow(e.y)) return false;
      const r = e.y / T;
      if (!lvl.floorAt(c, r)) return false;
      const nx = e.x + (dir === 'R' ? 1 : -1);
      const probe = dir === 'R' ? nx + T / 2 - 1 : nx - T / 2;
      return lvl.floorAt(colOf(probe), r);
    }
    if (e.x !== centerX(c)) return false;
    return dir === 'U' ? lvl.ladderAt(c, Math.floor((e.y - 1) / T)) : lvl.ladderAt(c, Math.floor(e.y / T));
  }

  function step(e, dir) {
    if (dir === 'L') e.x--; else if (dir === 'R') e.x++;
    else if (dir === 'U') e.y--; else e.y++;
  }

  // ------------------------------------------------------------ game flow
  function startGame() {
    G.score = 0;
    G.lives = CFG.startingLives;
    G.pepper = CFG.startingPepper;
    G.levelNum = 1;
    G.nextLifeAt = CFG.extraLifeAt;
    store.set('char', G.charIndex);
    Sfx.start();
    loadLevel();
  }

  function loadLevel() {
    G.level = window.Level.build(G.levelNum - 1);
    G.subs = G.level.subs.map(s => ({ c0: s.c0, stackY: PLATE_Y }));
    G.ingredients = [];
    G.level.subs.forEach((s, si) => {
      for (const [type, f] of s.layers)
        G.ingredients.push({ type, sub: si, c0: s.c0, y: FLOOR_Y[f], state: 'rest',
          pressed: new Array(SUB_W).fill(false), riders: [], bounce: 0 });
    });
    G.dropCount = 0;
    G.bonus = null;
    G.popups = [];
    resetActors();
    G.state = 'ready';
    G.timer = 2;
  }

  function resetActors() {
    const s = G.level.start;
    G.player = { x: s.x, y: s.y, face: 1, vdir: 'U', climbing: false, moving: false, acc: 0, deathT: 0 };
    const count = Math.min(6, 3 + Math.floor(G.levelNum / 2));
    G.enemies = [];
    for (let i = 0; i < count; i++) {
      G.enemies.push({ type: VILLAIN_ORDER[i % 3], state: 'waiting', timer: 1 + i * 2.2,
        x: -100, y: -100, dir: 'R', acc: 0, lastKey: null, ride: null, face: 1 });
    }
    for (const ing of G.ingredients) ing.riders = [];
    G.cloud = null;
  }

  function addScore(n) {
    G.score += n;
    if (G.score >= G.nextLifeAt) {
      G.nextLifeAt += CFG.extraLifeAt;
      G.lives++;
      Sfx.life();
      popup(W / 2, H / 2, '1UP!', '#7CFC00');
    }
  }

  function popup(x, y, text, color = '#ffe14d') {
    G.popups.push({ x, y, text, color, t: 0 });
  }

  function killPlayer() {
    G.state = 'dying';
    G.player.deathT = 0;
    G.lives--;
    G.cloud = null;
    Sfx.die();
  }

  // ------------------------------------------------------------ player
  function resolvePlayerDir(p, dir) {
    if (canMove(p, dir)) return dir;
    const lvl = G.level;
    if (dir === 'U' || dir === 'D') {
      // Not lined up with a ladder: walk toward one if it's close.
      if (!onFloorRow(p.y)) return null;
      const r = p.y / T, c = colOf(p.x);
      for (const lc of [c, c - 1, c + 1]) {
        const cx = centerX(lc);
        if (Math.abs(cx - p.x) > 12) continue;
        const ok = dir === 'U' ? lvl.ladderAt(lc, r - 1) : lvl.ladderAt(lc, r);
        if (!ok) continue;
        const h = cx > p.x ? 'R' : 'L';
        if (canMove(p, h)) return h;
      }
      return null;
    }
    // Pressing sideways near the end of a ladder: finish climbing onto the floor.
    if (!onFloorRow(p.y)) {
      for (const fy of FLOOR_Y) {
        if (Math.abs(fy - p.y) > 10) continue;
        const r = fy / T, c = colOf(p.x) + (dir === 'R' ? 1 : -1);
        if (!lvl.floorAt(c, r)) continue;
        const v = fy < p.y ? 'U' : 'D';
        if (canMove(p, v)) return v;
      }
    }
    return null;
  }

  function updatePlayer(dt) {
    const p = G.player;
    const dir = Input.dir();
    p.moving = false;
    if (!dir) { p.acc = 0; return; }
    p.acc += CFG.playerSpeed * dt;
    while (p.acc >= 1) {
      p.acc -= 1;
      const d = resolvePlayerDir(p, dir);
      if (!d) { p.acc = 0; break; }
      step(p, d);
      p.moving = true;
      if (d === 'L') p.face = -1;
      if (d === 'R') p.face = 1;
      p.climbing = d === 'U' || d === 'D';
      if (p.climbing) p.vdir = d;
      pressIngredients(p);
    }
  }

  function pressIngredients(p) {
    if (!onFloorRow(p.y)) return;
    const c = colOf(p.x);
    for (const ing of G.ingredients) {
      if (ing.state !== 'rest' || ing.y !== p.y || c < ing.c0 || c >= ing.c0 + SUB_W) continue;
      const i = c - ing.c0;
      if (ing.pressed[i]) continue;
      ing.pressed[i] = true;
      Sfx.step();
      if (ing.pressed.every(Boolean)) startFall(ing);
    }
  }

  function usePepper() {
    const p = G.player;
    if (G.pepper <= 0 || G.cloud) { Sfx.empty(); return; }
    G.pepper--;
    Sfx.pepper();
    let r;
    if (p.climbing) {
      r = p.vdir === 'U' ? { x: p.x - 16, y: p.y - 70, w: 32, h: 40 } : { x: p.x - 16, y: p.y - 4, w: 32, h: 40 };
    } else {
      r = p.face > 0 ? { x: p.x + 8, y: p.y - 30, w: 40, h: 30 } : { x: p.x - 48, y: p.y - 30, w: 40, h: 30 };
    }
    G.cloud = { ...r, t: 0, life: 0.45 };
  }

  // ------------------------------------------------------------ ingredients
  function startFall(ing) {
    ing.state = 'falling';
    ing.pressed.fill(false);
    ing.riders = [];
    const x0 = ing.c0 * T, x1 = (ing.c0 + SUB_W) * T;
    for (const e of G.enemies) {
      if ((e.state === 'walk' || e.state === 'stunned') && e.y === ing.y && e.x >= x0 && e.x < x1) {
        e.state = 'riding';
        e.ride = ing;
        ing.riders.push(e);
      }
    }
    Sfx.drop();
  }

  // Random floor tile for a bonus: not under a sandwich stack, and not right next to the player.
  function bonusSpot() {
    const L = G.level, p = G.player, spots = [];
    const inSub = c => L.subs.some(s => c >= s.c0 && c < s.c0 + SUB_W);
    for (const [f, c0, c1] of L.floors)
      for (let c = c0; c <= c1; c++) {
        const x = c * T + T / 2, y = FLOOR_Y[f];
        if (!inSub(c) && (y !== p.y || Math.abs(x - p.x) > 4 * T)) spots.push({ x, y });
      }
    return spots.length ? spots[Math.floor(Math.random() * spots.length)] : { x: L.start.x, y: L.start.y };
  }

  function land(ing, plated) {
    ing.state = plated ? 'plated' : 'rest';
    ing.pressed.fill(false);
    ing.bounce = 0.15;
    addScore(50);
    Sfx.land();
    G.dropCount++;
    const bonusType = Object.keys(CFG.bonuses).find(k => CFG.bonuses[k].drops.includes(G.dropCount));
    if (bonusType && !G.bonus) {
      G.bonus = { type: bonusType, ...bonusSpot(), t: 9 };
      Sfx.bonusAppear();
    }
    let pts = 500;
    for (const e of ing.riders) {
      if (e.state === 'riding' && e.ride === ing) { killEnemy(e, pts); pts *= 2; }
    }
    ing.riders = [];
  }

  function squash(ing, y0, y1) {
    const x0 = ing.c0 * T - 4, x1 = (ing.c0 + SUB_W) * T + 4;
    for (const e of G.enemies) {
      if (e.state !== 'walk' && e.state !== 'stunned') continue;
      if (e.x < x0 || e.x >= x1) continue;
      if (y1 >= e.y - 24 && y0 < e.y) { killEnemy(e, 500); Sfx.squash(); }
    }
  }

  function updateIngredient(ing, dt) {
    if (ing.bounce > 0) ing.bounce -= dt;
    if (ing.state !== 'falling') return;
    const y0 = ing.y;
    const ny = y0 + FALL_SPEED * dt;
    for (const fy of FLOOR_Y) {
      if (fy <= y0 || fy > ny) continue;
      if (!G.level.floorCovers(fy / T, ing.c0, ing.c0 + SUB_W - 1)) continue;
      const below = G.ingredients.find(o => o !== ing && o.sub === ing.sub && o.state === 'rest' && o.y === fy);
      squash(ing, y0, fy);
      ing.y = fy;
      land(ing, false);
      if (below) startFall(below);
      return;
    }
    const sub = G.subs[ing.sub];
    if (ny >= sub.stackY) {
      squash(ing, y0, sub.stackY);
      ing.y = sub.stackY;
      sub.stackY -= LAYER_H[ing.type];
      land(ing, true);
      return;
    }
    squash(ing, y0, ny);
    ing.y = ny;
    for (const e of ing.riders) if (e.state === 'riding') e.y = ny;
  }

  // ------------------------------------------------------------ villains
  function killEnemy(e, pts) {
    addScore(pts);
    popup(e.x, e.y - 24, String(pts));
    e.state = 'dead';
    e.ride = null;
    e.timer = 4;
  }

  function spawnEnemy(e) {
    const p = G.player;
    const d = s => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) * 2;
    const spots = G.level.spawns.slice().sort((a, b) => d(b) - d(a));
    const s = spots[Math.floor(Math.random() * Math.min(2, spots.length))];
    Object.assign(e, { x: s.x, y: s.y, dir: s.dir, state: 'walk', acc: 0, lastKey: null, ride: null });
  }

  function chooseDir(e) {
    const opts = ['L', 'R', 'U', 'D'].filter(d => canMove(e, d));
    if (!opts.length) return null;
    const choices = opts.length > 1 ? opts.filter(d => d !== REVERSE[e.dir]) : opts;
    const smart = Math.min(0.95, CFG.villains[e.type].smart + 0.03 * (G.levelNum - 1));
    if (Math.random() < smart) {
      const p = G.player, dy = p.y - e.y, dx = p.x - e.x;
      const v = dy < 0 ? 'U' : 'D', h = dx < 0 ? 'L' : 'R';
      const pref = Math.abs(dy) > 4 ? [v, h] : [h, v];
      for (const d of pref) if (choices.includes(d)) return d;
    }
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function updateEnemy(e, dt) {
    switch (e.state) {
      case 'waiting':
      case 'dead':
        e.timer -= dt;
        if (e.timer <= 0) spawnEnemy(e);
        return;
      case 'riding':
        return;
      case 'stunned':
        e.timer -= dt;
        if (e.timer <= 0) e.state = 'walk';
        return;
    }
    const v = CFG.villains[e.type];
    e.acc += CFG.enemySpeed * v.speed * Math.min(1.6, 1 + 0.07 * (G.levelNum - 1)) * dt;
    while (e.acc >= 1) {
      e.acc -= 1;
      const key = e.x + ',' + e.y;
      const atJunction = e.x === centerX(colOf(e.x)) && onFloorRow(e.y) && e.lastKey !== key;
      if (atJunction || !e.dir || !canMove(e, e.dir)) {
        e.dir = chooseDir(e);
        e.lastKey = key;
      }
      if (!e.dir || !canMove(e, e.dir)) { e.acc = 0; break; }
      step(e, e.dir);
      if (e.dir === 'L') e.face = -1;
      if (e.dir === 'R') e.face = 1;
    }
  }

  // ------------------------------------------------------------ update
  const rectsHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function updatePlaying(dt) {
    updatePlayer(dt);
    for (const ing of G.ingredients) updateIngredient(ing, dt);
    for (const e of G.enemies) updateEnemy(e, dt);

    if (G.cloud) {
      G.cloud.t += dt;
      for (const e of G.enemies) {
        if ((e.state === 'walk' || e.state === 'stunned') && rectsHit(G.cloud, { x: e.x - 12, y: e.y - 28, w: 24, h: 28 })) {
          e.state = 'stunned';
          e.timer = Math.max(1.6, 3.2 - 0.15 * (G.levelNum - 1));
        }
      }
      if (G.cloud.t >= G.cloud.life) G.cloud = null;
    }

    const p = G.player;
    if (G.bonus) {
      G.bonus.t -= dt;
      if (G.bonus.t <= 0) G.bonus = null;
      else if (Math.abs(G.bonus.x - p.x) < 14 && Math.abs(G.bonus.y - p.y) < 8) {
        const def = CFG.bonuses[G.bonus.type];
        addScore(def.points);
        G.pepper += def.pepper;
        popup(G.bonus.x, G.bonus.y - 30, def.points + ' +PEPPER', '#F6E300');
        Sfx.bonus();
        G.bonus = null;
      }
    }

    for (const e of G.enemies) {
      if (e.state === 'walk' && Math.abs(e.x - p.x) < 12 && Math.abs(e.y - p.y) < 12) { killPlayer(); return; }
    }

    if (G.ingredients.every(i => i.state === 'plated')) {
      G.state = 'clear';
      G.timer = 3;
      Sfx.clear();
    }
  }

  function handleEvents() {
    if (G.modal) { Input.drain(); return; }
    for (const ev of Input.drain()) {
      if (ev.type === 'mute') { Sfx.setMuted(!Sfx.muted); store.set('muted', Sfx.muted); continue; }
      switch (G.state) {
        case 'title':
          if (ev.type === 'tap' && window.Scores.enabled && rectsHit({ x: ev.x, y: ev.y, w: 1, h: 1 }, HISCORE_BTN))
            openModal(() => window.Scores.showBoard());
          else if (ev.type === 'confirm' || ev.type === 'pepper' || ev.type === 'tap') { G.state = 'select'; Sfx.select(); }
          break;
        case 'select': handleSelectEvent(ev); break;
        case 'playing':
          if (ev.type === 'pepper') usePepper();
          else if (ev.type === 'pause') { G.prevState = G.state; G.state = 'paused'; }
          break;
        case 'ready': case 'dying': case 'clear':
          if (ev.type === 'pause') { G.prevState = G.state; G.state = 'paused'; }
          break;
        case 'paused':
          if (ev.type === 'pause' || ev.type === 'confirm' || ev.type === 'tap') G.state = G.prevState;
          break;
        case 'gameover':
          if (G.timer <= 0 && G.place === 0 && (ev.type === 'confirm' || ev.type === 'pepper' || ev.type === 'tap')) G.state = 'title';
          break;
      }
    }
  }

  function update(dt) {
    G.t += dt;
    handleEvents();
    for (const pu of G.popups) pu.t += dt;
    G.popups = G.popups.filter(pu => pu.t < 1.2);

    switch (G.state) {
      case 'ready':
        G.timer -= dt;
        if (G.timer <= 0) G.state = 'playing';
        break;
      case 'playing':
        updatePlaying(dt);
        break;
      case 'dying':
        for (const ing of G.ingredients) updateIngredient(ing, dt);
        G.player.deathT += dt;
        if (G.player.deathT > 2.2) {
          if (G.lives <= 0) {
            G.state = 'gameover'; G.timer = 1.5;
            G.place = null;
            window.Scores.placeFor(G.score).then(n => { G.place = n; });
          }
          else { resetActors(); G.state = 'ready'; G.timer = 1.5; }
        }
        break;
      case 'clear':
        G.timer -= dt;
        if (G.timer <= 0) { G.levelNum++; G.pepper++; loadLevel(); }
        break;
      case 'gameover':
        G.timer -= dt;
        if (G.timer <= 0 && G.place && !G.modal) {
          const place = G.place;
          G.place = 0;
          openModal(() => window.Scores.promptName(G.score, place, CFG.characters[G.charIndex].name)
            .then(id => id && window.Scores.showBoard(id))
            .then(() => { G.state = 'title'; }));
        }
        break;
    }
  }

  function openModal(show) {
    G.modal = true;
    Sfx.select();
    show().finally(() => { G.modal = false; Input.drain(); });
  }

  // ------------------------------------------------------------ character select
  const SELECT_TILE = { w: 100, h: 124, gap: 12 };
  const START_BTN = { x: W / 2 - 95, y: 410, w: 190, h: 44 };

  function selectTiles() {
    const n = CFG.characters.length, perRow = 4, tiles = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow), col = i % perRow;
      const rowW = inRow * SELECT_TILE.w + (inRow - 1) * SELECT_TILE.gap;
      tiles.push({ x: (W - rowW) / 2 + col * (SELECT_TILE.w + SELECT_TILE.gap), y: 110 + row * (SELECT_TILE.h + 16),
        w: SELECT_TILE.w, h: SELECT_TILE.h });
    }
    return tiles;
  }

  function handleSelectEvent(ev) {
    const n = CFG.characters.length;
    const move = d => { G.charIndex = (G.charIndex + d + n) % n; Sfx.select(); };
    if (ev.type === 'dir') {
      if (ev.dir === 'L') move(-1);
      else if (ev.dir === 'R') move(1);
      else if (ev.dir === 'U' && G.charIndex >= 4) move(-4);
      else if (ev.dir === 'D' && G.charIndex + 4 < n) move(4);
    } else if (ev.type === 'confirm' || ev.type === 'pepper') {
      startGame();
    } else if (ev.type === 'pause') {
      G.state = 'title';
    } else if (ev.type === 'tap') {
      const pt = { x: ev.x, y: ev.y, w: 1, h: 1 };
      if (rectsHit(pt, START_BTN)) { startGame(); return; }
      selectTiles().forEach((t, i) => {
        if (!rectsHit(pt, t)) return;
        if (i === G.charIndex) startGame();
        else { G.charIndex = i; Sfx.select(); }
      });
    }
  }

  // ------------------------------------------------------------ drawing helpers
  function text(str, x, y, size, color, align = 'center') {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function roundRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  // Draws a sprite with its feet at (x, y). Falls back to a colored blob
  // with an initial if the PNG is missing.
  function drawSprite(img, def, x, y, { size = CFG.spriteSize, flip = false, frame = 0, rot = 0, alpha = 1, bob = 0 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (img) {
      const frames = def.frames || 1;
      const fw = img.width / frames;
      const sc = size / Math.max(fw, img.height);
      const dw = fw * sc, dh = img.height * sc;
      ctx.translate(x, y - dh / 2 + bob);
      if (rot) ctx.rotate(rot);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, fw * (frame % frames), 0, fw, img.height, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.translate(x, y - size / 2 + bob);
      if (rot) ctx.rotate(rot);
      ctx.fillStyle = def.color || '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, size / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${Math.round(size / 3)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText((def.name || '?')[0], 0, 1);
    }
    ctx.restore();
  }

  function pepperIcon(x, y) {
    roundRect(x, y - 10, 9, 12, 2, '#f4f4f4');
    roundRect(x + 1, y - 13, 7, 4, 1, '#9aa0a6');
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 3, y - 6, 1, 1); ctx.fillRect(x + 5, y - 5, 1, 1); ctx.fillRect(x + 4, y - 3, 1, 1);
  }

  // ------------------------------------------------------------ level drawing
  function drawIngredientSegment(type, x, y, i) {
    const left = i === 0, right = i === SUB_W - 1, w = T;
    const ends = r => [left ? r : 0, right ? r : 0, right ? r : 0, left ? r : 0];
    const seg = (yy, h, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, yy, w, h, ends(r)); else ctx.rect(x, yy, w, h);
      ctx.fill();
    };
    switch (type) {
      case 'top':
        seg(y - 10, 10, 5, '#c97a2b');
        ctx.fillStyle = '#e8a24c'; ctx.fillRect(x + (left ? 3 : 0), y - 9, w - (left || right ? 3 : 0), 2);
        ctx.fillStyle = '#8a4d14'; ctx.fillRect(x + 5, y - 7, 5, 1);
        ctx.fillStyle = '#fff3d6'; ctx.fillRect(x + 3, y - 5, 2, 1); ctx.fillRect(x + 11, y - 6, 2, 1);
        ctx.fillStyle = '#f3d29a'; ctx.fillRect(x, y - 2, w, 2);
        break;
      case 'bottom':
        ctx.fillStyle = '#f3d29a'; ctx.fillRect(x, y - 8, w, 2);
        seg(y - 6, 6, 3, '#c97a2b');
        break;
      case 'lettuce':
        ctx.fillStyle = '#3cbf4a';
        ctx.fillRect(x, y - 4, w, 4);
        ctx.beginPath(); ctx.arc(x + 4, y - 4, 3, Math.PI, 0); ctx.arc(x + 12, y - 4, 3, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#2a8f36'; ctx.fillRect(x, y - 1, w, 1);
        break;
      case 'tomato':
        roundRect(x + 0.5, y - 6, w - 1, 6, 3, '#e8352e');
        ctx.fillStyle = '#ffb3a6'; ctx.fillRect(x + 4, y - 4, 2, 1); ctx.fillRect(x + 10, y - 3, 2, 1);
        break;
      case 'cheese':
        ctx.fillStyle = '#F6E300';
        ctx.fillRect(x, y - 6, w, 4);
        ctx.beginPath(); ctx.moveTo(x + 4, y - 2); ctx.lineTo(x + 11, y - 2); ctx.lineTo(x + 7, y + 1); ctx.fill();
        ctx.fillStyle = '#ffe48a'; ctx.fillRect(x, y - 6, w, 1);
        break;
      case 'meat':
        seg(y - 7, 7, 3, '#c23a4e');
        ctx.fillStyle = '#8e2236'; ctx.fillRect(x + 3, y - 5, 2, 2); ctx.fillRect(x + 10, y - 3, 2, 2);
        ctx.fillStyle = '#f2a7b3'; ctx.fillRect(x + 7, y - 6, 1, 1); ctx.fillRect(x + 13, y - 6, 1, 1);
        break;
      case 'cutlet':
        seg(y - 8, 8, 4, '#c8862f');
        ctx.fillStyle = '#e6b866'; ctx.fillRect(x + (left ? 3 : 0), y - 8, w - (left || right ? 3 : 0), 1);
        ctx.fillRect(x + 2, y - 6, 2, 1); ctx.fillRect(x + 9, y - 5, 2, 1); ctx.fillRect(x + 13, y - 3, 1, 1);
        ctx.fillStyle = '#8a5a1c'; ctx.fillRect(x + 5, y - 3, 2, 1); ctx.fillRect(x + 11, y - 6, 1, 1);
        ctx.fillRect(x, y - 1, w, 1);
        break;
      case 'peppers':
        roundRect(x + 0.5, y - 5, 9, 4, 2, '#d7261e');
        roundRect(x + 7, y - 4, 8.5, 4, 2, '#b81c14');
        ctx.fillStyle = '#ff7a5c'; ctx.fillRect(x + 2, y - 4, 4, 1); ctx.fillRect(x + 9, y - 3, 3, 1);
        break;
      case 'mozzarella':
        ctx.fillStyle = '#fbf7ea';
        ctx.fillRect(x, y - 6, w, 4);
        ctx.beginPath(); ctx.arc(x + 5, y - 2, 2.5, 0, Math.PI); ctx.arc(x + 12, y - 2, 2, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#e3d9bb'; ctx.fillRect(x, y - 3, w, 1);
        break;
    }
  }

  function drawIngredient(ing) {
    const y = Math.round(ing.y) - (ing.bounce > 0 ? 2 : 0);
    for (let i = 0; i < SUB_W; i++)
      drawIngredientSegment(ing.type, ing.c0 * T + i * T, y + (ing.pressed[i] ? 3 : 0), i);
  }

  function drawLevel() {
    const lvl = G.level;
    ctx.fillStyle = '#d9d2c5';
    for (const [c, a, b] of lvl.ladders) {
      const y0 = FLOOR_Y[a] - 2, y1 = FLOOR_Y[b];
      ctx.fillRect(c * T + 2, y0, 2, y1 - y0);
      ctx.fillRect(c * T + 12, y0, 2, y1 - y0);
      for (let y = y0 + 4; y < y1; y += 6) ctx.fillRect(c * T + 2, y, 12, 2);
    }
    for (const [f, c0, c1] of lvl.floors) {
      const y = FLOOR_Y[f], x = c0 * T, w = (c1 - c0 + 1) * T;
      ctx.fillStyle = '#091140'; ctx.fillRect(x, y, w, 5);
      ctx.fillStyle = '#9cc6ff'; ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = '#163a7a'; ctx.fillRect(x, y + 5, w, 1);
    }
    for (const s of G.subs) {
      const x = s.c0 * T - 8, w = SUB_W * T + 16;
      roundRect(x, PLATE_Y, w, 7, 3, '#8b5a2b');
      ctx.fillStyle = '#c08a52'; ctx.fillRect(x + 3, PLATE_Y, w - 6, 2);
      text('6 FT', s.c0 * T + SUB_W * T / 2, PLATE_Y + 16, 7, '#F6E300');
    }
  }

  function drawBonus(b) {
    if (b.t < 2 && Math.floor(G.t * 8) % 2) return;
    const def = CFG.bonuses[b.type];
    // falls back to a colored circle with the first letter if the PNG is missing
    // gentle float: rises up to 3px off the floor and back, about once a second
    const bob = -Math.round(1.5 * (1 + Math.sin(G.t * 5)));
    drawSprite(sprites.bonuses[b.type], def, b.x, b.y, { size: def.size, bob });
  }

  function drawEnemy(e) {
    if (e.state === 'waiting' || e.state === 'dead') return;
    const def = CFG.villains[e.type], img = sprites.villains[e.type];
    const moving = e.state === 'walk';
    const frame = moving ? Math.floor(G.t * 8) : 0;
    const bob = moving && Math.floor(G.t * 8) % 2 ? -1 : 0;
    const alpha = e.state === 'stunned' && Math.floor(G.t * 10) % 2 ? 0.45 : 1;
    drawSprite(img, def, e.x, Math.round(e.y), { flip: e.face < 0, frame, bob, alpha });
    if (e.state === 'stunned') {
      for (let i = 0; i < 3; i++) {
        const a = G.t * 6 + i * 2.1;
        ctx.fillStyle = '#ffe14d';
        ctx.fillRect(e.x + Math.cos(a) * 10 - 1.5, e.y - CFG.spriteSize - 2 + Math.sin(a) * 3, 3, 3);
      }
    }
  }

  function drawPlayer() {
    const p = G.player, def = CFG.characters[G.charIndex], img = sprites.characters[G.charIndex];
    if (G.state === 'dying') {
      const t = p.deathT;
      drawSprite(img, def, p.x, p.y, { rot: t < 1.2 ? t * 14 : Math.PI, alpha: t > 1.6 ? Math.max(0, 1 - (t - 1.6) * 2) : 1 });
      return;
    }
    let flip = p.face < 0, bob = 0, frame = 0;
    if (p.moving) {
      if (p.climbing) flip = Math.floor(G.t * 7) % 2 === 1;
      else { bob = Math.floor(G.t * 10) % 2 ? -1 : 0; frame = Math.floor(G.t * 10); }
    }
    drawSprite(img, def, p.x, p.y, { flip, bob, frame });
  }

  function drawCloud(c) {
    const k = c.t / c.life;
    ctx.save();
    ctx.globalAlpha = 0.9 * (1 - k * 0.7);
    // Fine grains: fixed pseudo-random spots that drift outward and settle as the cloud fades
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    for (let i = 0; i < 48; i++) {
      const rx = ((i * 73 + 17) % 101) / 100, ry = ((i * 41 + 29) % 97) / 96;
      const px = c.x + rx * c.w, py = c.y + ry * c.h;
      const dx = (px - cx) * k * 0.25, dy = (py - cy) * k * 0.25 + k * 4;
      const s = i % 3 === 0 ? 2 : 1.5;
      ctx.fillStyle = i % 4 ? '#f2f2f2' : '#b8b8b8';
      ctx.fillRect(Math.round(px + dx), Math.round(py + dy), s, s);
    }
    ctx.restore();
  }

  function drawHUD() {
    text('SCORE', 16, 14, 8, '#F6E300', 'left');
    text(String(G.score).padStart(6, '0'), 16, 28, 10, '#fff', 'left');
    text('HI-SCORE', W / 2, 14, 8, '#F6E300');
    text(String(Math.max(window.Scores.best, G.score)).padStart(6, '0'), W / 2, 28, 10, '#fff');
    text('LEVEL', W - 16, 14, 8, '#F6E300', 'right');
    text(String(G.levelNum), W - 16, 28, 10, '#fff', 'right');

    const by = H - 14;
    const def = CFG.characters[G.charIndex], img = sprites.characters[G.charIndex];
    const reserve = Math.max(0, G.lives - (G.state === 'dying' || G.state === 'gameover' ? 0 : 1));
    for (let i = 0; i < Math.min(reserve, 6); i++) drawSprite(img, def, 20 + i * 20, by + 7, { size: 18 });
    pepperIcon(W - 70, by + 4);
    text('x' + G.pepper, W - 52, by, 9, '#fff', 'left');
    if (Sfx.muted) text('MUTE', W / 2, by, 7, '#777');
  }

  function overlay(lines) {
    const h = lines.length * 22 + 24;
    roundRect(W / 2 - 170, H / 2 - h / 2, 340, h, 8, 'rgba(10,12,30,0.88)');
    lines.forEach(([str, size, color], i) => text(str, W / 2, H / 2 - h / 2 + 24 + i * 22, size, color));
  }

  function drawGame() {
    drawLevel();
    for (const ing of G.ingredients) drawIngredient(ing);
    if (G.bonus) drawBonus(G.bonus);
    for (const e of G.enemies) drawEnemy(e);
    drawPlayer();
    if (G.cloud) drawCloud(G.cloud);
    for (const pu of G.popups) text(pu.text, pu.x, pu.y - pu.t * 20, 8, pu.color);
    drawHUD();

    const touch = document.body.classList.contains('touch');
    if (G.state === 'ready') overlay([[`LEVEL ${G.levelNum}`, 12, '#F6E300'], ['READY!', 14, '#fff']]);
    else if (G.state === 'clear') overlay([['SUBS SERVED!', 14, '#F6E300'], [`LEVEL ${G.levelNum} CLEAR`, 10, '#fff']]);
    else if (G.state === 'paused') overlay([['PAUSED', 14, '#F6E300'], [touch ? 'TAP TO RESUME' : 'PRESS P TO RESUME', 8, '#fff']]);
    else if (G.state === 'gameover') {
      const l = [['GAME OVER', 16, '#FF6600'], [`SCORE ${G.score}`, 10, '#fff']];
      if (G.timer <= 0 && G.place === 0 && !G.modal) l.push([touch ? 'TAP TO CONTINUE' : 'PRESS ENTER', 8, '#F6E300']);
      overlay(l);
    }
  }

  // ------------------------------------------------------------ screens
  const HISCORE_BTN = { x: W / 2 - 120, y: 456, w: 240, h: 36 }; // title-screen tap target for the top 10

  function drawTitle() {
    const img = sprites.title;
    if (img) {
      const s = Math.min(440 / img.width, 220 / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (W - w) / 2, 50, w, h);
    } else {
      text(CFG.title.text.toUpperCase(), W / 2, 140, 22, '#F6E300');
    }

    const touch = document.body.classList.contains('touch');
    if (Math.floor(G.t * 2) % 2 === 0) text(touch ? 'TAP TO START' : 'PRESS ENTER', W / 2, 310, 12, '#fff');

    text('- VILLAINS -', W / 2, 360, 8, '#F6E300');
    VILLAIN_ORDER.forEach((k, i) => {
      const x = W / 2 + (i - 1) * 130;
      drawSprite(sprites.villains[k], CFG.villains[k], x, 425, { size: 48, bob: Math.floor(G.t * 4 + i) % 2 ? -2 : 0 });
      text(CFG.villains[k].name.toUpperCase(), x, 442, 7, '#fff');
    });

    const hb = HISCORE_BTN; // border doubles as the visible tap target for the top 10
    ctx.strokeStyle = '#F6E300';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hb.x, hb.y, hb.w, hb.h, 6); else ctx.rect(hb.x, hb.y, hb.w, hb.h);
    ctx.stroke();
    text(`HI-SCORE ${String(window.Scores.best).padStart(6, '0')}`, W / 2, 470, 8, '#F6E300');
    if (window.Scores.enabled) text(touch ? 'TAP FOR TOP 10' : 'CLICK FOR TOP 10', W / 2, 483, 6, '#F6E300');
    if (!touch) text('ARROWS/WASD MOVE  SPACE PEPPER  P PAUSE  M MUTE', W / 2, 516, 6, '#F9FAFB');
  }

  function drawSelect() {
    text('CHOOSE YOUR PLAYER', W / 2, 60, 14, '#F6E300');
    selectTiles().forEach((t, i) => {
      const sel = i === G.charIndex, def = CFG.characters[i];
      roundRect(t.x - 3, t.y - 3, t.w + 6, t.h + 6, 10, sel ? '#F6E300' : '#2a2f55');
      roundRect(t.x, t.y, t.w, t.h, 8, sel ? '#5c94fc' : '#151933');
      const bob = sel && Math.floor(G.t * 4) % 2 ? -3 : 0;
      drawSprite(sprites.characters[i], def, t.x + t.w / 2, t.y + 88, { size: 72, bob });
      const words = def.name.toUpperCase().split(' ');
      const lines = words.length > 2 ? [words[0], words.slice(1).join(' ')] : [words.join(' ')];
      lines.forEach((ln, j) => text(ln, t.x + t.w / 2, t.y + 100 + j * 11 - (lines.length - 1) * 2, 7, sel ? '#F6E300' : '#aaa'));
    });
    const b = START_BTN;
    roundRect(b.x, b.y, b.w, b.h, 10, Math.floor(G.t * 3) % 2 ? '#F6E300' : '#FF6600');
    text('START', W / 2, b.y + b.h / 2 + 1, 14, '#fff');
    const touch = document.body.classList.contains('touch');
    text(touch ? 'TAP A CHEF, THEN START' : 'ARROWS TO CHOOSE, ENTER TO START', W / 2, 480, 7, '#F9FAFB');
  }

  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#5c94fc'; // CHANGE GAME BACKGROUND COLOR HERE
    ctx.fillRect(0, 0, W, H);
    if (G.state === 'loading') text('LOADING...', W / 2, H / 2, 12, '#fff');
    else if (G.state === 'title') drawTitle();
    else if (G.state === 'select') drawSelect();
    else drawGame();
  }

  // ------------------------------------------------------------ boot
  function resize() {
    const stage = document.getElementById('stage');
    const cs = getComputedStyle(stage);
    const aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const s = Math.max(0.1, Math.min(aw / W, ah / H));
    const cssW = Math.floor(W * s), cssH = Math.floor(H * s);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    scale = Math.max(1, Math.min(4, (cssW * (window.devicePixelRatio || 1)) / W));
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
  }

  const toLogical = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H };
  };

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['playing', 'ready', 'dying', 'clear'].includes(G.state)) {
      G.prevState = G.state;
      G.state = 'paused';
    }
  });
  Input.setupTouch(canvas, toLogical);
  resize();

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= DT) { update(DT); acc -= DT; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const fontReady = document.fonts ? Promise.race([document.fonts.load(`10px ${FONT}`), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
  Promise.all([loadAssets(), fontReady]).then(() => { G.state = 'title'; });

  if (/[?&]debug\b/.test(location.search)) window.__sandwich = { G, sprites, startGame, canMove, startFall };
})();
