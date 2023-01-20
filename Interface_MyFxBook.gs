
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __MYFXB_CLS = "myfxbook";

// -----------------------------------------------------------------------------------------------------------------------------------------

function TEST_MYFXBOOK () { __TEST_SETUP ();
  var sheet = SpreadsheetApp.getActiveSpreadsheet ().getSheetByName ("Xs");
  var values1 = sheet.getRange ("$A6:$A").getValues ();
  var values2 = sheet.getRange ("D$4:F$4").getValues ();
  debugLog (values1); debugLog (values2);
  debugLog (MYFXBOOK_OUTLOOK_PAIRTYPE (MYFXBOOK_DEFAULT_EMAIL, MYFXBOOK_DEFAULT_PASSWORD, values1, values2));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_cacheKey (a, b) { return "MFXB_" + a + "_" + ((b != undefined) ? b : ""); }
function __myfxbook_cacheTimeOutlooksBackEnd () { return CACHE_TIME_15M; }
function __myfxbook_cacheTimeOutlooksFrontEnd () { return CACHE_TIME_12H; }
function __myfxbook_cacheTimeBackoff () { return CACHE_TIME_1H; }
function __myfxbook_cacheTimeSession () { return CACHE_TIME_24H; }

function __myfxbook_validEmail (x) { return (!util_is_nullOrZero (x) && (util_str_includes (x, "@"))) ? true : false; }
function __myfxbook_validPassword (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __myfxbook_validPair (x) { return (!util_is_nullOrZero (x) && (x [0] != '#') && (x.length <= 6)) ? true : false; }
function __myfxbook_validType (x) { return (!util_is_nullOrZero (x) && !util_is_null (__myfxbook_communityOutlookSymbolsDetail [x])) ? true : false; }

// -----------------------------------------------------------------------------------------------------------------------------------------

// XXX note is case sensitive, assumes upper case ...
function MYFXBOOK_OUTLOOK_PAIRTYPE (email, password, pair, type) {
  util_args_check (__myfxbook_validEmail (email) && __myfxbook_validPassword (password));
  var session = myfxbook_sessionToken (email);
  if (util_is_nullOrZero (session)) session = myfxbook_sessionLogin (email, password);
  const outlooks = util_is_nullOrZero (session) ? undefined : myfxbook_communityOutlookData (session);
  return util_array_runnerXY ((pair_, type_) => {
    if (util_is_nullOrZero (pair_) || util_is_nullOrZero (type_) || util_is_null (outlooks) || util_is_null (outlooks [pair_])) return "";
    util_args_check (__myfxbook_validType (type_));
    return outlooks [pair_] [type_];
  }, pair, type);
}

function MYFXBOOK_OUTLOOK_TIMESTAMP (email) {
  util_args_check (__myfxbook_validEmail (email));
  const session = myfxbook_sessionToken (email);
  return !util_is_nullOrZero (session) ? myfxbook_communityOutlookTime (session) : undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __MYFXB_API_URL_BASE = "https://www.myfxbook.com/api";
var __MYFXB_API_EP_LOGIN = "/login.xml";
var __MYFXB_API_EP_LOGOUT = "/logout.xml";
var __MYFXB_API_EP_COMMUNITYOUTLOOK = "/get-community-outlook.xml";

// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_requestResponse_Base (url, params) { // XXX YUCK
  var r = util_exception_wrapper (() => {
    return connect_urlXmlResponse (__MYFXB_CLS, __MYFXB_API_URL_BASE + url + ((util_is_null (params) ? "" : "?" + params)), { method: "GET", headers: { 'accept': 'application/xml' } });
  }, (e) => app_error_throw (__MYFXB_CLS, e));
  var v; if (!util_is_nullOrZero (v = r.getAttribute ("error")) && v.getValue () == "true")
    app_error_throw (__MYFXB_CLS, "__myfxbook_requestResponse_Base", util_str_isolateURI (__MYFXB_API_URL_BASE + url), r.getAttribute ("message").getValue ());
  return r;
}
function __myfxbook_requestResponseLogin (email, password) {
  store_inc (__MYFXB_CLS, "request", "login", email);
  return __myfxbook_requestResponse_Base (__MYFXB_API_EP_LOGIN, "email=" + email + "&password=" + password);
}
function __myfxbook_requestResponse (url, session, params) {
  store_inc (__MYFXB_CLS, "request", "url", util_str_isolateURI (url));
  return __myfxbook_requestResponse_Base (url, "session=" + session + ((util_is_null (params) ? "" : "&" + params)));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function myfxbook_sessionToken (email) {
  return cache_read (__myfxbook_cacheKey ("SE", email), __myfxbook_cacheTimeSession ());
}

function myfxbook_sessionLogin (email, password) {
  cache_del (__myfxbook_cacheKey ("SE", email));
  if (util_is_nullOrZero (cache_read (__myfxbook_cacheKey ("SB", email), __myfxbook_cacheTimeBackoff ()))) {
    const result = __myfxbook_requestResponseLogin (email, password);
    if (!util_is_nullOrZero (result) && util_str_lower (result.getName ()) == "response") {
      var session = result.getChildren ().reduce ((p, v) => util_str_lower (v.getName ()) == "session" && !util_is_nullOrZero (v.getText ()) ? v.getText () : p, undefined);
      if (!util_is_nullOrZero (session)) {
        cache_write (__myfxbook_cacheKey ("SE", email), session);
        store_inc (__MYFXB_CLS, "session", "login");
        return session;
      }
    }
    cache_write (__myfxbook_cacheKey ("SB", email), "BACKOFF");
    store_inc (__MYFXB_CLS, "session", "backoff");
  }
  return undefined;
}

function myfxbook_sessionLogout (email) {
  const cache_key = __myfxbook_cacheKey ("SE", email);
  const session = cache_read (cache_key, __myfxbook_cacheTimeSession ());
  if (!util_is_nullOrZero (session)) {
    cache_del (cache_key);
    store_inc (__MYFXB_CLS, "session", "logout");
    return __myfxbook_requestResponse (__MYFXB_API_EP_LOGOUT, session);
  }
  return undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var __myfxbook_communityOutlookSymbolsDetail = {
  "short": [ "shortPercentage", 0.01 ], "shortVol": [ "shortVolume", 1.0 ], "shortVal": [ "avgShortPrice", 1.0 ], "shortPos": [ "shortPositions", 1.0 ],
  "long": [ "longPercentage", 0.01 ], "longVol": [ "longVolume", 1.0 ], "longVal": [ "avgLongPrice", 1.0 ], "longPos": [ "longPositions", 1.0 ]
};

function __myfxbook_communityOutlookSymbols (q) {
  return q.reduce ((p, v) => { p [v.getChild ("name").getText ()] =
      Object.entries (__myfxbook_communityOutlookSymbolsDetail).reduce ((pp, ee) => { pp [ee [0]] = v.getChild (ee [1][0]).getText () * ee [1][1]; return pp; }, {});
    return p;
  }, {});
}

function __myfxbook_communityOutlook (session) {
  var result = __myfxbook_requestResponse (__MYFXB_API_EP_COMMUNITYOUTLOOK, session);
  if (!util_is_null (result) && !util_is_null (result = result.getChildren ()
        .reduce ((p, v) => util_str_lower (v.getName ()) == "community-outlook" && !util_is_null (v.getChild ("symbols")) ? v : p, undefined)))
      result = __myfxbook_communityOutlookSymbols (result.getChild ("symbols").getChildren ());
  return result;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_communityOutlookUpdate (session, origin = "foreground") {
  var result; if (!util_is_null (result = __myfxbook_communityOutlook (session))) {
    cache_writeWithLZ (__myfxbook_cacheKey ("CO", session), JSON.stringify (result));
    store_inc (__MYFXB_CLS, "update", "outlook", origin);
  }; return result;
}

function myfxbook_communityOutlookTime (session) {
  var time = cache_time (__myfxbook_cacheKey ("CO", session));
  return !util_is_null (time) ? util_date_epochToStr_yyyymmddhhmmss (time) : undefined
}
function myfxbook_communityOutlookData (session) {
  var result = cache_readWithLZ (__myfxbook_cacheKey ("CO", session), __myfxbook_cacheTimeOutlooksFrontEnd ());
  return !util_is_null (result) ? JSON.parse (result) : __myfxbook_communityOutlookUpdate (session);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_refresh_background_process () {
  cache_iterator_expired (__myfxbook_cacheKey ("CO"), __myfxbook_cacheTimeOutlooksBackEnd, __MYFXB_CLS, "outlook", "refresh",
    session => __myfxbook_communityOutlookUpdate (session, "background"));
}
function __myfxbook_refresh_background () {
  if (cache_checkany_expired (__myfxbook_cacheKey ("CO"), __myfxbook_cacheTimeOutlooksBackEnd))
    system_schedule ('__myfxbook_refresh_background_process');
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function myfxbook_setup () {
  run_handlerInsert (RUN_EVERY_MARKET_FAST, '__myfxbook_refresh_background');
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
