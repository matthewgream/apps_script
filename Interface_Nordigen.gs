
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __NORDIGEN_CLS = "nordigen";

// -----------------------------------------------------------------------------------------------------------------------------------------

function TEST_NORDIGEN () { __TEST_SETUP ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_cacheKey (a, b) { return "NORD_" + a + "_" + (b != undefined ? b : ""); }
function __nordigen_cacheTimeBalanceFrontEnd () { return CACHE_TIME_12H; }
function __nordigen_cacheTimeBalanceBackEnd () { return CACHE_TIME_15M; }
function __nordigen_cacheTimeInstitutions () { return CACHE_TIME_24H; }
function __nordigen_cacheTimeAuthorisation () { return CACHE_TIME_28D; }

function __nordigen_validSecretId (x) { return (!util_is_null (x) && (x.length == (8+1+4+1+4+1+4+1+12)) && /^[a-z0-9]{8}-([a-z0-9]{4}-){3}[a-z0-9]{12}$/.test (x)) ? true : false; }
function __nordigen_validSecretKey (x) { return (!util_is_null (x) && (x.length == 128)) ? true : false; }
function __nordigen_validAccount (x) { return (!util_is_null (x) && (x.length == (8+1+4+1+4+1+4+1+12)) && /^[a-z0-9]{8}-([a-z0-9]{4}-){3}[a-z0-9]{12}$/.test (x)) ? true : false; }
function __nordigen_validAccountIndex (x) { return (!util_is_nullOrZero (x) && ((x * 1.0) >= -2)) ? true : false; }
function __nordigen_validAccountName (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __nordigen_validInstitution (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __nordigen_validCountry (x) { return (!util_is_nullOrZero (x) && (x == "GB")) ? true : false; }
function __nordigen_validCurrency (x) { return (!util_is_null (x) && (x.length == 3)) ? true : false; }
function __nordigen_validDate (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __nordigen_validTransactionType (x) { return (!util_is_nullOrZero (x) && (x == "booked" || x == "pending")) ? true : false; }

// -----------------------------------------------------------------------------------------------------------------------------------------
// N25: secret_id
// O25: secret_key
//
// Q25: =NORDIGEN_ACCOUNT_ID (N25, O25, C25, R25, S25, T25)
// C25: "MONZOxyz"
// R25: "GB"
// S25: "Monzo Bank Limited"
// T25: 1
//
// I25: =NORDIGEN_BALANCE_VALUE (N25, O25, Q25, J25)
// J25: "GBP"
//
// M25: =NORDIGEN_BALANCE_TIMESTAMP (N25, O25, Q25)
// -----------------------------------------------------------------------------------------------------------------------------------------

function NORDIGEN_INSTITUTIONS (secret_id, secret_key, country) {
  util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) && __nordigen_validCountry (country));
  const token = __nordigen_access_token (secret_id, secret_key), cache_key = __nordigen_cacheKey ("IN", country);
  var institutions = cache_readWithLZ (cache_key, __nordigen_cacheTimeInstitutions ());
  if (!util_is_null (institutions))
    institutions = JSON.parse (institutions);
  else if (util_is_null (institutions) &&
      !util_is_null (institutions = (__nordigen_institutions (token, country)).map (v => v.name)))
    cache_writeWithLZ (cache_key, JSON.stringify (institutions));
  store_inc (__NORDIGEN_CLS, "institutions", country);
  return institutions;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function NORDIGEN_TRANSACTIONS (token, account, date_beg, date_end) {
  function __NORDIGEN_TRANSACTIONS (secret_id, secret_key, account, type, date_beg, date_end) {
    util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) && __nordigen_validAccount (account) && __nordigen_validTransactionType (type)
        && (util_is_nullOrZero (date_beg) || __nordigen_validDate (date_beg)) && (util_is_nullOrZero (date_end) || __nordigen_validDate (date_end)));
    store_inc (__NORDIGEN_CLS, "transactions", account);
    return nordigen_accountTransactions (__nordigen_access_token (secret_id, secret_key), account, type, date_beg, date_end);
  }
  return __NORDIGEN_TRANSACTIONS (token [0], token [1], account, "booked", date_beg, date_end);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function NORDIGEN_BALANCE (secret_id, secret_key, account, currency) {
  util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) && __nordigen_validAccount (account) && __nordigen_validCurrency (currency));
  const balance = cache_read (__nordigen_cacheKey ("BV", [account, secret_id, secret_key].join ("/")), __nordigen_cacheTimeBalanceFrontEnd ());
  store_inc (__NORDIGEN_CLS, "balance", account);
  return (!util_is_null (balance) ? balance : __NORDIGEN_BALANCE_UPDATE (secret_id, secret_key, account, currency)) * 1.0;
}
  function __NORDIGEN_BALANCE_UPDATE (secret_id, secret_key, account, currency, origin = "foreground") {
    var balance; if (!util_is_null (balance = nordigen_accountBalanceWithCurrency (__nordigen_access_token (secret_id, secret_key), account, currency))) {
      cache_write (__nordigen_cacheKey ("BV", [account, secret_id, secret_key].join ("/")), balance);
      store_inc (__NORDIGEN_CLS, "update", "balance", origin);
    }; return balance;
  }

