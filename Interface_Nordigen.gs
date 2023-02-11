
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __NORDIGEN_CLS = "nordigen";

// -----------------------------------------------------------------------------------------------------------------------------------------

function TEST_NORDIGEN () { __TEST_SETUP ();
  [ "GB", "FR", "SE" ].forEach (x => debugLog (x + " --> " + NORDIGEN_INSTITUTIONS (NORDIGEN_DEFAULT_ID, NORDIGEN_DEFAULT_KEY, x)));
  NORDIGEN_ACCOUNT_LIST ().forEach (x => debugLog (x + " --> " + NORDIGEN_BALANCE (NORDIGEN_DEFAULT_ID, NORDIGEN_DEFAULT_KEY, x)));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_cacheKey (a, b) { return "NORD_" + a + "_" + (b != undefined ? b : ""); }
function __nordigen_cacheTimeBalanceFrontEnd () { return CACHE.TIME_12H; }
function __nordigen_cacheTimeBalanceBackEnd () { return CACHE.TIME_15M; }
function __nordigen_cacheTimeInstitutions () { return CACHE.TIME_24H; }
function __nordigen_cacheTimeAuthorisation () { return CACHE.TIME_28D; }

function __nordigen_validSecretId (x) { return (!util_is_null (x) && (x.length == (8+1+4+1+4+1+4+1+12)) && /^[a-z0-9]{8}-([a-z0-9]{4}-){3}[a-z0-9]{12}$/.test (x)) ? true : false; }
function __nordigen_validSecretKey (x) { return (!util_is_null (x) && (x.length == 128)) ? true : false; }
function __nordigen_validAccount (x) { return (!util_is_null (x) && (x.length == (8+1+4+1+4+1+4+1+12)) && /^[a-z0-9]{8}-([a-z0-9]{4}-){3}[a-z0-9]{12}$/.test (x)) ? true : false; }
function __nordigen_validAccountIndex (x) { return (!util_is_nullOrZero (x) && ((x * 1.0) >= -2)) ? true : false; }
function __nordigen_validAccountName (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __nordigen_validInstitution (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __nordigen_validCountry (x) { return (!util_is_nullOrZero (x) && (x == "GB" || x == "FR" || x == "SE")) ? true : false; } // XXX for now
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
// I25: =NORDIGEN_BALANCE_VALUE (N25, O25, Q25)
//
// M25: =NORDIGEN_BALANCE_TIMESTAMP (N25, O25, Q25)
// -----------------------------------------------------------------------------------------------------------------------------------------

function NORDIGEN_INSTITUTIONS (secret_id, secret_key, country) {
  util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) && __nordigen_validCountry (country));
  const token = __nordigen_access_token (secret_id, secret_key), cache_key = __nordigen_cacheKey ("IN", country);
  var institutions = cache_readWithLZ (cache_key, __nordigen_cacheTimeInstitutions ());
  if (!util_is_null (institutions))
    institutions = JSON.parse (institutions);
  else if (!util_is_nullOrZero (institutions = (__nordigen_institutions (token, country)).map (v => v.name)))
    cache_writeWithLZ (cache_key, JSON.stringify (institutions));
  store_inc (__NORDIGEN_CLS, "institutions", country);
  return institutions;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function NORDIGEN_TRANSACTIONS (secret_id, secret_key, account, type, date_beg, date_end) {
  util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) && __nordigen_validAccount (account) && __nordigen_validTransactionType (type)
      && (util_is_nullOrZero (date_beg) || __nordigen_validDate (date_beg)) && (util_is_nullOrZero (date_end) || __nordigen_validDate (date_end)));
  store_inc (__NORDIGEN_CLS, "transactions", account);
  return nordigen_accountTransactions (__nordigen_access_token (secret_id, secret_key), account, type, date_beg, date_end);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function NORDIGEN_BALANCE (secret_id, secret_key, account) {
  util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) && __nordigen_validAccount (account));
  const balance = cache_read (__nordigen_cacheKey ("BX", [account, secret_id, secret_key].join ("/")), __nordigen_cacheTimeBalanceFrontEnd ());
  store_inc (__NORDIGEN_CLS, "balance", account);
  return !util_is_null (balance) ? JSON.parse (balance) : __NORDIGEN_BALANCE_UPDATE (secret_id, secret_key, account);
}
function __NORDIGEN_BALANCE_UPDATE (secret_id, secret_key, account, origin = "foreground") {
  var balance = nordigen_accountBalanceWithCurrency (__nordigen_access_token (secret_id, secret_key), account); if (!util_is_null (balance)) {
    cache_write (__nordigen_cacheKey ("BX", [account, secret_id, secret_key].join ("/")), JSON.stringify (balance));
    store_inc (__NORDIGEN_CLS, "update", "balance", origin);
  }; return balance;
}

