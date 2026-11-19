import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBlogHtml } from '../utils/sanitize.js';

// Needs "npm install" first (uses the sanitize-html package).
test('blog HTML loses scripts and event handlers but keeps formatting', () => {
  const out = sanitizeBlogHtml('<p onclick="x()" style="text-align:center">Hi<script>alert(1)</script></p>');
  assert.equal(out.includes('script'), false);
  assert.equal(out.includes('onclick'), false);
  assert.ok(out.includes('text-align:center'));
});

test('blog links get safe rel attributes and unsafe schemes are removed', () => {
  const out = sanitizeBlogHtml('<a href="javascript:alert(1)">x</a><a href="https://tvfmsynergy.com" target="_blank">y</a>');
  assert.equal(out.includes('javascript:'), false);
  assert.ok(out.includes('rel="noopener noreferrer"'));
});

test('iframes are kept only for approved video hosts', () => {
  const ok = sanitizeBlogHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
  const bad = sanitizeBlogHtml('<iframe src="https://evil.example/x"></iframe>');
  assert.ok(ok.includes('youtube.com/embed/abc'));
  assert.equal(bad.includes('evil.example'), false);
});
