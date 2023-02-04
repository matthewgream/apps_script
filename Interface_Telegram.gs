
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function TEST_TELEGRAM () { __TEST_SETUP ();
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_validUser (x) { return (!util_is_nullOrZero (x)) ? true : false; }
function __telegram_validMessage (x) { return (!util_is_nullOrZero (x)) ? true : false; }

// -----------------------------------------------------------------------------------------------------------------------------------------

function TELEGRAM_SEND (user, message) {
  util_args_check (__telegram_validUser (user) && __telegram_validMessage (message));
  telegram_messageTransmit (user, message);
}
function TELEGRAM_SEND_BACKGROUND (user, message) {
  util_args_check (__telegram_validUser (user) && __telegram_validMessage (message));
  __telegram_background_enqueue (user, message);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_cacheKey (a) { return "TGAM_" + a; }

var __TGAM_CLS = "telegram";

var __TGAM_CFG = {
  API_URL_BASE: "https://api.telegram.org/bot"
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_urlWebHook () {
  return APP_URL ();
}
function __telegram_urlWebAPI () {
  return __TGAM_CFG ['API_URL_BASE'] + TELEGRAM_DEFAULT_KEY;
}

function __telegram_requestResponse (path) {
  return connect_urlJsonResponse (__TGAM_CLS, __telegram_urlWebAPI () + "/" + path, { method: 'GET' });
}
function __telegram_requestResponsePost (path, data) {
  return connect_urlJsonResponse (__TGAM_CLS, __telegram_urlWebAPI () + "/" + path, { method: 'POST', payload: data });
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_messageTransmit (user, text) {
  var id = __telegram_chatIdLookup (user);
  if (util_is_nullOrZero (id))
    return undefined;
  var r = __telegram_requestResponsePost ("", { method: "sendMessage", chat_id: String (id), text: text, parse_mode: "HTML" });
  log (__TGAM_CLS, "send [" + user + "]: " + text.replaceAll ("\n", "\\n").replaceAll ("\r", "\\r"));
  store_inc (__TGAM_CLS, "message", "transmit");
  return r;
}

function telegram_messageReceive (user, text) {
  store_inc (__TGAM_CLS, "message", "receive");
  log (__TGAM_CLS, "[" + user + "] <<< " + text);
  // XXX
  telegram_messageTransmit (user, "Thanks! " + user + " for your message: " + text);
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_whitelistVerify (u) {
  var whitelist = cache_read (__telegram_cacheKey ("wh"));
  return (!util_is_nullOrZero (whitelist) && !util_is_nullOrZero (whitelist = JSON.parse (whitelist)) && whitelist.includes (u)) ? true : false;
}

function telegram_whitelistInsert (u) {
  var whitelist = cache_read (__telegram_cacheKey ("wh"));
  if (util_is_nullOrZero (whitelist = (util_is_nullOrZero (whitelist) ? Array () : JSON.parse (whitelist))) || ! whitelist.includes (u)) {
    cache_write (__telegram_cacheKey ("wh"), JSON.stringify (util_push (whitelist, u)));
    store_inc (__TGAM_CLS, "whitelist", "insert");
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_chatIdLookup (u) {
  var i = __telegram_chatIdLocate (u);
  if (util_is_nullOrZero (i) && !util_is_nullOrZero (i = __telegram_chatIdIdentify (u)))
    __telegram_chatIdUpdate (u, i);
  return i;
}

function __telegram_chatIdLocate (u) {
  var ids = cache_read (__telegram_cacheKey ("id"));
  return (!util_is_nullOrZero (ids) && !util_is_nullOrZero (ids = JSON.parse (ids)) && !util_is_nullOrZero (ids [u])) ? String (ids [u]) : undefined;
}

function __telegram_chatIdUpdate (u, i) {
  var ids = cache_read (__telegram_cacheKey ("id"));
  if (!util_is_nullOrZero (ids = (util_is_nullOrZero (ids)) ? {} : JSON.parse (ids)) && util_is_nullOrZero (ids [u])) {
    ids [u] = i;
    cache_write (__telegram_cacheKey ("id"), JSON.stringify (ids));
    store_inc (__TGAM_CLS, "chat-id", "update");
    return true;
  }
  return false;
}

function __telegram_chatIdIdentify (u) {
  var r = __telegram_requestResponse ("getUpdates");
  if (util_is_nullOrZero (r) || util_is_nullOrZero (r.result))
    return undefined;
  var i = r.result.reduce ((p, v) => (!util_is_nullOrZero (v.message) && !util_is_nullOrZero (v.message.chat) &&
    !util_is_nullOrZero (v.message.chat.username) && util_str_lower (v.message.chat.username) == util_str_lower (u)) ? String (v.message.chat.id) : p, undefined);
  store_inc (__TGAM_CLS, "chat-id", "identify");
  return i;
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_webhookInsert () {
  store_inc (__TGAM_CLS, "webhook", "insert");
  return __telegram_requestResponse ("setWebhook?url=" + __telegram_urlWebHook ());
}

function __telegram_webhookRemove () {
  store_inc (__TGAM_CLS, "webhook", "remove");
  return __telegram_requestResponse ("deleteWebhook?url=" + __telegram_urlWebHook ());
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram__doPost (t, e) {
  if (t != "POST" || util_is_nullOrZero (e.postData.contents))
    return false;
  var contents = JSON.parse (e.postData.contents);
  if (util_is_nullOrZero (contents) || util_is_nullOrZero (contents.message))
    store_inc (__TGAM_CLS, "message", "malformed");
  else {
    var chat = contents.message.from.id, user = contents.message.from.username, text = contents.message.text;
    if (!telegram_whitelistVerify (user)) {
        log (__TGAM_CLS, "[" + user + "] *** not whitelisted");
        store_inc (__TGAM_CLS, "message", "unverified");
    } else {
      if (__telegram_chatIdUpdate (user, chat))
          log (__TGAM_CLS, "[" + user + "] === " + chat);
      telegram_messageReceive (user, text);
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

function __telegram_queue () { return "tq"; }
function __telegram_queueAppend (m) { if (!util_is_nullOrZero (m)) queue_set_c (__telegram_queue (), queue_pop_n (__telegram_queue (), "W"), m); }
function __telegram_queueObtain () { var m = Array (), w = queue_get_n (__telegram_queue (), "W") - 1, r = queue_get_n (__telegram_queue (), "R");
  if (r < w && queue_set_n (__telegram_queue (), "R", w)) while (r <= w) m.push (queue_pop_c (__telegram_queue (), r ++)); return m.filter (m_ => m_ != undefined && m_.length > 0); }

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_background_enqueue (user, message) {
  __telegram_queueAppend ([ user, message ]);
}
function __telegram_background_process () {
  const number = __telegram_queueObtain ().map (m_ => telegram_messageTransmit (m_ [0], m_ [1])).filter (r => !util_is_null (r)).length;
  store_inc (__TGAM_CLS, "background", "process");
  if (number > 0) store_add (number, __TGAM_CLS, "background", "volume");
}
function __telegram_background_setup () {
  __system_timer_setup (timer_createMinutes, "__telegram_background_process", 1);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
