// Tiny synthesized sound effects (no audio files needed).
window.Sfx = (() => {
  let ac = null, master = null, muted = false;

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.25;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  }

  function tone(freq, dur, { type = 'square', vol = 0.3, slide = null, delay = 0 } = {}) {
    if (muted || !ac) return;
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol) {
    if (muted || !ac) return;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 3000;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    src.buffer = buf;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  const seq = (notes, step, opts) => notes.forEach((f, i) => tone(f, step * 1.2, { ...opts, delay: i * step }));

  return {
    unlock,
    get muted() { return muted; },
    setMuted(v) { muted = v; },
    step:   () => tone(1300, 0.03, { vol: 0.07 }),
    drop:   () => tone(700, 0.3, { type: 'triangle', slide: 160, vol: 0.2 }),
    land:   () => tone(160, 0.08, { vol: 0.2 }),
    pepper: () => noise(0.25, 0.35),
    empty:  () => tone(110, 0.12, { vol: 0.15 }),
    squash: () => tone(320, 0.25, { type: 'sawtooth', slide: 60, vol: 0.2 }),
    bonus:  () => seq([880, 1175, 1568], 0.06, { vol: 0.15 }),
    select: () => tone(900, 0.05, { vol: 0.12 }),
    start:  () => seq([523, 659, 784, 1047, 784, 1047], 0.11, { vol: 0.15 }),
    die:    () => seq([660, 560, 470, 390, 310, 220], 0.14, { vol: 0.15 }),
    clear:  () => seq([523, 659, 784, 659, 784, 1047, 1319], 0.1, { vol: 0.15, type: 'triangle' }),
    life:   () => seq([1047, 1319, 1568, 2093], 0.08, { vol: 0.12 }),
  };
})();
