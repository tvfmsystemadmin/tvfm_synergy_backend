// Checks the first bytes of a file, so a renamed file cannot pass as an image or video.
const matches = (buffer, bytes, offset = 0) => bytes.every((byte, i) => buffer[offset + i] === byte);
const ascii = (text) => Array.from(Buffer.from(text, 'ascii'));

export function detectMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (matches(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (matches(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (matches(buffer, ascii('GIF87a')) || matches(buffer, ascii('GIF89a'))) return 'image/gif';
  if (matches(buffer, ascii('RIFF')) && matches(buffer, ascii('WEBP'), 8)) return 'image/webp';
  if (matches(buffer, ascii('ftyp'), 4)) return 'video/mp4';
  if (matches(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  return null;
}
