
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var APPLICATION_NAME = "xxx";
var APPLICATION_USER_TELEGRAM = "yyy";
var APPLICATION_TELEGRAM_BACKGROUND = true;

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function app_setup () {
  telegram_whitelistInsert (APPLICATION_USER_TELEGRAM);
  __app_market_runner_setup ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var RUN_EVERY_MARKET_FAST =         "MRKT_HRS_FAST"; // 15m, 1hr
var RUN_EVERY_MARKET_SLOW =         "MRKT_HRS_SLOW"; // 1hr, 4hr
var RUN_EVERY_MARKET_LOWW =         "MRKT_HRS_LOWW"; // 4hr, 8hr

var RUN_EVERY_MARKET_DAY_PRIOR =    "MRKT_DAY_PRIOR";
var RUN_EVERY_MARKET_DAY_AFTER =    "MRKT_DAY_AFTER";
var RUN_EVERY_MARKET_WEEK_PRIOR =   "MRKT_WEK_PRIOR";
var RUN_EVERY_MARKET_WEEK_AFTER =   "MRKT_WEK_AFTER";
var RUN_EVERY_MARKET_MONTH_BEGIN =  "MRKT_MON_BEGIN";

var RUN_EVERY_MARKET_OPEN =         "MRKT_ONN_OPEN";
var RUN_EVERY_MARKET_CLOSE =        "MRKT_ONN_CLOS";

// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_market_determine_mode () {
  var isitopen = MARKET_OPEN_WITH_WINDOW ();
  var previous = store_get ("app", "runner", "state");
  if ((util_is_nullOrZero (previous) || previous != "market-slow") && isitopen == false)
    store_set ("market-slow", "app", "runner", "state"), app_info ("market", "moved open to closed", "activating market-slow mode (1hr, 4hr, 8hr)");
  else if ((util_is_nullOrZero (previous) || previous != "market-fast") && isitopen == true)
    store_set ("market-fast", "app", "runner", "state"), app_info ("market", "moved closed to open", "activating market-fast mode (15m, 1hr, 4hr)");
  return isitopen;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_market_runner_schedule (t) {
  const __config = {
    "M15": { true:  [ "fast/M15", RUN_EVERY_MARKET_FAST ]                                               },
    "H01": { false: [ "fast/H01", RUN_EVERY_MARKET_FAST ], true:  [ "slow/H01", RUN_EVERY_MARKET_SLOW ] },
    "H04": { true:  [ "loww/H04", RUN_EVERY_MARKET_LOWW ], false: [ "slow/H04", RUN_EVERY_MARKET_SLOW ] },
    "H08": { false: [ "loww/H08", RUN_EVERY_MARKET_LOWW ]                                               },
  };
  var config = __config [t] [__app_market_determine_mode ()]; if (config)
    store_inc ("app", "runner", "market", config [0]), run_handlerIterate (config [1]);
}

function __app_runEveryFifteenMinutes () { __app_market_runner_schedule ("M15"); }
function __app_runEveryOneHour () { __app_market_runner_schedule ("H01"); }
function __app_runEveryFourHours () { __app_market_runner_schedule ("H04"); }
function __app_runEveryEightHours () { __app_market_runner_schedule ("H08"); }

// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_market_runner_periodic (t) {
  const __config = {
    "days/H05":     [ () => MARKET_OPEN_DAY (), RUN_EVERY_MARKET_DAY_PRIOR,   "daily at 5am"                 ],
    "days/H23":     [ () => MARKET_OPEN_DAY (), RUN_EVERY_MARKET_DAY_AFTER,   "daily at 11pm"                ],
    "week/prior":   [ () => true,             , RUN_EVERY_MARKET_WEEK_PRIOR,  "weekly on saturday at 6am"    ],
    "week/after":   [ () => true,             , RUN_EVERY_MARKET_WEEK_AFTER,  "weekly on sunday at 6pm"      ],
    "month/D01":    [ () => true,             , RUN_EVERY_MARKET_MONTH_BEGIN, "monthly on 1st day"           ],
    "open":         [ () => true,             , RUN_EVERY_MARKET_OPEN,        "opening on monday 00:01 Z+3"  ],
    "close":        [ () => true,             , RUN_EVERY_MARKET_CLOSE,       "closing on friday 23:57 Z+3"  ]
  };
  var config = __config [t]; if (!util_is_null (config) && config [0] () == true) app_info ("app", "running tasks, market " + config [2]),
    store_inc ("app", "runner", "market", t), run_handlerIterate (config [1]);
}

function __app_runEveryDayAt5am () { __app_market_runner_periodic ("days/H05"); }
function __app_runEveryDayAt11pm () { __app_market_runner_periodic ("days/H23"); }
function __app_runEveryWeekOnSundayAt6pm () { __app_market_runner_periodic ("week/prior"); }
function __app_runEveryWeekOnSaturdayAt6am () { __app_market_runner_periodic ("week/after"); }
function __app_runEveryMonthOn1stDay () { __app_market_runner_periodic ("month/D01"); }
function __app_runOnMarketOpen () { __app_market_runner_periodic ("open"); };
function __app_runOnMarketClose () { __app_market_runner_periodic ("close"); };

// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_market_runner_setup () {
  __system_timer_setup (timer_createMinutes, "__app_runEveryFifteenMinutes", 15);
  __system_timer_setup (timer_createHours, "__app_runEveryOneHour", 1);
  __system_timer_setup (timer_createHours, "__app_runEveryFourHours", 4);
  __system_timer_setup (timer_createHours, "__app_runEveryEightHours", 8);
  __system_timer_setup (timer_createDaily, "__app_runEveryDayAt5am", 5);
  __system_timer_setup (timer_createDaily, "__app_runEveryDayAt11pm", 23);
  __system_timer_setup (timer_createWeekly, "__app_runEveryWeekOnSaturdayAt6am", ScriptApp.WeekDay.SATURDAY, 6);
  __system_timer_setup (timer_createMonthly, "__app_runEveryMonthOn1stDay", 1, 6);
  __system_timer_setup (timer_createWeekly, "__app_runOnMarketOpen", ScriptApp.WeekDay.SUNDAY, 20, 45);
  __system_timer_setup (timer_createWeekly, "__app_runOnMarketClose", ScriptApp.WeekDay.FRIDAY, 20, 45);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_report_format (type, label, title, message, details) {
  return type + " [" + label + "]: " + title + (!util_is_null (message) ? (" -- " + message) : "") + (!util_is_null (details) ? (" --> ('" + util_str_presentable ((util_is_array (details) ? util_str_join (details, ", ") : details), 256) + "')") : ""); }
function __app_report_telegram (label, title, message, details) {
  label = util_str_escape_html (label), title = (!util_is_null (title) ? (" :: " + util_str_escape_html (title)) : ""),
    message = (!util_is_null (message) ? ("\n" + util_str_escape_html (message)) : "");
  var mm = "<b>" + APPLICATION_NAME + " -- " + label + title + message + "</b>";
  var md = !util_is_null (details) ? ("\n<pre>" + util_str_escape_html (util_is_array (details) ? util_str_join (details, "\n") : details) + "</pre>") : "";
  if (APPLICATION_TELEGRAM_BACKGROUND) TELEGRAM_SEND_BACKGROUND (APPLICATION_USER_TELEGRAM, mm + md); else TELEGRAM_SEND (APPLICATION_USER_TELEGRAM, mm + md); }
function __app_report_info (label, title, message, details) {
  return __app_report_telegram (label.toLowerCase (), title.toLowerCase (), message, details); }
function __app_report_error (label, title, message, details) {
  return __app_report_telegram (label.toUpperCase (), title.toUpperCase (), message, details); }
function __app_message (type, handler, label, title, message, details) {
  log (label, title + (!util_is_null (message) ? (" -- " + message) : "") + (!util_is_null (details) ? ("\n" + (util_is_array (details) ? util_str_join (details, "\n") : details)) : ""));
  if (!util_is_null (handler)) handler (label, title, message, details); Logger.log (__app_report_format (type, label, title, message, details)); }

// -----------------------------------------------------------------------------------------------------------------------------------------

function app_debug (label, title, message, details) {
  return __app_message ("DEBUG", undefined, label, title, message, details); }
function app_info (label, title, message, details) {
  return __app_message ("INFO", __app_report_info, label, title, message, details); }
function app_error (label, title, message, details) {
  return __app_message ("ERROR", __app_report_error, label, title, message, details); }
function app_error_throw (label, title, message, details) {
  app_error (label, title, message, details); throw __app_report_format ("ERROR", label, title, message, details); }

// -----------------------------------------------------------------------------------------------------------------------------------------

var system_info = app_info;
var system_error = app_error;
var system_debug = app_debug;
var system_error_throw = function (label, title, message, details) { throw __app_report_format ("ERROR", label, title, message, details); }
var system_config = app_config;

// -----------------------------------------------------------------------------------------------------------------------------------------

function log (a, b, c) {
  const d = util_date_strAsyyyymmddhhmmss ();
  const __arg1 = (a,b,c) => (a && (b || c)) ? a : "", __arg2 = (a,b,c) => (b && (a && c)) ? b : "", __arg3 = (a,b,c) => (c) ? c : (b ? b : (a ? a : ""));
  if (Array.isArray (b) && Array.isArray (c)) system_error_throw ("log", "dual arrays not supported");
  else if (Array.isArray (b)) b.forEach (bb => __log_queueAppend ([ d, __arg1 (a, bb, c), __arg2 (a, bb, c), __arg3 (a, bb, c) ]));
  else if (Array.isArray (c)) c.forEach (cc => __log_queueAppend ([ d, __arg1 (a, b, cc), __arg2 (a, b, cc), __arg3 (a, b, cc) ]));
  else __log_queueAppend ([ d, __arg1 (a, b, c), __arg2 (a, b, c), __arg3 (a, b, c) ]);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var __APP_SERVICE_PRIVATE_KEY = 'xxx';
var __APP_SERVICE_CLIENT_EMAIL = 'yyy';

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigenHistorySourcesAdapter () {
  var accounts = NORDIGEN_ACCOUNT_LIST (), sheet = SpreadsheetApp.getActiveSpreadsheet ().getSheetByName ("O"),
    names = sheet.getRange ("B1:B").getValues ().map (v => v [0]);
  return sheet.getRange ("O1:O").getValues ().map (v => v [0]).map ((account_id, i) => ({ name: names [i], account: account_id }))
    .filter (mapping => __nordigen_validAccount (mapping.account) && accounts.includes (mapping.account));
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function app_config () {
  return {
  };
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
