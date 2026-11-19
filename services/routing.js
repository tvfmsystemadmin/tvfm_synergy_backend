// Pure routing rules for enquiry emails. No database or mail code here, so it can be tested on its own.
export const DEFAULT_ROUTE_KEY = 'default';

export function cleanEmails(list) {
  if (!Array.isArray(list)) return [];
  const clean = list
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(clean)];
}

// The order in which routes are checked: the most specific route first, then the form, then the default.
export function routeKeysFor(form, category) {
  const keys = [];
  if (category) keys.push(`${form}:${category}`);
  keys.push(form, DEFAULT_ROUTE_KEY);
  return keys;
}

// Returns the first enabled route that has at least one address. Returns no recipients when none match.
export function resolveRecipients(lead, routes) {
  for (const key of routeKeysFor(lead.form, lead.category)) {
    const route = routes.find((r) => r.key === key && r.enabled === true);
    if (!route) continue;
    const emails = cleanEmails(route.emails);
    if (emails.length) return { routeKey: key, emails };
  }
  return { routeKey: null, emails: [] };
}
