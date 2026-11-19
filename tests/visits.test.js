import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, isBot, istDayStart, istDateKey, VISITOR_ID_RE, DAY_MS } from '../utils/visits.js';

test('normalizePath keeps only the page address', () => {
  assert.equal(normalizePath('/pos?utm=1#register'), '/pos');
  assert.equal(normalizePath('/blogs/hair-care/'), '/blogs/hair-care');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath('///'), '/');
});

test('normalizePath refuses admin pages, non-paths and very long values', () => {
  assert.equal(normalizePath('/admin'), null);
  assert.equal(normalizePath('/admin/anything'), null);
  assert.equal(normalizePath('https://example.com/pos'), null);
  assert.equal(normalizePath(42), null);
  assert.equal(normalizePath('/' + 'a'.repeat(300)), null);
});

test('crawlers and previews are not counted', () => {
  assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBot('HeadlessChrome/120'), true);
  assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36'), false);
  assert.equal(isBot(undefined), false);
});

test('visitor codes must look like the ones the website makes', () => {
  assert.equal(VISITOR_ID_RE.test('3f2a9c1e-8b7d-4e6f-a1b2-c3d4e5f60718'), true);
  assert.equal(VISITOR_ID_RE.test('short'), false);
  assert.equal(VISITOR_ID_RE.test('bad id with spaces'), false);
});

test('India day boundaries: 00:00 IST is 18:30 UTC the day before', () => {
  const start = istDayStart(new Date('2026-11-13T10:00:00Z')); // 15:30 IST on 13 Nov
  assert.equal(start.toISOString(), '2026-11-12T18:30:00.000Z');
  assert.equal(istDateKey(start.getTime()), '2026-11-13');
  const justBeforeMidnight = istDayStart(new Date('2026-11-13T18:29:59Z')); // 23:59:59 IST
  assert.equal(istDateKey(justBeforeMidnight.getTime()), '2026-11-13');
  assert.equal(istDateKey(istDayStart(new Date('2026-11-13T18:30:00Z')).getTime()), '2026-11-14');
  assert.equal(istDateKey(start.getTime() - DAY_MS), '2026-11-12');
});
