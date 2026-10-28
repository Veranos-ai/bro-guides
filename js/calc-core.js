/* BRO Research: calculator maths, with no page code in it.
   Both calculators use these functions, and tests/calc.test.mjs checks them.
   Amounts are in mcg unless the name says otherwise. No dependencies. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BROCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAYS_PER_MONTH = 30.4375;
  var MIXED_WINDOW_WEEKS = 30 / 7; /* a mixed vial is commonly kept about 30 days */
  var READABLE_MIN = 5;            /* units: below this a draw is hard to read */
  var READABLE_MAX = 50;           /* units: above this a larger barrel is usual */
  var EPS = 1e-9;                  /* so 0.3 / 0.1 counts as 3, not 2.9999999999999996 */

  /* Accepts 2.5 and 2,5. Returns NaN when it is not a number. */
  function parseNum(s) { return parseFloat(String(s).trim().replace(',', '.')); }

  /* Rounds to dp places and writes the number the way the page language does. */
  function fmt(n, dp, locale) {
    if (!isFinite(n)) return '—';
    return parseFloat(n.toFixed(dp)).toLocaleString(locale || 'en', { maximumFractionDigits: dp });
  }

  /* Reconstitution: vial mass (mg), water (mL), target amount (mcg), syringe size (units, U-100).
     Returns null until all three numbers are positive. */
  function reconstitution(i) {
    var mg = i.mg, ml = i.ml, targetMcg = i.targetMcg, barrel = i.barrel || 100;
    if (!(mg > 0 && ml > 0 && targetMcg > 0)) return null;
    var targetMg = targetMcg / 1000;
    var conc = mg / ml;              /* mg per mL */
    var drawMl = targetMg / conc;    /* mL */
    var units = drawMl * 100;        /* U-100: 1 unit = 0.01 mL */
    var status = units > barrel ? 'over' : units < READABLE_MIN ? 'small' : units > READABLE_MAX ? 'large' : 'ok';
    return { targetMg: targetMg, conc: conc, drawMl: drawMl, units: units, draws: Math.floor(mg / targetMg + EPS), status: status, barrel: barrel };
  }

  /* Supply: vials = [{ mg, n }], mode 'dose' (amountMcg per dose on `days` days a week) or 'week' (amountMcg a week).
     Returns { error } while something is missing, otherwise the full answer. */
  function supply(i) {
    var vials = (i.vials || []).filter(function (v) { return v.mg > 0 && v.n > 0; });
    if (!vials.length) return { error: 'vials' };
    var amount = i.amountMcg;
    if (!(amount > 0)) return { error: 'amount' };
    var nDays = i.mode === 'dose' ? i.days : 0;
    if (i.mode === 'dose' && !(nDays > 0)) return { error: 'days' };

    var totalMg = vials.reduce(function (a, v) { return a + v.mg * v.n; }, 0);
    var nVials = vials.reduce(function (a, v) { return a + v.n; }, 0);
    var totalMcg = totalMg * 1000;
    var weekMcg = i.mode === 'dose' ? amount * nDays : amount;
    var weeks = totalMcg / weekMcg;
    var months = weeks * 7 / DAYS_PER_MONTH;
    var doses = i.mode === 'dose' ? Math.floor(totalMcg / amount + EPS) : null;

    var at = 0, longest = 0;
    var segments = vials.map(function (v) {
      var w = (v.mg * v.n * 1000) / weekMcg, one = (v.mg * 1000) / weekMcg;
      longest = Math.max(longest, one);
      var seg = { mg: v.mg, n: v.n, from: at, to: at + w, weeks: w };
      at += w;
      return seg;
    });
    var warn = weeks < 1 ? 'less' : longest > MIXED_WINDOW_WEEKS ? 'mixed' : null;
    return { totalMg: totalMg, nVials: nVials, totalMcg: totalMcg, weekMcg: weekMcg, nDays: nDays, weeks: weeks, months: months,
             doses: doses, segments: segments, longestVialWeeks: longest, warn: warn };
  }

  return { DAYS_PER_MONTH: DAYS_PER_MONTH, MIXED_WINDOW_WEEKS: MIXED_WINDOW_WEEKS, READABLE_MIN: READABLE_MIN, READABLE_MAX: READABLE_MAX,
           parseNum: parseNum, fmt: fmt, reconstitution: reconstitution, supply: supply };
});
