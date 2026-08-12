/* ============================================================
   ACHILLE IMMOBILIER — scroll choreography & atmosphere
   ============================================================ */
(function () {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- smooth scroll (Lenis) ---------------- */
  var lenis = null;
  if (!reduceMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.95 });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* anchor links routed through Lenis */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.6 });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------------- loader ---------------- */
  var loader = document.getElementById('loader');
  window.addEventListener('load', function () {
    setTimeout(function () { loader.classList.add('is-done'); }, 700);
  });
  /* hard fallback so the site never stays hidden */
  setTimeout(function () { loader.classList.add('is-done'); }, 2600);

  /* ---------------- scene activation ---------------- */
  var scenes = document.querySelectorAll('.scene');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('is-active');
    });
  }, { threshold: 0.45 });
  scenes.forEach(function (s) { io.observe(s); });

  /* first scene activates on load */
  setTimeout(function () { scenes[0].classList.add('is-active'); }, 900);

  /* ---------------- parallax per scene ---------------- */
  if (!reduceMotion) {
    scenes.forEach(function (scene) {
      var img = scene.querySelector('.scene-bg img');
      if (img) {
        gsap.fromTo(img,
          { yPercent: -8, scale: 1.16 },
          {
            yPercent: 8, scale: 1.16, ease: 'none',
            scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom top', scrub: true }
          });
      }
      var copy = scene.querySelector('.hero-copy, .plan-copy, .garden-copy, .int-copy, .night-copy');
      if (copy) {
        gsap.fromTo(copy,
          { y: 0 },
          {
            y: -60, ease: 'none',
            scrollTrigger: { trigger: scene, start: 'top top', end: 'bottom top', scrub: true }
          });
      }
    });
  }

  /* ---------------- plan index ↔ callouts ---------------- */
  document.querySelectorAll('.plan-index li').forEach(function (li) {
    var key = li.getAttribute('data-co');
    var co = document.querySelector('.callout[data-group="' + key + '"]');
    if (!co) return;
    li.addEventListener('mouseenter', function () { co.classList.add('is-hi'); });
    li.addEventListener('mouseleave', function () { co.classList.remove('is-hi'); });
  });

  /* ---------------- ocean — synthesized ambience ---------------- */
  var audioCtx = null, oceanGain = null, oceanOn = false;

  function buildOcean() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    /* brown-ish noise buffer */
    var seconds = 4;
    var buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * seconds, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    var last = 0;
    for (var i = 0; i < data.length; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;

    /* slow swell — waves */
    var lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.09;
    var lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 190;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    var lfo2 = audioCtx.createOscillator();
    lfo2.frequency.value = 0.061;
    var lfo2Gain = audioCtx.createGain();
    lfo2Gain.gain.value = 0.05;

    oceanGain = audioCtx.createGain();
    oceanGain.gain.value = 0;
    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(oceanGain.gain);

    noise.connect(filter);
    filter.connect(oceanGain);
    oceanGain.connect(audioCtx.destination);

    noise.start();
    lfo.start();
    lfo2.start();
  }

  var soundToggle = document.getElementById('soundToggle');
  var soundState = document.getElementById('soundState');
  if (soundToggle) {
    soundToggle.addEventListener('click', function () {
      if (!audioCtx) buildOcean();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      oceanOn = !oceanOn;
      var t = audioCtx.currentTime;
      oceanGain.gain.cancelScheduledValues(t);
      oceanGain.gain.setValueAtTime(oceanGain.gain.value, t);
      oceanGain.gain.linearRampToValueAtTime(oceanOn ? 0.16 : 0, t + 1.4);
      soundToggle.classList.toggle('is-on', oceanOn);
      soundToggle.setAttribute('aria-pressed', String(oceanOn));
      soundState.textContent = oceanOn ? 'ON' : 'OFF';
    });
  }

  /* ---------------- threshold walkthrough — canvas scroll scrub ---------------- */
  (function initWalk() {
    var walk = document.getElementById('walk');
    var canvas = document.getElementById('walkCanvas');
    if (!walk || !canvas) return;

    fetch('img/walk/manifest.json')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (m) { setup(m.count, m.pad, m.ext); })
      .catch(function () { walk.style.display = 'none'; ScrollTrigger.refresh(); });

    function setup(COUNT, PAD, EXT) {
      var ctx = canvas.getContext('2d');
      var frames = new Array(COUNT);
      var loaded = new Array(COUNT);
      var current = 0, target = 0, drawnFrame = -1;

      function src(i) {
        var n = String(i + 1); while (n.length < (PAD || 4)) n = '0' + n;
        return 'img/walk/w_' + n + '.' + (EXT || 'jpg');
      }
      function load(i, cb) {
        if (frames[i]) return;
        var im = new Image();
        im.onload = function () { loaded[i] = true; if (cb) cb(); };
        im.src = src(i);
        frames[i] = im;
      }

      /* first frame right away, the rest in gentle batches */
      load(0, function () { drawnFrame = -1; });
      var q = 1;
      (function pump() {
        var batch = 0;
        while (q < COUNT && batch < 6) { load(q); q++; batch++; }
        if (q < COUNT) setTimeout(pump, 120);
      })();

      function nearestLoaded(i) {
        if (loaded[i]) return i;
        for (var d = 1; d < COUNT; d++) {
          if (i - d >= 0 && loaded[i - d]) return i - d;
          if (i + d < COUNT && loaded[i + d]) return i + d;
        }
        return -1;
      }

      function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        drawnFrame = -1;
      }
      window.addEventListener('resize', resize);
      resize();

      function draw(i) {
        var im = frames[i];
        if (!im || !loaded[i]) return;
        var cw = canvas.width, ch = canvas.height;
        var ir = im.naturalWidth / im.naturalHeight, cr = cw / ch;
        var dw, dh, dx, dy;
        if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
        else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
        ctx.drawImage(im, dx, dy, dw, dh);
        drawnFrame = i;
      }

      gsap.ticker.add(function () {
        current += (target - current) * 0.22;
        var i = nearestLoaded(Math.round(current));
        if (i !== -1 && i !== drawnFrame) draw(i);
      });

      var fill = document.getElementById('walkProgressFill');
      var caps = walk.querySelectorAll('.walk-caption');
      var RANGES = [[0.04, 0.3], [0.36, 0.62], [0.68, 0.97]];

      ScrollTrigger.create({
        trigger: walk,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: function (self) {
          var p = self.progress;
          target = p * (COUNT - 1);
          if (fill) fill.style.transform = 'scaleX(' + p + ')';
          caps.forEach(function (c, idx) {
            var r = RANGES[idx] || [2, 3];
            c.classList.toggle('is-on', p >= r[0] && p <= r[1]);
          });
          walk.classList.toggle('is-done', p > 0.97);
        }
      });
    }
  })();

  /* ---------------- reserve form ---------------- */
  var form = document.getElementById('reserveForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var arrival = form.arrival.value || '—';
      var departure = form.departure.value || '—';
      var guests = form.guests.value || '—';
      var body = 'Stay request%0D%0A%0D%0AArrival: ' + encodeURIComponent(arrival) +
        '%0D%0ADeparture: ' + encodeURIComponent(departure) +
        '%0D%0AGuests: ' + encodeURIComponent(guests);
      window.location.href = 'mailto:contact@achille-immobilier.com?subject=Achille%20Immobilier%20—%20Stay%20request&body=' + body;
    });
  }
})();
