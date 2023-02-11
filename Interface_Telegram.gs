
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function TEST_TELEGRAM () { __TEST_SETUP ();
  TELEGRAM_SEND_FOREGROUND (APPLICATION_USER_TELEGRAM, "Hello FG (" + APPLICATION_NAME + ")");
  TELEGRAM_SEND_BACKGROUND (APPLICATION_USER_TELEGRAM, "Hello BG (" + APPLICATION_NAME + ")");
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_validUsername (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __telegram_validMessage (x) { return (!util_is_nullOrZero (x)) ? true : false; }

// -----------------------------------------------------------------------------------------------------------------------------------------

function TELEGRAM_SEND (username, message) {
  util_args_check (__telegram_validUsername (username) && __telegram_validMessage (message));
  return __telegram_background_enqueue (username, message);
}
function TELEGRAM_SEND_FOREGROUND (username, message) {
  util_args_check (__telegram_validUsername (username) && __telegram_validMessage (message));
  return !util_is_null (telegram_messageTransmit (username, message));
}
function TELEGRAM_SEND_BACKGROUND (username, message) {
  util_args_check (__telegram_validUsername (username) && __telegram_validMessage (message));
  return __telegram_background_enqueue (username, message);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

var __TGAM_CLS = "telegram";
var __TGAM_CFG = {
  API_URL_BASE: "https://api.telegram.org/bot"
}

function __telegram_cacheKey (a) { return "TGAM_" + a; }

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_urlWebHook () {
  return APP_URL ();
}
function __telegram_urlWebAPI () {
  return __TGAM_CFG ['API_URL_BASE'] + TELEGRAM_DEFAULT_KEY;
}
function __telegram_requestResponse (path, data = undefined) {
  return connect_urlJsonResponse (__TGAM_CLS, __telegram_urlWebAPI () + "/" + path, util_is_null (data) ? { method: 'GET' } : { method: 'POST', payload: data });
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_messageTransmit (username, text) {
  store_inc (__TGAM_CLS, "message", "transmit", "count");
  store_add (text.length, __TGAM_CLS, "message", "transmit", "volume");
  var id = __telegram_chatIdLookup (username);
  if (util_is_nullOrZero (id))
    return undefined;
  var response = __telegram_requestResponse ("", { method: "sendMessage", chat_id: String (id), text: text, parse_mode: "HTML" });
  log (__TGAM_CLS, "send [" + username + "]: " + text.replaceAll ("\n", "\\n").replaceAll ("\r", "\\r"));
  return response;
}
function telegram_messageReceive (username, text) {
  store_inc (__TGAM_CLS, "message", "receive", "count");
  store_add (text.length, __TGAM_CLS, "message", "receive", "volume");
  log (__TGAM_CLS, "[" + username + "] <<< " + text);
  // XXX
  telegram_messageTransmit (username, "Thanks! " + username + " for your message: " + text);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_whitelistVerify (username) {
  var whitelist = cache_read (__telegram_cacheKey ("wh"));
  return (!util_is_nullOrZero (whitelist) && !util_is_nullOrZero (whitelist = JSON.parse (whitelist)) && whitelist.includes (username)) ? true : false;
}
function telegram_whitelistInsert (username) {
  var whitelist = cache_read (__telegram_cacheKey ("wh"));
  if (util_is_nullOrZero (whitelist = (util_is_nullOrZero (whitelist) ? Array () : JSON.parse (whitelist))) || ! whitelist.includes (username)) {
    cache_write (__telegram_cacheKey ("wh"), JSON.stringify (util_push (whitelist, username)));
    store_inc (__TGAM_CLS, "whitelist", "insert");
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_chatIdLookup (username) {
  var id; if (util_is_nullOrZero (id = __telegram_chatIdCacheLocate (username)) && !util_is_nullOrZero (id = __telegram_chatIdIdentifyFromUpdates (username)))
    __telegram_chatIdCacheUpdate (username, id);
  return id;
}
function __telegram_chatIdCacheLocate (username) {
  var ids; return (!util_is_nullOrZero (ids = cache_read (__telegram_cacheKey ("id"))) && !util_is_nullOrZero (ids = JSON.parse (ids)) && !util_is_nullOrZero (ids [username])) ? 
    String (ids [username]) : undefined;
}
function __telegram_chatIdCacheUpdate (username, id) {
  var ids; if (!util_is_nullOrZero (ids = (!util_is_nullOrZero (cache_read (__telegram_cacheKey ("id"))) ? JSON.parse (ids) : {})) && util_is_nullOrZero (ids [username])) {
    ids [username] = id;
    cache_write (__telegram_cacheKey ("id"), JSON.stringify (ids));
    store_inc (__TGAM_CLS, "chatid", "update");
    return true;
  }
  return false;
}
function __telegram_chatIdIdentifyFromUpdates (username) {
  var result = __telegram_requestResponse ("getUpdates");
  if (util_is_nullOrZero (result) || util_is_nullOrZero (result = result.result))
    return undefined;
  result = result.find (r => (!util_is_nullOrZero (r.message) && !util_is_nullOrZero (r.message.chat) && !util_is_nullOrZero (r.message.chat.username) && 
    util_str_lower (r.message.chat.username) == util_str_lower (username)));
  store_inc (__TGAM_CLS, "chatid", "identify");
  return !util_is_nullOrZero (result) ? result.message.chat.id : undefined;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_webhookInsert () {
  store_inc (__TGAM_CLS, "webhook", "insert");
  return !util_is_null (__telegram_requestResponse ("setWebhook?url=" + __telegram_urlWebHook ()));
}
function __telegram_webhookRemove () {
  store_inc (__TGAM_CLS, "webhook", "remove");
  return !util_is_null (__telegram_requestResponse ("deleteWebhook?url=" + __telegram_urlWebHook ()));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram__doPost (type, e) {
  if (type != "POST" || util_is_nullOrZero (e.postData.contents))
    return false;
  var contents = JSON.parse (e.postData.contents);
  if (util_is_nullOrZero (contents) || util_is_nullOrZero (contents.message))
    store_inc (__TGAM_CLS, "message", "malformed");
  else {
    var id = contents.message.from.id, username = contents.message.from.username, text = contents.message.text;
    if (!telegram_whitelistVerify (username))
      log (__TGAM_CLS, "[" + username + "] *** not whitelisted"), store_inc (__TGAM_CLS, "message", "unverified");
    else if (__telegram_chatIdCacheUpdate (username, id)) {
      log (__TGAM_CLS, "[" + username + "] === " + id), store_inc (__TGAM_CLS, "message", "updated");
      telegram_messageReceive (username, text);
    }
  }
  return true;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_setup () { __TEST_SETUP ();
  system_register_webHandlerPOST ('__telegram__doPost');
  __telegram_background_setup ();

//  __telegram_webhookRemove ();
//  __telegram_webhookInsert ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_queueName () { return "tq"; }
function __telegram_queueAppend (m) { return !util_is_nullOrZero (m) ? queue_set_c (__telegram_queueName (), queue_pop_n (__telegram_queueName (), "W"), m) : false; }
function __telegram_queueObtain () { var m = Array (), w = queue_get_n (__telegram_queueName (), "W") - 1, r = queue_get_n (__telegram_queueName (), "R");
  if (r < w && queue_set_n (__telegram_queueName (), "R", w)) while (r <= w) m.push (queue_pop_c (__telegram_queueName (), r ++)); return m.filter (m_ => !util_is_nullOrZero (m_)); }

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_background_enqueue (username, message) {
  return __telegram_queueAppend ([ username, message ]);
}
function __telegram_background_process () {
  const number = __telegram_queueObtain ().map (m => telegram_messageTransmit (m [0], m [1])).filter (r => !util_is_null (r)).length;
  store_inc (__TGAM_CLS, "background", "process");
  if (number > 0) store_add (number, __TGAM_CLS, "background", "volume");
}
function __telegram_background_setup () {
  __system_timer_setup (timer_createMinutes, "__telegram_background_process", 1);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
