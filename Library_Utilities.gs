
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function structuredClone (x) {
  return JSON.parse (JSON.stringify (x));
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function util_args_check (a, b) {
  if (!a) throw "BAD ARGUMENTS" + (b != undefined ? ": " + b : "");
}
function util_assert (a) {
  if (!a) throw "assert failed";
}

function util_function_find (f) {
  return Object.keys (this).filter (v => f (v));
}
function util_function_call (f, a, b, c, d, e, g, h, i) {
  return this [f] (a, b, c, d, e, g, h, i);
}
function util_function_exists (f) {
  return (f == undefined || f == '' || this [f] == undefined) ? false : true;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_tree_push (t, p, v) {
  for (var i = 0; i < p.length; i++) {
    var pp = p [i];
    if (!t [pp]) t [pp] = { _v: util_str_isnum (v) ? (v * 1.0) : v };
    else t [pp]._v += (!util_str_isnum (t [pp]._v)) ? ("," + v) : (util_str_isnum (v) ? (v * 1.0) : 1.0);
    t = t [pp];
  }
}
function util_tree_flat (t, s, n = '') {
  var r = Array ();
  if (n != '') n = n + s;
  for (var i in t)
    if (i != "_v")
      r.push ({ n: n + i, v: t [i]._v }), r = r.concat (util_tree_flat (t [i], s, n + i));
  return r;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_date_epoch (t) {
  return (t == undefined ? (new Date ()) : (new Date (t))).getTime ();
}
function util_date_epochFromStr (a) { a = a.toString ();
  return Date.parse ((/[0-9]{2}.[0-9]{2}.[0-9]{4}/.test (a)) ? (a.substr (6, 4) + "-" + a.substr (3, 2) + "-" + a.substr (0, 2)) : a);
}
function util_date_epochFromStr2 (t) {
  return (new Date (t)).getTime ();
}
function util_date_epochToStr_yyyymmddhhmmss (a) {
  var aa = new Date (); aa.setTime (a); return aa.toISOString ().replace ("T", " ").split (".") [0];
}
function util_date_epochToStr_yyyymmdd (a) {
  var aa = new Date (); aa.setTime (a); return aa.toISOString ().split ("T") [0];
}
function util_date_epochToStr_ISO (a) {
  var aa = new Date (); aa.setTime (a); return aa.toISOString ();
}

function util_date_epochDiffInSecs (a, b) {
  return Math.floor (((b == undefined ? (new Date ()).getTime () : b * 1.0) - (a * 1.0)) / 1000.0);
}
function util_date_epochInSecs () {
  return Math.floor ((new Date ()).getTime () / 1000.0);
}
function util_date_diffInSecs (a, b) {
  return Math.floor ((typeof a == 'string' ? ((new Date (b)).getTime () - (new Date (a)).getTime ()) : (b - a)) / 1000.0);
}
function util_date_weekOfYear () {
  return Utilities.formatDate (new Date (), "Z", "w") * 1.0;
}
function util_date_dayOfWeek () {
  return Utilities.formatDate (new Date (), "Z", "u") * 1.0;
}
function util_date_hourOfDay () {
  return new Date ().getUTCHours () * 1.0;
}
function util_date_plusDays (n) {
  return new Date (new Date().getTime () + (n*24*60*60*1000));
}
function util_date_plusHours (n) {
  return new Date (new Date().getTime () + (n*60*60*1000));
}
function util_date_strAsISO (t) {
  return (t == undefined ? (new Date ()) : (new Date (t))).toISOString ();
}
function util_date_strAsyyyymmddhhmmss (t) {
  return (t == undefined ? (new Date ()) : (new Date (t))).toISOString ().replace ("T", " ").split (".") [0];
}
function util_date_strAsyyyymmdd (t) {
  return (t == undefined ? (new Date ()) : (new Date (t))).toISOString ().split ("T") [0];
}
function util_date_strAsyyyymmdd_plusplus (s) {
  var d = s.substr (8, 2) * 1.0, m = s.substr (5, 2) * 1.0, y = s.substr (0, 4) * 1.0, x = s.substr (4, 1);
  return (d == 30 && (m == 9 || m == 4 || m == 6 || m == 11) || d == (((y % 4 == 0) ? 29 : 28)) && (m == 2) || d == 31) ? (m == 12) ?
    (y + 1.0) + x+"01"+x+"01" : (y) + x + ((m + 1.0) < 10.0 ? '0'+(m + 1.0) : (m + 1.0)) + x+"01" : (y) + x+(m < 10.0 ? '0'+m : m) + x + ((d + 1.0) < 10.0 ? '0'+(d + 1.0) : (d + 1.0));
}
function util_date_strAsyyyymmdd_minusminus (s) {
  var d = s.substr (8, 2) * 1.0, m = s.substr (5, 2) * 1.0, y = s.substr (0, 4) * 1.0, x = s.substr (4, 1);
  if (d > 1) d -= 1; else { y = (m > 1) ? y : y - 1; m = (m > 1) ? m - 1 : 12; d = (m != 9 && m != 4 && m != 6 && m != 11) ? ((m == 2) ? ((y % 4 == 0) ? 29 : 28) : 31) : 30; }
  return (y) + x + (m < 10.0 ? '0'+m : m) + x + (d < 10.0 ? '0'+d : d);
}
function util_date_arrAsyyyymmdd () {
  var d = new Date (); return [ d.getUTCFullYear (), d.getUTCMonth () + 1, d.getUTCDate () ];
}
function util_date (t) {
  var x = (t == undefined ? (new Date ()) : (new Date (t)));
  return { year: x.getUTCFullYear (), month: x.getUTCMonth (), day: x.getUTCDay (), hours: x.getUTCHours (), minutes: x.getUTCMinutes () };
}
// -----------------------------------------------------------------------------------------------------------------------------------------

function util_noop (a) {
  return a;
}
function util_is_not (a) {
  return !a;
}
function util_is_null (a) {
  return (a == undefined) ? true : false;
}
function util_is_nullOrZero (a) {
  return (a == undefined || a.length == 0) ? true : false;
}
function util_is_array (a) {
  return (a != undefined && Array.isArray (a)) ? true : false;
}
function util_concat (a, b) {
  return (a == undefined ? b : (b == undefined ? a : (a.concat (b))));
}
function util_push (a, b) {
  if (a == undefined) a = new Array (); a.push (b); return a;
}
function util_uniq (a) {
  return (a == undefined) ? undefined : a.filter ((v, i, z) => z.indexOf (v) == i);
}
function util_diff1 (a, b) {
  return (a == undefined) ? undefined : a.filter (v => ! b.includes (v));
}
function util_diff2 (a, b) {
  return a.filter (x => ! b.includes (x)).concat (b.filter (x => ! a.includes (x)));
}
function util_transpose (a) {
  return Object.keys (a [0]).map (v => a.map (r => r [v]));
}
function util_locate (a, b, n) {
  if (a != undefined && b != undefined) for (var i in a) if ((n == undefined && a [i] == b) || (n != undefined && n > 0 && a [i].toString ().substr (0, n) == b)) return a [i]; return undefined;
}
function util_locateLeft (a, b, n) {
  if (a != undefined && b != undefined) for (var i in a) if (a [i].toString ().substr (0, n) == b) return a [i]; return undefined;
}
function util_sort (a) {
  return Object.keys (a).sort ().reduce ((p, i) => { p [i] = a [i]; return p; }, {});
}
function util_merge (a, b) {
  return Array.isArray (b) ? b.reduce (util_merge, a) : Object.keys (b).reduce ((aa, k) => { aa [k] = b [k]; return aa; }, a);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_str_isnum (v) {
  if (v == undefined) return false; for (var i = 0; i < v.length; i++) if (!((v [i] >= '0' && v [i] <= '9') || v [i] == '.' || v [i] == '-' || v [i] == '+')) return false; return true;
}
function util_str_splitUnquoted (s, d) {
  var t = [], x = "", iq1 = false, iq2 = false, ib = 0;
  for (var i = 0, l = s.length; i < l; i++) { var c = s [i];
    if (c === '"' && (i == 0 || (i > 0 && s [i - 1] != '\\'))) iq1 = !iq1, x += c;
    else if (c === '\'' && (i == 0 || (i > 0 && s [i - 1] != '\\'))) iq2 = !iq2, x += c;
    else if (c === "[") ib ++, x += c; else if (c === "]") ib --, x += c;
    else if (c === d && !iq1 && !iq2 && ib == 0) t.push (x), x = "";
    else x += c;
  }
  if (x) t.push (x);
  return t;
}
function util_str_includesUnquoted (s, d) {
  var iq1 = false, iq2 = false, ib = 0;
  for (var i = 0, l = s.length; i < l; i++) { var c = s [i];
    if (c === '"' && (i == 0 || (i > 0 && s [i - 1] != '\\'))) iq1 = !iq1;
    else if (c === '\'' && (i == 0 || (i > 0 && s [i - 1] != '\\'))) iq2 = !iq2;
    else if (c === "[") ib ++; else if (c === "]") ib --;
    else if (c === d && !iq1 && !iq2 && ib == 0) return true;
  }
  return false;
}
function util_str_countUnquoted (s, d) {
  var n = 0, iq1 = false, iq2 = false, ib = 0;
  for (var i = 0, l = s.length; i < l; i++) { var c = s [i];
    if (c === '"' && (i == 0 || (i > 0 && s [i - 1] != '\\'))) iq1 = !iq1;
    else if (c === '\'' && (i == 0 || (i > 0 && s [i - 1] != '\\'))) iq2 = !iq2;
    else if (c === "[") ib ++; else if (c === "]") ib --;
    else if (c === d && !iq1 && !iq2 && ib == 0) n ++;
  }
  return n; // XXX: off by one error
}
function util_str_tags_strip (s) {
  return s.replace (/<\/?[^>]+(>|$)/g, "").trim ();
}
function util_str_error (e) {
  if (typeof e == "string") return e;
  if (e.stack) return e.name + " " + e.stack;
  return e.name + " " + (e.message ? ": " + e.message : "");
}
function util_str_split (s, d) {
  return s.toString ().split (d);
}
function util_str_splitOrNull (s, d) {
  return (s == undefined || s.length == 0) ? undefined : s.toString ().split (d);
}
function util_str_join (a, d) {
  return a.join (d);
}
function util_str_lower (s) {
  return s.toString ().toLowerCase ();
}
function util_str_upper (s) {
  return s.toString ().toUpperCase ();
}
function util_str_isprefix (s, p) {
  return s.toString ().startsWith (p);
}
function util_str_remove (s, c) {
  return s.toString ().replace (c, "");
}
function util_str_replace (s, c, d) {
  return s.toString ().replace (c, d);
}
function util_str_chunk (s, n) {
  var l = Math.ceil (s.length / n), c = new Array (l); for (var i = 0, o = 0; i < l; ++i, o += n) c [i] = s.substr (o, n); return c;
}
function util_str_substr (s, a, b) {
  return (b == undefined) ? s.substr (a) : s.substr (a, b);
}
function util_str_substring (s, a, b) {
  return (b == undefined) ? s.substring (a) : s.substring (a, b);
}
function util_str_index (s, c) {
  return s.toString ().indexOf (c);
}
function util_str_includes (s, c) {
  return s.toString ().includes (c);
}
function util_str_trim (s) {
  return s.toString ().trim ();
}
function util_str_isolateURI (s) {
  for (var i = 0; i < s.length && (s [i] != '#' && s [i] != '?'); i++) /* */;
  while (i > 0 && s [i - 1] == '/') i--;
  return (i < s.length) ? s.substr (0, i) : s;
}
function util_str_niceNum (x) {
  return x.toString ().replace (/\B(?=(\d{3})+(?!\d))/g, ",");
}
function util_str_niceSecsAsDays (n) {
  function __n (x, a, p) { if (x [1] > a) { x [0] += (Math.floor (x [1] / a) + p); x [1] -= Math.floor (x [1] / a) * a; } return x; }
  return __n (__n (__n (__n (["", n], 86400, "d"), 3600, "h"), 60, "m"), 1, "s") [0];
}
function util_str_escape_html (s) {
  const __entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' };
  return String (s).replace (/[&<>"'`=\/]/g, ss => __entities [ss]);
}
function util_str_presentable (s, l) {
  return String (s).replaceAll ('\n', "\\n").replaceAll ('\r', "\\r").substr (0, l) + (s.length > l ? " ...": "")
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_num_formatNN (n) {
  return n.toFixed (2);
}
function util_num_roundNNNNNNNN (n) {
  return Math.round (n * 100000000.0) / 100000000.0;
}
function util_num_roundNN (n) {
  return Math.round (n * 100.0) / 100.0;
}
function util_num_roundN (n, r) {
  return n.toFixed (r) * 1.0;
}
function util_num_avg (d) {
  return d.length == 0 ? 0 : util_num_roundNN (d.reduce ((p, v) => p + (v * 1.0), 0) * 1.0 / d.length);
}
function util_num_std (d, a) {
  return d.length == 0 ? 0 : Math.sqrt (d.reduce ((p, v) => p + (((v * 1.0) - (a * 1.0)) ** 2), 0) / d.length) * 1.0;
}
function util_num_sum (a) {
  return util_num_roundNN (Object.values (a).reduce ((p, v) => p + (v * 1.0), 0) * 1.0);
}
function util_num_min (d, s = undefined) {
  return d.length == 0 ? s : d.reduce ((p, v) => (p == undefined || (v * 1.0) < p) ? v : p, s) * 1.0;
}
function util_num_max (d, s = undefined) {
  return d.length == 0 ? s : d.reduce ((p, v) => (p == undefined || (v * 1.0) > p) ? v : p, s) * 1.0;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_array_runnerX (f, a) {
  function __X (f, a, i) { return (!Array.isArray (a)) ? f (a, i) : a.map ((v, j) => __X (f, v, j)); }
  return __X (f, !Array.isArray (a) ? a : a.map (v => v [0]));
}

function util_array_runnerY (f, a) {
  function __Y (f, a, j) { return (!Array.isArray (a)) ? f (a, j) : a.map ((v, i) => __Y (f, v, i)); }
  return __Y (f, a);
}

function util_array_runnerXY (f, a, b) {
  function __XY (f, a, b, i, j) { var aa = Array.isArray (a), bb = Array.isArray (b);
    return (aa && !bb) ? a.map ((v, ii) => __XY (f, v, b, ii)) : (
      (!aa && bb) ? b.map ((v, jj) => __XY (f, a, v, jj)) : (
        (aa &&  bb) ? a.map ((v, ii) => b.map ((u, jj) => __XY (f, v, u, ii, jj))) : (
          f (a, b, i, j)
        )));}
  return __XY (f, !Array.isArray (a) ? a : a.map (v => v [0]), !Array.isArray (b) ? b : b [0]);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
