# Sandwich Time

A browser remake of the classic *BurgerTime*, but you're building **six-foot subs**.
Walk across each ingredient to drop it a floor. Knock it all the way down until
every sub is stacked on its board. Dodge (or squash) the Soda Can, Onion and
Cupcake, and shake **pepper** to stun them.

Plain HTML/JS/Canvas. There's no build step and nothing to install.

## Run it

- **Desktop:** double-click `index.html`.
- **Phone or tablet:** serve the folder and open it on your device over the same Wi-Fi:
  ```bash
  python3 -m http.server 8000
  # then open http://<your-computer-ip>:8000 on your phone
  ```
  To host it publicly, upload the whole folder to any static host (GitHub Pages, Netlify, S3, etc.).

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move / climb | Arrow keys or WASD | D-pad (slide your thumb between directions) |
| Pepper | Space / Z / X | PEPPER button |
| Start / confirm | Enter | Tap |
| Pause | P / Esc | II button |
| Mute | M | ♫ button |

## Replacing the artwork

Drop your own PNGs over the placeholders and keep the same filenames, or change the
paths and names in **`js/config.js`**.

| File | What it is |
|---|---|
| `assets/title/title.png` | Title-screen logo (currently says "Sandwich Time") |
| `assets/characters/character1.png` … `character7.png` | The 7 selectable characters |
| `assets/villains/soda-can.png` | Soda Can villain |
| `assets/villains/onion.png` | Onion villain |
| `assets/villains/cupcake.png` | Cupcake villain |
| `assets/bonus/coffee.png` | Coffee cup bonus item (+1 pepper). Square canvas, sits bottom-center on the floor; on-screen size is `bonus.size` in `js/config.js` |

**Sprite guidelines (characters and villains)**
- Transparent background, **square** canvas. 128×128 works well; any size scales.
- Face **right**. The game mirrors the sprite when it walks left.
- Feet at the **bottom edge**. The sprite is anchored bottom-center on the floor.
- Optional walk animation: put frames side by side in one horizontal strip
  (e.g. 4 frames → 512×128) and set `frames: 4` for that sprite in `js/config.js`.

**Title image:** any size and aspect ratio. It's scaled to fit the top of the title screen
(roughly 2:1 landscape looks best).

Character names, villain names, villain speed/aggression, lives, pepper count and
other tuning values are also in `js/config.js`.

If an image is missing or fails to load, the game draws a colored circle in its place
and keeps running.

To regenerate the original placeholder art (this overwrites the PNGs):
`python3 tools/make_placeholders.py`

## How it plays

- Each sub is 6 segments wide (one per "foot"). Walk over all 6 to drop that layer.
- A falling layer knocks the layer below it down too, so chain reactions are possible.
- Villains standing on a layer when it drops ride it down for big points (500, 1000, 2000…).
  Villains underneath a falling layer get squashed.
- Pepper stuns villains for a few seconds. Grab the **coffee** bonus for +1 pepper.
- There are 4 stage layouts. They cycle, and villains get faster and more numerous each level.
- Extra life every 20,000 points. Your high score is saved in the browser.

## Project layout

```
index.html          page shell + touch controls
css/style.css       responsive layout (desktop, phone portrait/landscape)
js/config.js        ← edit me: sprites, names, tuning
js/level.js         stage layouts (floors, ladders, ingredient positions)
js/game.js          game logic and rendering
js/input.js         keyboard + touch input
js/audio.js         synthesized sound effects
assets/             replaceable PNG art
tools/              placeholder art generator
```
