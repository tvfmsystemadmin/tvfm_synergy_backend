import ContactInfo from '../models/ContactInfo.js';
import SiteSettings from '../models/SiteSettings.js';
import { HttpError } from '../utils/httpError.js';
import { cleanList, cleanText, hasOwn } from '../utils/strings.js';
import { emailOk } from '../utils/validators.js';
import { isAssetUrl, isHttpUrl } from '../utils/links.js';

const KEY = 'main';
const PHONE_HREF = /^\+?\d{7,15}$/;

export async function getPublicContact(req, res) {
  const item = await ContactInfo.findOne({ key: KEY });
  res.json({ ok: true, item: item || null });
}

export const getAdminContact = getPublicContact;

// Saves the contact details the website shows. The site falls back to its built-in details when this is empty.
export async function putContact(req, res) {
  const body = req.body || {};
  const errors = {};
  const list = (value) => (Array.isArray(value) ? value.filter((v) => v && typeof v === 'object').slice(0, 10) : []);

  const phones = list(body.phones)
    .map((p) => ({
      label: cleanText(p.label, 40),
      display: cleanText(p.display, 40),
      href: cleanText(p.href, 20).replace(/\s/g, ''),
    }))
    .filter((p) => p.display || p.href);
  if (phones.some((p) => !PHONE_HREF.test(p.href))) {
    errors.phones = 'Enter each phone number with digits only in the link field, for example +919940658115.';
  }

  const emails = list(body.emails)
    .map((e) => ({ label: cleanText(e.label, 40), address: cleanText(e.address, 254) }))
    .filter((e) => e.address);
  if (emails.some((e) => !emailOk(e.address))) errors.emails = 'One or more email addresses are not valid.';

  const socialLinks = list(body.socialLinks)
    .map((s) => ({ label: cleanText(s.label, 40), url: cleanText(s.url, 500) }))
    .filter((s) => s.url);
  if (socialLinks.some((s) => !isHttpUrl(s.url))) errors.socialLinks = 'Social links must start with https://';

  const mapUrl = cleanText(body.mapUrl, 500);
  if (mapUrl && !isHttpUrl(mapUrl)) errors.mapUrl = 'Enter a full link starting with https://';

  const whatsapp = cleanText(body.whatsappNumber, 20).replace(/\D/g, '');
  if (whatsapp && (whatsapp.length < 7 || whatsapp.length > 15)) errors.whatsappNumber = 'Enter the WhatsApp number with country code.';

  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);

  const item = await ContactInfo.findOneAndUpdate(
    { key: KEY },
    {
      $set: {
        phones,
        emails,
        socialLinks,
        mapUrl,
        whatsappNumber: whatsapp,
        addressLines: cleanList(body.addressLines, { max: 6, maxLength: 150 }),
        description: cleanText(body.description, 1000),
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.json({ ok: true, item });
}

// Site settings (maintenance mode). The document is created with its defaults the first time it is read.
const SETTINGS_KEY = 'main';

async function loadSettings() {
  return SiteSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

const logosView = (doc) => ({
  light: doc.branding?.logoLight || '',
  dark: doc.branding?.logoDark || '',
});

const settingsView = (doc) => ({
  logos: logosView(doc),
  maintenance: {
    enabled: Boolean(doc.maintenance?.enabled),
    title: doc.maintenance?.title ?? '',
    message: doc.maintenance?.message ?? '',
  },
});

// Public: the website only needs the maintenance switch and its text.
export async function getPublicSiteSettings(req, res) {
  const doc = await loadSettings();
  res.json({ ok: true, item: settingsView(doc) });
}

export async function getAdminSiteSettings(req, res) {
  const doc = await loadSettings();
  res.json({ ok: true, item: settingsView(doc) });
}

const toBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

// Saves only the fields that were sent. Anything else in the body is ignored.
export async function putSiteSettings(req, res) {
  const maintenance = req.body?.maintenance && typeof req.body.maintenance === 'object' ? req.body.maintenance : {};
  const errors = {};
  const $set = {};

  if (hasOwn(maintenance, 'enabled')) $set['maintenance.enabled'] = toBoolean(maintenance.enabled);

  if (hasOwn(maintenance, 'title')) {
    const title = cleanText(maintenance.title, 120);
    if (!title) errors.title = 'Enter a heading for the maintenance page.';
    else $set['maintenance.title'] = title;
  }

  if (hasOwn(maintenance, 'message')) {
    const message = cleanText(maintenance.message, 500);
    if (!message) errors.message = 'Enter a short message for visitors.';
    else $set['maintenance.message'] = message;
  }

  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);

  const doc = Object.keys($set).length
    ? await SiteSettings.findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      )
    : await loadSettings();
  res.json({ ok: true, item: settingsView(doc) });
}

// Website logos: one for the light theme, one for the dark theme. Empty means the built-in logo is used.
export async function getAdminLogo(req, res) {
  const doc = await loadSettings();
  res.json({ ok: true, item: logosView(doc) });
}

export async function putLogo(req, res) {
  const body = req.body || {};
  const errors = {};
  const $set = {};
  for (const [key, field] of [['light', 'branding.logoLight'], ['dark', 'branding.logoDark']]) {
    if (body[key] === undefined) continue;
    const url = typeof body[key] === 'string' ? body[key].trim() : '';
    if (url && !isAssetUrl(url)) errors[key] = 'Upload the logo first.';
    else $set[field] = url;
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);
  const doc = Object.keys($set).length
    ? await SiteSettings.findOneAndUpdate({ key: SETTINGS_KEY }, { $set }, { upsert: true, new: true, setDefaultsOnInsert: true })
    : await loadSettings();
  res.json({ ok: true, item: logosView(doc) });
}
