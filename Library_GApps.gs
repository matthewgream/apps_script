
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function LATCH (a, b, c = 0) { // c = hystersis, don't do anything if difference is less than percent
  var p = PropertiesService.getScriptProperties ();
  var v = p.getProperty ("LATCH:"+b) * 1.0;
  if (v == undefined || ((a * 1.0) - v) > (v * c)) p.setProperty ("LATCH:"+b, v = a);
  return v;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_colOffset (a, b) {
  function __s (s, n) { return s.toString ().charCodeAt (n); }
  return (b.toString ().length == 2 ? (((__s (b, 0) - 65) + 1) * 26) + (__s (b, 1) - 65) : (__s (b, 0) - 65)) - (__s (a, 0) - 65);
}
function util_sheet_col2abc (c) {
  var a = ''; while (c > 0) a = String.fromCharCode (((c - 1) % 26) + 65) + a, c = (c - ((c - 1) % 26) - 1) / 26; return a;
}
function util_sheet_abc2col (a) {
  var c = 0; for (var i = 0; i < a.length; i++) c += (a.toString ().charCodeAt (i) - 64) * Math.pow (26, (a.length - i) - 1); return c;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_waitForCalculations (t) {
  if (util_is_null (t) || t > 300 || t <= 0) t = 300; // max
  SpreadsheetApp.getActiveSpreadsheet ().waitForAllDataExecutionsCompletion (t);
}
function util_sheet_toast (t, m) {
  SpreadsheetApp.getActiveSpreadsheet ().toast (t, m);
}
function util_sheet_nameOfDoc () {
  return SpreadsheetApp.getActiveSpreadsheet ().getName ();
}
function util_sheet_refresh (n, c) {
  var s = SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (n);
  if (!util_is_nullOrZero (s)) {
    var r = s.getRange (c), v = r.getValues ();
    r.clearContent ();
    SpreadsheetApp.flush ();
    r.setValues (v);
  }
}
function util_sheet_toggleVisibility (f) { //function toggleSheetsConfig () { return util_sheet_toggleVisibility (n => n.substr (0, 2) == "C:"); }
  SpreadsheetApp.getActiveSpreadsheet ().getSheets ().forEach (s => { if (f (s.getName ())) if (s.isSheetHidden ()) s.showSheet (); else s.hideSheet (); });
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_buildFromArray (s, row_headers, row_data, col_beg, col_end, data_list, data_callback, data_callargg, a, f) {
  var headers = util_sheet_headersLoad (s, row_headers, col_beg, col_end);
  var content = Array ();
  var skipped = data_list.reduce ((skipped, data) => {
    skipped = skipped.concat (Object.keys (data).filter (v => ! headers.includes (v)));
    if (!util_is_null (data_callback)) data_callback (data, data_callargg);
    data.timestamp = util_date_str_yyyymmddhhmmss ();
    content.push (util_sheet_headersOrder (headers, data));
    return skipped;
  }, Array ());
  if (s.getMaxRows () > (row_data - 1)) {
    s.getRange (col_beg + row_data + ":" + col_end + s.getMaxRows ()).clearContent ();
    if (s.getMaxRows () > row_data)
      s.deleteRows (row_data, s.getMaxRows () - row_data);
  }
  if (s != undefined) {
    var sr = s.getRange (col_beg + row_data + ":" + util_sheet_col2abc (util_sheet_abc2col (col_beg) + headers.length - 1) + (row_data - 1 + content.length))
      .setValues (content)
      .setFontFamily ("Consolas").setFontSize (10).setWrapStrategy (SpreadsheetApp.WrapStrategy.CLIP);
    if (f != undefined) sr.setNumberFormats (Array (content.length).fill (f));
  }
  if (a != undefined) {
    var sa = a.getRange (col_beg + (a.getLastRow () + 1) + ":" + util_sheet_col2abc (util_sheet_abc2col (col_beg) + headers.length - 1) + (a.getLastRow () + content.length))
    .setValues (content)
    .setFontFamily ("Consolas").setFontSize (10).setWrapStrategy (SpreadsheetApp.WrapStrategy.CLIP);
    if (f != undefined) sa.setNumberFormats (Array (content.length).fill (f));
  }
  return { length: data_list.length, skipped: util_uniq (skipped) };
}

function util_sheet_findDestroyCreate (spread, sheet_tpl, n, d) {
  var s = spread.getSheetByName (n), f = false;
  if (!util_is_null (s) && (!util_is_null (d) && d == true))
    spread.deleteSheet (s);
  if (util_is_null (s) || (!util_is_null (d) && d == true)) {
    spread.setActiveSheet (sheet_tpl);
    s = spread.duplicateActiveSheet ();
    s.setName (n);
    s.showSheet ();
    f = true;
  }
  return [s, f];
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_rowHide (s, m) {
  if (!util_is_null (m) && s.getMaxRows () > (m - 1))
    s.hideRows (m, s.getMaxRows () + 1 - m);
}
function util_sheet_rowPushAndHide (s, r1, r2, m, x) {
  var r = s.insertRowsBefore (r1, x.length).getRange (r2); r.setValues (x); util_sheet_rowHide (s, m);
}
function util_sheet_rowPrune (s, m) {
  if (!util_is_nullOrZero (m) && s.getMaxRows () > (m - 1)) s.deleteRows (m, s.getMaxRows () + 1 - m);
}
function util_sheet_rowAppend (s, v) {
  s.getRange (s.getLastRow () + 1, 1, v.length, v [0].length).setValues (v);
}
function util_sheet_rowUpdate (s, v) {
  v.forEach (vv => s.getRange (vv.row, 1, 1, vv.values [0].length).setValues (vv.values));
}
function util_sheet_rowRemoveEmptyTrailing (n, l = 0) {
  return util_sheet_rowRemoveEmptyTrailingBySheet (SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (n), l);
}
function util_sheet_rowRemoveEmptyTrailingBySheet (s, l = 0) {
  if (!util_is_null (s)) {
    var rs = s.getLastRow () + 1, re = s.getMaxRows ();
    if ((re - l) > rs)
      s.deleteRows (rs, (re - l) - rs);
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_headersLoad (s, r, cb, ce) {
  return s.getRange (cb + r + ":" + (ce ? ce : util_sheet_col2abc (s.getLastColumn ())) + r).getValues () [0];
}
function util_sheet_headersFind (h, n) {
  var i = h.indexOf (n); return (i < 0) ? undefined : i;
}
function util_sheet_headersOrder (h, c, partial_okay = false) {
  function __l1 (d) { if (String (d).length == 0) return "";
    if (Array.isArray (d)) d = (d.length == 1) ? d [0] : d.map (v => (typeof v == 'string') ? v : JSON.stringify (util_sort (v))).sort ().join (",");
    else if (typeof d == 'object') d = JSON.stringify (util_sort (d));
    return (d == "{}" || d == "[]") ? "" : d; }
  function __l2 (r) { var i = r.length - 1; while (i >= 0 && r [i] == '') i--;  return (i >= 0 && i < (r.length - 1)) ? r.slice (0, i + 1) : r; }
  var r = h.map (hh => !util_is_null (c [hh.trim ()]) ? __l1 (c [hh.trim ()]) : "");
  return (partial_okay == false) ? r : __l2 (r);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_lock_wrapper (t, d, f, a) {
  function __l (t) { return (t == "Document") ? LockService.getDocumentLock () : ((t == "Script") ? LockService.getScriptLock () : ((t == "User") ? LockService.getUserLock () : undefined)); }
  var l = __l (t); if (d == 0 && !l.tryLock (d)) return; else if (d != 0) l.waitLock (d); try { var r = f (a); l.releaseLock (); return r; } catch (e) { l.releaseLock (); throw e; }
}
function util_lock_seconds (x) {
  return x * 1000;
}

function util_exception_wrapper (f, g) {
  try { return f (); } catch (e) { if (g == undefined) throw e; else return g (e); }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_formatSavedStore (s, r_c, c_c, r_f) {
  s.getRange (c_c + r_f + ":" + r_f).setNumberFormat ("").setValues ([ s.getRange (c_c + r_c + ":" + r_c).getNumberFormats () [0].map (v => '"' + v + '"') ]);
}
function util_sheet_formatSavedLoad (s, r_f, c_c) {
  return s.getRange (c_c + r_f + ":" + r_f).getValues () [0].map (v => v.split ('"') [1]);
}
function util_sheet_formatSavedApply (s, r_c, c_c, r_f) {
  s.getRange (c_c + r_c + ":" + s.getLastRow ()).setNumberFormats (Array (s.getLastRow () - (r_c - 1)).fill (s.getRange (c_c + r_f + ":" + r_f).getValues () [0].map (v => v.split ('"') [1])));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_drive_backup (spread) {
  var name = spread.getName () + " -- VERSION W" + (util_date_weekOfYear () < 10 ? "0" : "") + util_date_weekOfYear () + " " + util_date_str_yyyymmdd (),
      file = DriveApp.getFileById (spread.getId ()).makeCopy (name), url = file.getUrl ();
  return [ spread.getName (), file.getName (), !url.includes ("?") ? url : url.split ("?") [0] ];
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_appscript_make_user (e) { if (e == undefined || e.user == undefined) return undefined; e = e.user;
  return (e.email == undefined) ? (e.nickname == undefined ? undefined : e.nickname) : (e.nickname == undefined ? e.email : e.nickname + " (" + e.email + ")"); 
}
function util_appscript_make_info (e) { if (e == undefined) return undefined;
  function __make_mode (e) { switch (e) { case ScriptApp.AuthMode.NONE: return "NONE"; case ScriptApp.AuthMode.CUSTOM_FUNCTION: return "CUSTOM_FUNCTION"; 
    case ScriptApp.AuthMode.LIMITED: return "LIMITED"; case ScriptApp.AuthMode.FULL: return "FULL"; default: return "UNDEFINED"; } }
  function __make_source (e) { return "'" + e.getName () + "' [" + e.getId () + "]"; }
    var s = Array ();  s.push ("script: " + ScriptApp.getScriptId () + (e.authMode ? (", " + __make_mode (e.authMode)) : "")); 
  if (e.source) s.push ("source: " + __make_source (e.source)); return s;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sleep (m) {
  Utilities.sleep (m * 1000);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
