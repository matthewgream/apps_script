
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __MYFXB_CLS = "myfxbook";

// -----------------------------------------------------------------------------------------------------------------------------------------

function TEST_MYFXBOOK () { __TEST_SETUP ();
  
  debugLog (myfxbook_sessionLogin (MYFXBOOK_DEFAULT_EMAIL, MYFXBOOK_DEFAULT_PASSWORD));
  debugLog (__myfxbook_communityOutlookUpdate (myfxbook_sessionToken (MYFXBOOK_DEFAULT_EMAIL)));

  const symbols_s = util_sheet_getRangeByAddress ("Xs!$A6:$A").getValues ().flat (Infinity).filter (v => !util_is_nullOrZero (v)), symbols_m = MARKET_SYMBOLS ();
  const symbols = util_uniq (util_concat (symbols_s, symbols_m)).sort (), details = Object.keys (__myfxbook_communityOutlookSymbolsDetail ());
  const results = MYFXBOOK_OUTLOOK_PAIRTYPE (MYFXBOOK_DEFAULT_EMAIL, MYFXBOOK_DEFAULT_PASSWORD, symbols.map (s => [ s ]), [ details ]);
  results.forEach ((r_, i) => debugLog (symbols [i] + " --> " + 
    r_.map ((rr_, j) => (rr_ == "" ? "" : details [j] + " " + util_num_rndNN (rr_))).join (", ")));
  
  debugLog (MYFXBOOK_OUTLOOK_TIMESTAMP (MYFXBOOK_DEFAULT_EMAIL));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_cacheKey (a, b) { return "MFXB_" + a + "_" + ((b != undefined) ? b : ""); }
function __myfxbook_cacheTimeOutlooksBackEnd () { return CACHE.TIME_15M; }
function __myfxbook_cacheTimeOutlooksFrontEnd () { return CACHE.TIME_12H; }
function __myfxbook_cacheTimeBackoff () { return CACHE.TIME_1H; }
function __myfxbook_cacheTimeSession () { return CACHE.TIME_24H; }

function __myfxbook_validEmail (x) { return (!util_is_nullOrZero (x) && (util_str_includes (x, "@"))) ? true : false; }
function __myfxbook_validPassword (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __myfxbook_validPair (x) { return (!util_is_nullOrZero (x) && (x [0] != '#') && (x.length <= 6)) ? true : false; }
function __myfxbook_validType (x) { return (!util_is_nullOrZero (x) && !util_is_null (__myfxbook_communityOutlookSymbolsDetail () [x])) ? true : false; }

// -----------------------------------------------------------------------------------------------------------------------------------------

// XXX note is case sensitive, assumes upper case ...
function MYFXBOOK_OUTLOOK_PAIRTYPE (email, password, pair, type) {
  util_args_check (__myfxbook_validEmail (email) && __myfxbook_validPassword (password));
  var session = myfxbook_sessionToken (email);
  if (util_is_nullOrZero (session)) session = myfxbook_sessionLogin (email, password);
  const outlooks = !util_is_nullOrZero (session) ? myfxbook_communityOutlookData (session) : undefined;
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

var __MYFXB_CFG = {
  URL_BASE: "https://www.myfxbook.com/api",
  EP_LOGIN: "/login.xml",
  EP_LOGOUT: "/logout.xml",
  EP_COMMUNITYOUTLOOK: "/get-community-outlook.xml"
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_requestResponse_Base (url, params) { // XXX YUCK
  const result = util_exception_wrapper (() =>
    connect_urlXmlResponse (__MYFXB_CLS, __MYFXB_CFG ['URL_BASE'] + url + ((util_is_null (params) ? "" : "?" + params)), { method: "GET", headers: { 'accept': 'application/xml' } }),
    (e) => app_error_throw (__MYFXB_CLS, e));
  const value = result.getAttribute ("error"); if (!util_is_nullOrZero (value) && value.getValue () == "true")
    app_error_throw (__MYFXB_CLS, "__myfxbook_requestResponse_Base", util_str_isolateURI (__MYFXB_CFG ['URL_BASE'] + url), result.getAttribute ("message").getValue ());
  return result;
}
function __myfxbook_requestResponseLogin (email, password) {
  store_inc (__MYFXB_CLS, "request", "login", email);
  return __myfxbook_requestResponse_Base (__MYFXB_CFG ['EP_LOGIN'], "email=" + email + "&password=" + password);
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
      var session = result.getChildren ().find (v => util_str_lower (v.getName ()) == "session");
      if (!util_is_nullOrZero (session) && !util_is_nullOrZero (session = session.getText ())) {
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
    return __myfxbook_requestResponse (__MYFXB_CFG ['EP_LOGOUT'], session);
  }
  return undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_communityOutlookSymbolsDetail () { return {
  "short": [ "shortPercentage", 0.01 ], "shortVol": [ "shortVolume", 1.0 ], "shortVal": [ "avgShortPrice", 1.0 ], "shortPos": [ "shortPositions", 1.0 ],
  "long": [ "longPercentage", 0.01 ], "longVol": [ "longVolume", 1.0 ], "longVal": [ "avgLongPrice", 1.0 ], "longPos": [ "longPositions", 1.0 ] }; 
}
function __myfxbook_communityOutlookSymbols (response) {
  return response.reduce ((symbols, values) => util_assign (symbols, values.getChild ("name").getText (),
    Object.entries (__myfxbook_communityOutlookSymbolsDetail ()).reduce ((attributes, [attribute, value]) =>
      util_assign (attributes, attribute, values.getChild (value [0]).getText () * value [1]), {})), {});
}
function __myfxbook_communityOutlook (session) {
  var result = __myfxbook_requestResponse (__MYFXB_CFG ['EP_COMMUNITYOUTLOOK'], session);
  if (!util_is_null (result) && !util_is_null (result = result.getChildren ().find (v => util_str_lower (v.getName ()) == "community-outlook" && !util_is_null (v.getChild ("symbols")))))
      result = __myfxbook_communityOutlookSymbols (result.getChild ("symbols").getChildren ());
  return result;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_communityOutlookUpdate (session, origin = "foreground") {
  const result = __myfxbook_communityOutlook (session); if (!util_is_null (result)) {
    cache_writeWithLZ (__myfxbook_cacheKey ("CO", session), JSON.stringify (result));
    store_inc (__MYFXB_CLS, "update", "outlook", origin);
  }; return result;
}
function myfxbook_communityOutlookTime (session) {
  const time = cache_time (__myfxbook_cacheKey ("CO", session));
  return !util_is_null (time) ? util_date_epochToStr_yyyymmddhhmmss (time) : undefined
}
function myfxbook_communityOutlookData (session) {
  const result = cache_readWithLZ (__myfxbook_cacheKey ("CO", session), __myfxbook_cacheTimeOutlooksFrontEnd ());
  return !util_is_null (result) ? JSON.parse (result) : __myfxbook_communityOutlookUpdate (session);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __myfxbook_refresh_details () {
  const __t = "background", __d = {
    "CO": { time: __myfxbook_cacheTimeOutlooksBackEnd, name: "outlook", func: p => __myfxbook_communityOutlookUpdate (p, __t) },
  }; return __d;
}
function __myfxbook_refresh_background_process (keys) { cache_table_refresh_background_process (keys, __myfxbook_refresh_details (), __myfxbook_cacheKey, __MYFXB_CLS); }
function __myfxbook_refresh_background () { cache_table_refresh_background (__myfxbook_refresh_details (), __myfxbook_cacheKey, '__myfxbook_refresh_background_process'); }

function myfxbook_setup () {
  app_run (RUN_EVERY_MARKET.FAST, '__myfxbook_refresh_background');
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
