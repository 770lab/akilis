/* ============================================================
   VILLA MARAVILHA — scroll choreography & atmosphere
   ============================================================ */
(function () {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- smooth scroll (Lenis) ---------------- */
  var lenis = null;
  if (!reduceMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.95 });
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
      window.location.href = 'mailto:stay@villamaravilha.mx?subject=Villa%20Maravilha%20—%20Stay%20request&body=' + body;
    });
  }
})();