function NORDIGEN_BALANCE_TIMESTAMP (secret_id, secret_key, account) {
  util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) && __nordigen_validAccount (account));
  var time = cache_time (__nordigen_cacheKey ("BV", [account, secret_id, secret_key].join ("/")));
  if (util_is_null (time)) return undefined;
  return util_date_epochToStr_yyyymmddhhmmss (time);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function NORDIGEN_ACCOUNT_LIST () {
  store_inc (__NORDIGEN_CLS, "list", "accounts");
  var accounts = Array ();
  cache_iterator (__nordigen_cacheKey ("BV"), triple => accounts.push (triple.split ("/") [0]));
  return accounts;
}

// account_index = -2 --> delete everything
// account_index = -1 --> force reauthorisation
// account_index = 0 --> no accounts, see how many
// account_index > 0 --> specific account from authorised list
function NORDIGEN_ACCOUNT_ID (secret_id, secret_key, account_name, account_country, account_institution, account_index) {
  util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) &&
      __nordigen_validAccountName (account_name) && __nordigen_validInstitution (account_institution) && __nordigen_validAccountIndex (account_index));
  if (account_index == -2) {
    for (var i = 0; i < 50; i++)
      cache_del (__nordigen_cacheKey ("AC", account_name+"("+i+")"));
    cache_del (__nordigen_cacheKey ("IN", account_country));
    cache_del (__nordigen_cacheKey ("IN", account_name));
    cache_del (__nordigen_cacheKey ("AU", account_name));
  }

  store_inc (__NORDIGEN_CLS, "account-id", account_name);

  var account_id = cache_read (__nordigen_cacheKey ("AC", account_name+"("+account_index+")"), __nordigen_cacheTimeAuthorisation ());
  if (account_index > 0 && !util_is_null (account_id))
    return account_id;
  debugLog ("account_id --> " + account_id);

  var institution_id = cache_read (__nordigen_cacheKey ("IN", account_name), __nordigen_cacheTimeAuthorisation ());
  if (util_is_null (institution_id)) {
    var institutions = __nordigen_institutions (__nordigen_access_token (secret_id, secret_key), account_country);
    if (util_is_null (institutions))
      return app_error_throw (__NORDIGEN_CLS, "NORDIGEN_ACCOUNT_ID: no institutions for country code " + account_country); // does not return
    var institution = institutions.find (v => (v.name == account_institution));
    if (util_is_null (institution))
      return app_error_throw (__NORDIGEN_CLS, "NORDIGEN_ACCOUNT_ID: no institution '" + account_institution +
        "' in " + util_str_join (institutions.map (v => v.name), ",") + "."); // does not return
    cache_write (__nordigen_cacheKey ("IN", account_name), institution_id = institution.id);
  }
  debugLog ("institution_id --> " + institution_id);

  var authorisation_url = cache_read (__nordigen_cacheKey ("AU", account_name), __nordigen_cacheTimeAuthorisation ());
  if (util_is_null (authorisation_url) || account_index < 0) {
    var result = __nordigen_requisition (__nordigen_access_token (secret_id, secret_key), institution_id);
    if (util_is_null (result))
      return app_error_throw (__NORDIGEN_CLS, "NORDIGEN_ACCOUNT_ID: could not get requisition for'" + institution_id + "'");
    cache_write (__nordigen_cacheKey ("AU", account_name), authorisation_url = result.link);
    return authorisation_url; // will return to cell and needs to be clicked on ...
  }
  debugLog ("authorisation_url --> " + authorisation_url);

  const accounts = __nordigen_requisitionAccounts (__nordigen_access_token (secret_id, secret_key), institution_id);
  if (util_is_null (accounts))
    return app_error_throw (__NORDIGEN_CLS, "NORDIGEN_ACCOUNT_ID: no accounts found for '" + institution_id + "'");
  debugLog ("accounts.length --> " + accounts.length);
  if (account_index <= 0 || account_index > accounts.length)
    return app_error_throw (__NORDIGEN_CLS, "NORDIGEN_ACCOUNT_ID: no account in requisition for '" + institution_id +
      "' at index " + account_index + " (" + accounts.length + " available)");
  cache_write (__nordigen_cacheKey ("AC", account_name+"("+account_index+")"), account_id = accounts [account_index - 1]);
  return account_id;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __NORD_API_URL_BASE = "https://ob.nordigen.com";
