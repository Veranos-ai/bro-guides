/* BRO Research: supply calculator ("how long will it last").
   No dependencies. Text comes from the page (#supply-i18n), never from this file. */
(function () {
  'use strict';
  var app = document.getElementById('supply-app');
  if (!app) return;

  var S = JSON.parse(document.getElementById('supply-i18n').textContent);
  var LOCALE = document.documentElement.lang || 'en';
  var DAYS_PER_MONTH = 30.4375;
  var MIXED_WINDOW_WEEKS = 30 / 7; /* a mixed vial is commonly kept about 30 days */
  var MAX_VIALS = 8;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    units: $('s-value'), sub: $('s-sub'), sentence: $('s-sentence'), warning: $('s-warning'),
    bar: $('s-bar'), list: $('s-list'), formula: $('s-formula'), sticky: $('s-sticky'),
    rows: $('vial-rows'), add: $('add-vial'), tpl: $('vial-row-tpl'), dayWrap: $('day-chips'), dayBox: $('pick-days'),
    rTotal: $('s-r-total'), rWeek: $('s-r-week'), rDoses: $('s-r-doses'), rWeeks: $('s-r-weeks'), rMonths: $('s-r-months')
  };
  var state = { mode: 'dose', unit: 'mcg', days: {} };

  function tpl(str, vars) { return str.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; }); }
  function num(s) { return parseFloat(String(s).trim().replace(',', '.')); }
  function fmt(n, dp) {
    if (!isFinite(n)) return '—';
    return parseFloat(n.toFixed(dp)).toLocaleString(LOCALE, { maximumFractionDigits: dp });
  }
  function amount(mcg) { return mcg >= 1000 ? fmt(mcg / 1000, 3) + ' ' + S.mg : fmt(mcg, 1) + ' ' + S.mcg; }
  function mcgOnly(mcg) { return fmt(mcg, 1) + ' ' + S.mcg; }
  function vials(n) { return tpl(n === 1 ? S.vialOne : S.vialMany, { n: n }); }

  /* Reads positive numbers; anything else counts as "not entered" (0) */
  function readMass(v) { var n = num(v); return n > 0 ? n : 0; }
  function readQty(v) { var n = parseInt(v, 10); return n > 0 ? Math.min(n, 99) : 0; }
  function readAmount(v) { var n = num(v); return n > 0 ? n * (state.unit === 'mg' ? 1000 : 1) : 0; }

  /* A group is a row of preset chips plus an "Other" chip that opens a custom input */
  function bindGroup(group, read, onChange) {
    var chips = group.querySelectorAll('.chip');
    var row = group.querySelector('.custom-row');
    var input = row.querySelector('input');
    var api = { value: 0, other: false };
    chips.forEach(function (c) {
      if (c.getAttribute('aria-pressed') === 'true' && !c.hasAttribute('data-other')) api.value = parseFloat(c.getAttribute('data-value'));
    });
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        chip.setAttribute('aria-pressed', 'true');
        api.other = chip.hasAttribute('data-other');
        row.classList.toggle('is-open', api.other);
        if (api.other) { api.value = read(input.value); input.focus(); }
        else api.value = parseFloat(chip.getAttribute('data-value'));
        onChange();
      });
    });
    input.addEventListener('input', function () { api.value = read(input.value); onChange(); });
    api.reread = function () { if (api.other) api.value = read(input.value); };
    return api;
  }

  /* ----- Schedule amount (one group per mode) ----- */
  var amount$ = {
    dose: bindGroup($('amt-dose'), readAmount, render),
    week: bindGroup($('amt-week'), readAmount, render)
  };

  /* ----- mcg | mg switch (both custom rows stay in step) ----- */
  var unitBtns = app.querySelectorAll('[data-unit]');
  unitBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.unit = btn.getAttribute('data-unit');
      unitBtns.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-unit') === state.unit ? 'true' : 'false'); });
      amount$.dose.reread(); amount$.week.reread();
      render();
    });
  });

  /* ----- Per dose / per week ----- */
  app.querySelectorAll('[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.mode = btn.getAttribute('data-mode');
      app.querySelectorAll('[data-mode]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
      app.querySelectorAll('[data-block]').forEach(function (b) { b.hidden = b.getAttribute('data-block') !== state.mode; });
      el.dayBox.hidden = state.mode !== 'dose';
      render();
    });
  });

  /* ----- Day buttons: names come from the browser's calendar for the page language ----- */
  var fmtDay = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
  for (var d = 0; d < 7; d++) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip chip--day'; b.setAttribute('aria-pressed', 'false');
    b.setAttribute('data-day', d);
    b.textContent = fmtDay.format(new Date(2024, 0, 1 + d)); /* 1 Jan 2024 is a Monday */
    el.dayWrap.appendChild(b);
  }
  el.dayWrap.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-day]'); if (!btn) return;
    var k = btn.getAttribute('data-day'), on = !state.days[k];
    state.days[k] = on; btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    render();
  });

  /* ----- Vials ----- */
  function renumber() {
    var cards = el.rows.querySelectorAll('.vial-card');
    cards.forEach(function (c, i) { c.querySelector('.vial-card-title').textContent = tpl(S.vialTitle, { n: i + 1 }); });
    el.add.hidden = cards.length >= MAX_VIALS;
  }
  function addVial() {
    var card = el.tpl.content.firstElementChild.cloneNode(true);
    card._g = {
      mass: bindGroup(card.querySelector('[data-field="mass"]'), readMass, render),
      qty: bindGroup(card.querySelector('[data-field="qty"]'), readQty, render)
    };
    card.querySelector('.vial-remove').addEventListener('click', function () {
      if (el.rows.children.length > 1) { card.remove(); renumber(); render(); }
    });
    el.rows.appendChild(card);
    renumber();
  }
  el.add.addEventListener('click', function () { addVial(); render(); });

  function readVials() {
    var out = [];
    el.rows.querySelectorAll('.vial-card').forEach(function (c) {
      var mg = c._g.mass.value, n = c._g.qty.value;
      if (mg > 0 && n > 0) out.push({ mg: mg, n: n });
    });
    return out;
  }

  function setWarning(msg) { el.warning.textContent = msg || ''; el.warning.classList.toggle('is-visible', !!msg); }
  function clear(msg) {
    el.units.textContent = '—'; if (el.sticky) el.sticky.textContent = '—';
    el.sub.innerHTML = '&nbsp;'; el.sentence.textContent = msg;
    [el.rTotal, el.rWeek, el.rDoses, el.rWeeks, el.rMonths].forEach(function (x) { x.textContent = '—'; });
    el.bar.innerHTML = ''; el.list.innerHTML = ''; el.formula.textContent = '';
  }

  function render() {
    setWarning('');
    var vs = readVials();
    var perMcg = amount$[state.mode].value;
    var nDays = Object.keys(state.days).filter(function (k) { return state.days[k]; }).length;

    if (!vs.length) return clear(S.enterVial);
    if (!perMcg) return clear(state.mode === 'dose' ? S.enterDose : S.enterWeek);
    if (state.mode === 'dose' && !nDays) return clear(S.pickDays);

    var totalMg = vs.reduce(function (a, v) { return a + v.mg * v.n; }, 0);
    var nVials = vs.reduce(function (a, v) { return a + v.n; }, 0);
    var totalMcg = totalMg * 1000;
    var weekMcg = state.mode === 'dose' ? perMcg * nDays : perMcg;
    var weeks = totalMcg / weekMcg, days = weeks * 7, months = days / DAYS_PER_MONTH;
    var doses = state.mode === 'dose' ? Math.floor(totalMcg / perMcg + 1e-9) : null;

    el.units.textContent = fmt(weeks, 1);
    if (el.sticky) el.sticky.textContent = fmt(weeks, 1);
    el.sub.textContent = tpl(doses != null ? S.subDose : S.subWeek, { months: fmt(months, 1), doses: doses });
    var daysTxt = tpl(nDays === 1 ? S.dayOne : S.dayMany, { n: nDays });
    el.sentence.textContent = tpl(state.mode === 'dose' ? S.sentDose : S.sentWeek, {
      vials: vials(nVials), total: amount(totalMcg), dose: amount(perMcg), days: daysTxt,
      week: amount(weekMcg), doses: doses, weeks: fmt(weeks, 1), months: fmt(months, 1)
    });
    el.rTotal.textContent = amount(totalMcg);
    el.rWeek.textContent = amount(weekMcg);
    el.rDoses.textContent = doses != null ? tpl(S.dosesN, { n: doses }) : '—';
    el.rWeeks.textContent = tpl(S.weeksN, { n: fmt(weeks, 1) });
    el.rMonths.textContent = tpl(S.monthsN, { n: fmt(months, 1) });

    /* Timeline: one segment per vial entry, sized by how long it lasts */
    var at = 0, bar = '', list = '', longest = 0;
    vs.forEach(function (v, i) {
      var w = (v.mg * v.n * 1000) / weekMcg, one = (v.mg * 1000) / weekMcg;
      longest = Math.max(longest, one);
      bar += '<span class="supply-seg supply-seg--' + (i % 2) + '" style="flex:' + w.toFixed(4) + '"><b>' + (vs.length > 1 ? (i + 1) : '') + '</b></span>';
      list += '<li><span>' + tpl(S.vialLine, { n: i + 1, mass: fmt(v.mg, 2) + ' ' + S.mg + ' × ' + v.n }) + '</span><strong>' +
        tpl(S.weeksRange, { from: fmt(at, 1), to: fmt(at + w, 1) }) + '</strong></li>';
      at += w;
    });
    el.bar.innerHTML = bar;
    el.list.innerHTML = list;

    el.formula.textContent = [
      tpl(S.workTotal, { total: amount(totalMcg), vials: vials(nVials) }),
      state.mode === 'dose' ? tpl(S.workWeekDose, { dose: amount(perMcg), n: nDays, week: amount(weekMcg) }) : tpl(S.workWeekEntered, { week: amount(weekMcg) }),
      tpl(S.workWeeks, { total: mcgOnly(totalMcg), week: mcgOnly(weekMcg), weeks: fmt(weeks, 1) }),
      tpl(S.workMonths, { weeks: fmt(weeks, 1), months: fmt(months, 1) })
    ].concat(doses != null ? [tpl(S.workDoses, { total: mcgOnly(totalMcg), dose: mcgOnly(perMcg), doses: doses })] : []).join('\n');

    if (weeks < 1) setWarning(S.warnLess);
    else if (longest > MIXED_WINDOW_WEEKS) setWarning(tpl(S.noteMixed, { w: fmt(longest, 1) }));
  }

  addVial();
  render();
})();
