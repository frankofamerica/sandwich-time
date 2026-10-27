// Keyboard + touch input. Game code reads Input.dir() each frame and
// drains discrete events (pepper, confirm, pause, taps) with Input.drain().
window.Input = (() => {
  const KEYMAP = {
    ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R',
    ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D',
  };
  const held = [];   // keyboard directions, most recent last
  let padDir = null; // on-screen d-pad direction
  const events = [];

  window.addEventListener('keydown', e => {
    window.Sfx.unlock();
    const d = KEYMAP[e.code];
    if (d) {
      e.preventDefault();
      if (!held.includes(d)) { held.push(d); events.push({ type: 'dir', dir: d }); }
      return;
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'Space': case 'KeyZ': case 'KeyX': case 'KeyJ':
        e.preventDefault(); events.push({ type: 'pepper' }); break;
      case 'Enter': case 'NumpadEnter': events.push({ type: 'confirm' }); break;
      case 'Escape': case 'KeyP': events.push({ type: 'pause' }); break;
      case 'KeyM': events.push({ type: 'mute' }); break;
    }
  });
  window.addEventListener('keyup', e => {
    const d = KEYMAP[e.code];
    if (d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); }
  });
  window.addEventListener('blur', () => { held.length = 0; padDir = null; });

  function setupTouch(canvas, toLogical) {
    const body = document.body;
    const enableTouchUI = () => {
      if (!body.classList.contains('touch')) {
        body.classList.add('touch');
        window.dispatchEvent(new Event('resize'));
      }
    };
    if (window.matchMedia('(pointer: coarse)').matches) enableTouchUI();
    window.addEventListener('touchstart', () => { enableTouchUI(); window.Sfx.unlock(); }, { passive: true });
    document.addEventListener('gesturestart', e => e.preventDefault());

    // D-pad: direction comes from where the thumb is relative to the pad
    // center, so you can slide between directions without lifting.
    const pad = document.getElementById('dpad');
    let padPointer = null;
    const updatePad = e => {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      let d = null;
      if (Math.hypot(dx, dy) > r.width * 0.12)
        d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'U' : 'D');
      if (d && d !== padDir) events.push({ type: 'dir', dir: d });
      padDir = d;
      pad.dataset.dir = d || '';
    };
    pad.addEventListener('pointerdown', e => {
      e.preventDefault();
      window.Sfx.unlock();
      padPointer = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      updatePad(e);
    });
    pad.addEventListener('pointermove', e => { if (e.pointerId === padPointer) updatePad(e); });
    const release = e => {
      if (e.pointerId !== padPointer) return;
      padPointer = null; padDir = null; pad.dataset.dir = '';
    };
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);

    const bindButton = (id, type) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        window.Sfx.unlock();
        el.classList.add('down');
        events.push({ type });
      });
      const up = () => el.classList.remove('down');
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    };
    bindButton('btn-pepper', 'pepper');
    bindButton('btn-pause', 'pause');
    bindButton('btn-mute', 'mute');

    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      window.Sfx.unlock();
      const p = toLogical(e.clientX, e.clientY);
      events.push({ type: 'tap', x: p.x, y: p.y });
    });
  }

  return {
    dir: () => padDir || held[held.length - 1] || null,
    drain: () => events.splice(0),
    setupTouch,
  };
})();
