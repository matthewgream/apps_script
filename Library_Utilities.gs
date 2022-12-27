
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function REVERSE (a) {
  return (!Array.isArray (a)) ? a : a.reverse ();
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

function util_functions_find (f) {
  return Object.keys (this).filter (v => f (v));
}
function util_functions_call (f, a, b, c, d, e) {
  return this [f] (a, b, c, d, e);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_num_roundNN (n) {
  return Math.round (n * 100.0) / 100.0;
}
function util_num_round (n) {
  return Math.round (n);
}
function util_num_avg (d) {
  return d.length == 0 ? 0 : util_num_roundNN (d.reduce ((p, v) => p + (v * 1.0), 0) / d.length);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_date_str_yyyymmdd () {
  return (new Date()).toISOString ().split ("T") [0];
}
function util_date_arr_yyyymmdd () {
  var d = new Date (); return [ d.getUTCFullYear (), d.getUTCMonth () + 1, d.getUTCDate () ];
}
function util_date_str_yyyymmddhhmmss () {
  return (new Date()).toISOString ().replace ("T", " ").split (".") [0]
}
function util_date_str_ISO (t) {
  return (t == undefined ? (new Date ()) : (new Date (t))).toISOString ();
}
function util_date_diffDays (a, b) {
  return (typeof a == 'string') ? ((new Date (b)).getTime () - (new Date (a)).getTime ()) / 1000 / 86400 : ((b - a) / 1000 / 86400);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_merge (a, b) {
  return Array.isArray (b) ? b.reduce (util_merge, a) : Object.assign (a, b);
}
function util_push (a, b) {
  if (a == undefined) a = new Array (); a.push (b); return a;
}
function util_diff (a, b) {
 return (a == undefined) ? undefined : a.filter (v => ! b.includes (v));
}
function util_uniq (a) {
  return (a == undefined) ? undefined : a.filter ((v, i, z) => z.indexOf (v) == i);
}
function util_sort (a) {
  return Object.keys (a).sort ().reduce ((p, i) => { p [i] = a [i]; return p; }, {});
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_is_null (a) {
  return (a == undefined) ? true : false;
}
function util_is_nullOrZero (a) {
  return (a == undefined || a.length == 0) ? true : false;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_str_error (e) {
  return String (e.name) + (e.message ? ": " + e.message : "") + (e.stack ? " <<< " + e.stack + " >>>" : "");
}
function util_str_lower (s) {
  return s.toString ().toLowerCase ();
}
function util_str_upper (s) {
  return s.toString ().toUpperCase ();
}
function util_str_split (s, d) {
  return s.toString ().split (d);
}
function util_str_substr (s, a, b) {
  return (b == undefined) ? s.substr (a) : s.substr (a, b);
}
function util_str_isprefix (s, p) {
  return s.toString ().startsWith (p);
}
function util_str_niceSecsAsDays (n) {
  var __l = function (x, a, p) { if (x [1] > a) { x [0] += (Math.floor (x [1] / a) + p); x [1] -= Math.floor (x [1] / a) * a; } return x; }
  return __l (__l (__l (__l (["", n], 86400, "d"), 3600, "h"), 60, "m"), 1, "s") [0];
}
function util_str_niceNum (x) {
  return x.toString ().replace (/\B(?=(\d{3})+(?!\d))/g, ",");
}
function util_str_isnum (v) {
  for (var i = 0; i < v.length; i++) if (!((v [i] >= '0' && v [i] <= '9') || v [i] == '.' || v [i] == '-' || v [i] == '+')) return false; return true;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_cache_gets (n, compressed = true) {
  var c = CacheService.getScriptCache (), k = c.get ("C/L/" + n); if (k == null || (k * 1.0) == 0) return undefined;
  var b = c.getAll (k = Array.from ({ length: k }, (v, i) => "C/D/" + n + "/" + i));
  return compressed ? LZString.decompressFromBase64 (k.map (x => b [x]).join ("")) : k.map (x => b [x]).join ("");
}
function util_cache_puts (n, s, compressed = true, t = 21600) {
  function __l (s, n) { var l = Math.ceil (s.length / n), c = new Array (l); for (var i = 0, o = 0; i < l; ++i, o += n) c [i] = s.substr (o, n); return c; }
  var c = CacheService.getScriptCache (), b = __l (compressed ? LZString.compressToBase64 (s) : s, (100*1000)-1), k = Array.from ({ length: b.length }, (v, i) => "C/D/" + n + "/" + i);
  c.put ("C/L/" + n, b.length, t);
  c.putAll (k.reduce (function (p, v, i) { p [v] = b [i]; return p; }, {}), t);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_lock_wrapper (t, d, f, a) {
  function __l (t) { return (t == "Document") ? LockService.getDocumentLock () : ((t == "Script") ? LockService.getScriptLock () : ((t == "User") ? LockService.getUserLock () : undefined)); }
  var l = __l (t); if (d == 0 && !l.tryLock (d)) return; else if (d != 0) l.waitLock (d); try { var r = f (a); l.releaseLock (); return r; } catch (e) { l.releaseLock (); throw e; }
}
function util_lock_seconds (x) {
  return x * 1000;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __t_n (f) { return ScriptApp.newTrigger (f).timeBased (); }
function __t_e (f) { var t = ScriptApp.getProjectTriggers (); for (var i in t) if (t [i].getHandlerFunction () == f) return true; return false; }
function timer_create (f) { return __t_n (f).after (1).create ().getUniqueId (); }
function timer_createMinutes (f, n) { if (!__t_e (f)) { __t_n (f).everyMinutes (n).create (); return true; } return false; }
function timer_createHours (f, n) { if (!__t_e (f)) { __t_n (f).everyHours (n).create (); return true; } return false; }
function timer_createDaily (f, h, m) { if (!__t_e (f)) { __t_n (f).everyDays (1).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_createWeekly (f, n, h, m) { if (!__t_e (f)) { __t_n (f).onWeekDay (n).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_createMonthly (f, n, h, m) { if (!__t_e (f)) { __t_n (f).onMonthDay (n).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_delete (id) { ScriptApp.getProjectTriggers().forEach (function (t) { if (t.getUniqueId () == id) ScriptApp.deleteTrigger (t); }); }
function timer_cnt () { var t = ScriptApp.getProjectTriggers (); return t.length; }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __str_clr (p, s)         { var v = p.getProperties (), l = 0; for (var k in v) if (util_str_isprefix (k, s)) { p.deleteProperty (k); l += 1; }; return l; }
function __stg_len (p, s)         { var v = p.getProperties (), l = 0; for (var k in v) if (util_str_isprefix (k, s)) { l += (k.length + v [k].length) }; return l; }
function __stg_cnt (p, s)         { var v = p.getProperties (), l = 0; for (var k in v) if (util_str_isprefix (k, s)) { l ++ }; return l; }
function __stg_rst (p)            { p.deleteAllProperties (); }

// -----------------------------------------------------------------------------------------------------------------------------------------

var __q_p = PropertiesService.getDocumentProperties ();
function __q_n (i, s)             { return "Q" + ((i == undefined) ? "" : (i + ((s == undefined) ? "" : ("_" + s + "_")))); }
function queue_pop_n (i, s)       { var c = __q_p.getProperty (__q_n (i, s)); c = (c == undefined) ? 1 : c * 1.0; __q_p.setProperty (__q_n (i, s), (c == 9999999) ? 1 : c + 1.0); return c; }
function queue_get_n (i, s)       { var c = __q_p.getProperty (__q_n (i, s)); return (c == undefined) ? 1 : c * 1.0; }
function queue_set_n (i, s, c)    { c = (c == 9999999) ? 1 : c + 1.0; __q_p.setProperty (__q_n (i, s), c); return c; }
function queue_pop_c (i, c)       { var m = __q_p.getProperty (__q_n (i, "#_" + c)); __q_p.deleteProperty (__q_n (i, "#_" + c)); return m == undefined ? m : JSON.parse (m); }
function queue_set_c (i, c, m)    { if (m == undefined) return false; __q_p.setProperty (__q_n (i, "#_" + c), JSON.stringify (m)); return true; }
function queue_rst (i)            { return __str_clr (__q_p, __q_n (i)); }
function queue_len (i)            { return __stg_len (__q_p, __q_n (i)); }
function queue_cnt (i)            { return __stg_cnt (__q_p, __q_n (i)); }

// -----------------------------------------------------------------------------------------------------------------------------------------

var __s_p = PropertiesService.getDocumentProperties ();
function __s_n (i, j, k, l)       { return "M" + (((i==undefined)?"":(";"+i)) + ((j==undefined)?"":(";"+j)) + ((k==undefined)?"":(";"+k)) + ((l==undefined)?"":(";"+l))); }
function __s_z1 (z, y, s, v)      { if (util_str_isprefix (y, s)) z [util_str_substr (y, 1 + s.length)] = v [y]; return z; }
function __s_z2 (z, y, s, v)      { return ((util_str_isprefix (y, s)) ? z + (v [y] * 1.0) : z); }
function store_get (i, j, k, l)   { return __s_p.getProperty (__s_n (i, j, k, l)); }
function store_inc (i, j, k, l)   { __s_p.setProperty (__s_n (i, j, k, l), (__s_p.getProperty (__s_n (i, j, k, l)) * 1.0) + 1.0); }
function store_add (v, i, j, k, l){ __s_p.setProperty (__s_n (i, j, k, l), (__s_p.getProperty (__s_n (i, j, k, l)) * 1.0) + (v * 1.0)); }
function store_app (v, i, j, k, l){ var vv = __s_p.getProperty (__s_n (i, j, k, l)); __s_p.setProperty (__s_n (i, j, k, l), vv == undefined ? v : vv + "," + v); }
function store_set (v, i, j, k, l){ __s_p.setProperty (__s_n (i, j, k, l), v); }
function store_sum (i, j, k, l)   { var v = __s_p.getProperties (); return Object.keys (v).reduce (function (z, y) { return __s_z2 (z, y, __s_n (i, j, k, l), v); }, 0); }
function store_lst (i, j, k, l)   { var v = __s_p.getProperties (); return Object.keys (v).reduce (function (z, y) { return __s_z1 (z, y, __s_n (i, j, k, l), v); }, {}); }
function store_clr (i, j, k, l)   { return __str_clr (__s_p, __s_n (i, j, k, l)); }
function store_rst (i, j, k, l)   { return __str_clr (__s_p, __s_n (i, j, k, l)); }
function store_len ()             { return __stg_len (__s_p, __s_n ()); }
function store_cnt ()             { return __stg_cnt (__s_p, __s_n ()); }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_colOffset (a, b) {
  function __l (s, n) { return s.toString ().charCodeAt (n); }
  return (b.toString ().length == 2 ? (((__l (b, 0) - 65) + 1) * 26) + (__l (b, 1) - 65) : (__l (b, 0) - 65)) - (__l (a, 0) - 65);
}
function util_sheet_col2abc (c) {
  var a = ''; while (c > 0) a = String.fromCharCode (((c - 1) % 26) + 65) + a, c = (c - ((c - 1) % 26) - 1) / 26; return a;
}
function util_sheet_abc2col (a) {
  var c = 0; for (var i = 0; i < a.length; i++) c += (a.toString ().charCodeAt (i) - 64) * Math.pow (26, (a.length - i) - 1); return c;
}
function util_sheet_toggleVisibility (f) {
  SpreadsheetApp.getActiveSpreadsheet ().getSheets ().forEach (s => { if (f (s.getName ())) if (s.isSheetHidden ()) s.showSheet (); else s.hideSheet (); });
}
function util_sheet_rowHide (s, m) {
  if (!util_is_null (m) && s.getMaxRows () > (m - 1)) s.hideRows (m, s.getMaxRows () + 1 - m);
}
function util_sheet_rowPushAndHide (s, r1, r2, m, x) {
  s.insertRowsBefore (r1, x.length).getRange (r2).setValues (x); util_sheet_rowHide (s, m);
}
function util_sheet_rowPrune (s, m) {
  if (!util_is_nullOrZero (m) && s.getMaxRows () > (m - 1)) s.deleteRows (m, s.getMaxRows () + 1 - m);
}
function util_sheet_appendRows (s, v) {
  s.getRange (s.getLastRow () + 1, 1, v.length, v [0].length).setValues (v);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_headers_load (s, r, cb, ce) {
  return s.getRange (cb + r + ":" + (ce ? ce : util_sheet_col2abc (s.getLastColumn ())) + r).getValues () [0];
}
function util_sheet_headers_find (h, n) {
  var i = h.indexOf (n); return (i < 0) ? undefined : i;
}
function util_sheet_headers_order (h, c) {
  function __l (d) { if (String (d).length == 0) return "";
    if (Array.isArray (d)) d = (d.length == 1) ? d [0] : d.map (v => (typeof v == 'string') ? v : JSON.stringify (util_sort (v))).sort ().join (",");
    else if (typeof d == 'object') d = JSON.stringify (util_sort (d));
    return (d == "{}" || d == "[]") ? "" : d;
  }
  return h.map (hh => !util_is_null (c [hh.trim ()]) ? __l (c [hh.trim ()]) : "");
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
