
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function system_debug () {
  Logger.log (__system_diagnostics ());
  __system_check ();
}

function system_report () {
  return { "system": __system_diagnostics () };
}

function system_setup (user, info) {
  var setup_functions = util_function_find (v => (v != "system_setup" && v.endsWith ("_setup")));
  setup_functions.forEach (util_function_call);
  var m = "opened by " + (util_is_nullOrZero (user) ? "(unknown)" : user) + " with " + (util_is_nullOrZero (info) ? "(unknown)" : info) ;
  log ("system", m + " [" + ScriptApp.getScriptId () + "]"); system_report_info ("system", m);
  log ("system", "setup: " + setup_functions.map (v => v.replace ("_setup", "")).join (", "));

  function __timer_setup (f, n, a, b, c) { if (f (n, a, b, c) == true) log ("system", "Timer for '" + n + "' did not exist, will be created"); }
  __timer_setup (timer_createMinutes, "runEveryMinute", 1);
  __timer_setup (timer_createHours, "runEveryHour", 1);
  __timer_setup (timer_createDaily, "runEveryDayAt5am", 5, 0);
  __timer_setup (timer_createWeekly, "runEveryWeekOnSaturday", ScriptApp.WeekDay.SATURDAY, 6);
  __timer_setup (timer_createWeekly, "runEveryWeekOnTuesday", ScriptApp.WeekDay.TUESDAY, 6);
  __timer_setup (timer_createMonthly, "runEveryMonth", 3, 6);
  __timer_setup (timer_createMinutes, "__system_runner", 1);
  __timer_setup (timer_createHours, "__system_check", 1);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// XXX refactor

function __system_diagnostics () {
  return __system_modules_names.map (v =>
    v + ": " + util_function_call (v + "_cnt") + (util_function_exists (v + "_len") ? "/" + util_function_call (v + "_len") : "")
                + (util_function_exists (v + "_str") ? "/" + util_function_call (v + "_str") : "")
  ).join (", ");
}

var WARNING_SIZE_STORAGE  = (512*1024)*(2/3);   // 2/3 of property storage size
var WARNING_SIZE_CONNECT  = 25*1000;            // 25K per day, can go 100K on enterprise
var WARNING_SIZE_LOG      = 75*1000;            // too many log lines
var WARNING_SIZE_TIMER    = 15;                 // 20 is system limit

var __system_modules_names = [ "queue", "store", "timer", "log", "runner" ];
function __system_modules () { return {
    storage: { limit: Math.floor (WARNING_SIZE_STORAGE), size: () => queue_len () + store_len () },
    connect: { limit: WARNING_SIZE_CONNECT, size: () => { var d = util_date_str_yyyymmdd (); return store_get ("url", util_str_substr (d, 0, 7), util_str_substr (d, 8, 2)) * 1.0; } },
    log: { limit: WARNING_SIZE_LOG, size: log_cnt },
    timer: { limit: WARNING_SIZE_TIMER, size: timer_cnt },
  };
}

function __system_check () {
  Object.entries (__system_modules ()).forEach (([n, d]) => {
    var size = d.size (), limit = d.limit; if (size > limit)
      system_report_error ("<b>warning -- " + n + " at '" + size + "', threshold '" + limit + "'</b>", "<pre>" + __system_diagnostics () + "</pre>");
  });
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

/*

Server side Google Apps Script is not asynchronous. It doesn't even have a setTimeout function, but it does syntactically support Promises,
so to make all this work all we have to do is to provide a sleep function (which is synchronous), and tell rottle you're working in synchronous mode

  const ms = Rottle.ms
  const rot = new Rottle ({
    period: ms('minute'),
    rate: 10,
    delay: ms('seconds', 2),
    sleep: Utilities.sleep,
    synch: true
  })

because Apps Script is synchronous and single threaded you can just do this

  rot.rottle()
  const result = UrlFetchApp.fetch(url)

or if you prefer

  Utilities.sleep (rot.waitTime())
  rot.use()
  const result = UrlFetchApp.fetch(url)

*/

function __url_fetch (u) {
  const __day = util_date_arr_yyyymmdd (), d_i = __day [0] + "-" + __day [1], d_j = (__day [2] < 10) ? "0" + __day [2] : __day [2];
  try {
    store_inc ("url", d_i, d_j);
    var r = UrlFetchApp.fetch (u);
/*    if (r == undefined || r.getResponseCode () == 404)
      throw (" ... no response, or 404 error");
    if (r.getResponseCode () >= 500 && r.getResponseCode () <= 599)
      throw (" ... 50x error");*/
    return r.getContentText ();
  } catch (e) {
    throw "connect_url: " + util_str_error (e);
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __log_queue = "zz", __log_sheet = "#", __log_col_start = "A", __log_col_end = "C", __log_row = 4, __log_size = 35, __log_sheet_ref = undefined;

function __log_sheet_load () {
  if (__log_sheet_ref == undefined) __log_sheet_ref = SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (__log_sheet);
}
function __log_queueClear () {
  queue_rst (__log_queue);
}
function __log_queueAppend (m) {
  if (!util_is_nullOrZero (m)) queue_set_c (__log_queue, queue_pop_n (__log_queue, "W"), m);
}
function __log_queueWriter (f) {
  var cr = queue_get_n (__log_queue, "R"), m = Array ();
  while (cr < queue_get_n (__log_queue, "W")) { var mm = queue_pop_c (__log_queue, cr); cr = queue_set_n (__log_queue, "R", cr); if (!util_is_nullOrZero (mm)) m.push (mm); }
  if (m.length > 0) f (m);
}
function __log_queueProcess () { __log_sheet_load ();
  __log_queueWriter (m => util_sheet_rowPushAndHide (__log_sheet_ref, __log_row, __log_col_start + __log_row + ":" + __log_col_end + (__log_row + m.length - 1), __log_size, m.reverse ()));
}
function __log_queueTrim (n) { __log_sheet_load ();
  util_sheet_rowPrune (__log_sheet_ref, n);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var log_suspend = false;

function log_cnt () { __log_sheet_load ();
  return __log_sheet_ref.getLastRow () - 1;
}
function log_reduce () {
  __log_queueTrim (__log_size);
}
function log_flush () {
  __log_queueProcess ();
}
function log_process () {
  util_lock_wrapper ("Document", util_lock_seconds (0), () => { if (!log_suspend) __log_queueProcess (); });
}
function log (x, m) {
  if (Array.isArray (m)) m.forEach (mm => __log_queueAppend ([ util_date_str_yyyymmddhhmmss (), x, mm ]));
  else __log_queueAppend ([ util_date_str_yyyymmddhhmmss (), x, m ]);
}
function log_str () {
  return (log_suspend ? "suspended" : "operating");
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __system_report_name = APPLICATION_USER_TELEGRAM;

function system_report_info (t, m) {
  telegram_messageTransmit (__system_report_name, "<b>" + APPLICATION_NAME + "\n" + t + "</b>\n" + m);
}
function system_report_error (t, m) {
  telegram_messageTransmit (__system_report_name, "<b>" + APPLICATION_NAME + "\n" + t + "</b>\n" + m);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function STORE_LIST (s, f) {
  var l = store_lst ();
  var t = {}; Object.entries (l).forEach (([k, v]) => util_tree_push (t, util_str_split (k, ";"), util_str_isnum (v) ? (v * 1.0) : v));
  var r = util_tree_flat (t, ",").map (v => [v.n, v.v]).concat ([[ "_current", util_date_str_ISO () ]]);
  if (!util_is_nullOrZero (s) && !util_is_nullOrZero (s = s.split (";"))) r = r.filter (rr => s.some (ss => rr [0].startsWith (ss)));
  if (!util_is_nullOrZero (f) && !util_is_nullOrZero (f = f.split (";"))) r = r.filter (rr => ! f.some (ff => rr [0].startsWith (ff)));
  return r.sort ((a, b) => (a [0] == b [0]) ? 0 : ((a [0] < b [0]) ? -1 : 1));
}
function STORE_RESET () {
  log ("system", "store reset");
  store_rst ();
  store_set (util_date_str_ISO (), "_started");
  return "OK";
}
function store_report () {
  var d = util_date_str_yyyymmdd (), v = store_get ("url", util_str_substr (d, 0, 7), util_str_substr (d, 8, 2)) * 1.0,
      t = store_sum ("url"), c = Object.keys (store_lst ("url")).length;
  return { "urlreq": [ d + "=" + v, "days=" + c, "total=" + t, "average=" + (c == 0 ? 0 : util_num_round (t / c)) ].join (", ") }
}
function store_setup () {
  if (store_get ("_started") == undefined) {
    store_rst ();
    store_set (util_date_str_ISO (), "_started");
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __runner_function = APPLICATION_RUNNER;
var __runner_timeExpire = 5*60;
var __runner_timeAbort = 7*60;

// -----------------------------------------------------------------------------------------------------------------------------------------

function runner_suspend (f, r = undefined) {
  var ff = store_get ("system", "state", "suspended") == undefined ? false : true;
  if (ff == false && f == true) {
    store_set (util_date_str_ISO (), "system", "state", "suspended");
    var m = "runner, suspended" + (r == undefined ? "" : ": " + r);
    log ("system", m); system_report_info ("system", m); store_inc ("system", "suspended", util_date_str_yyyymmdd ());
  } else if (ff == true && f == false) {
    var t = store_get ("system", "state", "suspended"); if (t != undefined) t = util_str_niceSecsAsDays (util_date_timeSecsToNow ((new Date (t)).getTime ()));
    store_clr ("system", "state", "suspended");
    var m = Array (); if (r != undefined) m.push (r); if (t != undefined) m.push ("after " + t); m = "runner, resumed" + ((m.length > 0) ? ": " + m.join (", ") : "");
    log ("system", m); system_report_info ("system", m); store_inc ("system", "resumed", util_date_str_yyyymmdd ());
  }
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
      store_inc ("system", "cancelled", util_date_str_yyyymmdd ());
      log ("system", "runner, was cancelled");
      system_report_error ("system", "runner, was cancelled");
    }
    store_set ((new Date ()).getTime (), "system", "state", "start-time");
    return true;
  });
  if (started == true)
    store_inc ("system", "started", util_date_str_yyyymmdd ());
  return started;
}
function __runner_end (t, m) {
  var timestart = store_get ("system", "state", "start-time"), duration = 0;
  if (timestart != undefined) {
    store_clr ("system", "state", "start-time");
    duration = util_date_timeSecsToNow (timestart);
  }
  log ("system", "runner, " + t + ": at " + duration + " seconds (" + util_str_niceSecsAsDays (duration) + ")" + (m ? ", " + m : ""));
  store_inc ("system", t, util_date_str_yyyymmdd ());
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
    system_report_error ("system", "runner, aborted: " + e.name + ": " + e.message);
    return true;
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runner_cnt () {
  return [ "started", "completed", "aborted", "cancelled", "suspended" ].map (v => store_sum ("system", v)).join ("/");
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
