/* Applies the saved theme before the page draws (no flash). Shared by index.html, status.html and portal.html.
   skin: original | crimson | midnight | velocity | emerald   (original keeps light/dark + accent choices)
   anim: full | subtle | off                                  (default: full, or subtle if the device asks for less motion)
   layout: a (Office) | b (Performance — dark; only Admin and Team members, the app checks the role)
   look:   pro (Professional — default) | game (Game) | classic (the skins above). Partners, Managers and the client
           pages always get Professional; Admin and Team members can pick (the app checks the role) */
(function () {
  var SKIN_MODE = { crimson: 'dark', midnight: 'dark', emerald: 'dark', velocity: 'light' };
  var mode = 'system', accent = 'blue', skin = 'original', anim = '', layout = 'a', layoutOk = false, look = 'pro', lookOk = false;
  var staffPage = !/(portal|status)\.html$/.test(location.pathname);     // the client pages always use the Office layout
  try {
    mode = localStorage.getItem('tracker-theme') || 'system';
    accent = localStorage.getItem('tracker-accent') || 'blue';
    skin = localStorage.getItem('tracker-skin') || 'original';
    anim = localStorage.getItem('tracker-anim') || '';
    layout = localStorage.getItem('tracker-layout') === 'b' ? 'b' : 'a';
    layoutOk = localStorage.getItem('tracker-layout-ok') === '1';
    look = localStorage.getItem('tracker-look') || 'pro';
    lookOk = localStorage.getItem('tracker-look-ok') === '1';
  } catch (e) {}
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (!SKIN_MODE[skin] && skin !== 'original') skin = 'original';
  if (look !== 'game' && look !== 'classic') look = 'pro';
  function effLook() { return staffPage && lookOk ? look : 'pro'; }
  function apply() {
    var el = document.documentElement, lk = effLook();
    el.setAttribute('data-look', lk);
    if (lk !== 'classic') {                                   // Professional / Game: light, Office layout, original skin
      el.setAttribute('data-layout', 'a'); el.setAttribute('data-theme', 'light');
      el.setAttribute('data-accent', lk === 'game' ? 'purple' : 'blue'); el.setAttribute('data-skin', 'original');
      el.setAttribute('data-anim', anim || (rm && rm.matches ? 'subtle' : 'full'));
      return;
    }
    var lay = staffPage && layout === 'b' && layoutOk ? 'b' : 'a';
    el.setAttribute('data-layout', lay);
    var dark = lay === 'b' || (SKIN_MODE[skin] ? SKIN_MODE[skin] === 'dark' : (mode === 'dark' || (mode === 'system' && mq && mq.matches)));
    el.setAttribute('data-theme', dark ? 'dark' : 'light');
    el.setAttribute('data-accent', skin === 'original' ? accent : 'none');
    el.setAttribute('data-skin', skin);
    el.setAttribute('data-anim', anim || (rm && rm.matches ? 'subtle' : 'full'));
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (mode === 'system') apply(); });
  function save() {
    try {
      localStorage.setItem('tracker-theme', mode); localStorage.setItem('tracker-accent', accent);
      localStorage.setItem('tracker-skin', skin); localStorage.setItem('tracker-anim', anim); localStorage.setItem('tracker-layout', layout); localStorage.setItem('tracker-look', look);
    } catch (e) {}
  }
  window.TrackerTheme = {
    SKINS: [['original', 'Original', '#2667d1'], ['crimson', 'Crimson Forge', '#b3262b'], ['midnight', 'Midnight Ops', '#f2c94c'],
            ['velocity', 'Velocity', '#d0213a'], ['emerald', 'Emerald Pulse', '#2fd59c']],
    get: function () { return { mode: mode, accent: accent, skin: skin, anim: anim || document.documentElement.getAttribute('data-anim'), layout: layout, look: effLook(), lookOk: lookOk }; },
    setLook: function (x) { look = x === 'game' || x === 'classic' ? x : 'pro'; save(); apply(); },
    allowLook: function (ok) { lookOk = !!ok; try { localStorage.setItem('tracker-look-ok', ok ? '1' : '0'); } catch (e) {} apply(); },
    setLayout: function (x) { layout = x === 'b' ? 'b' : 'a'; save(); apply(); },
    allowLayout: function (ok) { layoutOk = !!ok; try { localStorage.setItem('tracker-layout-ok', ok ? '1' : '0'); } catch (e) {} apply(); },
    set: function (m, a) { if (m) mode = m; if (a) accent = a; save(); apply(); },
    setSkin: function (s) { skin = SKIN_MODE[s] || s === 'original' ? s : 'original'; save(); apply(); },
    setAnim: function (x) { anim = x === 'full' || x === 'subtle' || x === 'off' ? x : ''; save(); apply(); },
    reset: function () { mode = 'system'; accent = 'blue'; skin = 'original'; anim = ''; layout = 'a'; look = 'pro'; save(); apply(); }
  };
})();
