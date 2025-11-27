import DOMPurify from 'dompurify';

/**
 * Shared DOMPurify sanitization configuration
 * Used consistently across the application for both rendering and saving content
 * 
 * Based on configuration from DangerouslyHTMLComment and SafeMarkdownRenderer
 */
export const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    // Block elements
    'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'code',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'hr', 'br',
    // Inline elements
    'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'ins',
    'span', 'sub', 'sup', 'mark', 'kbd',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'className'],
  // Prevent javascript: URLs and other dangerous protocols
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitizes content before saving to the backend
 * This provides the first layer of XSS defense at the input stage
 * 
 * Removes potentially dangerous content:
 * - <script> tags
 * - javascript: URLs
 * - Event handlers (onclick, onerror, etc.)
 * - Dangerous tags (iframe, object, embed)
 * 
 * @param content - Raw content from editor (markdown or HTML)
 * @returns Sanitized content safe to store and render
 * 
 * @example
 * const userInput = '<p>Hello</p><script>alert("XSS")</script>';
 * const safe = sanitizeEditorContent(userInput);
 * // Returns: '<p>Hello</p>' (script tag removed)
 */
export function sanitizeEditorContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  // Use DOMPurify with our standard configuration
  const sanitized = DOMPurify.sanitize(trimmed, SANITIZE_CONFIG);

  return sanitized;
}

/**
 * Helper function to decode HTML entities
 * Reused from DangerouslyHTMLComment
 */
export function decodeHtml(html: string): string {
  if (typeof document === 'undefined') {
    // Server-side, return as-is
    return html;
  }
  
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

/**
 * Checks if content contains potentially dangerous patterns
 * Useful for validation or logging suspicious content
 */
export function hasUnsafeContent(content: string): boolean {
  if (!content) return false;

  const dangerousPatterns = [
    /javascript:/i,
    /<script/i,
    /on\w+\s*=/i, // onclick, onload, onerror, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(content));
}
