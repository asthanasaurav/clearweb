const SAFE_AUTO_REMOVE = new Set(['advertising','sponsored_content','social_widget','engagement_bait','newsletter','overlay','clutter']);
const NEVER_AUTO_REMOVE_TAGS = new Set(['INPUT','TEXTAREA','SELECT','BUTTON','FORM']);

function candidateFromElementLike(node) {
  return {
    tag: String(node.tag || '').toUpperCase(),
    text: String(node.text || '').slice(0, 1200),
    ariaLabel: String(node.ariaLabel || '').slice(0, 300),
    role: String(node.role || ''),
    href: String(node.href || '').slice(0, 500),
    classes: Array.isArray(node.classes) ? node.classes.slice(0, 20) : [],
    id: String(node.id || '').slice(0, 150)
  };
}

function heuristicClassify(candidate) {
  const haystack = [candidate.text,candidate.ariaLabel,candidate.role,candidate.href,candidate.id,...candidate.classes].join(' ').toLowerCase();
  if (/(sponsored|promoted|advertisement|\bad\b|doubleclick|adserver)/.test(haystack)) return { type:'advertising', confidence:0.94, reason:'Advertising or sponsorship markers detected' };
  if (/(newsletter|subscribe|sign up for updates)/.test(haystack)) return { type:'newsletter', confidence:0.91, reason:'Newsletter subscription language detected' };
  if (/(share on|facebook|twitter|linkedin|reddit)/.test(haystack)) return { type:'social_widget', confidence:0.82, reason:'Social sharing markers detected' };
  return { type:'unknown', confidence:0.25, reason:'No strong deterministic semantic signal' };
}

function policy(candidate, classification) {
  const protectedControl = NEVER_AUTO_REMOVE_TAGS.has(candidate.tag) || /(login|sign in|checkout|payment|cart|navigation)/i.test(candidate.role + ' ' + candidate.text);
  if (protectedControl) return { ...classification, action:'keep', policyReason:'Protected interactive/auth/payment/navigation UI' };
  if (classification.confidence >= 0.90 && SAFE_AUTO_REMOVE.has(classification.type)) return { ...classification, action:'remove', policyReason:'High-confidence removable category' };
  if (classification.confidence >= 0.65) return { ...classification, action:'flag', policyReason:'Medium confidence: explain but do not remove automatically' };
  return { type:'unknown', confidence:classification.confidence, reason:classification.reason, action:'keep', policyReason:'Low confidence fails open' };
}

module.exports = { candidateFromElementLike, heuristicClassify, policy };
