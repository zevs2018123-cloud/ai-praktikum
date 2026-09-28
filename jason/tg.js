/* Thin wrapper over the Telegram WebApp SDK.
   Outside Telegram (plain browser / preview) every TG.* method is a no-op
   and the app works as a normal web page. */
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
      /* follow Telegram's light/dark choice, not the OS one */
      if(tg.colorScheme) document.documentElement.setAttribute('data-theme', tg.colorScheme);
      if(tg.setHeaderColor) tg.setHeaderColor(tg.colorScheme==='dark' ? '#0f0f12' : '#ffffff');
      if(tg.setBackgroundColor) tg.setBackgroundColor(tg.colorScheme==='dark' ? '#0f0f12' : '#ffffff');
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

      var LS_PREFIX = (tgUser && tgUser.id) ? ('u' + tgUser.id + ':') : '';
  function lsKey(k){ return LS_PREFIX + k; }

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
                if(v){ localStorage.setItem(lsKey(k), v); }
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
    initData: (tg && tg.initData) || '',
    cloudAvailable: cloudOn,
    lsKey: lsKey,
    lsPrefix: LS_PREFIX,
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
