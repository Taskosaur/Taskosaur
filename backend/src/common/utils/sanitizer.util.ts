import * as sanitize from 'sanitize-html';

export const sanitizeHtml = (html: string): string => {
  if (!html) return html;
  return sanitize(html, {
    allowedTags: [
      // Block elements
      'p',
      'div',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'pre',
      'code',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'hr',
      // Inline elements
      'a',
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'del',
      'ins',
      'span',
      'br',
      'sub',
      'sup',
      'mark',
      'kbd',
      'strike',
      // Input for checkboxes (sometimes used in markdown)
      'input',
    ],
    allowedAttributes: {
      '*': ['class', 'style', 'title', 'className'],
      a: ['href', 'name', 'target', 'title', 'rel'],
      input: ['type', 'checked', 'disabled'],
      code: ['className'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
};
