const PAGE_PATH = /^\/[a-z0-9/-]{0,80}$/;
const HTTP_URL = /^https?:\/\/[^\s<>"']{3,500}$/i;
const UPLOAD_PATH = /^\/uploads\/[a-z-]+\/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm)$/;

// A page on this website, for example /pos or /services/franchise.
export const isPagePath = (value) =>
  typeof value === 'string' && PAGE_PATH.test(value) && !value.includes('//');

export const isHttpUrl = (value) => typeof value === 'string' && HTTP_URL.test(value.trim());

// An uploaded file from this server, or a full https link.
export const isAssetUrl = (value) =>
  typeof value === 'string' && (UPLOAD_PATH.test(value) || isHttpUrl(value));

// Checks a button when it is active. Errors are added to the errors object.
export function checkCta(data, errors, active) {
  if (!active) return;
  if (!data.ctaText) errors.ctaText = 'Enter the button text.';
  if (data.ctaType === 'external') {
    if (!isHttpUrl(data.ctaUrl)) errors.ctaUrl = 'Enter a full link starting with https://';
  } else if (!isPagePath(data.ctaPage)) {
    errors.ctaPage = 'Choose the page this button should open.';
  }
}
