import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { decodeHtml } from '@/utils/sanitize-content';

interface DangerouslyHTMLCommentProps {
  comment: string;
}

/**
 * Renders HTML or markdown content safely using react-markdown
 * Supports both HTML tags and markdown syntax (including blockquotes with >, >>, >>>)
 * Uses rehype-raw to parse HTML and rehype-sanitize to prevent XSS
 * Decodes HTML entities (like &gt;) before parsing to ensure markdown syntax is recognized
 */
export function DangerouslyHTMLComment({ comment }: DangerouslyHTMLCommentProps) {
  // Decode HTML entities (like &gt; to >) so markdown parser can recognize syntax
  const hasHtmlEntities = /&[a-z]+;|&#\d+;/i.test(comment);
  const contentToRender = hasHtmlEntities ? decodeHtml(comment) : comment;

  // Custom sanitize schema to allow common HTML tags
  const sanitizeSchema = {
    tagNames: [
      // Block elements
      'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'hr', 'br',
      // Inline elements
      'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'ins',
      'span', 'sub', 'sup', 'mark', 'kbd',
      // Input for checkboxes
      'input'
    ],
    attributes: {
      a: ['href', 'title', 'target', 'rel'],
      input: ['type', 'checked', 'disabled'],
      code: ['className'], // for syntax highlighting
      '*': ['className'] // Allow className on all elements for styling
    }
  };

  return (
    <div className="prose prose-sm max-w-none [&_blockquote]:not-italic">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]} // GitHub Flavored Markdown (tables, checkboxes, etc.)
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]} // Parse HTML then sanitize
        components={{
          // Custom component for task checkboxes to make them disabled
          input: ({ node, ...props }) => {
            if (props.type === 'checkbox') {
              return <input {...props} disabled className="cursor-not-allowed" />;
            }
            return <input {...props} />;
          },
        }}
      >
        {contentToRender}
      </ReactMarkdown>
    </div>
  );
}
