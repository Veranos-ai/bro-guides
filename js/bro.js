/* BRO Research: navigation, language memory, reconstitution calculator.
   No dependencies. Calculator text comes from the page (#calc-i18n), never from this file. */
(function () {
  'use strict';

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Menu dropdowns ---------- */
  function closeMenus(except) {
    document.querySelectorAll('.nav-item.is-open').forEach(function (i) {
      if (i === except) return;
      i.classList.remove('is-open');
      var b = i.querySelector('.sub-toggle'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  document.querySelectorAll('.sub-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.nav-item');
      closeMenus(item);
      var open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.nav-item')) closeMenus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });

  /* ---------- Language memory ----------
     Choosing a language stores it. Each page's <head> reads it and moves to the
     matching page, so the whole site stays in that language until it is changed. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-set-lang]') : null;
    if (!a) return;
    try { localStorage.setItem('bro-lang', a.getAttribute('data-set-lang')); } catch (err) { /* private mode */ }
  });

  /* ---------- Calculator ---------- */
  var app = document.getElementById('calc-app');
  if (!app) return;

  var S = JSON.parse(document.getElementById('calc-i18n').textContent);
  var LOCALE = document.documentElement.lang || 'en';
  var C = window.BROCalc; /* the maths lives in calc-core.js */

  /* state.dose is always stored in mcg */
  var state = { strength: 10, water: 2, dose: 250, syringe: 100 };
  var doseUnit = 'mcg';

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    hero: $('result-hero'), label: $('result-label'), units: $('result-units'), sub: $('result-sub'),
    sentence: $('result-sentence'), warning: $('warning'), svg: $('syringe-svg'), caption: $('syringe-caption'),
    strength: $('r-strength'), volume: $('r-volume'), reading: $('r-reading'), uses: $('r-uses'),
    formula: $('formula'), sticky: $('sticky-units')
  };

  /* "{name}" placeholders */
  function tpl(str, vars) {
    return str.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
  }
  /* Accepts 2.5 and 2,5 */
  var num = C.parseNum;
  function fmt(n, dp) { return n > 0 ? C.fmt(n, dp, LOCALE) : '—'; }
  function fmtAmount(mcg) {
    return mcg >= 1000 ? fmt(mcg / 1000, 3) + ' ' + S.mg : fmt(mcg, 1) + ' ' + S.mcg;
  }

  /* Wire each picker: chips, the "Other" chip and its custom input */
  Object.keys(state).forEach(function (key) {
    var pick = app.querySelector('[data-pick="' + key + '"]');
    if (!pick) return;
    var row = pick.querySelector('.custom-row');
    var input = row ? row.querySelector('input') : null;

    function readInput() {
      var v = num(input.value);
      if (!(isFinite(v) && v > 0)) return 0;
      return (key === 'dose' && doseUnit === 'mg') ? v * 1000 : v;
    }

    pick.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        pick.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        chip.setAttribute('aria-pressed', 'true');
        var other = chip.hasAttribute('data-other');
        if (row) row.classList.toggle('is-open', other);
        if (other && input) {
          if (!input.value) input.value = key === 'dose' ? (doseUnit === 'mg' ? state.dose / 1000 : state.dose) : state[key];
          input.focus(); input.select();
          state[key] = readInput();
        } else {
          var v = parseFloat(chip.getAttribute('data-value'));
          if (isFinite(v) && v > 0) state[key] = v;
        }
        render();
      });
    });

    if (input) input.addEventListener('input', function () { state[key] = readInput(); render(); });
  });

  /* mcg / mg switch for the custom target amount */
  var unitBtns = app.querySelectorAll('#dose-unit [data-unit]');
  unitBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      doseUnit = btn.getAttribute('data-unit');
      unitBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
      var input = $('custom-dose');
      var v = num(input.value);
      if (isFinite(v) && v > 0) state.dose = doseUnit === 'mg' ? v * 1000 : v;
      render();
    });
  });

  function setWarning(msg, isError) {
    el.warning.textContent = msg || '';
    el.warning.classList.toggle('is-visible', !!msg);
    el.hero.classList.toggle('is-error', !!(msg && isError));
  }

  function render() {
    var mg = state.strength, ml = state.water, targetMcg = state.dose, barrel = state.syringe;
    var r = C.reconstitution({ mg: mg, ml: ml, targetMcg: targetMcg, barrel: barrel });
    var barrelMl = barrel / 100;
    el.label.textContent = S.label;
    el.caption.textContent = tpl(S.caption, { ml: barrelMl, max: barrel });
    el.svg.setAttribute('aria-label', S.svgLabel);
    setWarning('', false);

    if (!r) {
      el.units.textContent = '—';
      if (el.sticky) el.sticky.textContent = '—';
      el.sub.innerHTML = '&nbsp;';
      el.sentence.textContent = S.enterAll;
      ['strength', 'volume', 'reading', 'uses'].forEach(function (k) { el[k].textContent = '—'; });
      el.formula.textContent = '';
      drawSyringe(barrel, 0);
      return;
    }

    var targetMg = r.targetMg, conc = r.conc, drawMl = r.drawMl, units = r.units, draws = r.draws;

    el.units.textContent = fmt(units, 1);
    if (el.sticky) el.sticky.textContent = fmt(units, 1);
    el.sub.textContent = tpl(S.sub, { drawMl: fmt(drawMl, 3), conc: fmt(conc, 2) });
    el.sentence.textContent = tpl(S.sentence, {
      mg: fmt(mg, 2), ml: fmt(ml, 2), conc: fmt(conc, 2), target: fmtAmount(targetMcg),
      drawMl: fmt(drawMl, 3), units: fmt(units, 1), barrel: barrel
    });
    el.strength.textContent = tpl(S.concentration, { c: fmt(conc, 2) });
    el.volume.textContent = tpl(S.volume, { d: fmt(drawMl, 3) });
    el.reading.textContent = tpl(S.reading, { u: fmt(units, 1), max: barrel });
    el.uses.textContent = tpl(S.draws, { n: draws });
    el.formula.textContent = [
      tpl(S.workConc, { mg: fmt(mg, 2), ml: fmt(ml, 2), c: fmt(conc, 2) }),
      tpl(S.workDraw, { t: fmt(targetMg, 3), c: fmt(conc, 2), d: fmt(drawMl, 3) }),
      tpl(S.workUnits, { d: fmt(drawMl, 3), u: fmt(units, 1) })
    ].join('\n');

    if (r.status === 'over') setWarning(tpl(S.warnOver, { u: fmt(units, 1), max: barrel }), true);
    else if (r.status === 'small') setWarning(tpl(S.warnSmall, { u: fmt(units, 1) }), false);
    else if (r.status === 'large') setWarning(tpl(S.warnLarge, { u: fmt(units, 1) }), false);

    drawSyringe(barrel, units);
  }

  /* ---------- Syringe drawing ----------
     Needle on the left, 0 at the needle end. The reading is the edge of the
     plunger tip that faces the needle, so the blue liquid grows from the needle. */
  function drawSyringe(maxUnits, fillUnits) {
    var H = 104, x0 = 96, w = 340, y = 32, h = 30;
    var inner = x0 + 8, width = w - 16;
    var fill = maxUnits > 0 ? Math.max(0, Math.min(1, fillUnits / maxUnits)) : 0;
    var markX = inner + fill * width;

    var ticks = '';
    for (var i = 0; i <= 10; i++) {
      var x = inner + (i / 10) * width, major = i % 5 === 0;
      ticks += '<line x1="' + x.toFixed(1) + '" y1="' + y + '" x2="' + x.toFixed(1) + '" y2="' + (y + (major ? 10 : 6)) +
        '" stroke="' + (major ? '#0e1626' : '#8891a1') + '" stroke-width="1"/>';
    }
    var labels = '';
    [0, 0.5, 1].forEach(function (p) {
      labels += '<text x="' + (inner + p * width).toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle" ' +
        'font-family="IBM Plex Mono, monospace" font-size="10" fill="#8891a1">' + Math.round(p * maxUnits) + '</text>';
    });
    var mid = y + h / 2;
    var labelX = Math.max(inner + 16, Math.min(inner + width - 16, markX));

    el.svg.innerHTML =
      '<line x1="8" y1="' + mid + '" x2="' + (x0 - 18) + '" y2="' + mid + '" stroke="#8891a1" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="' + (x0 - 18) + '" y="' + (mid - 8) + '" width="18" height="16" rx="3" fill="#0e1626"/>' +
      '<rect x="' + x0 + '" y="' + (y - 5) + '" width="' + w + '" height="' + (h + 10) + '" rx="6" fill="#fff" stroke="#0e1626" stroke-width="1.5"/>' +
      '<rect x="' + inner + '" y="' + y + '" width="' + (markX - inner).toFixed(1) + '" height="' + h + '" fill="#2b50e0"/>' +
      ticks +
      '<rect x="' + markX.toFixed(1) + '" y="' + (y - 5) + '" width="10" height="' + (h + 10) + '" fill="#0e1626"/>' +
      '<line x1="' + (markX + 10).toFixed(1) + '" y1="' + mid + '" x2="' + (x0 + w + 36) + '" y2="' + mid + '" stroke="#0e1626" stroke-width="4"/>' +
      '<rect x="' + (x0 + w + 36) + '" y="' + (mid - 14) + '" width="7" height="28" rx="2" fill="#0e1626"/>' +
      (fill > 0
        ? '<text x="' + labelX.toFixed(1) + '" y="' + (y - 13) + '" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600" fill="#0e1626">' + fmt(fillUnits, 1) + '</text>'
        : '') +
      labels;
  }

  render();
})();
