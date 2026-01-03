import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

interface ShadowDomHtmlRendererProps {
  content: string;
  className?: string;
}

export const ShadowDomHtmlRenderer: React.FC<ShadowDomHtmlRendererProps> = ({
  content,
  className,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    if (hostRef.current && !shadowRootRef.current) {
      shadowRootRef.current = hostRef.current.attachShadow({ mode: 'open' });
    }

    if (shadowRootRef.current) {
      // Basic email styles to mimic Gmail/email client rendering
      // We force a light theme inside the shadow DOM because emails are typically designed for light backgrounds
      const style = document.createElement('style');
      style.textContent = `
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color: #222;
          background-color: #ffffff; /* Force white background for email fidelity */
          padding: 16px;
          border-radius: 4px;
          overflow-wrap: break-word;
          border: 1px solid #e5e7eb;
        }

        /* Standard Gmail-like Resets & Defaults */
        div, p, h1, h2, h3, h4, h5, h6, ul, ol, li, dl, dt, dd, table, th, td, blockquote {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        p { margin-bottom: 1em; }
        
        h1, h2, h3, h4, h5, h6 {
            font-weight: bold;
            margin-top: 1em;
            margin-bottom: 0.5em;
            line-height: 1.2;
        }
        
        h1 { font-size: 1.5em; }
        h2 { font-size: 1.25em; }
        
        ul, ol {
            margin-left: 1.5em;
            margin-bottom: 1em;
            padding-left: 1em;
        }
        
        li { margin-bottom: 0.25em; }
        
        blockquote {
            margin: 1em 0;
            padding-left: 1em;
            border-left: 3px solid #ccc;
            color: #555;
        }
        
        a { color: #1a73e8; text-decoration: none; }
        a:hover { text-decoration: underline; }
        
        img { max-width: 100%; height: auto; }
        
        table {
            border-collapse: collapse;
            max-width: 100%;
        }

        pre, code {
          font-family: monospace;
          background-color: #f5f5f5;
          padding: 2px 4px;
          border-radius: 3px;
        }

        pre {
          padding: 10px;
          overflow-x: auto;
        }
        
        /* Gmail signature handling */
        .gmail_signature {
            color: #888;
            margin-top: 20px;
            border-top: 1px solid #eee;
            padding-top: 10px;
        }
      `;

      // Allow some more tags/attributes that are common in emails but safe
      const sanitizedContent = DOMPurify.sanitize(content, {
        ADD_TAGS: ['style', 'font', 'center', 'strike', 'u'], 
        ADD_ATTR: ['target', 'color', 'bgcolor', 'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'width', 'height', 'style'],
        WHOLE_DOCUMENT: false,
        FORCE_BODY: true, 
      });

      const contentWrapper = document.createElement('div');
      contentWrapper.innerHTML = sanitizedContent;
      
      // Ensure all links open in new tab
      const links = contentWrapper.querySelectorAll('a');
      links.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });

      shadowRootRef.current.innerHTML = ''; // Clear previous
      shadowRootRef.current.appendChild(style);
      shadowRootRef.current.appendChild(contentWrapper);
    }
  }, [content]);

  return <div ref={hostRef} className={className} />;
};
