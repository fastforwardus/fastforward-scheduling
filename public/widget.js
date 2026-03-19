(function() {
  'use strict';

  var config = {};
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  
  config.color    = currentScript.getAttribute('data-color')    || '#27295C';
  config.text     = currentScript.getAttribute('data-text')     || 'Agendar consulta';
  config.position = currentScript.getAttribute('data-position') || 'bottom-right';
  config.rep      = currentScript.getAttribute('data-rep')      || 'general';
  config.lang     = currentScript.getAttribute('data-lang')     || '';

  var BASE_URL = 'https://scheduling.fastfwdus.com';

  function getBookUrl() {
    var url = config.rep === 'general' ? BASE_URL + '/book' : BASE_URL + '/book/' + config.rep;
    if (config.lang) url += '?lang=' + config.lang;
    return url;
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#ff-widget-btn{position:fixed;z-index:99998;display:flex;align-items:center;gap:10px;padding:13px 20px;border-radius:50px;border:none;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;color:#fff;box-shadow:0 4px 24px rgba(0,0,0,0.18);transition:all 0.25s ease;white-space:nowrap;}',
      '#ff-widget-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.22);}',
      '#ff-widget-btn img{width:22px;height:22px;object-fit:contain;}',
      '#ff-widget-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,16,35,0.7);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;padding:0;opacity:0;transition:opacity 0.3s ease;height:0;}',
      '#ff-widget-overlay.ff-open{opacity:1;height:auto;}',
      '#ff-widget-modal{width:100%;max-width:560px;height:90vh;background:#fff;border-radius:20px 20px 0 0;overflow:hidden;transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1);}',
      '#ff-widget-overlay.ff-open #ff-widget-modal{transform:translateY(0);}',
      '#ff-widget-modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#27295C;}',
      '#ff-widget-modal-header img{height:28px;object-fit:contain;}',
      '#ff-widget-close{background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;line-height:1;}',
      '#ff-widget-close:hover{background:rgba(255,255,255,0.25);}',
      '#ff-widget-iframe{width:100%;height:calc(90vh - 62px);border:none;display:block;}',
      '@media(min-width:600px){#ff-widget-overlay{align-items:center;padding:20px;}#ff-widget-modal{border-radius:20px;height:85vh;}#ff-widget-iframe{height:calc(85vh - 62px);}}'
    ].join('');
    document.head.appendChild(style);
  }

  function createButton() {
    var btn = document.createElement('button');
    btn.id = 'ff-widget-btn';
    btn.style.background = config.color;
    btn.style[config.position === 'bottom-left' ? 'left' : 'right'] = '24px';
    btn.style.bottom = '24px';

    var img = document.createElement('img');
    img.src = 'https://fastfwdus.com/wp-content/uploads/2025/03/fastforward-logo.png.png';
    img.alt = 'FastForward';

    var span = document.createElement('span');
    span.textContent = config.text;

    btn.appendChild(img);
    btn.appendChild(span);
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
  }

  function createModal() {
    var overlay = document.createElement('div');
    overlay.id = 'ff-widget-overlay';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });

    var modal = document.createElement('div');
    modal.id = 'ff-widget-modal';

    var header = document.createElement('div');
    header.id = 'ff-widget-modal-header';

    var logo = document.createElement('img');
    logo.src = 'https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png';
    logo.alt = 'FastForward FDA Experts';

    var closeBtn = document.createElement('button');
    closeBtn.id = 'ff-widget-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeModal);

    header.appendChild(logo);
    header.appendChild(closeBtn);

    var iframe = document.createElement('iframe');
    iframe.id = 'ff-widget-iframe';
    iframe.title = 'FastForward - Agendar consulta';
    iframe.allow = 'camera; microphone';

    modal.appendChild(header);
    modal.appendChild(iframe);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function openModal() {
    var overlay = document.getElementById('ff-widget-overlay');
    var iframe  = document.getElementById('ff-widget-iframe');
    if (!iframe.src) iframe.src = getBookUrl();
    document.body.style.overflow = 'hidden';
    overlay.classList.add('ff-open');
  }

  function closeModal() {
    var overlay = document.getElementById('ff-widget-overlay');
    document.body.style.overflow = '';
    overlay.classList.remove('ff-open');
  }

  function init() {
    injectStyles();
    createButton();
    createModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
