const { POLICY_VERSION } = require('./policy');
const { registrableDomain } = require('./sanitize');

const templates = [
  { request: ({ page }) => page, type: 'stylesheet', third: false, context: 'automatic_page_load', action: 'allow', category: 'essential', reason: 'First-party stylesheet required to render the page', confidence: 0.99 },
  { request: ({ page }) => page, type: 'image', third: false, context: 'automatic_page_load', action: 'allow', category: 'content', reason: 'First-party image used as page content', confidence: 0.98 },
  { request: ({ page }) => `api.${page}`, type: 'xhr', third: false, context: 'background_request', action: 'allow', category: 'essential', reason: 'First-party API request required for page operation', confidence: 0.97 },
  { request: () => 'securepubads.g.doubleclick.net', type: 'script', third: true, context: 'automatic_page_load', lists: ['easylist', 'easyprivacy'], action: 'block', category: 'advertising', reason: 'Known third-party advertising script', confidence: 0.99 },
  { request: () => 'www.google-analytics.com', type: 'xhr', third: true, context: 'automatic_page_load', lists: ['easyprivacy'], action: 'block', category: 'analytics', reason: 'Known third-party analytics collection request', confidence: 0.99 },
  { request: () => 'api.fpjs.io', type: 'script', third: true, context: 'automatic_page_load', lists: ['tracker-radar'], action: 'block', category: 'fingerprinting', reason: 'Known browser-fingerprinting service', confidence: 0.98 },
  { request: () => 'connect.facebook.net', type: 'script', third: true, context: 'automatic_page_load', lists: ['easyprivacy'], action: 'block', category: 'tracking', reason: 'Cross-site social tracking script loaded automatically', confidence: 0.98 },
  { request: () => 'checkout.stripe.com', type: 'subFrame', third: true, context: 'user_clicked_checkout', action: 'allow', category: 'payment', reason: 'Payment provider explicitly requested during checkout', confidence: 0.98 },
  { request: () => 'accounts.google.com', type: 'subFrame', third: true, context: 'user_started_login', action: 'allow', category: 'authentication', reason: 'Authentication provider explicitly requested during login', confidence: 0.97 },
  { request: () => 'www.recaptcha.net', type: 'script', third: true, context: 'user_submitted_form', action: 'allow', category: 'authentication', reason: 'Anti-abuse challenge required for a submitted form', confidence: 0.94 },
  { request: () => 'www.youtube-nocookie.com', type: 'subFrame', third: true, context: 'user_requested_media', action: 'allow', category: 'content', reason: 'Embedded video explicitly requested by the user', confidence: 0.95 },
  { request: () => 'cdn.jsdelivr.net', type: 'script', third: true, context: 'automatic_page_load', action: 'allow', category: 'content', reason: 'Known content-delivery host serving a page dependency', confidence: 0.90 },
  { request: ({ index }) => `assets-${index}.unknown-service.test`, type: 'script', third: true, context: 'automatic_page_load', action: 'review', category: 'unknown', reason: 'Unknown third-party script requires further evidence', confidence: 0.58 },
  { request: ({ index }) => `metrics-${index}.unknown-service.test`, type: 'xhr', third: true, context: 'background_request', action: 'review', category: 'unknown', reason: 'Unknown telemetry endpoint requires policy review', confidence: 0.55 }
];

function generateSeedCases({ siteCount = 32 } = {}) {
  const cases = [];
  for (let index = 1; index <= siteCount; index += 1) {
    const page = `site-${String(index).padStart(2, '0')}.test`;
    templates.forEach((template, templateIndex) => {
      const request = template.request({ page, index });
      cases.push({
        schema_version: 1,
        id: `seed-${String(index).padStart(2, '0')}-${String(templateIndex + 1).padStart(2, '0')}`,
        input: {
          page_domain: page,
          request_domain: request,
          resource_type: template.type,
          third_party: template.third,
          user_context: template.context,
          list_matches: template.lists || []
        },
        expected: { action: template.action, category: template.category, reason: template.reason, confidence: template.confidence },
        page_group: registrableDomain(page),
        label_status: 'synthetic-reviewed',
        policy_version: POLICY_VERSION
      });
    });
  }
  return cases;
}

module.exports = { generateSeedCases };
