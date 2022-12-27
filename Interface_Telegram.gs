
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_test () {
  telegram_setup ();
  telegram_transmit ("xxx", "Hello!");
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_transmit (user, message) {
  telegram_messageTransmit (user, message);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __telegram_requestURI () {
  return "https://api.telegram.org/bot" + "KEY";
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

function telegram_messageTransmit (user, text) {
  var id = __telegram_chatIdLookup (user);
  if (util_is_nullOrZero (id))
    return undefined;
  var r = __telegram_requestResponsePost ("", { method: "sendMessage", chat_id: String (id), text: text, parse_mode: "HTML" });
  log ("telegram", "[" + user + "] >>> " + text);
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
  var i = r.result.reduce (function (p, v) {
    return (!util_is_nullOrZero (v.message) && !util_is_nullOrZero (v.message.chat) &&
              !util_is_nullOrZero (v.message.chat.username) && util_str_lower (v.message.chat.username) == util_str_lower (u)) ? String (v.message.chat.id) : p;
  }, undefined);
  return i;
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function telegram_setup () {
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
