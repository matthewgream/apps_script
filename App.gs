
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var APPLICATION_NAME = "xxx";
var APPLICATION_USER_TELEGRAM = "yyy";
var APPLICATION_RUNNER = "zzz";

// -----------------------------------------------------------------------------------------------------------------------------------------

function runLogAndReport (a, x) {
  var m = Object.keys (x).reduce ((z, v) => z.concat (Array.isArray (x [v]) ? x [v].map (vv => v + " : " + vv) : [v + " : " + x [v]]), Array ());
  log (a, m); report_info (util_str_upper (a) + " at " + util_date_str_yyyymmddhhmmss (), "<pre>" + m.join ("\n") + "</pre>");
}

function runEveryMonth () {
  runner_suspend_wrapper (function () {
    runLogAndReport ("monthly", tasks_runEveryMonth ());
  }, "monthly");
}
function runEveryWeekOnSaturday () {
}
function runEveryWeekOnTuesday () {
  runner_suspend_wrapper (function () {
    runLogAndReport ("weekly", tasks_runEveryWeek ());
  }, "weekly");
}
function runEveryDayAt5am () {
  runner_suspend_wrapper (function () {
    runLogAndReport ("daily", tasks_runEveryDayAt5am ());
  }, "daily");
}
function runEveryHour () { var extended = true;
  runLogAndReport ("status", util_merge (tasks_report (extended), [ store_report (extended), system_report (extended) ]));
}
function runEveryMinute () {
  log_process ();
}
function runManually () {
  runLogAndReport ("manual", tasks_runManually ());
  runLogAndReport ("store", store_report ());
}
function runManually2 () {
  runLogAndReport ("manual2", tasks_runManually2 ());
  runLogAndReport ("store", store_report ());
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function menu_queues_toggle () { util_sheet_toggleVisibility (function (n) { return n.length == 4 && n.substring (0, 2) == "__"; }); }
function menu_display () {
  SpreadsheetApp.getUi ().createMenu ('APP')
    .addItem ('Log process', 'log_process')
    .addItem ('Log reduce', 'log_reduce')
    .addItem ('Queues toggle', 'menu_queues_toggle')
    .addToUi ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function onOpen2 (e) {
  menu_display ();
  try {
    system_setup ();
  } catch (e) {
    log ("system", "exception in onOpen: " + util_str_error (e));
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
