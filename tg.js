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

  return {
    active: !!tg,

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

    close: function(){ if(tg && tg.close) try{ tg.close(); }catch(e){} }
  };
})();
