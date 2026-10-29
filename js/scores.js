// Online high-score table (Firebase Firestore) plus the name-entry and top-10
// dialogs. Stays switched off until `firebase` in js/config.js is filled in.
// The Firebase SDK is only downloaded once it's actually needed.
window.Scores = (() => {
  const CFG = window.GAME_CONFIG;
  const FB = CFG.firebase || {};
  const SIZE = CFG.leaderboardSize || 10;
  const MAX_NAME = CFG.nameMaxLength || 20;
  const COLLECTION = 'highscores';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
  const enabled = !!(FB.apiKey && FB.projectId);

  // ------------------------------------------------------------ database
  let dbPromise = null, cache = null;

  const loadScript = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('could not load ' + src));
    document.head.appendChild(s);
  });
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

  function db() {
    if (!dbPromise) {
      dbPromise = loadScript(SDK + 'firebase-app-compat.js')
        .then(() => loadScript(SDK + 'firebase-firestore-compat.js'))
        .then(() => (firebase.apps.length ? firebase.app() : firebase.initializeApp(FB)).firestore());
      dbPromise.catch(() => { dbPromise = null; }); // try again next time
    }
    return dbPromise;
  }

  async function top(ms = 8000) {
    const snap = await withTimeout(db().then(d =>
      d.collection(COLLECTION).orderBy('score', 'desc').limit(SIZE).get()), ms);
    const when = doc => { const t = doc.get('createdAt'); return t ? t.toMillis() : Infinity; };
    cache = snap.docs
      .map(doc => ({ id: doc.id, name: doc.get('name'), score: doc.get('score'), at: when(doc) }))
      .sort((a, b) => b.score - a.score || a.at - b.at); // ties: earlier entry ranks higher
    return cache;
  }

  // The leaderboard place (1..10) this score would take, or 0 if it doesn't
  // make the top 10. Ties go below existing entries. Resolves 0 when offline.
  async function placeFor(score) {
    if (!enabled || score <= 0) return 0;
    let list;
    try { list = await top(4000); } catch (e) { list = cache; }
    if (!list) return 0;
    const place = list.filter(r => r.score >= score).length + 1;
    return place <= SIZE ? place : 0;
  }

  async function submit(name, score) {
    const d = await withTimeout(db(), 8000);
    const ref = await withTimeout(d.collection(COLLECTION).add({
      name, score, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }), 8000);
    return ref.id;
  }

  const cleanName = s => s.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

  // ------------------------------------------------------------ dialogs
  const $ = id => document.getElementById(id);
  // The tap that opens a dialog can also "click" whatever lands under the
  // finger, so ignore close clicks for a moment after opening.
  let openedAt = 0;
  const justOpened = () => performance.now() - openedAt < 400;
  const open = dlg => { openedAt = performance.now(); dlg.showModal(); };

  const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'ST' : n % 10 === 2 && n !== 12 ? 'ND' : n % 10 === 3 && n !== 13 ? 'RD' : 'TH');

  // Resolves with the saved entry's id, or null if the player skipped.
  function promptName(score, place) {
    const dlg = $('name-dialog'), form = $('name-form'), input = $('name-input');
    const msg = $('name-msg'), submitBtn = $('name-submit'), skipBtn = $('name-skip');
    input.maxLength = MAX_NAME;
    input.value = '';
    msg.textContent = '';
    submitBtn.disabled = false;
    $('name-score').textContent = String(score).padStart(6, '0');
    $('name-place').textContent = `${ordinal(place)} PLACE`;
    $('name-place-sub').textContent = `ON THE TOP ${SIZE} LEADERBOARD`;

    return new Promise(resolve => {
      const done = id => {
        form.removeEventListener('submit', onSubmit);
        skipBtn.removeEventListener('click', onSkip);
        dlg.removeEventListener('cancel', onCancel);
        dlg.close();
        resolve(id);
      };
      const onSubmit = async e => {
        e.preventDefault();
        const name = cleanName(input.value);
        if (!name) { msg.textContent = 'PLEASE ENTER A NAME'; input.focus(); return; }
        submitBtn.disabled = true;
        msg.textContent = 'SAVING...';
        try {
          done(await submit(name, score));
        } catch (err) {
          console.warn('Sandwich Time: could not save score', err);
          msg.textContent = 'COULD NOT SAVE. TRY AGAIN?';
          submitBtn.disabled = false;
        }
      };
      const onSkip = () => { if (!justOpened()) done(null); };
      const onCancel = e => { e.preventDefault(); onSkip(); }; // Escape key
      form.addEventListener('submit', onSubmit);
      skipBtn.addEventListener('click', onSkip);
      dlg.addEventListener('cancel', onCancel);
      open(dlg);
      input.focus();
    });
  }

  // Shows the top 10. `highlightId` marks the player's own new entry.
  function showBoard(highlightId = null) {
    const dlg = $('scores-dialog'), list = $('scores-list'), msg = $('scores-msg');
    const render = rows => {
      list.textContent = '';
      rows.forEach((r, i) => {
        const li = document.createElement('li');
        if (r.id === highlightId) li.className = 'me';
        const rank = document.createElement('span'), name = document.createElement('span'), pts = document.createElement('span');
        rank.className = 'rank'; name.className = 'name'; pts.className = 'pts';
        rank.textContent = i + 1;
        name.textContent = String(r.name || '').toUpperCase();
        pts.textContent = String(r.score).padStart(6, '0');
        li.append(rank, name, pts);
        list.appendChild(li);
      });
      msg.textContent = rows.length ? '' : 'NO SCORES YET. BE THE FIRST!';
    };

    if (cache) render(cache); else { list.textContent = ''; msg.textContent = 'LOADING...'; }
    top().then(render).catch(err => {
      console.warn('Sandwich Time: could not load scores', err);
      if (!cache) msg.textContent = 'COULD NOT LOAD SCORES';
    });

    return new Promise(resolve => {
      const done = () => {
        if (justOpened()) return;
        $('scores-close').removeEventListener('click', done);
        dlg.removeEventListener('click', onBackdrop);
        dlg.removeEventListener('cancel', onCancel);
        dlg.close();
        resolve();
      };
      const onBackdrop = e => { if (e.target === dlg) done(); };
      const onCancel = e => { e.preventDefault(); openedAt = 0; done(); };
      $('scores-close').addEventListener('click', done);
      dlg.addEventListener('click', onBackdrop);
      dlg.addEventListener('cancel', onCancel);
      open(dlg);
    });
  }

  if (enabled) top().catch(() => {}); // warm the cache for the title screen

  return {
    enabled, placeFor, promptName, showBoard,
    get best() { return cache && cache.length ? cache[0].score : 0; }, // #1 on the leaderboard
  };
})();
