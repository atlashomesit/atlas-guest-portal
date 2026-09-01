/**
 * TASK-8093: Atlas embeddable booking widget loader.
 * Usage: <div id="atlas-booking-widget" data-embed-key="..."></div>
 *        <script src="https://{tenantHost}/embed.js" data-embed-key="..." async></script>
 * Creates an iframe pointing to /embed/{embedKey} and auto-resizes via postMessage.
 */
(function () {
  'use strict';
  var SCRIPT_SELECTOR = 'script[data-embed-key][src*="embed.js"]';
  function getEmbedKey(script) {
    return (script.getAttribute('data-embed-key') || '').trim();
  }
  function getOrigin(script) {
    try {
      var u = new URL(script.src, window.location.href);
      return u.origin;
    } catch (e) {
      return '';
    }
  }
  function mountForScript(el) {
    var key = getEmbedKey(el);
    if (!key) return;
    // Find mount target: explicit data-target, or previous div#atlas-booking-widget, or script parent.
    var targetId = el.getAttribute('data-target');
    var mount = null;
    if (targetId) mount = document.getElementById(targetId);
    if (!mount) mount = document.getElementById('atlas-booking-widget');
    // fallback: look for sibling div with data-embed-key
    if (!mount) {
      var candidate = document.querySelector('div[data-embed-key="' + key + '"]');
      if (candidate) mount = candidate;
    }
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'atlas-booking-widget';
      el.parentNode.insertBefore(mount, el);
    }
    var origin = getOrigin(el);
    if (!origin) return;
    var iframe = document.createElement('iframe');
    iframe.src = origin + '/embed/' + encodeURIComponent(key);
    iframe.title = 'Book with Atlas';
    iframe.setAttribute('data-atlas-embed', key);
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.minHeight = '600px';
    iframe.style.display = 'block';
    iframe.loading = 'lazy';
    // Allow payment popups inside iframe
    iframe.allow = 'payment';
    // Let host CSS control width; iframe fills container.
    mount.appendChild(iframe);

    // Height auto-resize via postMessage {type:'atlas-embed-resize', height: 1234, embedKey: key}
    window.addEventListener('message', function (ev) {
      if (ev.origin !== origin) return;
      var d = ev.data;
      if (!d || d.type !== 'atlas-embed-resize' || d.embedKey !== key) return;
      var h = parseInt(d.height, 10);
      if (h > 0 && h < 10000) iframe.style.height = h + 'px';
    });
  }

  function init() {
    var scripts = document.querySelectorAll(SCRIPT_SELECTOR);
    for (var i = 0; i < scripts.length; i++) mountForScript(scripts[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
