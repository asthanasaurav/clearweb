const { registrableDomain } = require('./sanitize');

const POLICY_VERSION = 'clearweb-request-policy-v1';
const PATTERNS = {
  advertising: /(doubleclick|googlesyndication|adservice|adnxs|taboola|outbrain)/i,
  analytics: /(google-analytics|analytics|segment\.io|mixpanel|amplitude)/i,
  fingerprinting: /(fingerprintjs|fingerprint|canvasprint)/i,
  social: /(connect\.facebook|facebook\.net|platform\.twitter|platform\.linkedin)/i,
  payment: /(stripe|adyen|paypal|klarna|checkout\.com)/i,
  authentication: /(accounts\.google|login\.microsoftonline|auth0|okta|captcha|recaptcha|hcaptcha)/i,
  media: /(youtube|vimeo|spotify|soundcloud)/i,
  cdn: /(cloudfront|cloudflare|fastly|gstatic|jsdelivr|unpkg)/i
};

function blockCategory(host) {
  if (PATTERNS.advertising.test(host)) return 'advertising';
  if (PATTERNS.analytics.test(host)) return 'analytics';
  if (PATTERNS.fingerprinting.test(host)) return 'fingerprinting';
  if (PATTERNS.social.test(host)) return 'tracking';
  return 'tracking';
}

function labelRequest(record) {
  const input = record.input || record;
  const host = String(input.request_domain || '');
  const outcome = record.evidence?.outcome;
  const matches = input.list_matches || [];
  if (outcome === 'observed_blocked' || matches.length) {
    return { expected: { action: 'block', category: blockCategory(host), reason: 'Deterministic blocker evidence identifies this request as unwanted', confidence: 0.99 }, review_required: false, label_status: 'auto-evidence' };
  }
  if (!input.third_party || registrableDomain(input.page_domain) === registrableDomain(host)) {
    const content = ['image', 'media', 'font'].includes(input.resource_type);
    return { expected: { action: 'allow', category: content ? 'content' : 'essential', reason: content ? 'First-party content required by the page' : 'First-party request required for normal page operation', confidence: 0.96 }, review_required: false, label_status: 'auto-evidence' };
  }
  if (PATTERNS.payment.test(host) && input.user_context === 'user_clicked_checkout') {
    return { expected: { action: 'allow', category: 'payment', reason: 'Payment provider requested during an explicit checkout flow', confidence: 0.97 }, review_required: false, label_status: 'auto-evidence' };
  }
  if (PATTERNS.authentication.test(host) && ['user_started_login', 'user_submitted_form'].includes(input.user_context)) {
    return { expected: { action: 'allow', category: 'authentication', reason: 'Authentication provider requested during an explicit login flow', confidence: 0.96 }, review_required: false, label_status: 'auto-evidence' };
  }
  if (PATTERNS.media.test(host) && input.user_context === 'user_requested_media') {
    return { expected: { action: 'allow', category: 'content', reason: 'Third-party media was explicitly requested by the user', confidence: 0.94 }, review_required: false, label_status: 'auto-evidence' };
  }
  if (PATTERNS.cdn.test(host) && ['stylesheet', 'script', 'font', 'image'].includes(input.resource_type)) {
    return { expected: { action: 'allow', category: 'content', reason: 'Known content-delivery host serving a page asset', confidence: 0.88 }, review_required: true, label_status: 'needs-human-review' };
  }
  return { expected: { action: 'review', category: 'unknown', reason: 'Insufficient evidence to safely allow or block this third-party request', confidence: 0.55 }, review_required: true, label_status: 'needs-human-review' };
}

module.exports = { POLICY_VERSION, labelRequest };
