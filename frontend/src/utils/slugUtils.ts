/**
 * Extracts the UUID from a string that might contain a slug suffix.
 * A UUID is 36 characters long.
 * Example: "123e4567-e89b-12d3-a456-426614174000-my-task-slug" -> "123e4567-e89b-12d3-a456-426614174000"
 */
export const extractUuid = (id: string | undefined | null): string | null => {
  if (!id) return null;

  // UUIDs are 36 characters long (32 hex digits + 4 hyphens)
  // If the ID is longer than 36 chars and starts with a UUID pattern, extract it.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = id.match(uuidPattern);

  if (match) {
    return match[0];
  }

  // Fallback: if it doesn't look like a UUID at start, just return the ID (might be invalid or legacy)
  return id;
};

/**
 * Generates a URL-friendly slug from a string (e.g., task title).
 */
export const generateSlug = (text: string): string => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/&/g, '-and-')   // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
};
