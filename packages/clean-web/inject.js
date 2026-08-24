const AD_HOST_MARKERS = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'amazon-adsystem.com', 'adnxs.com', 'taboola.com', 'outbrain.com'];
const AD_LABEL_PATTERN = '^(advertisement|advertentie|advertorial|sponsored|gesponsord|promoted|publicit[eé]|werbung|anzeige|annuncio|anuncio|реклама)$';

function buildCleanWebScript(enabled) {
  return `(() => {
    const STYLE_ID = 'clearweb-clean-style';
    const OBSERVER_KEY = '__clearwebCleanObserver';
    const adHosts = ${JSON.stringify(AD_HOST_MARKERS)};
    const adLabel = new RegExp(${JSON.stringify(AD_LABEL_PATTERN)}, 'i');
    const protectedSelector = 'form,nav,[role="navigation"],[role="dialog"],[aria-modal="true"],[data-clearweb-keep]';
    const removableSelector = [
      '[data-ad]', '[data-ad-slot]', '[data-ad-container]', '[aria-label*="advertisement" i]',
      '[class~="ad-slot" i]', '[class~="ad-container" i]', '[class*="advertisement" i]',
      '[id^="google_ads"]', '[id^="div-gpt-ad"]', '[class*="newsletter" i]',
      '[class*="social-share" i]', '[class*="cookie-banner" i]'
    ].join(',');

    const existing = document.getElementById(STYLE_ID);
    if (!${Boolean(enabled)}) {
      existing?.remove();
      window[OBSERVER_KEY]?.disconnect();
      delete window[OBSERVER_KEY];
      return { removed: 0 };
    }

    if (!existing) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = removableSelector + '{display:none!important;min-height:0!important;height:0!important;margin:0!important;padding:0!important}';
      document.documentElement.appendChild(style);
    }

    const isProtected = (element) => Boolean(element?.matches?.(protectedSelector) || element?.closest?.(protectedSelector));
    const adUrl = (element) => {
      const value = String(element?.src || element?.href || '');
      return adHosts.some((host) => value.includes(host));
    };
    const safeContainer = (element) => {
      let candidate = element;
      for (let depth = 0; depth < 3 && candidate?.parentElement; depth += 1) {
        const parent = candidate.parentElement;
        if (isProtected(parent) || /^(BODY|HTML|MAIN|ARTICLE|SECTION)$/.test(parent.tagName)) break;
        const interactive = parent.querySelector('input,textarea,select,button,[contenteditable="true"],a[href]');
        const structural = parent.children.length <= 4 && parent.textContent.length < 240;
        if (!interactive && structural) candidate = parent;
        else break;
      }
      return candidate;
    };
    const remove = (element) => {
      if (!element?.isConnected || isProtected(element)) return false;
      const target = safeContainer(element);
      if (!target || isProtected(target)) return false;
      target.remove();
      return true;
    };
    const ownText = (element) => Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(' ').trim();
    const sweep = (root = document) => {
      let removed = 0;
      const roots = root.matches ? [root] : [];
      const select = (selector) => roots.filter((item) => item.matches(selector)).concat(Array.from(root.querySelectorAll?.(selector) || []));
      select(removableSelector).forEach((element) => { removed += remove(element) ? 1 : 0; });
      select('iframe,img,script').forEach((element) => { if (adUrl(element)) removed += remove(element) ? 1 : 0; });
      select('div,aside,span,p').forEach((element) => {
        const text = ownText(element);
        if (text && text.length <= 40 && adLabel.test(text)) removed += remove(element) ? 1 : 0;
      });
      select('video[autoplay]').forEach((video) => { try { video.pause(); video.removeAttribute('autoplay'); } catch {} });
      return removed;
    };

    let removed = sweep();
    window[OBSERVER_KEY]?.disconnect();
    const pending = new Set(); let scheduled = false;
    const flush = (deadline) => {
      scheduled = false;
      for (const node of pending) {
        pending.delete(node); if (node.isConnected) removed += sweep(node);
        if (deadline?.timeRemaining && deadline.timeRemaining() < 2) break;
      }
      if (pending.size) schedule();
    };
    const schedule = () => { if (scheduled) return; scheduled = true; (window.requestIdleCallback || ((fn) => setTimeout(fn, 80)))(flush, { timeout: 500 }); };
    window[OBSERVER_KEY] = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) pending.add(node); }));
      schedule();
    });
    window[OBSERVER_KEY].observe(document.documentElement, { childList: true, subtree: true });
    return { removed };
  })()`;
}

module.exports = { AD_HOST_MARKERS, AD_LABEL_PATTERN, buildCleanWebScript };
