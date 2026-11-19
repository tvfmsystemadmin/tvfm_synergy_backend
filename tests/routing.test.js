import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecipients, routeKeysFor, cleanEmails } from '../services/routing.js';

const routes = [
  { key: 'default', enabled: true, emails: ['Central@TVFM.com'] },
  { key: 'pos', enabled: true, emails: ['pos@tvfm.com', 'central@tvfm.com', 'POS@tvfm.com'] },
  { key: 'contact:Distributorship', enabled: true, emails: ['product@tvfm.com'] },
  { key: 'product', enabled: false, emails: ['off@tvfm.com'] },
  { key: 'career', enabled: true, emails: [] },
];

test('POS enquiries go to the pos route, with duplicates removed and addresses lowercased', () => {
  const r = resolveRecipients({ form: 'pos', category: '' }, routes);
  assert.equal(r.routeKey, 'pos');
  assert.deepEqual(r.emails, ['pos@tvfm.com', 'central@tvfm.com']);
});

test('a route for a specific category wins over the form route', () => {
  const r = resolveRecipients({ form: 'contact', category: 'Distributorship' }, routes);
  assert.equal(r.routeKey, 'contact:Distributorship');
  assert.deepEqual(r.emails, ['product@tvfm.com']);
});

test('a contact enquiry with no matching route falls back to the default route', () => {
  const r = resolveRecipients({ form: 'contact', category: 'Other' }, routes);
  assert.equal(r.routeKey, 'default');
  assert.deepEqual(r.emails, ['central@tvfm.com']);
});

test('a disabled route is skipped and the default is used', () => {
  const r = resolveRecipients({ form: 'product', category: '' }, routes);
  assert.equal(r.routeKey, 'default');
});

test('a route with no addresses is skipped', () => {
  const r = resolveRecipients({ form: 'career', category: 'Sales Manager' }, routes);
  assert.equal(r.routeKey, 'default');
});

test('with no routes at all, nobody is chosen', () => {
  const r = resolveRecipients({ form: 'pos', category: '' }, []);
  assert.equal(r.routeKey, null);
  assert.deepEqual(r.emails, []);
});

test('routeKeysFor lists the most specific key first', () => {
  assert.deepEqual(routeKeysFor('product', 'Distributorship'), ['product:Distributorship', 'product', 'default']);
  assert.deepEqual(routeKeysFor('pos', ''), ['pos', 'default']);
});

test('cleanEmails trims, lowercases, drops blanks and removes duplicates', () => {
  assert.deepEqual(cleanEmails(['  A@x.com ', 'a@x.com', '', 42, 'b@x.com']), ['a@x.com', 'b@x.com']);
  assert.deepEqual(cleanEmails('not a list'), []);
});
