import { sanitizeHtml } from './sanitizer.util';

describe('sanitizeHtml', () => {
  it('should return empty string if input is empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('should allow safe tags', () => {
    const input = '<p>Hello <b>World</b></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('should remove script tags', () => {
    const input = '<script>alert("xss")</script><p>Safe</p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('should remove onclick attributes', () => {
    // button is not in allowedTags, so it will be stripped, content preserved
    // Test with an allowed tag like 'a'
    const inputA = '<a href="#" onclick="alert(\'xss\')">Link</a>';
    expect(sanitizeHtml(inputA)).toBe('<a href="#">Link</a>');
  });

  it('should allow allowed attributes', () => {
    const input = '<a href="https://example.com" target="_blank" class="link">Link</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('should remove disallowed attributes', () => {
    const input = '<img src="image.jpg" data-evil="true">';
    expect(sanitizeHtml(input)).toBe('<img src="image.jpg" />');
  });

  it('should sanitize nested unsafe content', () => {
    const input = '<div><script>alert("xss")</script><span>Safe</span></div>';
    expect(sanitizeHtml(input)).toBe('<div><span>Safe</span></div>');
  });
});