function NORDIGEN_BALANCE_TIMESTAMP (secret_id, secret_key, account) {
  util_args_check (__nordigen_validSecretId (secret_id) && __nordigen_validSecretKey (secret_key) && __nordigen_validAccount (account));
  const time = cache_time (__nordigen_cacheKey ("BV", [account, secret_id, secret_key].join ("/")));
  return (!util_is_null (time)) ? util_date_epochToStr_yyyymmddhhmmss (time) : undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function NORDIGEN_ACCOUNT_LIST () {
  store_inc (__NORDIGEN_CLS, "list", "accounts");
  const accounts = Array (); cache_iterator (__nordigen_cacheKey ("BV"), triple => accounts.push (triple.split ("/") [0]));
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

  store_inc (__NORDIGEN_CLS, "account", account_name);

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

var __NORDIGEN_CFG = {
  URL_BASE: "https://ob.nordigen.com",
  EP_TOKEN: "/api/v2/token/new/",
  EP_REQUISITIONS: "/api/v2/requisitions/",
  EP_ACCOUNTS: "/api/v2/accounts/",
  EP_INSTITUTIONS: "/api/v2/institutions",
  URL_REDIRECT: "https://google.com"
};

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_access_token (secret_id, secret_key) {
  var token = cache_read (__nordigen_cacheKey ("TO", secret_id), CACHE.TIME_6H);
  if (util_is_null (token) && !util_is_null (token = __nordigen_accesstoken (secret_id, secret_key)))
      cache_write (__nordigen_cacheKey ("TO", secret_id), token);
  return token;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_requestResponseToken (secret_id, secret_key) {
  store_inc (__NORDIGEN_CLS, "request", "token");
  return connect_urlJsonResponse (__NORDIGEN_CLS, __NORDIGEN_CFG ['URL_BASE'] + __NORDIGEN_CFG ['EP_TOKEN'], {
    method: 'POST', headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
    payload: JSON.stringify ({ "secret_id": secret_id, "secret_key": secret_key }) });
}

function __nordigen_requestResponseRequsition (token, institution_id) {
  store_inc (__NORDIGEN_CLS, "request", "requisition", institution_id);
  return connect_urlJsonResponse (__NORDIGEN_CLS, __NORDIGEN_CFG ['URL_BASE'] + __NORDIGEN_CFG ['EP_REQUISITIONS'], {
    method: 'POST', headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': "Bearer " + token },
    payload: JSON.stringify ({ "redirect": __NORDIGEN_CFG ['URL_REDIRECT'], "institution_id": institution_id}) });
}

function __nordigen_requestResponse (token, url) {
  store_inc (__NORDIGEN_CLS, "request", "response", util_str_isolateURI (url));
  return connect_urlJsonResponse (__NORDIGEN_CLS, url, { method: "GET", headers: { 'accept': 'application/json', 'Authorization': "Bearer " + token } });
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_accesstoken (secret_id, secret_key) {
  const result = __nordigen_requestResponseToken (secret_id, secret_key);
  return !util_is_nullOrZero (result) && !util_is_nullOrZero (result.access) ? result.access : undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_institutions (token, country) {
  return __nordigen_requestResponse (token, __NORDIGEN_CFG ['URL_BASE'] + __NORDIGEN_CFG ['EP_INSTITUTIONS'] + "?country=" + country);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_requisition (token, institution_id) {
  return __nordigen_requestResponseRequsition (token, institution_id);
}

function __nordigen_requisitionAccounts (token, institution_id) {
  const result = __nordigen_requisitionFind (token, institution_id);
  return !util_is_nullOrZero (result) && !util_is_nullOrZero (result.accounts) ? result.accounts.sort () : undefined;
}

function __nordigen_requisitionFind (token, institution_id) {
  var url = __NORDIGEN_CFG ['URL_BASE'] + __NORDIGEN_CFG ['EP_REQUISITIONS'], requisitions;
  while (!util_is_null (url) && !util_is_nullOrZero (requisitions = __nordigen_requestResponse (token, url))) {
    const requisition = requisitions.results.find (v => v.status == "LN" && v.institution_id == institution_id); // linked vs. CR=created
    if (!util_is_nullOrZero (requisition))
      return requisition;
    url = requisitions.next;
  }
  return undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_accountBalance (token, account_id) {
  return __nordigen_requestResponse (token, __NORDIGEN_CFG ['URL_BASE'] + __NORDIGEN_CFG ['EP_ACCOUNTS'] + account_id + "/balances/");
}

function nordigen_accountBalanceWithCurrency (token, account_id) {
  const result = __nordigen_accountBalance (token, account_id);
  return !util_is_nullOrZero (result) && !util_is_nullOrZero (result.balances) ? [result.balances [0].balanceAmount.amount * 1.0, result.balances [0].balanceAmount.currency]  : undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_accountTransactions (token, account_id, date_beg, date_end) {
  const args = Array ();
  if (!util_is_nullOrZero (date_beg)) args.push ("date_from=" + date_beg);
  if (!util_is_nullOrZero (date_end)) args.push ("date_to=" + util_date_strAsyyyymmdd_minusminus (date_end)); // XXX
  args = args.length > 0 ? "?" + util_str_join (args, "&") : "";
  return __nordigen_requestResponse (token, __NORDIGEN_CFG ['URL_BASE'] + __NORDIGEN_CFG ['EP_ACCOUNTS'] + account_id + "/transactions/" + args);
}

function nordigen_accountTransactions (token, account_id, type, date_beg, date_end) {
  const result = __nordigen_accountTransactions (token, account_id, date_beg, date_end);
  return !util_is_nullOrZero (result) && !util_is_nullOrZero (result.transactions) ? 
    ((type == "booked") ? result.transactions.booked : ((type == "pending") ? results.transactions.pending : undefined))
    .sort ((a, b) => (a.bookingDate < b.bookingDate) ? -1 : ((a.bookingDate > b.bookingDate) ? 1 : 0)) : undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __nordigen_refresh_details () {
  const __p = (p, n) => p.split ("/") [n], __t = "background", __d = {
    "BX": { time: __nordigen_cacheTimeBalanceBackEnd, name: "accounts", func: p => __NORDIGEN_BALANCE_UPDATE (__p (p, 1), __p (p, 2), __p (p, 0), __t) },
  }; return __d;
}
function __nordigen_refresh_background_process (keys) { cache_table_refresh_background_process (keys, __nordigen_refresh_details (), __nordigen_cacheKey, __NORDIGEN_CLS); }
function __nordigen_refresh_background () { cache_table_refresh_background (__nordigen_refresh_details (), __nordigen_cacheKey, '__nordigen_refresh_background_process'); }

function nordigen_setup () {
  app_run (RUN_EVERY_MARKET.FAST, '__nordigen_refresh_background');
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
