(function() {
  'use strict';

  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var containerId = currentScript.getAttribute('data-container') || 'ff-booking-form';
  var rep  = currentScript.getAttribute('data-rep')  || 'general';
  var lang = currentScript.getAttribute('data-lang') || 'es';

  var BASE_URL = 'https://scheduling.fastfwdus.com';

  var COPY = {
    es: { name:'Nombre completo', email:'Email empresarial', company:'Empresa', phone:'WhatsApp', btn:'Agendar consulta gratuita', namePh:'Tu nombre completo', emailPh:'nombre@tuempresa.com', companyPh:'Nombre de tu empresa', phonePh:'+54 11 2345 6789' },
    en: { name:'Full name', email:'Business email', company:'Company', phone:'WhatsApp', btn:'Book free consultation', namePh:'Your full name', emailPh:'name@yourcompany.com', companyPh:'Your company name', phonePh:'+1 555 000 0000' },
    pt: { name:'Nome completo', email:'Email corporativo', company:'Empresa', phone:'WhatsApp', btn:'Agendar consulta gratuita', namePh:'Seu nome completo', emailPh:'nome@suaempresa.com', companyPh:'Nome da sua empresa', phonePh:'+55 11 99999 9999' },
  };

  var t = COPY[lang] || COPY.es;

  var CSS = [
    '.ff-form{font-family:system-ui,-apple-system,sans-serif;max-width:480px;background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:28px;box-shadow:0 4px 24px rgba(39,41,92,0.08);}',
    '.ff-form-logo{display:block;height:32px;object-fit:contain;margin-bottom:20px;}',
    '.ff-form-field{margin-bottom:14px;}',
    '.ff-form-label{display:block;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;}',
    '.ff-form-input{width:100%;box-sizing:border-box;padding:11px 14px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;color:#111827;outline:none;transition:border-color 0.2s;}',
    '.ff-form-input:focus{border-color:#27295C;}',
    '.ff-form-btn{width:100%;padding:14px;background:#C9A84C;color:#1A1C3E;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px;transition:all 0.2s;font-family:inherit;}',
    '.ff-form-btn:hover{background:#E5BA52;transform:translateY(-1px);box-shadow:0 4px 16px rgba(201,168,76,0.3);}',
    '.ff-form-sub{text-align:center;font-size:11px;color:#9CA3AF;margin-top:10px;}',
  ].join('');

  function injectStyles() {
    if (document.getElementById('ff-form-styles')) return;
    var style = document.createElement('style');
    style.id = 'ff-form-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildForm(container) {
    var bookUrl = rep === 'general' ? BASE_URL + '/book' : BASE_URL + '/book/' + rep;

    container.innerHTML = [
      '<div class="ff-form">',
        '<img class="ff-form-logo" src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png" alt="FastForward FDA Experts">',
        '<div class="ff-form-field">',
          '<label class="ff-form-label">' + t.name + ' *</label>',
          '<input class="ff-form-input" id="ff-name" type="text" placeholder="' + t.namePh + '" required>',
        '</div>',
        '<div class="ff-form-field">',
          '<label class="ff-form-label">' + t.email + ' *</label>',
          '<input class="ff-form-input" id="ff-email" type="email" placeholder="' + t.emailPh + '" required>',
        '</div>',
        '<div class="ff-form-field">',
          '<label class="ff-form-label">' + t.company + ' *</label>',
          '<input class="ff-form-input" id="ff-company" type="text" placeholder="' + t.companyPh + '" required>',
        '</div>',
        '<div class="ff-form-field">',
          '<label class="ff-form-label">' + t.phone + ' *</label>',
          '<input class="ff-form-input" id="ff-phone" type="tel" placeholder="' + t.phonePh + '" required>',
        '</div>',
        '<button class="ff-form-btn" id="ff-submit">' + t.btn + ' →</button>',
        '<p class="ff-form-sub">FastForward ® | FDA Experts · Miami, FL</p>',
      '</div>',
    ].join('');

    document.getElementById('ff-submit').addEventListener('click', function() {
      var name    = document.getElementById('ff-name').value.trim();
      var email   = document.getElementById('ff-email').value.trim();
      var company = document.getElementById('ff-company').value.trim();
      var phone   = document.getElementById('ff-phone').value.trim();

      if (!name || !email || !company || !phone) {
        alert('Por favor completá todos los campos.');
        return;
      }

      var params = new URLSearchParams({
        name: name, email: email, company: company, phone: phone, lang: lang,
      });

      window.open(bookUrl + '?' + params.toString(), '_blank');
    });
  }

  function init() {
    injectStyles();
    var container = document.getElementById(containerId);
    if (!container) {
      console.warn('[FastForward] Container #' + containerId + ' not found.');
      return;
    }
    buildForm(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
