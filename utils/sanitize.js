import sanitizeHtml from 'sanitize-html';

// Keeps the formatting the blog editor offers, and removes scripts, event handlers and unsafe links.
const options = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
    'a', 'img', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
    'figure', 'figcaption', 'iframe', 'div', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'title', 'allow', 'allowfullscreen', 'frameborder'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    '*': ['style', 'class'],
  },
  allowedStyles: {
    '*': { 'text-align': [/^(left|right|center|justify)$/] },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs, rel: 'noopener noreferrer' };
      if (out.target !== '_blank') delete out.target;
      return { tagName, attribs: out };
    },
  },
};

export function sanitizeBlogHtml(html) {
  return sanitizeHtml(String(html ?? ''), options);
}
