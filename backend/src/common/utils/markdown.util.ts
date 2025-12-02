import { marked } from 'marked';

/**
 * Converts markdown string to HTML
 * @param markdown The markdown string to convert
 * @returns The converted HTML string
 */
export const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  return marked.parse(markdown) as string;
};
