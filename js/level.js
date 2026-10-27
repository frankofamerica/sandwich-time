// Level geometry: floors, ladders and where each sub's ingredients start.
// Layouts are written in floor indices (0 = top floor, 5 = bottom floor).
window.Level = (() => {
  const T = 16, COLS = 30, ROWS = 33;
  const W = COLS * T, H = ROWS * T;
  const FLOOR_ROWS = [5, 9, 13, 17, 21, 25];
  const FLOOR_Y = FLOOR_ROWS.map(r => r * T);
  const PLATE_Y = 30 * T;
  const SUB_W = 6; // a six-foot sub: six one-"foot" segments
  const LAYER_H = { top: 10, lettuce: 6, tomato: 6, cheese: 6, meat: 7, bottom: 8, cutlet: 8, peppers: 5, mozzarella: 6 };

  const BASE_LAYOUTS = [
    {
      floors: [[0, 1, 28], [1, 1, 20], [2, 1, 28], [3, 8, 28], [4, 1, 28], [5, 1, 28]],
      // [column, top floor, bottom floor]
      ladders: [[1, 0, 5], [9, 0, 3], [9, 4, 5], [10, 3, 4], [19, 1, 4], [20, 0, 1], [20, 4, 5], [28, 0, 5]],
      subs: [
        { c0: 2,  layers: [['top', 0], ['lettuce', 1], ['cheese', 2], ['meat', 4], ['bottom', 5]] },
        { c0: 12, layers: [['top', 0], ['peppers', 1], ['mozzarella', 3], ['cutlet', 4], ['bottom', 5]] }, // chicken cutlet sub
        { c0: 22, layers: [['top', 0], ['lettuce', 2], ['tomato', 3], ['meat', 4], ['bottom', 5]] },
      ],
      start: { col: 14, floor: 5 },
    },
    {
      floors: [[0, 1, 28], [1, 6, 23], [2, 1, 28], [3, 1, 28], [4, 1, 10], [4, 19, 28], [5, 1, 28]],
      ladders: [[1, 0, 2], [1, 3, 5], [9, 1, 4], [10, 0, 1], [10, 4, 5], [20, 0, 3], [19, 3, 5], [28, 0, 5]],
      subs: [
        { c0: 2,  layers: [['top', 0], ['lettuce', 2], ['tomato', 3], ['meat', 4], ['bottom', 5]] },
        { c0: 12, layers: [['top', 0], ['peppers', 1], ['mozzarella', 2], ['cutlet', 3], ['bottom', 5]] }, // chicken cutlet sub
        { c0: 22, layers: [['top', 0], ['meat', 2], ['cheese', 3], ['tomato', 4], ['bottom', 5]] },
      ],
      start: { col: 14, floor: 5 },
    },
  ];

  const m = c => COLS - 1 - c;
  const mirror = L => ({
    floors: L.floors.map(([f, a, b]) => [f, m(b), m(a)]),
    ladders: L.ladders.map(([c, a, b]) => [m(c), a, b]),
    subs: L.subs.map(s => ({ c0: m(s.c0 + SUB_W - 1), layers: s.layers })).reverse(),
    start: { col: m(L.start.col), floor: L.start.floor },
  });

  const LAYOUTS = [BASE_LAYOUTS[0], BASE_LAYOUTS[1], mirror(BASE_LAYOUTS[0]), mirror(BASE_LAYOUTS[1])];

  function build(index) {
    const L = LAYOUTS[index % LAYOUTS.length];
    const grid = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    const floor = grid(), ladder = grid();

    for (const [f, c0, c1] of L.floors)
      for (let c = c0; c <= c1; c++) floor[FLOOR_ROWS[f]][c] = true;
    // A ladder tile at row r means you can climb through y in [r*T, (r+1)*T].
    for (const [c, a, b] of L.ladders)
      for (let r = FLOOR_ROWS[a]; r < FLOOR_ROWS[b]; r++) ladder[r][c] = true;

    const inside = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
    const spawns = [];
    for (const [f, c0, c1] of L.floors) {
      if (f !== 0 && f !== 5) continue;
      spawns.push({ x: c0 * T + T / 2, y: FLOOR_Y[f], dir: 'R' });
      spawns.push({ x: c1 * T + T / 2, y: FLOOR_Y[f], dir: 'L' });
    }

    return {
      floors: L.floors,
      ladders: L.ladders,
      subs: L.subs,
      spawns,
      start: { x: L.start.col * T + T / 2, y: FLOOR_Y[L.start.floor] },
      floorAt: (c, r) => inside(c, r) && floor[r][c],
      ladderAt: (c, r) => inside(c, r) && ladder[r][c],
      floorCovers(r, c0, c1) {
        for (let c = c0; c <= c1; c++) if (!inside(c, r) || !floor[r][c]) return false;
        return true;
      },
    };
  }

  return { T, COLS, ROWS, W, H, FLOOR_ROWS, FLOOR_Y, PLATE_Y, SUB_W, LAYER_H, build };
})();
