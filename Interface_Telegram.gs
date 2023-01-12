
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function TELEGRAM_SEND (user, message) {
  telegram_messageTransmit (user, message);
}
function TELEGRAM_SEND_BACKGROUND (user, message) {
  __telegram_background_enqueue (user, message);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_requestURI () {
  return "https://api.telegram.org/bot" + TELEGRAM_DEFAULT_KEY;
}
function __telegram_requestJson (u, o) {
  return JSON.parse (UrlFetchApp.fetch (u, o).getContentText ());
}
function __telegram_requestResponse (path) {
  return __telegram_requestJson (__telegram_requestURI () + "/" + path, { method: 'GET' });
}
function __telegram_requestResponsePost (path, data) {
  return __telegram_requestJson (__telegram_requestURI () + "/" + path, { method: 'POST', payload: data });
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_setup () {
  __telegram_background_setup ();
}

function telegram_messageTransmit (user, text) {
  var id = __telegram_chatIdLookup (user);
  if (util_is_nullOrZero (id))
    return undefined;
  var r = __telegram_requestResponsePost ("", { method: "sendMessage", chat_id: String (id), text: text, parse_mode: "HTML" });
  log ("telegram", "send [" + user + "]: " + text.replaceAll ("\n", "\\n").replaceAll ("\r", "\\r"));
  store_inc ("telegram", "message", "transmit");
  return r;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_chatIdLookup (u) {
  var i = __telegram_chatIdLocate (u);
  if (util_is_nullOrZero (i) && !util_is_nullOrZero (i = __telegram_chatIdIdentify (u)))
    __telegram_chatIdUpdate (u, i);
  return i;
}
function __telegram_chatIdLocate (u) {
  var i = store_get ("telegram", "chats", u); return (!util_is_nullOrZero (i)) ? String (i) : undefined;
}
function __telegram_chatIdUpdate (u, i) {
  store_set (String (i), "telegram", "chats", u); return true;
}
function __telegram_chatIdIdentify (u) {
  var r = __telegram_requestResponse ("getUpdates");
  if (util_is_nullOrZero (r) || util_is_nullOrZero (r.result))
    return undefined;
  var i = r.result.reduce ((p, v) => (!util_is_nullOrZero (v.message) && !util_is_nullOrZero (v.message.chat) &&
              !util_is_nullOrZero (v.message.chat.username) && util_str_lower (v.message.chat.username) == util_str_lower (u)) ? String (v.message.chat.id) : p, undefined);
  return i;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

var __tg_queue = "tg";

function __tg_queueAppend (m) { // could be an issue with concurrent processes ... 
  if (!util_is_nullOrZero (m)) queue_set_c (__tg_queue, queue_pop_n (__tg_queue, "W"), m);
}
function __tg_queueObtain () {
  var cr = queue_get_n (__tg_queue, "R"), m = Array ();
  while (cr < queue_get_n (__tg_queue, "W")) { var mm = queue_pop_c (__tg_queue, cr); cr = queue_set_n (__tg_queue, "R", cr); if (!util_is_nullOrZero (mm)) m.push (mm); } 
  return m;
}
function __tg_queueProcess () {
  var m = __tg_queueObtain ();
  return util_is_nullOrZero (m) ? 0 : m.reduce ((p, m_) => p + util_is_null (telegram_messageTransmit (m_ [0], m_ [1]) ? 0 : 1), 0);
}
function __tg_queuePending () {
  return queue_get_n (__tg_queue, "W") - queue_get_n (__tg_queue, "R");
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_background_enqueue (user, message) {
  __tg_queueAppend ([ user, message ]);
}
function __telegram_background_process () {
  var number = __tg_queueProcess ();
  store_inc ("telegram", "background", "process");
  if (!util_is_null (number) && number > 0) store_add (number, "telegram", "background", "volume");
}
function __telegram_background_setup () {
  __system_timer_setup (timer_createMinutes, "__telegram_background_process", 1);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
