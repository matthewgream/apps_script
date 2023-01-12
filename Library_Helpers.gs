
// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------

function cache_iterator_expired (key, timeout_f, name, type1, type2, callback_f, remove_on_error = true) {
  var total = 0, number = Object.values (cache_lst (key)).reduce ((number, value) => { total ++; var item = util_str_replace (value.k, key, "");
    if (cache_expired (value.k, util_is_null (timeout_f) ? 0 : timeout_f (item))) {
      var result = util_exception_wrapper (() => callback_f (item, value.k), e => { log (name, type1 + "-" + type2 + ", failure [" + item + "]: " + util_str_error (e)); return undefined; });
      if (!util_is_null (result)) number ++; else if (remove_on_error) cache_clr (value.k);
    }; return number; }, 0);
  log (name, type1 + "-" + type2 + ", total=" + total + ", number=" + number);
  store_inc (name, type1, type2);
}

function cache_checkany_expired (key, timeout_f) {
  return Object.values (cache_lst (key)).some (value => cache_expired (value.k, util_is_null (timeout_f) ? 0 : timeout_f (util_str_replace (value.k, key, ""))));
}

// -----------------------------------------------------------------------------------------------------------------------------------------

function cache_iterator (key, callback_f) {
  Object.values (cache_lst (key)).reduce ((number, value) => { var item = util_str_replace (value.k, key, "");
    var result = util_exception_wrapper (() => callback_f (item, value.k), e => { return undefined; });
    if (!util_is_null (result)) number ++; return number;
  }, 0);
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------
