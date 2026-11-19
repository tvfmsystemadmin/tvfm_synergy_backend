import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PAGES,
  ALL_PAGE_IDS,
  RESOURCE_PAGE,
  READ_ALSO,
  UPLOAD_PAGES,
  hasPage,
  hasAnyPage,
  canGrantPages,
  isKnownPage,
} from '../config/adminPages.js';

const owner = { isOwner: true, pages: ALL_PAGE_IDS };
const editor = { isOwner: false, pages: ['blogs', 'services'] };
const nobody = { isOwner: false, pages: [] };

test('every page id is unique and known', () => {
  assert.equal(new Set(ALL_PAGE_IDS).size, ALL_PAGE_IDS.length);
  assert.ok(ALL_PAGE_IDS.includes('roles') && ALL_PAGE_IDS.includes('users') && ALL_PAGE_IDS.includes('visitors'));
  assert.equal(isKnownPage('nope'), false);
});

test('each content type belongs to a real page, and read-extras are real pages', () => {
  for (const page of Object.values(RESOURCE_PAGE)) assert.ok(ALL_PAGE_IDS.includes(page), page);
  for (const [name, pages] of Object.entries(READ_ALSO)) {
    assert.ok(name in RESOURCE_PAGE, name);
    for (const page of pages) assert.ok(ALL_PAGE_IDS.includes(page), page);
  }
});

test('the owner can open every page, including ones added later', () => {
  for (const id of ALL_PAGE_IDS) assert.equal(hasPage(owner, id), true, id);
  assert.equal(hasPage({ isOwner: true, pages: [] }, 'roles'), true);
});

test('a role only opens the pages it lists', () => {
  assert.equal(hasPage(editor, 'blogs'), true);
  assert.equal(hasPage(editor, 'users'), false);
  assert.equal(hasPage(editor, 'roles'), false);
  assert.equal(hasAnyPage(editor, ['users', 'services']), true);
  assert.equal(hasAnyPage(editor, ['users', 'roles']), false);
});

test('an account with no role opens nothing', () => {
  for (const id of ALL_PAGE_IDS) assert.equal(hasPage(nobody, id), false, id);
  assert.equal(hasPage(null, 'blogs'), false);
});

test('an unknown resource is denied to everyone except the owner', () => {
  assert.equal(hasPage(editor, RESOURCE_PAGE.nonexistent), false);
  assert.equal(hasPage(owner, RESOURCE_PAGE.nonexistent), true);
});

test('upload pages are the ones that carry pictures or documents', () => {
  assert.ok(UPLOAD_PAGES.includes('blogs'));
  assert.ok(UPLOAD_PAGES.includes('media'));
  assert.equal(UPLOAD_PAGES.includes('users'), false);
  assert.equal(UPLOAD_PAGES.includes('roles'), false);
});

test('nobody can give out pages they cannot open themselves', () => {
  assert.equal(canGrantPages(editor, ['blogs']), true);
  assert.equal(canGrantPages(editor, ['blogs', 'users']), false);
  assert.equal(canGrantPages(owner, ['users', 'roles']), true);
});

test('page labels and groups are filled in for the role editor', () => {
  for (const page of ADMIN_PAGES) {
    assert.ok(page.label && page.group, page.id);
  }
});