var __NORD_API_EP_TOKEN = "/api/v2/token/new/";
var __NORD_API_EP_REQUISITIONS = "/api/v2/requisitions/";
var __NORD_API_EP_ACCOUNTS = "/api/v2/accounts/";
var __NORD_API_EP_INSTITUTIONS = "/api/v2/institutions";
var __NORD_API_URL_REDIRECT = "https://google.com";

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_access_token (secret_id, secret_key) {
  var token = cache_read (__nordigen_cacheKey ("TO", secret_id), CACHE_TIME_6H);
  if (util_is_null (token) && !util_is_null (token = __nordigen_accesstoken (secret_id, secret_key)))
      cache_write (__nordigen_cacheKey ("TO", secret_id), token);
  return token;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_requestResponseToken (secret_id, secret_key) {
  store_inc (__NORDIGEN_CLS, "request", "token");
  return connect_urlJsonResponse (__NORDIGEN_CLS, __NORD_API_URL_BASE + __NORD_API_EP_TOKEN, {
    method: 'POST', headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
    payload: JSON.stringify ({ "secret_id": secret_id, "secret_key": secret_key })
  });
}

function __nordigen_requestResponseRequsition (token, institution_id) {
  store_inc (__NORDIGEN_CLS, "request", "requisition", institution_id);
  return connect_urlJsonResponse (__NORDIGEN_CLS, __NORD_API_URL_BASE + __NORD_API_EP_REQUISITIONS, {
    method: 'POST', headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': "Bearer " + token },
    payload: JSON.stringify ({ "redirect": __NORD_API_URL_REDIRECT, "institution_id": institution_id})
  });
}

function __nordigen_requestResponse (token, url) {
  store_inc (__NORDIGEN_CLS, "request", "response", util_str_isolateURI (url));
  return connect_urlJsonResponse (__NORDIGEN_CLS, url, {
    method: "GET", headers: { 'accept': 'application/json', 'Authorization': "Bearer " + token }
  });
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_accesstoken (secret_id, secret_key) {
  var result = __nordigen_requestResponseToken (secret_id, secret_key);
  if (util_is_nullOrZero (result) || util_is_nullOrZero (result.access))
    return undefined;
  return result.access;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_institutions (token, country) {
  return __nordigen_requestResponse (token, __NORD_API_URL_BASE + __NORD_API_EP_INSTITUTIONS + "?country=" + country);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_requisition (token, institution_id) {
  return __nordigen_requestResponseRequsition (token, institution_id);
}

function __nordigen_requisitionAccounts (token, institution_id) {
  var result = __nordigen_requisitionFind (token, institution_id);
  if (util_is_nullOrZero (result) || util_is_nullOrZero (result.accounts))
    return undefined;
  return result.accounts.sort (); // linked vs. CR=created
}

function __nordigen_requisitionFind (token, institution_id) {
  var url = __NORD_API_URL_BASE + __NORD_API_EP_REQUISITIONS, requisition = undefined;
  while (!util_is_null (url)) {
    var requisitions = __nordigen_requestResponse (token, url);
    if (util_is_nullOrZero (requisitions))
      break;
    if (!util_is_nullOrZero (requisition = requisitions.results.find (v => v.status == "LN" && v.institution_id == institution_id))) // linked vs. CR=created
      break;
    url = requisitions.next;
  }
  return requisition;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_accountBalance (token, account_id) {
  return __nordigen_requestResponse (token, __NORD_API_URL_BASE + __NORD_API_EP_ACCOUNTS + account_id + "/balances/");
}

function nordigen_accountBalanceWithCurrency (token, account_id, currency) {
//  if (util_is_nullOrZero (currency))
//    return app_error_throw2 (__NORDIGEN_CLS, "GET_BALANCE: currency not defined"); // does not return
  var result = __nordigen_accountBalance (token, account_id);
  if (util_is_nullOrZero (result) || util_is_nullOrZero (result.balances))
    return undefined;
  var balance = result.balances [0]; // hope it's always like that
  if (!util_is_nullOrZero (currency) && balance.balanceAmount.currency != currency)
    return app_error_throw (__NORDIGEN_CLS, "NORDIGEN_BALANCE: currency mismatch, got " + balance.balanceAmount.currency + ", expected " + currency); // does not return
  return balance.balanceAmount.amount;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_accountTransactions (token, account_id, date_beg, date_end) {
  var args = Array ();
  if (!util_is_nullOrZero (date_beg)) args.push ("date_from=" + date_beg);
  if (!util_is_nullOrZero (date_end)) args.push ("date_to=" + util_date_strAsyyyymmdd_minusminus (date_end)); // XXX
  return __nordigen_requestResponse (token, __NORD_API_URL_BASE + __NORD_API_EP_ACCOUNTS + account_id + "/transactions/" + (args.length > 0 ? "?" + util_str_join (args, "&") : ""));
}

function nordigen_accountTransactions (token, account_id, type, date_beg, date_end) {
  var result = __nordigen_accountTransactions (token, account_id, date_beg, date_end);
  if (util_is_nullOrZero (result) || util_is_nullOrZero (result.transactions))
    return undefined;
  return ((type == "booked") ? result.transactions.booked : ((type == "pending") ? results.transactions.pending : undefined))
    .sort ((a, b) => (a.bookingDate < b.bookingDate) ? -1 : ((a.bookingDate > b.bookingDate) ? 1 : 0));
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_refresh_background_process () {
  cache_iterator_expired (__nordigen_cacheKey ("BV"), __nordigen_cacheTimeBalanceBackEnd, __NORDIGEN_CLS, "accounts", "refresh",
      triple => { var t = triple.split ("/"); return __NORDIGEN_BALANCE_UPDATE (t [1], t [2], t [0], undefined, "background"); });
}
function __nordigen_refresh_background () {
  if (cache_checkany_expired (__nordigen_cacheKey ("BV"), __nordigen_cacheTimeBalanceBackEnd))
    system_schedule ('__nordigen_refresh_background_process');
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function nordigen_setup () {
  run_handlerInsert (RUN_EVERY_MARKET_FAST, '__nordigen_refresh_background');
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
