import { BadRequestException } from '@nestjs/common';

/**
 * Input Sanitizer Utility
 * Provides methods to sanitize and validate user input to prevent security vulnerabilities
 */
export class InputSanitizer {
  /**
   * Maximum length for search queries
   * Prevents DoS through extremely long search strings
   */
  private static readonly MAX_SEARCH_LENGTH = 200;

  /**
   * Maximum length for general string inputs
   */
  private static readonly MAX_STRING_LENGTH = 500;

  /**
   * Pattern for safe search characters
   * Allows alphanumeric, spaces, and common punctuation
   * Excludes SQL injection patterns and regex special characters
   */
  private static readonly SAFE_SEARCH_PATTERN = /^[a-zA-Z0-9\s\-_@.# ]+$/;

  /**
   * Pattern for slug validation
   */
  private static readonly SAFE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  /**
   * Pattern for identifier names (project names, workspace names, etc.)
   */
  private static readonly SAFE_NAME_PATTERN = /^[a-zA-Z0-9\s\-_@.#]+$/;

  /**
   * Sanitize and validate search input
   * @param search - The search string to sanitize
   * @param fieldName - Name of the field for error messages (default: 'search')
   * @returns Sanitized search string or undefined if empty
   * @throws BadRequestException if input is invalid
   */
  static sanitizeSearch(
    search: string | undefined,
    fieldName: string = 'search',
  ): string | undefined {
    if (!search || search.trim() === '') {
      return undefined;
    }

    const trimmed = search.trim();

    // Check length
    if (trimmed.length > this.MAX_SEARCH_LENGTH) {
      throw new BadRequestException(
        `${fieldName} query must not exceed ${this.MAX_SEARCH_LENGTH} characters`,
      );
    }

    // Check for potentially dangerous patterns
    if (!this.SAFE_SEARCH_PATTERN.test(trimmed)) {
      throw new BadRequestException(
        `${fieldName} contains invalid characters. Only alphanumeric characters, spaces, and -_@.# are allowed`,
      );
    }

    // Check for SQL injection patterns (defense in depth - Prisma already parameterizes)
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
      /(--)|(\/\*)|(\/)|(;)/,
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    ];

    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(trimmed)) {
        throw new BadRequestException(`${fieldName} contains invalid pattern`);
      }
    }

    // Check for regex special characters that could cause ReDoS
    const regexSpecialChars = /[.*+?^${}()|[\]\\]/;
    if (regexSpecialChars.test(trimmed)) {
      throw new BadRequestException(`${fieldName} contains invalid special characters`);
    }

    return trimmed;
  }

  /**
   * Sanitize a name input (project name, workspace name, etc.)
   * @param name - The name to sanitize
   * @param fieldName - Name of the field for error messages
   * @param maxLength - Optional custom max length (default: 500)
   * @returns Sanitized name string
   * @throws BadRequestException if input is invalid
   */
  static sanitizeName(
    name: string,
    fieldName: string = 'name',
    maxLength: number = this.MAX_STRING_LENGTH,
  ): string {
    if (!name || name.trim() === '') {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const trimmed = name.trim();

    if (trimmed.length > maxLength) {
      throw new BadRequestException(`${fieldName} must not exceed ${maxLength} characters`);
    }

    if (!this.SAFE_NAME_PATTERN.test(trimmed)) {
      throw new BadRequestException(`${fieldName} contains invalid characters`);
    }

    return trimmed;
  }

  /**
   * Sanitize a slug input
   * @param slug - The slug to sanitize
   * @param fieldName - Name of the field for error messages
   * @returns Sanitized slug string
   * @throws BadRequestException if input is invalid
   */
  static sanitizeSlug(slug: string, fieldName: string = 'slug'): string {
    if (!slug || slug.trim() === '') {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const trimmed = slug.trim().toLowerCase();

    if (!this.SAFE_SLUG_PATTERN.test(trimmed)) {
      throw new BadRequestException(
        `${fieldName} must be lowercase alphanumeric with hyphens (e.g., 'my-project')`,
      );
    }

    return trimmed;
  }

  /**
   * Escape special characters in a string for safe use in LIKE queries
   * While Prisma parameterizes queries, this adds defense in depth
   * @param input - The string to escape
   * @returns Escaped string
   */
  static escapeLikeString(input: string): string {
    // Escape special LIKE characters
    return input.replace(/[%_\\]/g, '\\$&');
  }

  /**
   * Sanitize multiple search fields at once
   * @param fields - Object with field names and values
   * @returns Object with sanitized values
   * @throws BadRequestException if any field is invalid
   */
  static sanitizeMultipleFields(
    fields: Record<string, string | undefined>,
  ): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(fields)) {
      result[key] = this.sanitizeSearch(value, key);
    }

    return result;
  }

  /**
   * Validate and sanitize pagination parameters
   * @param page - Page number
   * @param pageSize - Page size
   * @param maxPageSize - Maximum allowed page size (default: 100)
   * @returns Validated pagination object
   * @throws BadRequestException if parameters are invalid
   */
  static sanitizePagination(
    page: number | string | undefined,
    pageSize: number | string | undefined,
    maxPageSize: number = 100,
  ): { page: number; pageSize: number } {
    // Convert to numbers if strings
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : (page ?? 1);
    const pageSizeNum = typeof pageSize === 'string' ? parseInt(pageSize, 10) : (pageSize ?? 10);

    // Validate
    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }

    if (isNaN(pageSizeNum) || pageSizeNum < 1) {
      throw new BadRequestException('Page size must be a positive integer');
    }

    if (pageSizeNum > maxPageSize) {
      throw new BadRequestException(
        `Page size cannot exceed ${maxPageSize}. Requested: ${pageSizeNum}`,
      );
    }

    return { page: pageNum, pageSize: pageSizeNum };
  }

  /**
   * Remove potentially dangerous whitespace characters
   * @param input - The string to clean
   * @returns Cleaned string
   */
  static cleanWhitespace(input: string): string {
    // Replace multiple spaces/tabs/newlines with single space
    return input.replace(/\s+/g, ' ').trim();
  }
}
