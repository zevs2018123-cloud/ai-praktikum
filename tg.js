/* Тонкая обвязка над Telegram WebApp SDK.
   Если скрипт telegram-web-app.js не загрузился (например, в предпросмотре
   вне Telegram — там его блокирует CSP хостинга артефактов) — все методы
   TG.* просто ничего не делают, приложение работает как обычная веб-страница. */
var TG = (function(){
  var tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  var mainButtonHandler = null;

  function applyTheme(){
    if(!tg) return;
    var p = tg.themeParams || {};
    var root = document.documentElement.style;
    try{
      if(p.bg_color) root.setProperty('--tg-bg', p.bg_color);
      if(p.secondary_bg_color) root.setProperty('--tg-surface2', p.secondary_bg_color);
      if(p.text_color) root.setProperty('--tg-text', p.text_color);
      if(p.hint_color) root.setProperty('--tg-hint', p.hint_color);
      if(p.button_color) root.setProperty('--tg-accent', p.button_color);
      if(p.button_text_color) root.setProperty('--tg-on-accent', p.button_text_color);
      document.documentElement.classList.add('tg-themed');
      if(tg.setHeaderColor) tg.setHeaderColor(p.bg_color || '#ffffff');
      if(tg.setBackgroundColor) tg.setBackgroundColor(p.bg_color || '#ffffff');
    }catch(e){}
  }

  if(tg){
    try{
      tg.ready();
      tg.expand();
      if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      applyTheme();
      tg.onEvent('themeChanged', applyTheme);
    }catch(e){}
  }

  /* Имя пользователя Telegram — приходит в initDataUnsafe.user при открытии
     мини-приложения из чата/меню бота. Вне Telegram (обычный браузер) — null. */
  var tgUser = null;
  try{
    var rawUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if(rawUser){
      var first = (rawUser.first_name || '').trim();
      var last = (rawUser.last_name || '').trim();
      var uname = (rawUser.username || '').trim();
      tgUser = {
        id: rawUser.id || null,
        firstName: first || null,
        lastName: last || null,
        username: uname || null,
        fullName: (first + ' ' + last).trim() || null,
        displayName: first || uname || null
      };
    }
  }catch(e){}

  /* CloudStorage: кросс-устройственная синхронизация прогресса.
     localStorage остаётся источником истины для мгновенного рендера;
     CloudStorage — фоновое зеркало поверх него, доступное только внутри Telegram. */
  var cloudOn = !!(tg && tg.CloudStorage);

  function cloudSync(done){
    var called = false;
    function finish(){ if(called) return; called = true; done(); }
    if(!cloudOn){ finish(); return; }
    var timer = setTimeout(finish, 2500);
    try{
      tg.CloudStorage.getKeys(function(err, keys){
        if(err || !keys || !keys.length){ clearTimeout(timer); finish(); return; }
        tg.CloudStorage.getItems(keys, function(err2, items){
          clearTimeout(timer);
          if(!err2 && items){
            try{
              Object.keys(items).forEach(function(k){
                var v = items[k];
                if(v){ localStorage.setItem(k, v); }
              });
            }catch(e){}
          }
          finish();
        });
      });
    }catch(e){ clearTimeout(timer); finish(); }
  }

  function cloudSet(key, jsonValue){
    if(!cloudOn) return;
    try{ tg.CloudStorage.setItem(key, jsonValue, function(){}); }catch(e){}
  }
  function cloudRemove(key){
    if(!cloudOn) return;
    try{ tg.CloudStorage.removeItem(key, function(){}); }catch(e){}
  }

  return {
    active: !!tg,
    user: tgUser,
    cloudAvailable: cloudOn,
    cloudSync: cloudSync,
    cloudSet: cloudSet,
    cloudRemove: cloudRemove,

    haptic: function(kind){
      if(!tg || !tg.HapticFeedback) return;
      try{
        if(kind==='success' || kind==='error' || kind==='warning') tg.HapticFeedback.notificationOccurred(kind);
        else if(kind==='select') tg.HapticFeedback.selectionChanged();
        else tg.HapticFeedback.impactOccurred(kind || 'light');
      }catch(e){}
    },

    showBack: function(onClick){
      if(!tg || !tg.BackButton) return;
      try{
        tg.BackButton.offClick(TG._lastBack || function(){});
        TG._lastBack = onClick;
        tg.BackButton.onClick(onClick);
        tg.BackButton.show();
      }catch(e){}
    },
    hideBack: function(){
      if(!tg || !tg.BackButton) return;
      try{ tg.BackButton.hide(); }catch(e){}
    },

    setMainButton: function(text, onClick, enabled){
      if(!tg || !tg.MainButton) return false;
      try{
        if(mainButtonHandler) tg.MainButton.offClick(mainButtonHandler);
        mainButtonHandler = onClick;
        tg.MainButton.setText(text);
        tg.MainButton.onClick(onClick);
        if(enabled === false) tg.MainButton.disable(); else tg.MainButton.enable();
        tg.MainButton.show();
      }catch(e){}
      return true;
    },
    hideMainButton: function(){
      if(!tg || !tg.MainButton) return;
      try{ tg.MainButton.hide(); }catch(e){}
    },

    /* Ссылки на t.me внутри мини-приложения нужно открывать нативно,
       иначе Telegram откроет их во встроенном браузере поверх приложения. */
    /* Внешние ссылки (YouTube и прочее) — во внешнем браузере или профильном
       приложении, а не внутри окна мини-приложения. */
    openLink: function(url){
      try{
        if(tg && tg.openLink){ tg.openLink(url, { try_instant_view:false }); return true; }
      }catch(e){}
      return false;
    },

    openTelegramLink: function(url){
      try{
        if(tg && tg.openTelegramLink){ tg.openTelegramLink(url); return true; }
      }catch(e){}
      return false;
    },

    close: function(){ if(tg && tg.close) try{ tg.close(); }catch(e){} }
  };
})();
