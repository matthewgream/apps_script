
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function system_debug () {
  Logger.log (__system_diagnostics ());
  Logger.log (runner_info ());
  __system_check ();
}

function system_report () {
  return { "system": __system_diagnostics (), "runner": runner_info () };
}

function system_setup () {
  var setup_functions = util_functions_find (v => (v != "system_setup" && v.endsWith ("_setup")));
  setup_functions.forEach (util_functions_call);
  var m = "setup - " + setup_functions.map (v => v.replace ("_setup", "")).join (", ");
  log ("system", m); Logger.log ("system: " + m);

  function __timerSetup (f, n, a, b, c) { if (f (n, a, b, c) == true) log ("system", "Timer for '" + n + "' did not exist, will be created"); }
  __timerSetup (timer_createMinutes, "runEveryMinute", 1);
  __timerSetup (timer_createHours, "runEveryHour", 1);
  __timerSetup (timer_createDaily, "runEveryDayAt5am", 5, 0);
  __timerSetup (timer_createWeekly, "runEveryWeekOnSaturday", ScriptApp.WeekDay.SATURDAY, 6);
  __timerSetup (timer_createWeekly, "runEveryWeekOnTuesday", ScriptApp.WeekDay.TUESDAY, 6);
  __timerSetup (timer_createMonthly, "runEveryMonth", 3, 6);
  __timerSetup (timer_createMinutes, "__system_runner", 1);
  __timerSetup (timer_createHours, "__system_check", 1);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __system_diagnostics () {
  return __system_modules_names.map (v => 
    v + ": " + (this [v + "_cnt"] ()) + (this [v + "_len"] != undefined ? "/" + (this [v + "_len"]()) : "") + (this [v + "_str"] != undefined ? "/" + (this [v + "_str"]()) : "")
  ).join (", ");
}
var __system_modules_names = [ "queue", "store", "timer", "log" ];

var WARNING_SIZE_STORAGE  = (512*1024)*(2/3);   // 2/3 of property storage size
var WARNING_SIZE_CONNECT  = 25*1000;            // 25K per day, can go 100K on enterprise
var WARNING_SIZE_LOG      = 75*1000;            // too many log lines
var WARNING_SIZE_TIMER    = 15;                 // 20 is system limit

var __system_limits = {
  storage: { limit: Math.floor (WARNING_SIZE_STORAGE), size: function () { return queue_len () + store_len (); } },
  connect: { limit: WARNING_SIZE_CONNECT, size: function () { var d = util_date_str_yyyymmdd (); return store_get ("url", util_str_substr (d, 0, 7), util_str_substr (d, 8, 2)) * 1.0; } },
  log: { limit: WARNING_SIZE_LOG, size: log_cnt },
  timer: { limit: WARNING_SIZE_TIMER, size: timer_cnt },
};

function __system_check () {
  Object.entries (__system_limits).forEach (([n, d]) => {
    var size = d.size (), limit = d.limit; if (size > limit)
      report_error ("system", "<b>WARNING: " + n + " at '" + size + "', threshold '" + limit + "':</b>" + "<pre>" + __system_diagnostics () + "</pre>");
  });
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

// https://github.com/brucemcpherson/rottler

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

var __log_queue = "au", __log_sheet = "#", __log_col_start = "A", __log_col_end = "C", __log_row = 2, __log_size = 35;

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
function __log_queueProcess () {
  __log_queueWriter (m => util_sheet_rowPushAndHide (SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (__log_sheet),
      __log_row, __log_col_start + __log_row + ":" + __log_col_end + (__log_row + m.length - 1), __log_size, m.reverse ()));
}
function __log_queueTrim (n) {
  util_sheet_rowPrune (SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (__log_sheet), n);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var log_suspend = false;

function log_cnt () {
  return SpreadsheetApp.getActiveSpreadsheet ().getSheetByName (__log_sheet).getLastRow () - 1;
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
function log_setup () {
  log_process ();
}
function log_str () {
  return (log_suspend ? "suspended" : "operating");
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __report_name = APPLICATION_USER_TELEGRAM;

function report_info (t, m) {
  telegram_messageTransmit (__report_name, "<b>" + APPLICATION_NAME + "\n" + t + "</b>\n" + m);
}
function report_error (t, m) {
  telegram_messageTransmit (__report_name, "<b>" + APPLICATION_NAME + "\n" + t + "</b>\n" + m);
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
  var ff = store_get ("runner", "state", "suspended") == undefined ? false : true;
  if (ff == false && f == true) {
    store_set (util_date_str_ISO (), "runner", "state", "suspended");
    var m = "suspended" + (r == undefined ? "" : ": " + r);
    log ("runner", m); report_info ("runner", m); store_inc ("runner", "suspended", util_date_str_yyyymmdd ());
  } else if (ff == true && f == false) {
    var t = store_get ("runner", "state", "suspended"); if (t != undefined) t = util_str_niceSecsAsDays (((new Date ()).getTime () - (new Date (t)).getTime ()) / 1000);
    store_clr ("runner", "state", "suspended");
    var m = Array (); if (r != undefined) m.push (r); if (t != undefined) m.push ("after " + t); m = "resumed" + ((m.length > 0) ? ": " + m.join (", ") : "");
    log ("runner", m); report_info ("runner", m); store_inc ("runner", "resumed", util_date_str_yyyymmdd ());
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
  return store_get ("runner", "state", "suspended") == undefined ? false : true;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __runner_isdone () {
  var timestart = store_get ("runner", "state", "start-time");
  if (timestart == undefined) return true;
  var duration = (((new Date ()).getTime () - (timestart * 1.0)) / 1000.0);
  if (duration >= __runner_timeExpire) return true;
  if (store_get ("runner", "state", "suspended") != undefined) return true;
  return false;
}
function __runner_start () {
  var started = util_lock_wrapper ("Script", util_lock_seconds (30), function () {
    var timestart = store_get ("runner", "state", "start-time");
    if (timestart != undefined && (((new Date ()).getTime () - (timestart * 1.0)) / 1000.0) < __runner_timeAbort) return false;
    if (timestart != undefined) {
      store_clr ("runner", "state", "start-time");
      store_inc ("runner", "cancelled", util_date_str_yyyymmdd ());
      log ("runner", "had been cancelled");
      report_error ("runner", "had been cancelled");
    }
    store_set ((new Date ()).getTime (), "runner", "state", "start-time");
    return true;
  });
  if (started == true)
    store_inc ("runner", "started", util_date_str_yyyymmdd ());
  return started;
}
function __runner_end (t, m) {
  var timestart = store_get ("runner", "state", "start-time"), duration = 0;
  if (timestart != undefined) {
    store_clr ("runner", "state", "start-time");
    duration = (((new Date ()).getTime () - (timestart * 1.0)) / 1000.0);
  }
  log ("runner", t + ", at " + duration + " seconds (" + util_str_niceSecsAsDays (duration) + ")" + (m ? ", " + m : ""));
  store_inc ("runner", t, util_date_str_yyyymmdd ());
}
function runner_execute () {
  try {
    if (!__runner_start ())
      return false;
    this [__runner_function] (runner_expired);
    __runner_end ("completed");
  } catch (e) {
    __runner_end ("aborted", util_str_error (e));
    report_error ("runner", "aborted: " + e.name + ": " + e.message);
  }
  return true;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runner_info () {
  return [
    runner_suspended () ? "suspended" : "operating",
    "sta/com/abo/can/sus: " + [ "started", "completed", "aborted", "cancelled", "suspended" ].map (v => store_sum ("runner", v)).join ("/"),
  ].join (", ");
}
function runner_expired () {
  return __runner_isdone ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __system_respawn (e) {
  if (e != undefined) timer_delete (e.triggerUid);
  __system_runner ();
}
function __system_runner () {
  if (runner_suspended () == false)
    if (runner_execute () == true)
      timer_create ("__system_respawn");
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
