import { test } from 'node:test';
import assert from 'node:assert/strict';
import Brand from '../models/Brand.js';

// Regression test: the admin panel edits, deletes and reorders records by _id.
test('JSON replies keep _id as a string', () => {
  const doc = new Brand({ name: 'Luxe' });
  const json = JSON.parse(JSON.stringify(doc));
  assert.equal(typeof json._id, 'string');
  assert.equal(json._id, String(doc._id));
  assert.equal(json.id, String(doc._id));
});
