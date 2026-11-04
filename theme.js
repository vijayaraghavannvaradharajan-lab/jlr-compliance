/* Applies the saved theme before the page draws (no flash). Shared by index.html, status.html and portal.html.
   skin: original | crimson | midnight | velocity | emerald   (original keeps light/dark + accent choices)
   anim: full | subtle | off                                  (default: full, or subtle if the device asks for less motion) */
(function () {
  var SKIN_MODE = { crimson: 'dark', midnight: 'dark', emerald: 'dark', velocity: 'light' };
  var mode = 'system', accent = 'blue', skin = 'original', anim = '';
  try {
    mode = localStorage.getItem('tracker-theme') || 'system';
    accent = localStorage.getItem('tracker-accent') || 'blue';
    skin = localStorage.getItem('tracker-skin') || 'original';
    anim = localStorage.getItem('tracker-anim') || '';
  } catch (e) {}
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (!SKIN_MODE[skin] && skin !== 'original') skin = 'original';
  function apply() {
    var el = document.documentElement;
    var dark = SKIN_MODE[skin] ? SKIN_MODE[skin] === 'dark' : (mode === 'dark' || (mode === 'system' && mq && mq.matches));
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
      localStorage.setItem('tracker-skin', skin); localStorage.setItem('tracker-anim', anim);
    } catch (e) {}
  }
  window.TrackerTheme = {
    SKINS: [['original', 'Original', '#2667d1'], ['crimson', 'Crimson Forge', '#b3262b'], ['midnight', 'Midnight Ops', '#f2c94c'],
            ['velocity', 'Velocity', '#d0213a'], ['emerald', 'Emerald Pulse', '#2fd59c']],
    get: function () { return { mode: mode, accent: accent, skin: skin, anim: anim || document.documentElement.getAttribute('data-anim') }; },
    set: function (m, a) { if (m) mode = m; if (a) accent = a; save(); apply(); },
    setSkin: function (s) { skin = SKIN_MODE[s] || s === 'original' ? s : 'original'; save(); apply(); },
    setAnim: function (x) { anim = x === 'full' || x === 'subtle' || x === 'off' ? x : ''; save(); apply(); },
    reset: function () { mode = 'system'; accent = 'blue'; skin = 'original'; anim = ''; save(); apply(); }
  };
})();
