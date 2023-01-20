
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function REVERSE (a) {
  return (!Array.isArray (a)) ? a : a.reverse ();
}

function LATCH (value, id, hysteresis = 0) { // c = hystersis, don't do anything if difference is less than percent
  var properties = PropertiesService.getScriptProperties (), stored = properties.getProperty ("LATCH:"+id) * 1.0;
  if (util_is_null (stored) || ((value * 1.0) - stored) > (stored * hysteresis)) properties.setProperty ("LATCH:"+id, stored = value);
  return stored;
}

function UTIL_SECS_DIFFERENCE (a, b) {
  return util_date_diffInSecs (a, b);
}

function UTIL_SECS_STRNICELY (a) {
  return util_str_niceSecsAsDays (a);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_colOffset (col_a, col_b) {
  function __s (s, n) { return s.toString ().charCodeAt (n); }
  return (col_b.toString ().length == 2 ? (((__s (col_b, 0) - 65) + 1) * 26) + (__s (col_b, 1) - 65) : (__s (col_b, 0) - 65)) - (__s (col_a, 0) - 65);
}
function util_sheet_col2abc (col_num) {
  var a = ''; while (col_num > 0) a = String.fromCharCode (((col_num - 1) % 26) + 65) + a, col_num = (col_num - ((col_num - 1) % 26) - 1) / 26; return a;
}
function util_sheet_abc2col (col_abc) {
  var c = 0; for (var i = 0; i < col_abc.length; i++) c += (col_abc.toString ().charCodeAt (i) - 64) * Math.pow (26, (col_abc.length - i) - 1); return c;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_tabsOrder (spread, f_filter, f_sort) {
  var names = spread.getSheets().map (s => s.getName ());
  var names_filtered = names.filter (f_filter).sort (f_sort);
  names.filter (name => !names_filtered.includes (name)).concat (names_filtered).forEach ((name, index) =>
    spread.getSheetByName (name).activate ().getIndex () != (index + 1) ? spread.moveActiveSheet (index + 1) : undefined);
}

function util_sheet_waitForCalculations (time) {
  if (util_is_null (time) || time > 300 || time <= 0) time = 300; // max
  SpreadsheetApp.getActiveSpreadsheet ().waitForAllDataExecutionsCompletion (time);
}
function util_sheet_toast (title, message) {
  SpreadsheetApp.getActiveSpreadsheet ().toast (title, message);
}
function util_sheet_nameOfDoc () {
  return SpreadsheetApp.getActiveSpreadsheet ().getName ();
}
function util_sheet_refresh (name, cell) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (name);
  if (!util_is_nullOrZero (sheet)) {
    var range = sheet.getRange (cell), values = range.getValues ();
    range.clearContent ();
    SpreadsheetApp.flush ();
    range.setValues (values);
  }
}
function util_sheet_toggleVisibility (f_filter) { //function toggleSheetsConfig () { return util_sheet_toggleVisibility (n => n.substr (0, 2) == "C:"); }
  var sheets = SpreadsheetApp.getActiveSpreadsheet ().getSheets ().filter (s => f_filter (s.getName ()));
  sheets.forEach (s => s.isSheetHidden () ? s.showSheet () : s.hideSheet ());
}
function util_sheet_setVisibility (f_filter, visible) { //function toggleSheetsConfig () { return util_sheet_toggleVisibility (n => n.substr (0, 2) == "C:"); }
  var sheets = SpreadsheetApp.getActiveSpreadsheet ().getSheets ().filter (s => f_filter (s.getName ())); if (!visible) sheets = sheets.reverse ();
  sheets.forEach (s => visible && s.isSheetHidden () ? s.showSheet () : (!visible && !s.isSheetHidden () ? s.hideSheet () : undefined));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_contentDelete (sheet, row, col_beg = "A", col_end = "") {
  if (sheet.getMaxRows () > (row - 1)) {
    sheet.getRange (col_beg + row + ":" + col_end + sheet.getMaxRows ()).clearContent ();
    if (sheet.getMaxRows () > row)
      sheet.deleteRows (row, sheet.getMaxRows () - row);
  }
}
function util_sheet_contentInsert (sheet, row, col, content, format) {
  var range = sheet.getRange (col + row + ":" + util_sheet_col2abc (util_sheet_abc2col (col) + content [0].length - 1) + (row - 1 + content.length))
    .clear ()
    .setValues (content)
    .setFontFamily ("Consolas").setFontSize (10).setWrapStrategy (SpreadsheetApp.WrapStrategy.CLIP);
  if (!util_is_null (format)) range.setNumberFormats (Array (content.length).fill (format));
}
function util_sheet_buildFromArray (sheet, row_headers, row_data, col_beg, col_end, data_list, data_callback, data_callargg, sheet_archive, format) {
  var timestamp = util_date_strAsyyyymmddhhmmss ();
  var headers = util_sheet_headersLoad (sheet, row_headers, col_beg, col_end);
  var content = Array ();
  var skipped = data_list.reduce ((skipped, data) => {
    skipped = skipped.concat (Object.keys (data).filter (v => ! headers.includes (v)));
    if (!util_is_null (data_callback)) data_callback (data, data_callargg);
    data.timestamp = timestamp;
    content.push (util_sheet_headersOrder (headers, data));
    return skipped;
  }, Array ());
  util_sheet_contentDelete (sheet, row_data, col_beg, col_end);
  util_sheet_contentInsert (sheet, row_data, col_beg, content, format);
  if (!util_is_null (sheet_archive))
    util_sheet_contentInsert (sheet_archive, (sheet_archive.getLastRow () + 1), col_beg, content, format);
  return { length: data_list.length, skipped: util_uniq (skipped) };
}
function util_sheet_buildFromArray2 (sheet, row_headers, row_data, col_beg, col_end, data_list, data_callback, data_callargg, sheet_archive, format) {
  var timestamp = util_date_strAsyyyymmddhhmmss ();
  var headers = util_sheet_headersLoad (!util_is_null (sheet) ? sheet : sheet_archive, row_headers, col_beg, col_end);
  var content = Array ();
  var skipped = data_list.reduce ((skipped, data) => {
    skipped = skipped.concat (Object.keys (data).filter (v => ! headers.includes (v)));
    if (!util_is_null (data_callback)) data_callback (data, data_callargg);
    data.timestamp = timestamp;
    content.push (util_sheet_headersOrder (headers, data));
    return skipped;
  }, Array ());
  if (!util_is_null (sheet))
    util_sheet_contentDelete (sheet, row_data, col_beg, col_end), util_sheet_contentInsert (sheet, row_data, col_beg, content, format);
  if (!util_is_null (sheet_archive))
    util_sheet_contentInsert (sheet_archive, (sheet_archive.getLastRow () + 1), col_beg, content, format);
  return { length: data_list.length, skipped: util_uniq (skipped) };
}

function util_sheet_findDestroyCreate (spread, sheet_tpl, name, delete_ok) {
  var sheet = spread.getSheetByName (name), created = false;
  if (!util_is_null (sheet) && (!util_is_null (delete_ok) && delete_ok == true))
    spread.deleteSheet (sheet);
  if (util_is_null (sheet) || (!util_is_null (delete_ok) && delete_ok == true)) {
    spread.setActiveSheet (sheet_tpl);
    sheet = spread.duplicateActiveSheet ();
    sheet.setName (name).showSheet ();
    created = true;
  }
  return [sheet, created];
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_rowHide (sheet, minimum) {
  if (!util_is_null (minimum) && sheet.getMaxRows () > (minimum - 1))
    sheet.hideRows (minimum, sheet.getMaxRows () + 1 - minimum);
}
function util_sheet_rowPushAndHide (sheet, r1, r2, minimum, values) {
  sheet.insertRowsBefore (r1, values.length).getRange (r2).setValues (values); util_sheet_rowHide (sheet, minimum);
}
function util_sheet_rowPrune (sheet, minimum) {
  if (!util_is_nullOrZero (minimum) && sheet.getMaxRows () > (minimum - 1)) sheet.deleteRows (minimum, sheet.getMaxRows () + 1 - minimum);
}
function util_sheet_rowAppend (sheet, values) {
  sheet.getRange (sheet.getLastRow () + 1, 1, values.length, values [0].length).setValues (values);
}
function util_sheet_rowUpdate (sheet, updates) {
  updates.forEach (content => sheet.getRange (content.row, 1, 1, content.values [0].length).setValues (content.values));
}
function util_sheet_rowRemoveEmptyTrailing (name, leave = 0) {
  return util_sheet_rowRemoveEmptyTrailingBySheet (SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (name), leave);
}
function util_sheet_rowRemoveEmptyTrailingBySheet (sheet, leave = 0) {
  if (!util_is_null (sheet)) {
    const row_beg = sheet.getLastRow () + 1, row_end = sheet.getMaxRows ();
    if ((row_end - leave) > row_beg)
      sheet.deleteRows (row_beg, (row_end - leave) - row_beg);
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_headersLoad (sheet, row, col_beg, col_end) {
  return sheet.getRange (col_beg + row + ":" + (col_end ? col_end : util_sheet_col2abc (sheet.getLastColumn ())) + row).getValues () [0];
}
function util_sheet_headersFind (headers, name) {
  const index = headers.indexOf (name); return (index < 0) ? undefined : index;
}
function util_sheet_headersOrder (headers, content, partial_okay = false) {
  function __l1 (d) { if (String (d).length == 0) return "";
    if (Array.isArray (d)) d = (d.length == 1) ? d [0] : d.map (v => (typeof v == 'string') ? v : JSON.stringify (util_sort (v))).sort ().join (",");
    else if (typeof d == 'object') d = JSON.stringify (util_sort (d));
    return (d == "{}" || d == "[]") ? "" : d; }
  function __l2 (r) { var i = r.length - 1; while (i >= 0 && r [i] == '') i--;  return (i >= 0 && i < (r.length - 1)) ? r.slice (0, i + 1) : r; }
  const mapped = headers.map (header => !util_is_null (content [header.trim ()]) ? __l1 (content [header.trim ()]) : "");
  return (partial_okay == false) ? mapped : __l2 (mapped);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sheet_formatSavedLoad (sheet, r_f, c_c, c_e, is_text = false) {
  const range = sheet.getRange (c_c + r_f + ":" + c_e + r_f); return is_text ? range.getValues () [0].map (v => v.split ('"') [1]) : range.getNumberFormats () [0];
}
function util_sheet_formatSavedStore (sheet, r_c, c_c, r_f) {
  sheet.getRange (c_c + r_f + ":" + r_f).setNumberFormat ("").setValues ([ sheet.getRange (c_c + r_c + ":" + r_c).getNumberFormats () [0].map (v => '"' + v + '"') ]);
}
function util_sheet_formatSavedApply (sheet, r_c, c_c, r_f) {
  sheet.getRange (c_c + r_c + ":" + sheet.getLastRow ())
    .setNumberFormats (Array (sheet.getLastRow () - (r_c - 1)).fill (sheet.getRange (c_c + r_f + ":" + r_f).getValues () [0].map (v => v.split ('"') [1])));
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function util_drive_backup (spread) {
  var name = spread.getName () + " -- VERSION W" + (util_date_weekOfYear () < 10 ? "0" : "") + util_date_weekOfYear () + " " + util_date_strAsyyyymmdd (),
      file = DriveApp.getFileById (spread.getId ()).makeCopy (name), url = file.getUrl ();
  return [ spread.getName (), file.getName (), !url.includes ("?") ? url : url.split ("?") [0] ];
}

// -----------------------------------------------------------------------------------------------------------------------------------------
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
// -----------------------------------------------------------------------------------------------------------------------------------------

function util_lock_wrapper (t, d, f, a) {
  function __l (t) { return (t == "Document") ? LockService.getDocumentLock () : ((t == "Script") ? LockService.getScriptLock () : ((t == "User") ? LockService.getUserLock () : undefined)); }
  var l = __l (t); if (d == 0 && !l.tryLock (d)) return undefined; else if (d != 0) l.waitLock (d); try { var r = f (a); l.releaseLock (); return r; } catch (e) { l.releaseLock (); throw e; }
}
function util_lock_seconds (x) {
  return x * 1000;
}

function util_exception_wrapper (f, g) {
  try { return f (); } catch (e) { if (g == undefined) throw e; else return g (e); }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function util_sleep (m) {
  Utilities.sleep (m * 1000);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
