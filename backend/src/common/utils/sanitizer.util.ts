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

/**
 * Sanitizes plain text by stripping all HTML tags and attributes.
 * Use this for fields like titles, names, etc.
 */
export const sanitizeText = (text: string): string => {
  if (!text) return text;
  return sanitize(text, {
    allowedTags: [],
    allowedAttributes: {},
  });
};

/**
 * Recursively sanitizes all string values in an object or array.
 * Use this for fields like customFields.
 */
export function sanitizeObject<T>(obj: T): T {
  // Use a private recursive function to avoid repeated casting of T
  const sanitize = (val: unknown): unknown => {
    if (typeof val === 'string') {
      return sanitizeText(val);
    }

    if (Array.isArray(val)) {
      return val.map((item: unknown) => sanitize(item));
    }

    if (val !== null && typeof val === 'object') {
      const result: Record<string, unknown> = {};
      const valAsRecord = val as Record<string, unknown>;

      for (const key in valAsRecord) {
        if (Object.prototype.hasOwnProperty.call(valAsRecord, key)) {
          result[key] = sanitize(valAsRecord[key]);
        }
      }
      return result;
    }

    return val;
  };

  return sanitize(obj) as T;
}
