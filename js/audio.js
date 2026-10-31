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

  function tone(freq, dur, { type = 'square', vol = 0.3, slide = null, delay = 0, at = null, out = master } = {}) {
    if (muted || !ac) return;
    const t0 = at !== null ? at : ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(out);
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

  // ------------------------------------------------------------ music
  // Original chiptune loop in an arcade style. One token per eighth note:
  // a note name ('C5', 'F#5'), '-' for a rest, '=' to hold the previous note.
  const EIGHTH = 0.15; // seconds
  const LEAD = `
    E5 G5 C6 G5 E5 G5 C6 -   D6 C6 B5 C6 G5 - E5 -    F5 A5 C6 A5 F5 A5 C6 -   E6 D6 C6 D6 E6 = = -
    D5 G5 B5 G5 D5 G5 B5 -   D6 C6 B5 A5 G5 A5 B5 -   C6 G5 E5 G5 A5 G5 E5 D5  C5 - E5 - C5 = = -
    A5 - A5 C6 E6 - C6 -     B5 - B5 G5 E5 - G5 -     A5 G5 F5 E5 F5 G5 A5 C6  B5 - D6 - G6 = = -
    A5 A5 C6 A5 G5 G5 C6 G5  F5 F5 E5 E5 D5 D5 C5 -   D5 E5 F#5 G5 A5 B5 C6 D6 B5 - G5 - D5 = = -`;
  const ROOTS = 'C C F C G G C G A E F G F C D G'; // one per bar, for the oom-pah bass
  const parse = s => s.trim().split(/\s+/);
  const MIDI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freqOf = n => {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    return 440 * 2 ** ((MIDI[m[1]] + (m[2] ? 1 : 0) + (+m[3] + 1) * 12 - 69) / 12);
  };
  const lead = parse(LEAD), roots = parse(ROOTS);
  const FIFTH = { C: 'G', D: 'A', E: 'B', F: 'C', G: 'D', A: 'E' };
  let music = null; // { out, step, next, timer } while playing
  let hatBuf = null;

  function hat(at, out) {
    if (!hatBuf) {
      hatBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.03), ac.sampleRate);
      const d = hatBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.value = 0.12;
    src.buffer = hatBuf;
    src.connect(f); f.connect(g); g.connect(out);
    src.start(at);
  }

  function scheduleStep(i, at, out) {
    const s = i % lead.length, note = lead[s];
    if (note !== '-' && note !== '=') {
      let len = 1;
      while (lead[(s + len) % lead.length] === '=') len++;
      tone(freqOf(note), EIGHTH * len * 0.9, { vol: 0.09, at, out });
    }
    const root = roots[Math.floor(s / 8) % roots.length], beat = s % 8;
    if (beat % 2 === 0) {
      const bassNote = beat % 4 === 0 ? root + '2' : FIFTH[root] + (FIFTH[root] < root ? '3' : '2');
      tone(freqOf(bassNote), EIGHTH * 0.9, { type: 'triangle', vol: 0.35, at, out });
    } else {
      hat(at, out);
    }
  }

  // Look-ahead scheduler: queues notes slightly ahead of time so the beat
  // stays steady even when frames hitch.
  function pump() {
    if (music.next < ac.currentTime) music.next = ac.currentTime + 0.02; // timer was throttled; don't burst
    while (music.next < ac.currentTime + 0.12) {
      scheduleStep(music.step++, music.next, music.out);
      music.next += EIGHTH;
    }
  }

  // Call every frame; starts or stops the loop only when `on` changes.
  function setMusic(on) {
    on = on && !muted && !!ac;
    if (on === !!music) return;
    if (on) {
      const out = ac.createGain();
      out.gain.value = 0.6;
      out.connect(master);
      music = { out, step: 0, next: ac.currentTime + 0.05, timer: null };
      pump();
      music.timer = setInterval(pump, 30);
    } else {
      clearInterval(music.timer);
      const out = music.out;
      out.gain.setTargetAtTime(0, ac.currentTime, 0.02); // fade out notes already queued
      setTimeout(() => out.disconnect(), 300);
      music = null;
    }
  }

  return {
    unlock,
    music: setMusic,
    get muted() { return muted; },
    setMuted(v) { muted = v; },
    step:   () => tone(1300, 0.03, { vol: 0.07 }),
    drop:   () => tone(700, 0.3, { type: 'triangle', slide: 160, vol: 0.2 }),
    land:   () => tone(160, 0.08, { vol: 0.2 }),
    pepper: () => noise(0.25, 0.35),
    empty:  () => tone(110, 0.12, { vol: 0.15 }),
    squash: () => tone(320, 0.25, { type: 'sawtooth', slide: 60, vol: 0.2 }),
    bonus:  () => seq([880, 1175, 1568], 0.06, { vol: 0.15 }),
    bonusAppear: () => seq([1568, 1319, 1568, 1319, 1976], 0.07, { vol: 0.13, type: 'triangle' }),
    select: () => tone(900, 0.05, { vol: 0.12 }),
    start:  () => seq([523, 659, 784, 1047, 784, 1047], 0.11, { vol: 0.15 }),
    die:    () => seq([660, 560, 470, 390, 310, 220], 0.14, { vol: 0.15 }),
    clear:  () => seq([523, 659, 784, 659, 784, 1047, 1319], 0.1, { vol: 0.15, type: 'triangle' }),
    life:   () => seq([1047, 1319, 1568, 2093], 0.08, { vol: 0.12 }),
  };
})();
