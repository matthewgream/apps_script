
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var APPLICATION_NAME = "xxx";
var APPLICATION_USER_TELEGRAM = "yyy";
var APPLICATION_CONSOLE_MESSAGES = false;

// -----------------------------------------------------------------------------------------------------------------------------------------

function app_setup () {
  telegram_whitelistInsert (APPLICATION_USER_TELEGRAM);
  __app_market_runner_setup ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

class RUN_EVERY_MARKET { }
RUN_EVERY_MARKET.FAST =         "MRKT_HRS_FAST"; // 15m, 1hr
RUN_EVERY_MARKET.SLOW =         "MRKT_HRS_SLOW"; // 1hr, 4hr
RUN_EVERY_MARKET.LOWW =         "MRKT_HRS_LOWW"; // 4hr, 8hr
RUN_EVERY_MARKET.DAY_PRIOR =    "MRKT_DAY_PRIOR";
RUN_EVERY_MARKET.DAY_AFTER =    "MRKT_DAY_AFTER";
RUN_EVERY_MARKET.WEEK_PRIOR =   "MRKT_WEK_PRIOR";
RUN_EVERY_MARKET.WEEK_AFTER =   "MRKT_WEK_AFTER";
RUN_EVERY_MARKET.MONTH_BEGIN =  "MRKT_MON_BEGIN";
RUN_EVERY_MARKET.OPEN =         "MRKT_ONN_OPEN";
RUN_EVERY_MARKET.CLOSE =        "MRKT_ONN_CLOS";

// -----------------------------------------------------------------------------------------------------------------------------------------

function app_market_mode () {
  return store_get ("app", "runner", "state");
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_market_mode_determine () {
  var isitopen = MARKET_OPEN_WITH_WINDOW ();
  var previous = store_get ("app", "runner", "state");
  if ((util_is_nullOrZero (previous) || previous != "market-slow") && isitopen == false)
    store_set ("market-slow", "app", "runner", "state"), app_info ("market", "moved open to closed", "activating market-slow mode (1hr, 4hr, 8hr)");
  else if ((util_is_nullOrZero (previous) || previous != "market-fast") && isitopen == true)
    store_set ("market-fast", "app", "runner", "state"), app_info ("market", "moved closed to open", "activating market-fast mode (15m, 1hr, 4hr)");
  return isitopen;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function app_run (x, y) { return handler_insert (__app_handler_key (), x, y); }

// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_handler_key () { return "RUN"; }

function __app_market_runner_schedule (t) {
  const __config = {
    "M15": { true:  [ "fast/M15", RUN_EVERY_MARKET.FAST ]                                               },
    "H01": { false: [ "fast/H01", RUN_EVERY_MARKET.FAST ], true:  [ "slow/H01", RUN_EVERY_MARKET.SLOW ] },
    "H04": { true:  [ "loww/H04", RUN_EVERY_MARKET.LOWW ], false: [ "slow/H04", RUN_EVERY_MARKET.SLOW ] },
    "H08": { false: [ "loww/H08", RUN_EVERY_MARKET.LOWW ]                                               },
  };
  var config = __config [t] [__app_market_mode_determine ()]; if (config)
    store_inc ("app", "runner", "market", config [0]), handler_iterate (__app_handler_key (), config [1]);
}

function __app_runEveryFifteenMinutes () { __app_market_runner_schedule ("M15"); }
function __app_runEveryOneHour () { __app_market_runner_schedule ("H01"); }
function __app_runEveryFourHours () { __app_market_runner_schedule ("H04"); }
function __app_runEveryEightHours () { __app_market_runner_schedule ("H08"); }

// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_market_runner_periodic (t) {
  const __config = {
    "days/H05":     [ () => MARKET_OPEN_DAY (), RUN_EVERY_MARKET.DAY_PRIOR,   "daily at 5am"                 ],
    "days/H23":     [ () => MARKET_OPEN_DAY (), RUN_EVERY_MARKET.DAY_AFTER,   "daily at 11pm"                ],
    "week/prior":   [ () => true,             , RUN_EVERY_MARKET.WEEK_PRIOR,  "weekly on saturday at 6am"    ],
    "week/after":   [ () => true,             , RUN_EVERY_MARKET.WEEK_AFTER,  "weekly on sunday at 6pm"      ],
    "month/D01":    [ () => true,             , RUN_EVERY_MARKET.MONTH_BEGIN, "monthly on 1st day"           ],
    "open":         [ () => true,             , RUN_EVERY_MARKET.OPEN,        "opening on monday 00:01 Z+3"  ],
    "close":        [ () => true,             , RUN_EVERY_MARKET.CLOSE,       "closing on friday 23:57 Z+3"  ]
  };
  var config = __config [t]; if (!util_is_null (config) && config [0] () == true) app_info ("app", "running tasks, market " + config [2]),
    store_inc ("app", "runner", "market", t), handler_iterate (__app_handler_key (), config [1]);
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
  __system_timer_setup (timer_createWeekly, "__app_runOnMarketOpen", ScriptApp.WeekDay.SUNDAY, 20, 45); // before 22:00
  __system_timer_setup (timer_createWeekly, "__app_runOnMarketClose", ScriptApp.WeekDay.FRIDAY, 23, 45); // after 22:00
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __app_report_syslog (label, title, message, details) {
  log (label, title + (!util_is_null (message) ? (" -- " + message) : "") + (!util_is_null (details) ? ("\n" + (util_is_array (details) ? util_str_join (details, "\n") : details)) : "")); }
function __app_report_logger (type, label, title, message, details) {
  Logger.log (__app_report_format (type, label, title, message, details)); }
function __app_report_console (label, title, message, details) {
  if (util_function_exists ('__console_message')) __console_message (__app_report_format ("ERROR", label, title, message, details)); }
function __app_report_telegram (label, title, message, details) {
  label = util_str_escape_html (label), title = (!util_is_null (title) ? (" :: " + util_str_escape_html (title)) : ""),
    message = (!util_is_null (message) ? ("\n" + util_str_escape_html (message)) : "");
  var mm = "<b>" + APPLICATION_NAME + " -- " + label + title + message + "</b>";
  var md = !util_is_nullOrZero (details) ? ("\n<pre>" + util_str_escape_html (util_is_array (details) ? util_str_join (details, "\n") : details) + "</pre>") : "";
  TELEGRAM_SEND_BACKGROUND (APPLICATION_USER_TELEGRAM, mm + md); }

function __app_report_format (type, label, title, message, details) {
  return type + " [" + label + "]: " + title + (!util_is_null (message) ? (" -- " + message) : "") +
    (!util_is_null (details) ? (" --> ('" + util_str_presentable ((util_is_array (details) ? util_str_join (details, ", ") : details), 256) + "')") : ""); }

function app_debug (label, title, message, details) {
  __app_report_syslog (label, title, message, details); __app_report_logger ("DEBUG", label, title, message, details); return undefined; }
function app_info (label, title, message, details) {
  __app_report_syslog (label, title, message, details); __app_report_logger ("INFO", label, title, message, details);
  __app_report_telegram (label.toLowerCase (),title.toLowerCase (), message, details); return undefined; }
function app_error (label, title, message, details) {
  __app_report_syslog (label, title, message, details); __app_report_logger ("ERROR", label, title, message, details);
  __app_report_telegram (label.toUpperCase (),title.toUpperCase (), message, details); if (APPLICATION_CONSOLE_MESSAGES) __app_report_console (label, title, message, details); return undefined; }
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
  else if (Array.isArray (b)) b.forEach (bb => __log_queueInsert ([ d, __arg1 (a, bb, c), __arg2 (a, bb, c), __arg3 (a, bb, c) ]));
  else if (Array.isArray (c)) c.forEach (cc => __log_queueInsert ([ d, __arg1 (a, b, cc), __arg2 (a, b, cc), __arg3 (a, b, cc) ]));
  else __log_queueInsert ([ d, __arg1 (a, b, c), __arg2 (a, b, c), __arg3 (a, b, c) ]);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var __SYSTEM_SERVICE_CFG = {
  PRIVATE_KEY: 'xxx',
  CLIENT_EMAIL: 'yyy'
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigenTransactionsAdapter (token, account, date_beg, date_end) {
  return NORDIGEN_TRANSACTIONS (token [0], token [1], account, "booked", date_beg, date_end);
}
function __nordigenHistoryAdapter () {
  var accounts = NORDIGEN_ACCOUNT_LIST (), sheet = SpreadsheetApp.getActiveSpreadsheet ().getSheetByName ("O"),
    names = sheet.getRange ("B1:B").getValues ().map (v => v [0]);
  return sheet.getRange ("O1:O").getValues ().map (v => v [0]).map ((account_id, i) => ({ name: names [i], account: account_id }))
    .filter (mapping => __nordigen_validAccount (mapping.account) && accounts.includes (mapping.account));
}
function __nordigenHistoryCallback (x) {
  if (!util_is_null (x.bookingDate))
    x.time = x.bookingDate;
  if (!util_is_null (x.valueDate) && (!util_is_null (x.time) && x.valueDate > x.time))
    x.time = x.valueDate;
  if (!util_is_null (x.transactionAmount))
    x.transactionCurrency = x.transactionAmount.currency, x.transactionAmount = x.transactionAmount.amount;
  if (!util_is_null (x.remittanceInformationUnstructuredArray))
    x.remittanceInformation = x.remittanceInformationUnstructuredArray, delete x.remittanceInformationUnstructuredArray;
  if (!util_is_null (x.remittanceInformationUnstructured))
    x.remittanceInformation = (x.remittanceInformation ? (x.remittanceInformation + ", ") : "") + x.remittanceInformationUnstructured, delete x.remittanceInformationUnstructured;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function app_config () {
  return {
  };
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
