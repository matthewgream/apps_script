
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var APPLICATION_NAME = "xxx";
var APPLICATION_USER_TELEGRAM = "yyy";
var APPLICATION_RUNNER = "zzz";

// -----------------------------------------------------------------------------------------------------------------------------------------

function runLogAndReport (a, x) {
  var m = Object.keys (x).reduce ((z, v) => z.concat (Array.isArray (x [v]) ? x [v].map (vv => v + " : " + vv) : [v + " : " + x [v]]), Array ());
  log (a, m); system_report_info (util_str_lower (a) + " -- " + util_date_str_yyyymmddhhmmss (), "<pre>" + m.join ("\n") + "</pre>");
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runEveryMonth () {
  runner_suspend_wrapper (() => {
    runLogAndReport ("monthly", tasks_runEveryMonth ());
  }, "monthly");
}
function runEveryWeekOnSaturday () {
}
function runEveryWeekOnTuesday () {
  runner_suspend_wrapper (() => {
    runLogAndReport ("weekly", tasks_runEveryWeek ());
  }, "weekly");
}
function runEveryDayAt5am () {
  runner_suspend_wrapper (() => {
    runLogAndReport ("daily", tasks_runEveryDayAt5am ());
  }, "daily");
}
function runEveryHour () { var extended = true;
  runLogAndReport ("status", util_merge (tasks_report (extended), [ store_report (extended), system_report (extended) ]));
}
function runEveryMinute () {
  log_process ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function runManually_Checks () {
  runLogAndReport ("manual-checks", tasks_runManually_Checks ());
}
function runManually_Reports () { var extended = true;
  runLogAndReport ("manual-reports", util_merge (tasksort (extended), [ store_report (extended), system_report (extended) ]));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function menu_runner_suspend () { runner_suspend (true, "console"); }
function menu_runner_resume () { runner_suspend (false); }
function menu_tasks_checks () { runManually_Checks (); }
function menu_tasks_report () { runManually_Reports (); }
function menu_queues_toggle () { util_sheet_toggleVisibility (n => (n.length == 4 && n.substring (0, 2) == "__")); }
function menu_debug () { }
function menu_display () {
  SpreadsheetApp.getUi ().createMenu ('[TASKS]')
    .addItem ('log-refresh', 'log_process')
    .addItem ('system-suspend', 'menu_runner_suspend')
    .addItem ('system-resume', 'menu_runner_resume')
    .addSeparator ()
    .addItem ('checks-manual', 'menu_tasks_checks')
    .addItem ('report-manual', 'menu_tasks_report')
    .addSeparator ()
    .addItem ('log-reduce', 'log_reduce')
    .addItem ('debug-queuesToggle', 'menu_queues_toggle')
    .addItem ('debug-customFunction', 'menu_debug')
    .addToUi ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function onOpen2 (e) {
  function __make_user (e) { if (e.user != undefined) e = e.user; else return undefined;
    return (e.email == undefined) ? (e.nickname == undefined ? undefined : e.nickname) : (e.nickname == undefined ? e.email : e.nickname + " (" + e.email + ")"); }
  function __make_info (e) {
    function __make_source (e) { return "'" + e.getName () + "' [" + e.getId () + "]"; }
    function __make_mode (e) { switch (e) { case ScriptApp.AuthMode.NONE: return "NONE"; case ScriptApp.AuthMode.CUSTOM_FUNCTION: return "CUSTOM_FUNCTION";
      case ScriptApp.AuthMode.LIMITED: return "LIMITED"; case ScriptApp.AuthMode.FULL: return "FULL"; default: return "UNDEFINED"; } }
    var s = Array (); if (e.source) s.push ("source: " + __make_source (e.source)); return s.join (", "); if (e.authMode) s.push ("auth: " + __make_mode (e.authMode)); }

  menu_display ();
  try {
    system_setup ((e != undefined) ? __make_user (e) : undefined, (e != undefined) ? __make_info (e) : undefined);
  } catch (e) {
    log ("app", "onOpen exception: " + util_str_error (e));
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
