
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var APPLICATION_NAME = "xxx";
var APPLICATION_USER_TELEGRAM = "yyy";

// -----------------------------------------------------------------------------------------------------------------------------------------

// zzz

// -----------------------------------------------------------------------------------------------------------------------------------------

function APP_URL () {
  return "xxx";
  //return ScriptApp.getService().getUrl ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function app_setup () {
  telegram_whitelistInsert (APPLICATION_USER_TELEGRAM);

  __system_timer_setup (timer_createMinutes, "runEveryFifteenMinutes", 15);
  __system_timer_setup (timer_createMinutes, "runEveryThirtyMinutes", 30);
  __system_timer_setup (timer_createHours, "runEveryOneHour", 1);
  __system_timer_setup (timer_createHours, "runEveryFourHours", 4);
  __system_timer_setup (timer_createHours, "runEverySixHours", 6);
  __system_timer_setup (timer_createHours, "runEveryTwelveHours", 12);
  __system_timer_setup (timer_createDaily, "runEveryDayAt5am", 5);
  __system_timer_setup (timer_createDaily, "runEveryDayAt11pm", 23);
  __system_timer_setup (timer_createWeekly, "runEveryWeekOnSaturdayAt6am", ScriptApp.WeekDay.SATURDAY, 6);
  __system_timer_setup (timer_createMonthly, "runEveryMonthOn1stDay", 1, 6);
  __system_timer_setup (timer_createWeekly, "runOnMarketOpen", ScriptApp.WeekDay.SUNDAY, 20, 45);
  __system_timer_setup (timer_createWeekly, "runOnMarketClose", ScriptApp.WeekDay.FRIDAY, 20, 45);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var RUN_EVERY_MARKET_DAY_PROIR =    "MRKT_DAY_PRIOR";
var RUN_EVERY_MARKET_DAY_AFTER =    "MRKT_DAY_AFTER";
var RUN_EVERY_MARKET_WEEK_PRIOR =   "MRKT_WEK_PRIOR";
var RUN_EVERY_MARKET_WEEK_AFTER =   "MRKT_WEK_AFTER";
var RUN_EVERY_MARKET_MONTH_BEGIN =  "MRKT_MON_BEGIN";

var RUN_EVERY_MARKET_LOWW =         "MRKT_HRS_LOWW";
var RUN_EVERY_MARKET_FAST =         "MRKT_HRS_FAST";
var RUN_EVERY_MARKET_SLOW =         "MRKT_HRS_SLOW";

var RUN_EVERY_MARKET_OPEN =         "MRKT_ONN_OPEN";
var RUN_EVERY_MARKET_CLOSE =        "MRKT_ONN_CLOS";

// -----------------------------------------------------------------------------------------------------------------------------------------

function runEveryFifteenMinutes () {
  if (MARKET_OPEN_WITH_WINDOW ()) {
    store_inc ("app", "runner", "market", "fast/M15");
    run_handlerIterate (RUN_EVERY_MARKET_FAST);
  }
}
function runEveryThirtyMinutes () {
  if (!MARKET_OPEN_WITH_WINDOW ()) {
    store_inc ("app", "runner", "market", "fast/M30");
    run_handlerIterate (RUN_EVERY_MARKET_FAST);
  }
}

function runEveryOneHour () {
  if (MARKET_OPEN_WITH_WINDOW ()) {
    store_inc ("app", "runner", "market", "slow/H01");
    run_handlerIterate (RUN_EVERY_MARKET_SLOW);
  }
}
function runEverySixHours () {
  if (!MARKET_OPEN_WITH_WINDOW ()) {
    store_inc ("app", "runner", "market", "slow/H06");
    run_handlerIterate (RUN_EVERY_MARKET_SLOW);
  }
}

function runEveryFourHours () {
  if (MARKET_OPEN_WITH_WINDOW ()) {
    store_inc ("app", "runner", "market", "loww/H04");
    run_handlerIterate (RUN_EVERY_MARKET_LOWW);
  }
}
function runEveryTwelveHours () {
  if (!MARKET_OPEN_WITH_WINDOW ()) {
    store_inc ("app", "runner", "market", "loww/H12");
    run_handlerIterate (RUN_EVERY_MARKET_LOWW);
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runEveryDayAt11pm () {
  if (MARKET_OPEN_DAY ()) {
    store_inc ("app", "runner", "market", "days/H23");
    system_report_info ("app", "runner", "running tasks, market daily at 11pm");
    run_handlerIterate (RUN_EVERY_MARKET_DAY_AFTER);
  }
}
function runEveryDayAt5am () {
  if (MARKET_OPEN_DAY ()) {
    store_inc ("app", "runner", "market", "days/H05");
    system_report_info ("app", "runner", "running tasks, market daily at 5am");
    run_handlerIterate (RUN_EVERY_MARKET_DAY_PROIR);
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runEveryWeekOnSaturdayAt6am () {
  store_inc ("app", "runner", "market", "week/after");
  system_report_info ("app", "runner", "running tasks, market weekly on saturday at 6am");
  run_handlerIterate (RUN_EVERY_MARKET_WEEK_AFTER);
}
function runEveryWeekOnSundayAt6pm () {
  store_inc ("app", "runner", "market", "week/prior");
  system_report_info ("app", "runner", "running tasks, market weekly on sunday at 6pm");
  run_handlerIterate (RUN_EVERY_MARKET_WEEK_PRIOR);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runEveryMonthOn1stDay () {
  store_inc ("app", "runner", "market", "month/D01");
  system_report_info ("app", "runner", "running tasks, market monthly on 1st day");
  run_handlerIterate (RUN_EVERY_MARKET_MONTH_BEGIN);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runOnMarketOpen () {
  store_inc ("app", "runner", "market", "open");
  system_report_info ("app", "runner", "running tasks, market opening on monday 00:01 Z+3");
  run_handlerIterate (RUN_EVERY_MARKET_OPEN);
}
function runOnMarketClose () {
  store_inc ("app", "runner", "market", "close");
  system_report_info ("app", "runner", "running tasks, market closing on friday 23:57 Z+3");
  run_handlerIterate (RUN_EVERY_MARKET_CLOSE);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_report_format (type, a, b, details) {
  return type + " [" + a + "]: " + b + (!util_is_null (details) ? (" --> ('" + util_str_presentable ((util_is_array (details) ? util_str_join (details, ", ") : details), 256) + "')") : ""); }
function __app_report_telegram (a, b, details) { var mm = "<b>" + APPLICATION_NAME + "\n" + a + (!util_is_null (b) ? (" -- " + b) : "") + "</b>";
  var md = !util_is_null (details) ? ("\n<pre>" + util_str_escape_html (util_is_array (details) ? util_str_join (details, "\n") : details) + "</pre>") : "";
  TELEGRAM_SEND (APPLICATION_USER_TELEGRAM, mm + md); }
function __app_report_info (a, b, details) { 
  return __app_report_telegram (a.toLowerCase (), b, details); }
function __app_report_error (a, b, details) { 
  return __app_report_telegram (a.toUpperCase (), b, details); }
function __app_message (type, handler, a, b, details) {
  log (a, b + (!util_is_null (details) ? ("\n" + (util_is_array (details) ? util_str_join (details, "\n") : details)) : "")); 
  if (handler != undefined) handler (a, b, details); Logger.log (__app_report_format (type, a, b, details)); }

// -----------------------------------------------------------------------------------------------------------------------------------------

function app_debug (a, b, details) {
  return __app_message ("DEBUG", undefined, a, b, details); }
function app_info (a, b, details) {
  return __app_message ("INFO", __app_report_info, a, b, details); }
function app_error (a, b, details) {
  return __app_message ("ERROR", __app_report_error, a, b, details); }
function app_error_throw (a, b, details) {
  app_error (a, b, details); throw __app_report_format ("ERROR", a, b, details); }

// -----------------------------------------------------------------------------------------------------------------------------------------

var system_info = app_info;
var system_error = app_error;
var system_debug = app_debug;
var system_error_throw = function (a, b, details) { throw __app_report_format ("ERROR", a, b, details); }
var system_report_info = __app_report_info;
var system_report_error = __app_report_error;
var system_config = config_data;

// -----------------------------------------------------------------------------------------------------------------------------------------

// xxx

var __APP_SERVICE_PRIVATE_KEY = 'xxx';
var __APP_SERVICE_CLIENT_EMAIL = 'yyy';

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------


// -----------------------------------------------------------------------------------------------------------------------------------------

function config_data () {
  return {
    nothing: 'here_yet'
  };
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
