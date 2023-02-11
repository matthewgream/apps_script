
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function SYSTEM_DEBUG () {
  debugLog_Set (true);
  handler_debug ().forEach (debugLog);
  Logger.log (__system_state ());
  __system_checks ();
  __system_status ();
}
function SYSTEM_STATE () {
  return __system_state ();
}
function SYSTEM_STORE_ALL (select, filter) {
  return __system_store (select, filter);
}
function SYSTEM_STORE_GET (a, b, c, d) {
  const __n = (x) => (x == "") ? undefined : x;
  return store_get (__n (a), __n (b), __n (c), __n (d));
}
function SYSTEM_STATUS (modules) {
  if (util_is_nullOrZero (modules)) throw "no status defined";
  if (!Array.isArray (modules)) modules = [ modules ];
  modules = modules.map (module => { const status_f = module + "_status";
    if (!util_function_exists (status_f)) throw "invalid status defined: " + module; return status_f;  });
  return Object.entries (modules.reduce ((p, status_f) => util_merge (p, util_function_call (status_f)), {}))
    .map (([k, v]) => Array.isArray (v) ? v.map (vv => k + ": " + vv) : [k + ": " + v]).flat (Infinity);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __system_modules_list () { return [
  "deployments", "cache", "queue", "store", "timer", "handler", "connect", "runner", "log", "config"
]; }
function __system_modules_data () {
  const WARNING_SIZE_STORAGE  = 425*1024;           // 425, makes is 500 of property storage size
  const WARNING_SIZE_CONNECT  = 25*1000;            // 25K per day, can go 100K on enterprise
  const WARNING_SIZE_LOG      = 150*1000;           // too many log lines
  const WARNING_SIZE_TIMER    = 18;                 // 20 is system limit
  return {
    storage: { threshold: WARNING_SIZE_STORAGE, limit: 512*1024, size: () => (cache_len () + queue_len () + store_len ()) },
    connect: { threshold: WARNING_SIZE_CONNECT, limit: 100*1000, size: connect_cnt },
    log: { threshold: WARNING_SIZE_LOG, limit: 500*1000, size: log_len, action: 'log_reduce' },
    timer: { threshold: WARNING_SIZE_TIMER, limit: 20, size: timer_cnt },
  };
}
function __system_state () {
  store_inc ("system", "functions", "state");
  const __ccall = (v, x, s) => (util_function_exists (v + x) ? s + util_function_call (v + x) : "");
  return __system_modules_list ().map (v => v + __ccall (v, "_cnt", ": ") + __ccall (v, "_len", "/") + __ccall (v, "_str", "/")).join (", ");
}
function __system_checks () {
  store_inc ("system", "functions", "checks");
  Object.entries (__system_modules_data ()).forEach (([n, d]) => {
    const size = d.size (), threshold = d.threshold, limit = d.limit; if (size > threshold) {
      var message = "system " + n + " at " + util_str_niceNum (size) + " (above " + util_str_niceNum (threshold) + ", limit " + util_str_niceNum (limit) + ")";
      if (!util_is_null (d.action) && util_function_exists (d.action)) util_function_call (d.action), message += " [action taken: " + d.action + "]";
      system_error ("warning", message, undefined, __system_state ());
    }
  });
}
function __system_backup () {
  store_inc ("system", "functions", "backup");
  const [a, b, c] = util_drive_backup (SpreadsheetApp.getActiveSpreadsheet ());
  system_info ("backup", "'" + a + "' to '" + b + "' at " + c);
}
function __system_status () {
  store_inc ("system", "functions", "status");
  const status_functions = util_function_find (v => !v.startsWith ("__") && !v.startsWith ("system") && v.endsWith ("_status"));
  const status = status_functions.reduce ((p, v) => util_merge (p, util_function_call (v)), { "system": __system_state () });
  const messages = Object.entries (status).map (([k, v]) => Array.isArray (v) ? v.map (vv => k + ": " + vv) : [k + ": " + v]).flat (Infinity);
  system_info ("status", util_date_strAsyyyymmddhhmmss (), undefined, messages);
}
function __system_store (s, f) {
  store_inc ("system", "functions", "store");
  if (s == "OK") s = undefined;
  var t = Object.entries (store_lst ()).reduce ((t, [k, v]) => util_tree_push (t, util_str_split (k, ";"), util_str_isnum (v) ? (v * 1.0) : v), {});
  var r = util_tree_flat (t, ",").map (v => [v.n, v.v]).concat ([[ "_current", util_date_strAsISO () ]]);
  if (!util_is_nullOrZero (s) && !util_is_nullOrZero (s = s.split (";"))) r = r.filter (rr => s.some (ss => rr [0].startsWith (ss)));
  if (!util_is_nullOrZero (f) && !util_is_nullOrZero (f = f.split (";"))) r = r.filter (rr => ! f.some (ff => rr [0].startsWith (ff)));
  return r.sort ((a, b) => (a [0] == b [0]) ? 0 : ((a [0] < b [0]) ? -1 : 1));
}
function __system_store_reset () {
  const str = "reset [was: " + store_get ("_started") + " @ " + util_str_niceNum (store_len ()) + "]";
  store_rst ();
  store_set (util_date_strAsISO (), "_started");
  system_info ("store", str);
  return "OK";
}
function __system_setup (user, info) {
  const setup_functions = util_function_find (v => !v.startsWith ("__") && !v.startsWith ("system") && v.endsWith ("_setup"));
  setup_functions.forEach (util_function_call);
  user = "opened by " + (util_is_nullOrZero (user) ? "(unknown)" : user);
  system_info ("setup", user, undefined, info);
  system_debug ("setup", "using, " + util_str_join (setup_functions.map (v => v.replace ("_setup", "")), ", "));
  __system_timer_setup (timer_createMinutes, "__system_logger", 1);
  __system_timer_setup (timer_createMinutes, "__system_runner", 1);
  __system_timer_setup (timer_createHours,   "__system_status", 6);
  __system_timer_setup (timer_createHours,   "__system_checks", 1);
  __system_timer_setup (timer_createWeekly,  "__system_backup", ScriptApp.WeekDay.SATURDAY, 1);
  if (!store_get ("_started"))
    store_rst (), store_set (util_date_strAsISO (), "_started");
  store_inc ("system", "functions", "setup");
}
function __system_timer_setup (f, n, a, b, c) {
  if (f (n, a, b, c) == true) system_error ("timer", "for '" + n + "' did not exist, will be created"); }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __stg_clr (p, s)     { return Object.keys (p.getProperties ()).filter (k => k.startsWith (s)).map (k => p.deleteProperty (k)).length; }
function __stg_len (p, s)     { return Object.entries (p.getProperties ()).filter (([k, v]) => k.startsWith (s)).reduce ((t, [k, v]) => t + (k.length + v.length), 0); }
function __stg_cnt (p, s)     { return Object.keys (p.getProperties ()).filter (k => k.startsWith (s)).length; }
function __stg_rst (p)        { p.deleteAllProperties (); }

// -----------------------------------------------------------------------------------------------------------------------------------------

class CACHE { }
CACHE.TIME_INF = (60*60*24*365);
CACHE.TIME_28D = (60*60*24*28);
CACHE.TIME_7D = (60*60*24*7);
CACHE.TIME_24H = (60*60*24);
CACHE.TIME_12H = (60*60*12);
CACHE.TIME_6H = (60*60*6);
CACHE.TIME_4H = (60*60*4);
CACHE.TIME_2H = (60*60*2);
CACHE.TIME_1H = (60*60);
CACHE.TIME_30M = (30*60);
CACHE.TIME_15M = (15*60);
CACHE.TIME_5M = (5*60);
CACHE.TIME_2M = (2*60);
CACHE.TIME_1M = (1*60);
CACHE.TIME_30S = (30);
CACHE.TIME_0 = 0;

var __system__c_p = undefined;
function __c_p ()                 { if (__system__c_p == undefined) __system__c_p = PropertiesService.getScriptProperties (); return __system__c_p; }
function __c_n (k, x)             { return "C" + ((k == undefined) ? "" : (x + "_" + k)); }
function __c_m (k, s)             { return util_str_isprefix (k, __c_n (s, "V")); }
function __c_x (k, s)             { return util_str_isprefix (k, __c_n (s, "T")); }
function __c_t (t)                { return t == undefined ? 0 : (((new Date ()).getTime () - t) / 1000); }
function __c_v (t, s)             { return (s == undefined || s >= CACHE.TIME_INF || (t != undefined && ((((new Date ()).getTime () - t) / 1000) < s))); }
function cache_read (k, s)        { return __c_v (__c_p ().getProperty (__c_n (k, "T")) * 1.0, s) ? __c_p ().getProperty (__c_n (k, "V")) : undefined; }
function cache_write (k, v)       { __c_p ().setProperty (__c_n (k, "T"), (new Date ()).getTime ()).setProperty (__c_n (k, "V"), v); return true; }
function cache_del (k)            { __c_p ().deleteProperty (__c_n (k, "T")).deleteProperty (__c_n (k, "V")); return true; }
function cache_lst (s)            { return Object.entries (__c_p ().getProperties ()).filter (([k, v]) => __c_m (k, s)).map (([k, v]) => ({ k: util_str_substr (k, 3), v: v })); }
function cache_clr (k)            { return __stg_clr (__c_p (), __c_n (k, "T")) + __stg_clr (__c_p (), __c_n (k, "V")); }
function cache_rst ()             { return __stg_clr (__c_p (), __c_n ()); }
function cache_len ()             { return __stg_len (__c_p (), __c_n ()); }
function cache_kil ()             { return __stg_rst (__c_p ()); }
function cache_cnt ()             { return __stg_cnt (__c_p (), __c_n ()); }

function cache_expired (k, s)     { return !__c_v (__c_p ().getProperty (__c_n (k, "T")) * 1.0, s); }
function cache_duration (k, s)    { return __c_t (__c_p ().getProperty (__c_n (k, "T")) * 1.0); }
function cache_timestamp (k)      { const t = __c_p ().getProperty (__c_n (k, "T")); return (t == undefined) ? "none" : util_date_epochToStr_ISO (t * 1.0); }
function cache_readWithLZ (k, s)  { const x = cache_read (k, s); if (x != undefined) return LZString.decompressFromUTF16 (x); }
function cache_writeWithLZ (k, v) { if (v != undefined) v = LZString.compressToUTF16 (v); cache_write (k, v); }
function cache_times (s)          { return Object.entries (__c_p ().getProperties ()).filter (([k, v]) => __c_x (k, s)).map (([k, v]) => v * 1.0); }
function cache_time (k)           { const t = __c_p ().getProperty (__c_n (k, "T")); return (t == undefined) ? undefined : t * 1.0; }

// -----------------------------------------------------------------------------------------------------------------------------------------

var __system__q_p = undefined;
function __q_p ()                 { if (__system__q_p == undefined) __system__q_p = PropertiesService.getDocumentProperties (); return __system__q_p; }
function __q_n (i, s)             { return "Q" + ((i == undefined) ? "" : (i + ((s == undefined) ? "" : ("_" + s + "_")))); }
function queue_pop_n (i, s)       { var c = __q_p ().getProperty (__q_n (i, s)); c = (c == undefined) ? 1 : c * 1.0; __q_p ().setProperty (__q_n (i, s), (c == 9999999) ? 1 : c + 1.0); return c; }
function queue_get_n (i, s)       { const c = __q_p ().getProperty (__q_n (i, s)); return (c == undefined) ? 1 : c * 1.0; }
function queue_set_n (i, s, c)    { c = (c == 9999999) ? 1 : c + 1.0; __q_p ().setProperty (__q_n (i, s), c); return c; }
function queue_pop_c (i, c)       { const m = __q_p ().getProperty (__q_n (i, "#_" + c)); __q_p ().deleteProperty (__q_n (i, "#_" + c)); return m == undefined ? m : JSON.parse (m); }
function queue_set_c (i, c, m)    { if (m == undefined) return false; __q_p ().setProperty (__q_n (i, "#_" + c), JSON.stringify (m)); return true; }
function queue_rst (i)            { return __stg_clr (__q_p (), __q_n (i)); }
function queue_len (i)            { return __stg_len (__q_p (), __q_n (i)); }
function queue_cnt (i)            { return __stg_cnt (__q_p (), __q_n (i)); }

// -----------------------------------------------------------------------------------------------------------------------------------------

var __system__s_p = undefined;
function __s_p ()                 { if (__system__s_p == undefined) __system__s_p = PropertiesService.getScriptProperties (); return __system__s_p; }
function __s_n (i, j, k, l)       { return "M" + (((i==undefined)?"":(";"+i)) + ((j==undefined)?"":(";"+j)) + ((k==undefined)?"":(";"+k)) + ((l==undefined)?"":(";"+l))); }
function __s_i (s)                { return Object.entries (__s_p ().getProperties ()).filter (([k, v]) => util_str_isprefix (k, s)); }
function store_get (i, j, k, l)   { return __s_p ().getProperty (__s_n (i, j, k, l)); }
function store_inc (i, j, k, l)   { __s_p ().setProperty (__s_n (i, j, k, l), (__s_p ().getProperty (__s_n (i, j, k, l)) * 1.0) + 1.0); }
function store_add (v, i, j, k, l){ __s_p ().setProperty (__s_n (i, j, k, l), (__s_p ().getProperty (__s_n (i, j, k, l)) * 1.0) + (v * 1.0)); }
function store_app (v, i, j, k, l){ const vv = __s_p ().getProperty (__s_n (i, j, k, l)); __s_p ().setProperty (__s_n (i, j, k, l), vv == undefined ? v : vv + "," + v); }
function store_set (v, i, j, k, l){ __s_p ().setProperty (__s_n (i, j, k, l), v); }
function store_sum (i, j, k, l)   { return __s_i (__s_n (i, j, k, l)).reduce ((z, [k, v]) => z + (v * 1.0), 0); }
function store_lst (i, j, k, l)   { const s = __s_n (i, j, k, l); return __s_i (s).reduce ((z, [k, v]) => util_assign (z, util_str_substr (k, 1 + s.length), v), {}); }
function store_clr (i, j, k, l)   { return __stg_clr (__s_p (), __s_n (i, j, k, l)); }
function store_rst (i, j, k, l)   { return __stg_clr (__s_p (), __s_n (i, j, k, l)); }
function store_len ()             { return __stg_len (__s_p (), __s_n ()); }
function store_cnt ()             { return __stg_cnt (__s_p (), __s_n ()); }
function store_gst (f,i,j,k,l)    { const x = f (store_get (i, j, k, l)); if (x != undefined) store_set (x, i, j, k, l); return x; }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function data_cache_gets (n, compressed = true) {
  const c = CacheService.getScriptCache (); var k = c.get ("C/L/" + n); if (k == null || (k * 1.0) == 0) return undefined;
  const b = c.getAll (k = Array.from ({ length: k }, (v, i) => "C/D/" + n + "/" + i));
  return compressed ? LZString.decompressFromUTF16 (k.map (x => b [x]).join ("")) : k.map (x => b [x]).join ("");
}
function data_cache_puts (n, s, compressed = true, t = 21600) {
  const c = CacheService.getScriptCache (), b = util_str_chunk (compressed ? LZString.compressToUTF16 (s) : s, (100*1000)-1), k = Array.from ({ length: b.length }, (v, i) => "C/D/" + n + "/" + i);
  c.put ("C/L/" + n, b.length, t), c.putAll (k.reduce ((p, v, i) => util_assign (p, v, b [i]), {}), t);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __t_n (f) { return ScriptApp.newTrigger (f).timeBased (); }
function __t_e (f) { return ScriptApp.getProjectTriggers ().find (t => t.getHandlerFunction () == f); }
function timer_create (f, n = 1) { return __t_n (f).after (n).create ().getUniqueId (); }
function timer_createMinutes (f, n) { if (!__t_e (f)) { __t_n (f).everyMinutes (n).create (); return true; } return false; }
function timer_createHours (f, n) { if (!__t_e (f)) { __t_n (f).everyHours (n).create (); return true; } return false; }
function timer_createDaily (f, h, m) { if (!__t_e (f)) { __t_n (f).everyDays (1).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_createWeekly (f, n, h, m) { if (!__t_e (f)) { __t_n (f).onWeekDay (n).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_createMonthly (f, n, h, m) { if (!__t_e (f)) { __t_n (f).onMonthDay (n).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_delete (id) { ScriptApp.getProjectTriggers().filter (t => t.getUniqueId () == id).forEach (t => ScriptApp.deleteTrigger (t)); }
function timer_cnt () { return ScriptApp.getProjectTriggers ().length; }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __system__log_queue = "lq";
function __log_queueClear () { queue_rst (__system__log_queue); }
function __log_queueSize () { return queue_get_n (__system__log_queue, "W") - queue_get_n (__system__log_queue, "R"); }
function __log_queueInsert (m) { if (!util_is_nullOrZero (m)) queue_set_c (__system__log_queue, queue_pop_n (__system__log_queue, "W"), m); }
function __log_queueObtain () { const m = Array (), w = queue_get_n (__system__log_queue, "W") - 1; var r = queue_get_n (__system__log_queue, "R");
  if (r < w && queue_set_n (__system__log_queue, "R", w)) while (r <= w) m.unshift (queue_pop_c (__system__log_queue, r ++)); return m.filter (m_ => m_ != undefined && m_.length > 0); }

var __system__log_sheet = { ref: undefined, tab: '!', col: 1, row: 10, len: 42 }
function __log_sheetLoad () { __system__log_sheet ['ref'] = SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (__system__log_sheet ['tab']); }
function __log_sheetClear () { if (__system__log_sheet ['ref'] == undefined) __log_sheetLoad (); util_sheet_rowPrune (__system__log_sheet ['ref'], __system__log_sheet ['len']); }
function __log_sheetSize () { if (__system__log_sheet ['ref'] == undefined) __log_sheetLoad (); return __system__log_sheet ['ref'].getLastRow () - 1; }
function __log_sheetInsert (m) { if (__system__log_sheet ['ref'] == undefined) __log_sheetLoad ();
  if (m.length > 0) util_sheet_rowPushAndHide (__system__log_sheet ['ref'], __system__log_sheet ['row'],
  util_sheet_col2abc (__system__log_sheet ['col']) + __system__log_sheet ['row'] + ":" + util_sheet_col2abc (__system__log_sheet ['col'] + m [0].length - 1) +
    ((__system__log_sheet ['row'] - 1) + m.length), __system__log_sheet ['len'], m); return m.length; }

// -----------------------------------------------------------------------------------------------------------------------------------------

var log_cnt = __log_queueSize, log_len = __log_sheetSize, log_str = log_state, log_reduce = __log_sheetClear;
function log_flush () {
  return __log_sheetInsert (__log_queueObtain ()); }
function log_state () {
  return store_get ("system", "logger", "state") == "suspended" ? "suspended" : "operating"; }
function log_process () { const size = (log_state () != "suspended") ? __log_sheetInsert (__log_queueObtain ()) : 0;
  store_inc ("system", "logger", "process"); if (size > 0) store_add (size, "system", "logger", "volume"); }
function log_suspend (v) { const sold = log_state (), snew = v ? "suspended" : "operating";
  if (!sold || snew != sold) store_set (snew, "system", "logger", "state"), system_debug ("system","logger: state=" + snew); }

function __system_logger () { log_process (); }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __args_encode (s) { return s.replaceAll (",", '&#2C;').replaceAll (":", '&#3A;'); }
function __args_decode (s) { return s.replaceAll ('&#2C;', ",").replaceAll ('&#3A;', ":"); }

function __system_schedule_key (t) { return "SCHD_" + t; }

function __system_schedule_push (callback, arguments) {
  if (!util_function_exists (callback)) system_error_throw ("scheduler", "invalid callback: " + callback);
  if (!util_is_null (arguments))
    callback += (":" + __args_encode (JSON.stringify (arguments)));
  util_lock_wrapper ("Script", util_lock_seconds (30), () => {
    var queue = cache_read (__system_schedule_key ("queue"));
    if (util_is_nullOrZero (queue) || !queue.split (",").includes (callback)) // XXX prevents duplicates
      cache_write (__system_schedule_key ("queue"), util_is_nullOrZero (queue) ? callback : (queue + "," + callback));
  });
  store_inc ("system", "schedule", "push");
}
function __system_schedule_pull () {
  var callback = util_lock_wrapper ("Script", util_lock_seconds (30), () => {
    var queue = cache_read (__system_schedule_key ("queue")), callback = undefined;
    if (!util_is_nullOrZero (queue))
      callback = (queue = queue.split (",")) [0], cache_write (__system_schedule_key ("queue"), queue.slice (1).join (","));
    return callback;
  }), arguments = undefined;
  if (!util_is_nullOrZero(callback)) {
    store_inc ("system", "schedule", "pull");
    if (callback.includes (":") && ([callback, arguments] = callback.split (":")) [1].length > 0)
      arguments = JSON.parse (__args_decode (arguments));
  }
  return [callback, arguments];
}
function __system_schedule_size () {
  return util_lock_wrapper ("Script", util_lock_seconds (30), () => {
    const queue = cache_read (__system_schedule_key ("queue"));
    return (util_is_nullOrZero (queue)) ? 0 : queue.split (",").length;
  });
}
function __system_schedule (complete_f) {
  var complete, callback, arguments, called = Array ();
  store_inc ("system", "schedule", "exec");

try {  // XXX REMOVE ME
  while (!(complete = complete_f ()) && !util_is_null (([callback, arguments] = __system_schedule_pull ()) [0]))
    util_function_call (callback, arguments), called.push (callback + util_str_safevaluetostr (arguments));
} catch (e) {
  log ("debug", "got exception, " + e + ", using " + callback + " / " + arguments);
  throw e;
}

  if (called.length > 0) system_debug ("schedule", "yielded: " + complete + ", called (" + called.length + "/" + __system_schedule_size () + ")", called.join (", "));
  return complete;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function system_schedule (callback, arguments = undefined) {
  return __system_schedule_push (callback, arguments);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __system__exe = this ['APPLICATION_RUNNER'] ? this ['APPLICATION_RUNNER'] : "__system_schedule";

// -----------------------------------------------------------------------------------------------------------------------------------------

function runner_suspend (desired, origin = undefined) {
  const current = store_get ("system", "state", "suspended") == undefined ? false : true;
  if (current == desired) return;
  const mode = (desired == true) ? "suspended" : "resumed", message = origin ? [ origin ] : Array ();
  if (desired == true)
    store_set (util_date_strAsISO (), "system", "state", "suspended");
  else if (desired == false) {
    const suspended = store_get ("system", "state", "suspended"); store_clr ("system", "state", "suspended");
    if (suspended) message.push ("after " + util_str_niceSecsAsDays (util_date_epochDiffInSecs (util_date_epochFromStr (suspended))));
  }
  system_info ("runner", mode + (message.length > 0 ? (", " + message.join (", ")): ""));
  store_inc ("system", "runner", mode);
}
function runner_suspend_wrapper (f, r) {
  const x = runner_suspended ();
  if (!x) runner_suspend (true, r);
  try {
    f ();
  } catch (e) {
    if (!x) runner_suspend (false);
    throw e;
  }
  if (!x) runner_suspend (false);
}
function runner_suspended () {
  return store_get ("system", "state", "suspended") == undefined ? false : true;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __runner_isdone () {
  const __RUNNER_TIME_EXPIRE = 5*60;
  const timestart = store_get ("system", "state", "start-time");
  if (util_is_null (timestart)) return true;
  const duration = util_date_epochDiffInSecs (timestart);
  if (duration >= __RUNNER_TIME_EXPIRE) return true;
  if (!util_is_null (store_get ("system", "state", "suspended"))) return true;
  return false;
}
function __runner_start () {
  const __RUNNER_TIME_ABORT = 7*60;
  const started = util_lock_wrapper ("Script", util_lock_seconds (30), () => {
    var timestart = store_get ("system", "state", "start-time");
    if (!util_is_null (timestart) && (util_date_epochDiffInSecs (timestart) < __RUNNER_TIME_ABORT)) return false;
    if (!util_is_null (timestart)) {
      store_clr ("system", "state", "start-time");
      store_inc ("system", "runner", "cancelled");
      system_error ("runner", "cancelled");
    }
    store_set (timestart = util_date_epoch (), "system", "state", "start-time");
    store_set (timestart, "system", "state", "start-last");
    return true;
  });
  if (started == true)
    store_inc ("system", "runner", "started");
  return started;
}
function __runner_end (t, m) {
  store_clr ("system", "state", "start-time");
  store_inc ("system", "runner", t);
}
function __runner_execute () {
  try {
    if (!__runner_start ())
      return false;
    const ran = this [__system__exe] (__runner_isdone);
    __runner_end ("completed", "ran " + ran + (ran == false ? " (no-respawn)" : ""));
    return ran;
  } catch (e) {
    __runner_end ("aborted", util_str_error (e));
    system_error ("runner", "aborted", undefined, util_str_error (e));
    return true;
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runner_cnt () {
  return [ "started", "completed", "aborted", "cancelled", "suspended" ].map (v => store_sum ("system", "runner", v)).join ("/");
}
function runner_str () {
  return runner_suspended () ? "suspended" : "operating";
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __system_respawn (e) {
  if (!util_is_null (e))
    timer_delete (e.triggerUid);
  __system_runner ();
}
function __system_runner () {
  if (runner_suspended () == false)
    if (__runner_execute () == true)
      timer_create ("__system_respawn");
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __connect_urlFetch (u) {
  const __day = util_date_arrAsyyyymmddhhmmss (), d_i = __day [0] + "-" + ((__day [1] < 10) ? "0" + __day [1] : __day [1]), d_j = (__day [2] < 10) ? "0" + __day [2] : __day [2];
  store_inc ("system", "connect", d_i, d_j);
  try {
    const r = UrlFetchApp.fetch (u);
/*    if (r == undefined || r.getResponseCode () == 404)
      throw (" ... no response, or 404 error");
    if (r.getResponseCode () >= 500 && r.getResponseCode () <= 599)
      throw (" ... 50x error");*/
    return r.getContentText ();
  } catch (e) {
    throw "connect_url: " + util_str_error (e);
  }
}

function __connect_urlResponse (name, url, opts, detail) {
  const __day = util_date_arrAsyyyymmddhhmmss (), d_i = __day [0] + "-" + ((__day [1] < 10) ? "0" + __day [1] : __day [1]), d_j = (__day [2] < 10) ? "0" + __day [2] : __day [2];
  store_inc ("system", "connect", d_i, d_j); // XXX for now
  opts.muteHttpExceptions = true;
  debugLog (detail + ": " + name + " --> " + url + " opts: " + JSON.stringify (opts));
  const r = UrlFetchApp.fetch (url, opts);
  debugLog ("--> " + r.getResponseCode ());
  if (r == undefined || (r.getResponseCode () != 200 && r.getResponseCode () != 201 && r.getResponseCode () != 204))
    return system_error_throw (name, "HTTP transport error (#" + r.getResponseCode () + "): ", url,
      "HEAD: " + util_str_presentable (JSON.stringify (r.getAllHeaders ()), 128) + ", BODY: " + util_str_presentable (r.getContentText (), 128)); // does not return
  return r;
}

function connect_urlRawResponse (name, url, opts = { method: 'GET' }, type = "text") {
  store_inc ("system", "connect", "raw-" + util_str_lower (opts.method), util_str_isolateURI (url));
  const r = __connect_urlResponse (name, url, opts, "connect_urlRawResponse");
  if (r.getResponseCode () == 204)
    return "";
  debugLog ("["+(r.getContentText ().length)+"]" + util_str_presentable (r.getContentText (), 128));
  return (type == 'text') ? r.getContentText () : r.getContent ();
}

function connect_urlJsonResponse (name, url, opts = { method: 'GET'}) {
  store_inc ("system", "connect", "jsn-" + util_str_lower (opts.method), util_str_isolateURI (url));
  const r = __connect_urlResponse (name, url, opts, "connect_urlJsonResponse");
  if (r.getResponseCode () == 204)
    return "";
  debugLog ("["+(r.getContentText ().length)+"] " + r.getContentText ().slice (0, 128) + " ...");
  const d = JSON.parse (r.getContentText ());
  return (!util_is_null (d)) ? d :
    system_error_throw (name, "JSON parser error", url, util_str_presentable (r.getContentText (), 128)); // does not return
}

function connect_urlXmlResponse (name, url) {
  store_inc ("system", "connect", "xml-get", util_str_isolateURI (url));
  const r = __connect_urlResponse (name, url, { }, "connect_urlXmlResponse");
  if (!(util_str_includes (r.getContentText (), "<") || util_str_includes (r.getContentText (), ">")))
    return system_error_throw (name, "XML response is not XML: ", url, util_str_presentable (r.getContentText (), 128)); // does not return
  debugLog ("["+(r.getContentText ().length)+"] " + r.getContentText ().slice (0, 128) + " ...");
  const d = XmlService.parse (r.getContentText ());
  return (!util_is_null (d) && !util_is_null (d.getRootElement ())) ? d.getRootElement () :
    system_error_throw (name, "XML parser error", url, util_str_presentable (r.getContentText (), 128)); // does not return
}

function connect_urlCachableResponse (name, url, timeout, forced = false) {
  var data; const uri = util_str_isolateURI (url);
  if (forced == false && !util_is_null (data = data_cache_gets (uri, true))) {
    store_inc ("system", "connect", "cache-get", uri);
  } else {
    data_cache_puts (uri, data = __connect_urlResponse (name, url, {}, "connect_urlCachableResponse").getContentText (), true, timeout);
    store_inc ("system", "connect", "cache-new", uri);
    store_set (data.length, "system", "cache", "connect", uri);
  }
  return data;
}

function connect_cnt () {
  return Object.values (store_lst ("system", "cache", "connect")).length;
}
function connect_len () {
  return Object.values (store_lst ("system", "cache", "connect")).reduce ((p, v) => p + (v * 1.0), 0);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __h_key (h, t) { return "H_" + (h != undefined ? h : "") + (t != undefined ? t : ""); }
function __h_get (h, t) { const x = cache_read (__h_key (h, t)); return !util_is_nullOrZero (x) ? x.split (",") : Array (); }
function __h_set (h, t, x) { cache_write (__h_key (h, t), x.join (",")); }
function __h_run (v, t, e) { return util_function_call (v, t, e) ? 1 : 0 }
function handler_rst (h) { return util_num_sum (cache_lst (__h_key (h)).map (v => cache_del (v.k) ? 1 : 0)); }
function handler_cnt (h) { return cache_lst (__h_key (h)).length; }
function handler_lst (h) { return cache_lst (__h_key (h)).map (v => ({ k: util_str_remove (v.k, __h_key (h)), v: v.v.split (",") })); }
function handler_insert (h, t, f) { store_inc ("system", "handler", h, "insert"); const x = __h_get (h, t); if (!x.includes (f)) x.push (f), __h_set (h, t, x); }
function handler_remove (h, t, f) { store_inc ("system", "handler", h, "remove"); const x = __h_get (h, t); if (x.includes (f)) x.splice (x.indexOf (f), 1), __h_set (h, t, x); }
function handler_iterate (h, t, e) { store_inc ("system", "handler", h, "iterate"); return util_num_sum (__h_get (h, t).map (v => util_exception_wrapper (
  () => util_function_exists (v) ?  __h_run (v, t, e) : handler_remove (h, t, v) && system_debug ("system", "handler ("+h+") [" + t + ", " + v + "], pruned"),
  (e) => system_error ("system", "handler ("+h+") [" + t + ", " + v + "], exception", undefined, util_str_error (e)))).filter (v => !util_is_null (v))); }
function handler_debug () { return handler_lst ().map (v => v.k + " --> " + util_str_join (v.v, ", ")).sort (); }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __web_handler_key () { return "WEB"; }
function __web_handler_service (t, e) {
  function __l (e) { return (e.pathInfo ? e.pathInfo : "") + (e.queryString ? ("?" + e.queryString) : "") + (e.contentLength && e.contentLength >= 0 ? "[" + e.contentLength + "]" : ""); }
  system_debug ("web", "Web "+t.toUpperCase ()+": " + __l (e), undefined, JSON.stringify (e));
  store_inc ("system", "web", t);
  if (!handler_iterate (__web_handler_key (), t, e)) {
    system_error ("web", "Web "+t.toUpperCase ()+": handler not found", undefined, JSON.stringify (e));
    return ContentService.createTextOutput (JSON.stringify ({ status: 'Forbidden', statusCode: 404, message : 'Not found' }));
  }
  return HtmlService.createHtmlOutput();
}

function system_register_webHandlerPOST (f) {
  handler_insert (__web_handler_key (), 'post', f); }
function system_register_webHandlerGET (f) {
  handler_insert (__web_handler_key (), 'get', f); }

function doGet (e) { return __web_handler_service ("get", e); }
function doPost (e) { return __web_handler_service ("post", e); }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function config_data () {
  return system_config ();
}
function config_match (c, i, q) {
  return Object.values (c).find (x => (!util_is_nullOrZero (x [i]) && (util_is_null (q) || q == x [i])));
}
function config_find (c, i, s) {
  const x = Object.keys (c).find (x => (!util_is_nullOrZero (c [x][i]) && (util_is_null (s) || s == x))); return util_is_nullOrZero (x) ? x : c [x][i];
}
function config_list (c, i) {
  return Object.keys (c).filter (x => (!util_is_nullOrZero (c [x][i])));
}
function config_exec (c, f, i, s) {
  function __match (a, b) { return (util_is_null (a) || a == b || util_str_matchsimplewildcards (b, a)); }
  return util_array_runnerY (a => Object.keys (c).filter (x => (!util_is_nullOrZero (c [x][i]) && __match (a, x))).reduce ((p, x) => util_push (p, f (x, c [x], i, c [x][i])), Array ()), s);
}
function config_exec2 (c, f, i, s) {
  function __match (a, b) { return (util_is_null (a) || a == b || util_str_matchsimplewildcards (b, a)); }
  return util_array_runnerY (a => Object.keys (c).filter (x => (!util_is_nullOrZero (c [x][i]) && __match (a, x))).reduce ((p, x) =>
    { const r = f (x, c [x], i, c [x][i]); if (!util_is_null (r)) p.push (r); return p; }, Array ()), s);
}
function config_cnt () {
  return Object.keys (config_data ()).length;
}
function config_len () {
  return JSON.stringify (config_data ()).length;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __system_deployments_url () {
  return "https://script.googleapis.com/v1/projects/";
}
function __system_deployments_execute (s, p) {
  const r = connect_urlJsonResponse ("system",
    __system_deployments_url () + ScriptApp.getScriptId () + "/deployments?pageSize=50" + (!util_is_nullOrZero (p) ? "&pageToken=" + p : ""),
    { method: "GET", headers: { "Authorization": "Bearer " + s.getAccessToken () }, contentType: "application/json" });
  const d = r.deployments.filter (v => v.entryPoints.some (vv => vv.entryPointType == "WEB_APP"));
  return util_is_nullOrZero (r.nextPageToken) ? d : util_concat (d, __system_deployments_execute (s, r.nextPageToken));
}
function system_deployments () {
  store_inc ("system", "deployments");
  return util_is_nullOrZero (__SYSTEM_SERVICE_CFG ['PRIVATE_KEY']) ? undefined : util_exception_wrapper (() => __system_deployments_execute (__system_serviceScriptAPI ()), e => Array ());
}

function __system_serviceScriptAPI () {
  return OAuth2.createService ('script_api')
    .setTokenUrl ('https://oauth2.googleapis.com/token')
    .setPrivateKey (__SYSTEM_SERVICE_CFG ['PRIVATE_KEY'])
    .setIssuer (__SYSTEM_SERVICE_CFG ['CLIENT_EMAIL'])
    .setPropertyStore (PropertiesService.getScriptProperties ())
    .setScope ('https://www.googleapis.com/auth/script.deployments')
    .setScope ('https://www.googleapis.com/auth/script.metrics');
}

function deployments_cnt () {
  const s = system_deployments (); return util_is_nullOrZero (s) ? 0 : s.length;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function onOpen2 (e) { // setup to run from a trigger, not otherwise
  util_exception_wrapper (() => __system_setup (util_appscript_make_user (e), util_appscript_make_info (e)),
    (e) => system_error ("onOpen", "exception", undefined, util_str_error (e)));
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __TEST_SETUP () {
  debugLog_Set (true);
}

var __system__debug_level = false;
function debugLog_Get () {
  return __system__debug_level;
}
function debugLog_Set (x) {
  __system__debug_level = (x > 0) ? true : false;
}
function debugLog (x) {
  if (__system__debug_level == true)
    Logger.log (x);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
