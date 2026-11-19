import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, escapeRegex, cleanText, parseDay } from '../utils/strings.js';
import { detectMime } from '../utils/fileSignature.js';
import { isPagePath, isHttpUrl, isAssetUrl, checkCta } from '../utils/links.js';

const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(12)]);

test('slugify makes URL-safe slugs', () => {
  assert.equal(slugify('Hair Care & Spa!'), 'hair-care-spa');
  assert.equal(slugify('Café Glam'), 'cafe-glam');
  assert.equal(slugify('   '), '');
});

test('escapeRegex makes user text safe inside a search pattern', () => {
  assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
});

test('cleanText trims and limits length, and ignores non-text values', () => {
  assert.equal(cleanText('  hello  ', 3), 'hel');
  assert.equal(cleanText(['x'], 10), '');
});

test('parseDay returns a date only for a real YYYY-MM-DD value', () => {
  assert.ok(parseDay('2026-11-07') instanceof Date);
  assert.equal(parseDay('07/11/2026'), null);
  assert.equal(parseDay(undefined), null);
});

test('detectMime recognises real image and video signatures', () => {
  assert.equal(detectMime(pad([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(detectMime(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(detectMime(pad(Buffer.from('GIF89a'))), 'image/gif');
  assert.equal(detectMime(Buffer.from('RIFF\0\0\0\0WEBP')), 'image/webp');
  assert.equal(detectMime(Buffer.from([0, 0, 0, 0x18, ...Buffer.from('ftypisom')])), 'video/mp4');
  assert.equal(detectMime(pad([0x1a, 0x45, 0xdf, 0xa3])), 'video/webm');
});

test('detectMime rejects text and short data', () => {
  assert.equal(detectMime(Buffer.from('hello world, not a file')), null);
  assert.equal(detectMime(Buffer.from([0xff, 0xd8])), null);
});

test('isPagePath accepts site paths only', () => {
  assert.equal(isPagePath('/pos'), true);
  assert.equal(isPagePath('/services/franchise'), true);
  assert.equal(isPagePath('//evil.com'), false);
  assert.equal(isPagePath('pos'), false);
  assert.equal(isPagePath('/a b'), false);
});

test('isHttpUrl rejects script URLs', () => {
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('https://www.youtube.com/watch?v=abc'), true);
});

test('isAssetUrl accepts uploads from this server and blocks path tricks', () => {
  assert.equal(isAssetUrl('/uploads/hero/3f2a1b4c-1234-4abc-9def-1234567890ab.jpg'), true);
  assert.equal(isAssetUrl('/uploads/../etc/passwd'), false);
});

test('checkCta reports a bad external link only when the button is active', () => {
  const errors = {};
  checkCta({ ctaText: 'Book', ctaType: 'external', ctaUrl: 'javascript:alert(1)' }, errors, true);
  assert.ok(errors.ctaUrl);
  const off = {};
  checkCta({ ctaType: 'external', ctaUrl: 'bad' }, off, false);
  assert.deepEqual(off, {});
});
