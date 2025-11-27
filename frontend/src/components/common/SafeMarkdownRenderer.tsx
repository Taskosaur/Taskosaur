import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Safely renders markdown content with XSS protection
 * Uses react-markdown with rehype-sanitize to prevent script injection
 */
export const SafeMarkdownRenderer: React.FC<SafeMarkdownRendererProps> = ({ 
  content, 
  className = `
    text-[var(--foreground)] leading-relaxed
    [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-5
    [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl
    [&_h4]:text-lg [&_h5]:text-base [&_h6]:text-sm
    [&_blockquote]:border-l-4 [&_blockquote]:border-gray-400
    [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600
    [&_p]:my-1
  `.trim().replace(/\s+/g, ' ')
}) => {
  // Custom sanitize schema to allow common HTML tags in markdown
  const sanitizeSchema = {
    tagNames: [
      // Block elements
      'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'hr',
      // Inline elements
      'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'ins',
      'span', 'br', 'sub', 'sup', 'mark', 'kbd',
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
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]} // GitHub Flavored Markdown (tables, checkboxes, etc.)
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]} // Parse HTML then sanitize
        components={{
          // Custom component for task checkboxes to make them interactive
          input: ({ node, ...props }) => {
            if (props.type === 'checkbox') {
              return <input {...props} disabled className="cursor-not-allowed" />;
            }
            return <input {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
