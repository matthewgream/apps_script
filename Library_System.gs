
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function SYSTEM_DEBUG () {
  debugLog_Set (true);
  Logger.log (__system_state ());
  __system_checks ();
}
function SYSTEM_STATE () {
  return __system_state ();
}
function SYSTEM_STORE_ALL (select, filter) {
  return __system_store (select, filter);
}
function SYSTEM_STORE_GET (a, b, c, d) {
  function __n (x) { return (x == "") ? undefined : x; }
  return store_get (__n (a), __n (b), __n (c), __n (d));
}
function SYSTEM_STATUS (modules) {
  if (util_is_nullOrZero (modules)) throw "no status defined";
  if (!Array.isArray (modules)) modules = [ modules ];
  modules = modules.map (module => { var status_f = module + "_status"; if (!util_function_exists (status_f)) throw "invalid status defined: " + module; return status_f;  });
  return Object.entries (modules.reduce ((p, status_f) => util_merge (p, util_function_call (status_f)), {}))
    .reduce ((z, [k, v]) => z.concat (Array.isArray (v) ? v.map (vv => k + ": " + vv) : [k + ": " + v]), Array ());
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var WARNING_SIZE_STORAGE  = 425*1024;           // 425, makes is 500 of property storage size
var WARNING_SIZE_CONNECT  = 25*1000;            // 25K per day, can go 100K on enterprise
var WARNING_SIZE_LOG      = 150*1000;           // too many log lines
var WARNING_SIZE_TIMER    = 18;                 // 20 is system limit

var __system_modules_names = [ "deployments", "cache", "queue", "store", "timer", "handler", "connect", "runner", "log", "config" ];
function __system_modules_data () { return {
    storage: { threshold: WARNING_SIZE_STORAGE, limit: 512*1024, size: () => (cache_len () + queue_len () + store_len ()) },
    connect: { threshold: WARNING_SIZE_CONNECT, limit: 100*1000, size: connect_cnt },
    log: { threshold: WARNING_SIZE_LOG, limit: 500*1000, size: log_cnt, action: 'log_reduce' },
    timer: { threshold: WARNING_SIZE_TIMER, limit: 20, size: timer_cnt },
  };
}
function __system_state () {
  store_inc ("system", "functions", "state");
  return __system_modules_names.map (v =>
    v + ": " + util_function_call (v + "_cnt") + (util_function_exists (v + "_len") ? "/" + util_function_call (v + "_len") : "")
                + (util_function_exists (v + "_str") ? "/" + util_function_call (v + "_str") : "")
  ).join (", ");
}
function __system_checks () {
  store_inc ("system", "functions", "checks");
  Object.entries (__system_modules_data ()).forEach (([n, d]) => {
    var size = d.size (), threshold = d.threshold, limit = d.limit; if (size > threshold) {
      var message = "system " + n + " at " + util_str_niceNum (size) + " above " + util_str_niceNum (threshold) + " (limit " + util_str_niceNum (limit) + ")";
      if (!util_is_null (d.action) && util_function_exists (d.action)) util_function_call (d.action), message += " [action taken: " + d.action + "]";
      system_error ("warning", message, __system_state ());
    }
  });
}
function __system_backup () {
  store_inc ("system", "functions", "backup");
  var [a, b, c] = util_drive_backup (SpreadsheetApp.getActiveSpreadsheet ());
  system_info ("backup", "from '" + a + "' to '" + b + "' at " + c);
}
function __system_status () {
  store_inc ("system", "functions", "status");
  var status_functions = util_function_find (v => !v.startsWith ("__") && !v.startsWith ("system") && v.endsWith ("_status"));
  var status = status_functions.reduce ((p, v) => util_merge (p, util_function_call (v)), { "system": __system_state () });
  var m = Object.entries (status).reduce ((z, [k, v]) => z.concat (Array.isArray (v) ? v.map (vv => k + ": " + vv) : [k + ": " + v]), Array ());
  system_info ("status", util_date_str_yyyymmddhhmmss (), m);
}
function __system_store (s, f) {
  store_inc ("system", "functions", "store");
  if (s == "OK") s = undefined;
  var t = {}; Object.entries (store_lst ()).forEach (([k, v]) => util_tree_push (t, util_str_split (k, ";"), util_str_isnum (v) ? (v * 1.0) : v));
  var r = util_tree_flat (t, ",").map (v => [v.n, v.v]).concat ([[ "_current", util_date_str_ISO () ]]);
  if (!util_is_nullOrZero (s) && !util_is_nullOrZero (s = s.split (";"))) r = r.filter (rr => s.some (ss => rr [0].startsWith (ss)));
  if (!util_is_nullOrZero (f) && !util_is_nullOrZero (f = f.split (";"))) r = r.filter (rr => ! f.some (ff => rr [0].startsWith (ff)));
  return r.sort ((a, b) => (a [0] == b [0]) ? 0 : ((a [0] < b [0]) ? -1 : 1));
}
function __system_store_reset () {
  system_info ("store", "reset, was: " + store_get ("_started") + " @ " + util_str_niceNum (store_len ()));
  store_rst ();
  store_set (util_date_str_ISO (), "_started");
  return "OK";
}
function __system_setup (user, info) {
  var setup_functions = util_function_find (v => !v.startsWith ("__") && !v.startsWith ("system") && v.endsWith ("_setup"));
  setup_functions.forEach (util_function_call);
  user = "opened by " + (util_is_nullOrZero (user) ? "(unknown)" : user);
  system_info ("setup", user, info);
  system_debug ("setup", "using, " + util_str_join (setup_functions.map (v => v.replace ("_setup", "")), ", "));

  __system_timer_setup (timer_createMinutes, "__system_logger", 1);
  __system_timer_setup (timer_createMinutes, "__system_runner", 1);
  __system_timer_setup (timer_createHours,   "__system_status", 6);
  __system_timer_setup (timer_createHours,   "__system_checks", 1);
  __system_timer_setup (timer_createWeekly,  "__system_backup", ScriptApp.WeekDay.SATURDAY, 1);

  if (!store_get ("_started"))
    store_rst (), store_set (util_date_str_ISO (), "_started");
  store_inc ("system", "functions", "setup");
}

function __system_timer_setup (f, n, a, b, c) {
  if (f (n, a, b, c) == true) system_error ("timer", "for '" + n + "' did not exist, will be created"); }

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __stg_clr (p, s)     { var v = p.getProperties (), l = 0; for (var k in v) if (util_str_isprefix (k, s)) { p.deleteProperty (k); l += 1; }; return l; }
function __stg_len (p, s)     { var v = p.getProperties (), l = 0; for (var k in v) if (util_str_isprefix (k, s)) { l += (k.length + v [k].length) }; return l; }
function __stg_cnt (p, s)     { var v = p.getProperties (), l = 0; for (var k in v) if (util_str_isprefix (k, s)) { l ++ }; return l; }
function __stg_rst (p)        { p.deleteAllProperties (); }

// -----------------------------------------------------------------------------------------------------------------------------------------

var CACHE_TIME_INF = (60*60*24*365);
var CACHE_TIME_28D = (60*60*24*28);
var CACHE_TIME_7D = (60*60*24*7);
var CACHE_TIME_24H = (60*60*24);
var CACHE_TIME_12H = (60*60*12);
var CACHE_TIME_6H = (60*60*6);
var CACHE_TIME_4H = (60*60*4);
var CACHE_TIME_2H = (60*60*2);
var CACHE_TIME_1H = (60*60);
var CACHE_TIME_30M = (30*60);
var CACHE_TIME_15M = (15*60);
var CACHE_TIME_5M = (5*60);
var CACHE_TIME_2M = (2*60);
var CACHE_TIME_1M = (1*60);
var CACHE_TIME_30S = (30);
var CACHE_TIME_0 = 0;

var __c_p = PropertiesService.getScriptProperties ();
function __c_n (k, x)             { return "C" + ((k == undefined) ? "" : (x + "_" + k)); }
function __c_m (k, s)             { return util_str_isprefix (k, __c_n (s, "V")); }
function __c_x (k, s)             { return util_str_isprefix (k, __c_n (s, "T")); }
function __c_t (t)                { return t == undefined ? 0 : (((new Date ()).getTime () - t) / 1000); }
function __c_v (t, s)             { return (s == undefined || s >= CACHE_TIME_INF || (t != undefined && ((((new Date ()).getTime () - t) / 1000) < s))); }
function cache_read (k, s)        { return __c_v (__c_p.getProperty (__c_n (k, "T")) * 1.0, s) ? __c_p.getProperty (__c_n (k, "V")) : undefined; }
function cache_write (k, v)       { __c_p.setProperty (__c_n (k, "T"), (new Date ()).getTime ()).setProperty (__c_n (k, "V"), v); return true; }
function cache_del (k)            { __c_p.deleteProperty (__c_n (k, "T")).deleteProperty (__c_n (k, "V")); }
function cache_lst (s)            { var v = __c_p.getProperties (), r = Array (); for (var k in v) if (__c_m (k, s)) r.push ({k: util_str_substr (k, 3), v: v [k]}); return r; }
function cache_clr (k)            { return __stg_clr (__c_p, __c_n (k, "T")) + __stg_clr (__c_p, __c_n (k, "V")); }
function cache_rst ()             { return __stg_clr (__c_p, __c_n ()); }
function cache_len ()             { return __stg_len (__c_p, __c_n ()); }
function cache_kil ()             { return __stg_rst (__c_p); }
function cache_cnt ()             { return __stg_cnt (__c_p, __c_n ()); }

function cache_expired (k, s)     { return !__c_v (__c_p.getProperty (__c_n (k, "T")) * 1.0, s); }
function cache_duration (k, s)    { return __c_t (__c_p.getProperty (__c_n (k, "T")) * 1.0); }
function cache_timestamp (k)      { var t = __c_p.getProperty (__c_n (k, "T")); return (t == undefined) ? "none" : util_date_str_ISO (t * 1.0); }
function cache_readWithLZ (k, s)  { var x = cache_read (k, s); if (x != undefined) return LZString.decompressFromUTF16 (x); }
function cache_writeWithLZ (k, v) { if (v != undefined) v = LZString.compressToUTF16 (v); cache_write (k, v); }
function cache_times (s)          { var v = __c_p.getProperties (), r = Array (); for (var k in v) if (__c_x (k, s)) r.push (v [k]); return r; }
function cache_time (k)           { var t = __c_p.getProperty (__c_n (k, "T")); return (t == undefined) ? undefined : t * 1.0; }

// -----------------------------------------------------------------------------------------------------------------------------------------

var __q_p = PropertiesService.getDocumentProperties ();
function __q_n (i, s)             { return "Q" + ((i == undefined) ? "" : (i + ((s == undefined) ? "" : ("_" + s + "_")))); }
function queue_pop_n (i, s)       { var c = __q_p.getProperty (__q_n (i, s)); c = (c == undefined) ? 1 : c * 1.0; __q_p.setProperty (__q_n (i, s), (c == 9999999) ? 1 : c + 1.0); return c; }
function queue_get_n (i, s)       { var c = __q_p.getProperty (__q_n (i, s)); return (c == undefined) ? 1 : c * 1.0; }
function queue_set_n (i, s, c)    { c = (c == 9999999) ? 1 : c + 1.0; __q_p.setProperty (__q_n (i, s), c); return c; }
function queue_pop_c (i, c)       { var m = __q_p.getProperty (__q_n (i, "#_" + c)); __q_p.deleteProperty (__q_n (i, "#_" + c)); return m == undefined ? m : JSON.parse (m); }
function queue_set_c (i, c, m)    { if (m == undefined) return false; __q_p.setProperty (__q_n (i, "#_" + c), JSON.stringify (m)); return true; }
function queue_rst (i)            { return __stg_clr (__q_p, __q_n (i)); }
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
function store_sum (i, j, k, l)   { var v = __s_p.getProperties (); return Object.keys (v).reduce ((z, y) => __s_z2 (z, y, __s_n (i, j, k, l), v), 0); }
function store_lst (i, j, k, l)   { var v = __s_p.getProperties (); return Object.keys (v).reduce ((z, y) => __s_z1 (z, y, __s_n (i, j, k, l), v), {}); }
function store_clr (i, j, k, l)   { return __stg_clr (__s_p, __s_n (i, j, k, l)); }
function store_rst (i, j, k, l)   { return __stg_clr (__s_p, __s_n (i, j, k, l)); }
function store_len ()             { return __stg_len (__s_p, __s_n ()); }
function store_cnt ()             { return __stg_cnt (__s_p, __s_n ()); }


// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function data_cache_gets (n, compressed = true) {
  var c = CacheService.getScriptCache (), k = c.get ("C1/L/" + n); if (k == null || (k * 1.0) == 0) return undefined;
  var b = c.getAll (k = Array.from ({ length: k }, (v, i) => "C1/D/" + n + "/" + i));
  return compressed ? LZString.decompressFromUTF16 (k.map (x => b [x]).join ("")) : k.map (x => b [x]).join ("");
}
function data_cache_puts (n, s, compressed = true, t = 21600) {
  var c = CacheService.getScriptCache (), b = util_str_chunk (compressed ? LZString.compressToUTF16 (s) : s, (100*1000)-1), k = Array.from ({ length: b.length }, (v, i) => "C1/D/" + n + "/" + i);
  c.put ("C1/L/" + n, b.length, t), c.putAll (k.reduce ((p, v, i) => { p [v] = b [i]; return p; }, {}), t);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __t_n (f) { return ScriptApp.newTrigger (f).timeBased (); }
function __t_e (f) { var t = ScriptApp.getProjectTriggers (); for (var i in t) if (t [i].getHandlerFunction () == f) return true; return false; }
function timer_create (f, n = 1) { return __t_n (f).after (n).create ().getUniqueId (); }
function timer_createMinutes (f, n) { if (!__t_e (f)) { __t_n (f).everyMinutes (n).create (); return true; } return false; }
function timer_createHours (f, n) { if (!__t_e (f)) { __t_n (f).everyHours (n).create (); return true; } return false; }
function timer_createDaily (f, h, m) { if (!__t_e (f)) { __t_n (f).everyDays (1).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_createWeekly (f, n, h, m) { if (!__t_e (f)) { __t_n (f).onWeekDay (n).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_createMonthly (f, n, h, m) { if (!__t_e (f)) { __t_n (f).onMonthDay (n).atHour (h).nearMinute ((m == undefined) ? 15 : m).inTimezone ("UTC").create (); return true; } return false; }
function timer_delete (id) { ScriptApp.getProjectTriggers().forEach (t => { if (t.getUniqueId () == id) ScriptApp.deleteTrigger (t); }); }
function timer_cnt () { var t = ScriptApp.getProjectTriggers (); return t.length; }

// -----------------------------------------------------------------------------------------------------------------------------------------

var __system_schedule_prefix = "SCHD_";
function __system_schedule_key (t) { return __system_schedule_prefix + t; }

function __system_schedule_push (callback) {
  if (!util_function_exists (callback)) system_error_throw ("scheduler", "invalid callback: " + callback);
  util_lock_wrapper ("Script", util_lock_seconds (30), () => {
    var queue = cache_read (__system_schedule_key ("queue"));
    cache_write (__system_schedule_key ("queue"), util_is_nullOrZero (queue) ? callback : (queue + "," + callback));
    store_inc ("system", "schedule", "push");
  });
}
function __system_schedule_pull () {
  return util_lock_wrapper ("Script", util_lock_seconds (30), () => {
    var queue = cache_read (__system_schedule_key ("queue")), callback = undefined;
    if (!util_is_nullOrZero (queue)) {
      callback = (queue = queue.split (",")) [0];
      cache_write (__system_schedule_key ("queue"), queue.slice (1).join (","));
      store_inc ("system", "schedule", "pull");
    }
    return callback;
  });
}
function __system_schedule_size () {
  return util_lock_wrapper ("Script", util_lock_seconds (30), () => {
    var queue = cache_read (__system_schedule_key ("queue"));
    return (util_is_nullOrZero (queue)) ? 0 : queue.split (",").length;
  });
}
function __system_schedule_exec (complete_f) {
  var complete, callback, called = Array ();
  store_inc ("system", "schedule", "exec");
  while (!(complete = complete_f ()) && !util_is_null (callback = __system_schedule_pull ()))
    util_function_call (callback), called.push (callback);
  if (called.length > 0) system_debug ("schedule", "yielded: " + complete + ", called (" + called.length + "/" + __system_schedule_size () + "), " + called.join (", "));
  return complete;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function system_schedule (callback) {
  return __system_schedule_push (callback);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

// XXX FIX

function handler_cnt () {
  return cache_lst (__run_prefix).length + cache_lst (__web_prefix).length;
}
function handler_str () {
  return "run:" + cache_lst (__run_prefix).length + "/web:" + cache_lst (__web_prefix).length;
}

// XXX should be merged and made generic
var __web_prefix = "WEBH_";
function __web_hKey (t) { return __web_prefix + t; }
function __web_hGet (t) { var h = cache_read (__web_hKey (t)); return (!util_is_nullOrZero (h)) ? JSON.parse (h) : Array (); }
function __web_hSet (t, h) { cache_write (__web_hKey (t), JSON.stringify (h)); }
function __web_hItr (f, x) { return cache_lst (__web_prefix).reduce (f, x); }
function __web_hRun (v, t, e) { return (!util_is_nullOrZero (v) && util_function_call (v, t, e)) ? 1 : 0 }
function web_handlerReset () { return __web_hItr ((p, v) => { cache_del (v.k); return p + 1; }, 0); }
function web_handlerCollect () { return __web_hItr ((p, v) => util_push (p, { k: util_str_remove (v.k, __web_hKey ("")), v: JSON.parse (v.v) }), Array ()); }
function web_handlerInsert (t, f) { store_inc ("system", "handler", "web", "insert"); var h = __web_hGet (t); if (! h.includes (f)) { h.push (f); __web_hSet (t, h); } }
function web_handlerRemove (t, f) { store_inc ("system", "handler", "web", "remove"); var h = __web_hGet (t); if (h.includes (f)) { h.splice (h.indexOf (f), 1);  __web_hSet (t, h); } }
function web_handlerIterate (t, e) {
  store_inc ("system", "handler", "web", "iterate");
  return __web_hGet (t).reduce ((p, v) => {
    return util_exception_wrapper (
      function () {
        if (!util_function_exists (v)) {
          system_debug ("web", "handler [" + t + ", " + v + "], pruned");
          web_handlerRemove (t, v);
          return p;
        } else
        return p + __web_hRun (v, t, e);
      },
      function (e) {
        system_error ("web", "handler [" + t + ", " + v + "], exception", util_str_error (e)); return p;
      });
  }, 0);
}
function web_handlerDebug () { return __web_hGet ("post").length + __web_hGet ("get").length; }

var __run_prefix = "RUNH_";
function __run_hKey (t) { return __run_prefix + t; }
function __run_hGet (t) { var h = cache_read (__run_hKey (t)); return (!util_is_nullOrZero (h)) ? JSON.parse (h) : Array (); }
function __run_hSet (t, h) { cache_write (__run_hKey (t), JSON.stringify (h)); }
function __run_hItr (f, x) { return cache_lst (__run_prefix).reduce (f, x); }
function __run_hRun (v, t, e) { return (!util_is_nullOrZero (v) && util_function_call (v, t)) ? 1 : 0 }
function run_handlerReset () { return __run_hItr ((p, v) => { cache_del (v.k); return p + 1; }, 0); }
function run_handlerCollect () { return __run_hItr ((p, v) => util_push (p, { k: util_str_remove (v.k, __run_hKey ("")), v: JSON.parse (v.v) }), Array ()); }
function run_handlerInsert (t, f) { var h = __run_hGet (t); if (! h.includes (f)) { h.push (f); __run_hSet (t, h); } }
function run_handlerRemove (t, f) { var h = __run_hGet (t); if (h.includes (f)) { h.splice (h.indexOf (f), 1);  __run_hSet (t, h); } }
function run_handlerIterate (t) {
  store_inc ("system", "handler", "runner", "iterate");
  return __run_hGet (t).reduce ((p, v) => {
    return util_exception_wrapper (
      function () {
        if (!util_function_exists (v)) {
          system_debug ("run", "handler [" + t + ", " + v + "], pruned");
          run_handlerRemove (t, v);
          return p;
        } else
          return p + __run_hRun (v, t);
      },
      function (e) {
        system_error ("run", "handler [" + t + ", " + v + "], exception", util_str_error (e)); return p;
      });
  }, 0);
}
function run_handlerDebug () { return __run_hItr ((p, v) => { p [0] ++; p [1] += JSON.parse (v.v).length; return p; }, [0, 0]); }

// -----------------------------------------------------------------------------------------------------------------------------------------

function handler_debug (prefix) { var h = undefined;
  if (prefix == "web") h = web_handlerCollect (); else if (prefix == "run") h = run_handlerCollect (); else return;
  h.map (v => prefix + ":" + v.k + " --> " + util_str_join (v.v, ", ")).sort ().reverse ().forEach (debugLog);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function connect_cnt () {
  return Object.values (store_lst ("system", "cache", "connect")).length;
}
function connect_len () {
  return Object.values (store_lst ("system", "cache", "connect")).reduce ((p, v) => p + (v * 1.0), 0);
}

function __connect_urlResponse (n, u, o, z) {
  o.muteHttpExceptions = true;
  debugLog (z + ": " + n + " --> " + u + " opts: " + JSON.stringify (o));
  var r = UrlFetchApp.fetch (u, o);
  debugLog ("--> " + r.getResponseCode ());
  if (r == undefined || (r.getResponseCode () != 200 && r.getResponseCode () != 201 && r.getResponseCode () != 204))
    return system_error_throw (n, "HTTP transport error (#" + r.getResponseCode () + "): " + u,
      "HEAD: " + util_str_presentable (JSON.stringify (r.getAllHeaders ()), 128) + ", BODY: " + util_str_presentable (r.getContentText (), 128)); // does not return
  return r;
}

function connect_urlRawResponse (n, u, o) {
  store_inc ("system", "connect", "raw-" + util_str_lower (o.method), util_str_isolateURI (u));
  var r = __connect_urlResponse (n, u, o, "connect_urlRawResponse");
  if (r.getResponseCode () == 204)
    return "";
  debugLog ("["+(r.getContentText ().length)+"]" + util_str_presentable (r.getContentText (), 128));
  return r.getContentText ();
}

function connect_urlJsonResponse (n, u, o) {
  store_inc ("system", "connect", "jsn-" + util_str_lower (o.method), util_str_isolateURI (u));
  var r = __connect_urlResponse (n, u, o, "connect_urlJsonResponse");
  if (r.getResponseCode () == 204)
    return "";
  debugLog ("["+(r.getContentText ().length)+"] " + r.getContentText ().slice (0, 128) + " ...");
  var d = JSON.parse (r.getContentText ());
  if (d == undefined)
    return system_error_throw (n, "JSON parser error: " + u, util_str_presentable (r.getContentText (), 128)); // does not return
  return d;
}

function connect_urlXmlResponse (n, u) {
  store_inc ("system", "connect", "xml-get", util_str_isolateURI (u));
  var r = __connect_urlResponse (n, u, { }, "connect_urlXmlResponse");
  if (!(util_str_index (r.getContentText (), "<") >= 0 || util_str_index (r.getContentText (), ">") >= 0))
    return system_error_throw (n, "XML response is not XML: " + u, util_str_presentable (r.getContentText (), 128)); // does not return
  debugLog ("["+(r.getContentText ().length)+"] " + r.getContentText ().slice (0, 128) + " ...");
  var d = XmlService.parse (r.getContentText ());
  if (d == undefined || d.getRootElement () == undefined)
    return system_error_throw (n, "XML parser error: " + u, util_str_presentable (r.getContentText (), 128)); // does not return
  return d.getRootElement ();
}

function connect_urlCachableResponse (name, url, timeout, forced = false) {
  var data, uri = util_str_isolateURI (url);
  if (forced == false && (data = data_cache_gets (uri, true)) != undefined) {
    store_inc ("system", "connect", "cache-get", uri);
  } else {
    data_cache_puts (uri, data = __connect_urlResponse (name, url, {}, "connect_urlCachableResponse").getContentText (), true, timeout);
    store_inc ("system", "connect", "cache-new", uri);
    store_set (data.length, "system", "cache", "connect", uri);
  }
  return data;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __log_queue = "au", __log_sheet = "!", __log_col_beg = "A", __log_col_end = "D",  __log_row = 10, __log_size = 40, __log_sheet_ref = undefined;

function __log_sheet_load () {
  __log_sheet_ref = SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (__log_sheet);
}
function __log_queueClear () {
  queue_rst (__log_queue);
}
function __log_queueAppend (m) { // could be an issue with concurrent processes ... should have a lock here
  if (!util_is_nullOrZero (m)) queue_set_c (__log_queue, queue_pop_n (__log_queue, "W"), m);
}
function __log_queueObtain () {
  var cr = queue_get_n (__log_queue, "R"), m = Array ();
  while (cr < queue_get_n (__log_queue, "W")) { var mm = queue_pop_c (__log_queue, cr); cr = queue_set_n (__log_queue, "R", cr); if (!util_is_nullOrZero (mm)) m.unshift (mm); }
  return m;
}
function __log_queueProcess () { if (__log_sheet_ref == undefined) __log_sheet_load ();
  var m = __log_queueObtain (); if (util_is_nullOrZero (m)) return 0;
  util_sheet_rowPushAndHide (__log_sheet_ref, __log_row, __log_col_beg + __log_row + ":" + __log_col_end + ((__log_row - 1) + m.length), __log_size, m);
  return m.length;
}
function __log_queueTrim (n) { if (__log_sheet_ref == undefined) __log_sheet_load ();
  util_sheet_rowPrune (__log_sheet_ref, n);
}
function __log_queuePending () {
  return queue_get_n (__log_queue, "W") - queue_get_n (__log_queue, "R");
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var log_suspend = false;

function log_cnt () { if (__log_sheet_ref == undefined) __log_sheet_load ();
  return __log_sheet_ref.getLastRow () - 1;
}
function log_len () {
  return __log_queuePending ();
}
function log_str () {
  return (log_suspend ? "suspended" : "operating");
}
function log_reduce () {
  __log_queueTrim (__log_size);
}
function log_flush () {
  __log_queueProcess ();
}
function log_process () {
  var number = (!log_suspend) ? __log_queueProcess () : 0;
  store_inc ("system", "logger", "process");
  if (!util_is_null (number) && number > 0) store_add (number, "system", "logger", "volume");
}
function log (a, b, c) {
  if (Array.isArray (b)) b.forEach (bb => __log_queueAppend ([ util_date_str_yyyymmddhhmmss (), (a && (bb || c)) ? a : "", (bb && (a && c)) ? bb : "", (c) ? c : ((bb) ? bb : ((a) ? a : "")) ]));
  if (Array.isArray (c)) c.forEach (cc => __log_queueAppend ([ util_date_str_yyyymmddhhmmss (), (a && (b || cc)) ? a : "", (b && (a && cc)) ? b : "", (cc) ? cc : ((b) ? b : ((a) ? a : "")) ]));
  __log_queueAppend ([ util_date_str_yyyymmddhhmmss (), (a && (b || c)) ? a : "", (b && (a && c)) ? b : "", (c) ? c : ((b) ? b : ((a) ? a : "")) ]);
}

function __system_logger () {
  log_process ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __runner_function = "__system_schedule_exec";
var __runner_timeExpire = 5*60;
var __runner_timeAbort = 7*60;

// -----------------------------------------------------------------------------------------------------------------------------------------

function runner_suspend (desired, source = undefined) {
  var current = store_get ("system", "state", "suspended") == undefined ? false : true;
  if (current == desired) return;
  var mode = (desired == true) ? "suspended" : "resumed", message = source ? [ source ] : Array ();
  if (desired == true)
    store_set (util_date_str_ISO (), "system", "state", "suspended");
  else if (desired == false) {
    var suspended = store_get ("system", "state", "suspended"); store_clr ("system", "state", "suspended");
    if (suspended) message.push ("after " + util_str_niceSecsAsDays (util_date_timeSecsToNow ((new Date (suspended)).getTime ())));
  }
  system_info ("runner", mode + (message.length > 0 ? ": " : "") + message.join (", "));
  store_inc ("system", "runner", mode);
}
function runner_suspend_wrapper (f, r) {
  var x = runner_suspended ();
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
  var timestart = store_get ("system", "state", "start-time");
  if (timestart == undefined) return true;
  var duration = util_date_timeSecsToNow (timestart);
  if (duration >= __runner_timeExpire) return true;
  if (store_get ("system", "state", "suspended") != undefined) return true;
  return false;
}
function __runner_start () {
  var started = util_lock_wrapper ("Script", util_lock_seconds (30), () => {
    var timestart = store_get ("system", "state", "start-time");
    if (timestart != undefined && (util_date_timeSecsToNow (timestart) < __runner_timeAbort)) return false;
    if (timestart != undefined) {
      store_clr ("system", "state", "start-time");
      store_inc ("system", "runner", "cancelled");
      system_error ("runner", "cancelled");
    }
    store_set ((new Date ()).getTime (), "system", "state", "start-time");
    return true;
  });
  if (started == true)
    store_inc ("system", "runner", "started");
  return started;
}
function __runner_end (t, m) {
  var timestart = store_get ("system", "state", "start-time"), duration = 0;
  if (timestart != undefined) {
    store_clr ("system", "state", "start-time");
    duration = util_date_timeSecsToNow (timestart);
  }
//  system_debug ("runner", t + ": at " + duration + " seconds (" + util_str_niceSecsAsDays (duration) + ")" + (m ? ", " + m : ""));
  store_inc ("system", "runner", t);
}
function __runner_execute () {
  try {
    if (!__runner_start ())
      return false;
    var ran = this [__runner_function] (__runner_isdone);
    __runner_end ("completed", "ran " + ran + (ran == false ? " (no-respawn)" : ""));
    return ran;
  } catch (e) {
    __runner_end ("aborted", util_str_error (e));
    system_error ("runner", "aborted", util_str_error (e));
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
  if (e != undefined) timer_delete (e.triggerUid);
  __system_runner ();
}
function __system_runner () {
  if (runner_suspended () == false)
    if (__runner_execute () == true)
      timer_create ("__system_respawn");
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function config_match (c, i, q) {
  return Object.values (c).find (x => (!util_is_nullOrZero (x [i]) && (util_is_null (q) || q == x [i])));
}
function config_find (c, i, s) {
  var x = Object.keys (c).find (x => (!util_is_nullOrZero (c [x][i]) && (util_is_null (s) || s == x))); return util_is_nullOrZero (x) ? x : c [x][i];
}
function config_exec (c, f, i, s, o) {
  function __match (a, b) { return (util_is_null (a) || (!util_is_null (o) && !util_is_null (o.use_regex)) ? (new RegExp (a)).test (b) : a == b); }
  return util_array_runnerY (a => Object.keys (c).filter (x => (!util_is_nullOrZero (c [x][i]) && __match (a, x))).reduce ((p, x) => util_push (p, f (x, c [x], i, c [x][i])), Array ()), s);
}
function config_exec2 (c, f, i, s, o) {
  function __match (a, b) { return (util_is_null (a) || (!util_is_null (o) && !util_is_null (o.use_regex)) ? (new RegExp (a)).test (b) : a == b); }
  return util_array_runnerY (a => Object.keys (c).filter (x => (!util_is_nullOrZero (c [x][i]) && __match (a, x))).reduce ((p, x) =>
    { var r = f (x, c [x], i, c [x][i]); if (!util_is_null (r)) p.push (r); return p; }, Array ()), s);
}
function config_cnt () {
  return Object.keys (config_data ()).length;
}
function config_len () {
  return JSON.stringify (config_data ()).length;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __TEST_SETUP () {
  debugLog_Set (true);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var __debugLog_Level = false;
function debugLog_Get () {
  return __debugLog_Level;
}
function debugLog_Set (x) {
  __debugLog_Level = (x > 0) ? true : false;
}
function debugLog (x) {
  if (__debugLog_Level == true)
    Logger.log (x);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __API_URL_BASE_GOOGLESCRIPTAPI_PROJECTS = "https://script.googleapis.com/v1/projects/";

function __system_deployments_execute (s, p) {
  var r = connect_urlJsonResponse ("system",
    __API_URL_BASE_GOOGLESCRIPTAPI_PROJECTS + ScriptApp.getScriptId () + "/deployments?pageSize=50" + (!util_is_nullOrZero (p) ? "&pageToken=" + p : ""),
    { method: "GET", headers: { "Authorization": "Bearer " + s.getAccessToken () }, contentType: "application/json" });
  var d = r.deployments.filter (v => v.entryPoints.some (vv => vv.entryPointType == "WEB_APP"));
  return util_is_nullOrZero (r.nextPageToken) ? d : util_concat (d, __system_deployments_execute (s, r.nextPageToken));
}
function system_deployments () {
  store_inc ("system", "deployments");
  return util_exception_wrapper (() => __system_deployments_execute (__system_serviceScriptAPI ()), e => Array ());
}
/*function __system_execution_data () { // XXX TODO ... need permissions
  var r = connect_urlJsonResponse ("system",
    __API_URL_BASE_GOOGLESCRIPTAPI_PROJECTS + ScriptApp.getScriptId () + "/metrics?metricsGranularity=DAILY",
    { method: "GET", headers: { "Authorization": "Bearer " + __system_serviceScriptAPI ().getAccessToken () }, contentType: "application/json" });
}*/

function __system_serviceScriptAPI () {
  return OAuth2.createService ('script_api')
    .setTokenUrl ('https://oauth2.googleapis.com/token')
    .setPrivateKey (__APP_SERVICE_PRIVATE_KEY)
    .setIssuer (__APP_SERVICE_CLIENT_EMAIL)
    .setPropertyStore (PropertiesService.getScriptProperties ())
    .setScope ('https://www.googleapis.com/auth/script.deployments')
    .setScope ('https://www.googleapis.com/auth/script.metrics');
}

function deployments_cnt () {
  return system_deployments ().length;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function onOpen2 (e) { // setup to run from a trigger, not otherwise
  util_exception_wrapper (() => { __system_setup (util_appscript_make_user (e), util_appscript_make_info (e)); },
    (e) => { system_error ("onOpen", "exception", util_str_error (e)); });
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function doGet (e) {
  function __l (e) { return (e.pathInfo ? e.pathInfo : "") + (e.queryString ? ("?" + e.queryString) : "") + (e.contentLength && e.contentLength >= 0 ? "[" + e.contentLength + "]" : ""); }
  system_debug ("web", "Web GET: " + __l (e), JSON.stringify (e));
  store_inc ("system", "web", "get");
  if (web_handlerIterate ('get', e) == 0) {
    system_error ("web", "Web GET: handler not found", JSON.stringify (e));
    return ContentService.createTextOutput (JSON.stringify ({ status: 'Forbidden', statusCode: 404, message : 'Not found' }));
  }
  return HtmlService.createHtmlOutput();
}

function doPost (e) {
  function __l (e) { return (e.pathInfo ? e.pathInfo : "") + (e.queryString ? ("?" + e.queryString) : "") + (e.contentLength && e.contentLength >= 0 ? "[" + e.contentLength + "]" : ""); }
  system_debug ("web", "Web POST: " + __l (e), JSON.stringify (e));
  store_inc ("system", "web", "post");
  if (web_handlerIterate ('post', e) == 0) {
    system_error ("web", "Web POST: handler not found" , JSON.stringify (e));
    return ContentService.createTextOutput (JSON.stringify ({ status: 'Forbidden', statusCode: 404, message : 'Not found' }));
  }
  return HtmlService.createHtmlOutput();
}

function system_register_postHandler (f) {
  web_handlerInsert ('post', f);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
