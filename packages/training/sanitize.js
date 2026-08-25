const crypto = require('node:crypto');

const RESOURCE_TYPES = new Set(['mainFrame', 'subFrame', 'stylesheet', 'script', 'image', 'font', 'object', 'xhr', 'ping', 'cspReport', 'media', 'webSocket', 'other']);
const USER_CONTEXTS = new Set(['automatic_page_load', 'user_navigation', 'user_clicked_checkout', 'user_started_login', 'user_requested_media', 'user_submitted_form', 'background_request']);
const COMMON_COMPOUND_SUFFIXES = new Set(['co.uk', 'org.uk', 'com.au', 'net.au', 'co.in', 'co.jp', 'com.br', 'com.mx', 'co.nz', 'co.za']);

function safeHostname(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, '').replace(/\.$/, '').slice(0, 253);
  } catch {
    return '';
  }
}

function registrableDomain(value) {
  const host = safeHostname(value);
  if (!host || /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[a-f0-9:]+\])$/i.test(host)) return host;
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join('.');
  return COMMON_COMPOUND_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

function sanitizeResourceType(value) {
  const candidate = String(value || 'other');
  return RESOURCE_TYPES.has(candidate) ? candidate : 'other';
}

function sanitizeUserContext(value) {
  const candidate = String(value || 'automatic_page_load');
  return USER_CONTEXTS.has(candidate) ? candidate : 'automatic_page_load';
}

function sanitizeListMatches(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(['ghostery', 'easylist', 'easyprivacy', 'tracker-radar', 'clearweb-rule']);
  return [...new Set(value.map((item) => String(item).toLowerCase()).filter((item) => allowed.has(item)))].sort();
}

function sanitizeCapturedRequest(details = {}, context = {}) {
  const requestDomain = safeHostname(details.url || details.requestDomain || details.request_domain);
  const pageDomain = safeHostname(context.pageUrl || context.pageDomain || context.page_domain || details.sourceHostname);
  if (!requestDomain) return null;
  const pageGroup = registrableDomain(pageDomain);
  const requestGroup = registrableDomain(requestDomain);
  return {
    schema_version: 1,
    id: context.id || crypto.randomUUID(),
    captured_on: new Date(context.now || Date.now()).toISOString().slice(0, 10),
    input: {
      page_domain: pageDomain || 'unknown',
      request_domain: requestDomain,
      resource_type: sanitizeResourceType(details.resourceType || details.type || details.resource_type),
      third_party: pageGroup ? Boolean(requestGroup && pageGroup !== requestGroup) : true,
      user_context: sanitizeUserContext(context.userContext || context.user_context),
      list_matches: sanitizeListMatches(context.listMatches || context.list_matches)
    },
    evidence: {
      outcome: context.outcome === 'observed_blocked' ? 'observed_blocked' : 'observed_allowed',
      source: context.source === 'ghostery' ? 'ghostery' : 'browser'
    },
    page_group: pageGroup || 'unknown'
  };
}

function captureFingerprint(record) {
  const input = record.input || record;
  return [
    registrableDomain(input.page_domain),
    registrableDomain(input.request_domain),
    input.resource_type || 'other',
    input.user_context || 'automatic_page_load',
    Boolean(input.third_party)
  ].join('|');
}

module.exports = { safeHostname, registrableDomain, sanitizeCapturedRequest, captureFingerprint };
