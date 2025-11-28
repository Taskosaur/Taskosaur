import * as sanitize from 'sanitize-html';

export const sanitizeHtml = (html: string): string => {
  if (!html) return html;
  return sanitize(html, {
    allowedTags: [
      'b',
      'i',
      'em',
      'strong',
      'a',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'span',
      'div',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
      'u',
      's',
      'strike',
      'del',
    ],
    allowedAttributes: {
      '*': ['class', 'style', 'title'],
      a: ['href', 'name', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
};
