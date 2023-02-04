
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function cache_iterator (key, callback_f) {
  return Object.values (cache_lst (key)).reduce ((number, value) =>
    number + !util_is_null (util_exception_wrapper (() => callback_f (util_str_replace (value.k, key, ""), value.k), e => undefined) ? 1 : 0), 0);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function __cache_iterator_expired (key, timeout_f, name, type1, type2, callback_f, remove_on_error = true) {
  var total = 0, number = Object.values (cache_lst (key)).reduce ((number, value) => { total ++; var item = util_str_replace (value.k, key, "");
    if (cache_expired (value.k, util_is_null (timeout_f) ? 0 : timeout_f (item))) {
      var result = util_exception_wrapper (() => callback_f (item, value.k), (e) => app_debug (name, type1 + "-" + type2 + ", failure [" + item + "]: " + util_str_error (e)));
      if (!util_is_null (result)) number ++; else if (remove_on_error) cache_clr (value.k);
    }; return number; }, 0);
  store_inc (name, type2, type1);
  return type1 + "-" + type2 + ": " + total + "/" + number;
}
function __cache_checkany_expired (key, timeout_f = () => 0) {
  return Object.values (cache_lst (key)).some (value => cache_expired (value.k, timeout_f (util_str_replace (value.k, key, ""))));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function cache_table_refresh_background_process (keys, details, cachekey_f, name) {
  app_debug (name, Object.entries (details).filter (([k, v]) => keys.includes (k))
    .map (([k, v]) => __cache_iterator_expired (cachekey_f (k), v.time, name, v.name, "refresh", v.func)).join (", ")); 
}
function cache_table_refresh_background (details, cachekey_f, process_n) {
  var expired = Object.entries (details).filter (([k, v]) => __cache_checkany_expired (cachekey_f (k), v.time)).map (([k, v]) => k).join (", ");
  if (expired.length > 0) system_schedule (process_n, expired);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
