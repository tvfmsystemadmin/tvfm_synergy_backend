import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnquiry, ageOk, phoneOk, emailOk } from '../utils/validators.js';

const pos = {
  source: 'salon-pos-registration',
  fullName: 'Asha Rao',
  email: 'asha@example.com',
  mobile: '+91 99406 58115',
  businessName: 'Asha Salon',
  city: 'Chennai',
  branches: '2',
  requirements: 'Billing and stock',
  consent: true,
};

test('a valid POS registration passes and is routed to the pos form', () => {
  const { errors, lead } = validateEnquiry(pos);
  assert.deepEqual(errors, {});
  assert.equal(lead.form, 'pos');
  assert.equal(lead.details.branches, 2);
});

test('missing consent and an out-of-range branch count are both reported', () => {
  const { errors } = validateEnquiry({ ...pos, consent: false, branches: '0' });
  assert.ok(errors.consent);
  assert.ok(errors.branches);
});

test('an unknown source is rejected, including prototype names', () => {
  assert.ok(validateEnquiry({ ...pos, source: 'constructor' }).errors.source);
  assert.ok(validateEnquiry({ ...pos, source: 'toString' }).errors.source);
});

test('product interest must be one of the offered choices', () => {
  const { errors } = validateEnquiry({
    source: 'product-enquiry',
    fullName: 'Ravi',
    email: 'ravi@example.com',
    mobile: '9940658115',
    interest: 'Something else',
    consent: true,
  });
  assert.ok(errors.interest);
});

test('a contact enquiry needs a type and a message of at least five characters', () => {
  const { errors } = validateEnquiry({
    source: 'contact',
    fullName: 'Ravi',
    email: 'ravi@example.com',
    mobile: '9940658115',
    enquiryType: '',
    message: 'hi',
  });
  assert.ok(errors.enquiryType);
  assert.ok(errors.message);
});

test('a career application checks age, role and the CV type', () => {
  const base = {
    source: 'career-application',
    fullName: 'Meena K',
    email: 'meena@example.com',
    mobile: '9940658115',
    dob: '1995-04-10',
    city: 'Chennai',
    role: 'Sales Executive',
    experience: 'Fresher',
    qualification: 'B.Com',
    consent: true,
  };
  assert.deepEqual(validateEnquiry(base).errors, {});
  assert.ok(validateEnquiry({ ...base, dob: '2020-01-01' }).errors.dob);
  assert.ok(validateEnquiry({ ...base, role: 'CEO' }).errors.role);
  assert.ok(validateEnquiry({ ...base, cv: { type: 'image/png', name: 'x.png', data: 'aGVsbG8=' } }).errors.cv);
});

test('a valid PDF CV is kept as an attachment with a safe filename', () => {
  const { errors, lead } = validateEnquiry({
    source: 'career-application',
    fullName: 'Meena K',
    email: 'meena@example.com',
    mobile: '9940658115',
    dob: '1995-04-10',
    city: 'Chennai',
    role: 'Sales Executive',
    experience: 'Fresher',
    qualification: 'B.Com',
    consent: true,
    cv: { type: 'application/pdf', name: 'resume.pdf', data: 'aGVsbG8=' },
  });
  assert.deepEqual(errors, {});
  assert.equal(lead.cv.filename, 'resume.pdf');
});

test('ageOk accepts 16 on the birthday and rejects 15 the day before', () => {
  const now = new Date('2026-11-07T00:00:00Z');
  assert.equal(ageOk('2010-11-07', now), true);
  assert.equal(ageOk('2010-11-08', now), false);
});

test('phone and email checks', () => {
  assert.equal(phoneOk('+91 99406 58115'), true);
  assert.equal(phoneOk('12'), false);
  assert.equal(emailOk('a@b'), false);
  assert.equal(emailOk('a@b.co'), true);
});
