'use client';

/**
 * Lightweight markdown-to-HTML renderer.
 * Handles: headings, bold, italic, inline code, fenced code blocks,
 * bullet lists, numbered lists, links, and paragraph breaks.
 *
 * Security: HTML in user input is escaped BEFORE markdown transforms are applied.
 * escapeHtml() converts <, >, &, ", ' to HTML entities so no raw HTML from
 * user input can reach the DOM.
 */

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/** Escape HTML entities to prevent XSS — applied BEFORE any markdown parsing. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert a markdown string to sanitised HTML. */
function parseMarkdown(raw: string): string {
  // 1. Escape HTML first (XSS prevention)
  const escaped = escapeHtml(raw);

  const lines = escaped.split('\n');
  const htmlParts: string[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlParts.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // --- Fenced code blocks ---
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        closeList();
        inCodeBlock = true;
        codeBlockContent = [];
      } else {
        htmlParts.push(
          `<pre style="background:var(--surface-2);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.75rem 1rem;overflow-x:auto;font-size:0.8125rem;line-height:1.6;margin:0.5rem 0"><code>${codeBlockContent.join('\n')}</code></pre>`
        );
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // --- Headings ---
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const text = applyInline(headingMatch[2]);
      const sizes: Record<number, string> = {
        1: 'font-size:1.25rem;font-weight:700;margin:0.75rem 0 0.375rem',
        2: 'font-size:1.1rem;font-weight:600;margin:0.625rem 0 0.3rem',
        3: 'font-size:0.975rem;font-weight:600;margin:0.5rem 0 0.25rem',
      };
      htmlParts.push(
        `<h${level} style="${sizes[level]};color:var(--foreground);line-height:1.3">${text}</h${level}>`
      );
      continue;
    }

    // --- Bullet list ---
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (inOl) { htmlParts.push('</ol>'); inOl = false; }
      if (!inUl) {
        htmlParts.push(
          '<ul style="list-style-type:disc;padding-left:1.5rem;margin:0.375rem 0">'
        );
        inUl = true;
      }
      htmlParts.push(`<li style="margin:0.125rem 0;line-height:1.5">${applyInline(bulletMatch[1])}</li>`);
      continue;
    }

    // --- Numbered list ---
    const orderedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (inUl) { htmlParts.push('</ul>'); inUl = false; }
      if (!inOl) {
        htmlParts.push(
          '<ol style="list-style-type:decimal;padding-left:1.5rem;margin:0.375rem 0">'
        );
        inOl = true;
      }
      htmlParts.push(`<li style="margin:0.125rem 0;line-height:1.5">${applyInline(orderedMatch[1])}</li>`);
      continue;
    }

    // Close any open list when we encounter a non-list line
    closeList();

    // --- Blank line -> spacing ---
    if (line.trim() === '') {
      htmlParts.push('<div style="height:0.5rem"></div>');
      continue;
    }

    // --- Regular paragraph ---
    htmlParts.push(
      `<p style="margin:0.25rem 0;line-height:1.6">${applyInline(line)}</p>`
    );
  }

  // Close any unclosed blocks
  if (inCodeBlock && codeBlockContent.length > 0) {
    htmlParts.push(
      `<pre style="background:var(--surface-2);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.75rem 1rem;overflow-x:auto;font-size:0.8125rem;line-height:1.6;margin:0.5rem 0"><code>${codeBlockContent.join('\n')}</code></pre>`
    );
  }
  closeList();

  return htmlParts.join('\n');
}

/** Apply inline formatting: bold, italic, inline code, links. */
function applyInline(text: string): string {
  let result = text;

  // Inline code (handle first to prevent inner matches)
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    return `<code style="background:var(--surface-2);padding:0.125rem 0.375rem;border-radius:var(--radius-sm);font-size:0.85em;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace">${code}</code>`;
  });

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links [text](url) — only allow safe protocols (http, https, mailto)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, linkText, url) => {
      // Strip leading/trailing whitespace from URL
      const trimmedUrl = url.trim();
      // Only allow http:, https:, and mailto: protocols — block javascript:, data:, vbscript:, etc.
      const isAllowedProtocol = /^https?:\/\//i.test(trimmedUrl) ||
        /^mailto:/i.test(trimmedUrl) ||
        // Allow relative URLs (no protocol prefix)
        !/^[a-zA-Z][a-zA-Z0-9+\-.]*:/i.test(trimmedUrl);
      if (!isAllowedProtocol) {
        // Render as plain text if protocol is disallowed
        return `${linkText}`;
      }
      return `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;text-underline-offset:2px">${linkText}</a>`;
    }
  );

  return result;
}

export default function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return (
      <div
        className={`text-sm px-3 py-2.5 ${className}`}
        style={{ color: 'var(--text-light)' }}
      >
        Nothing to preview
      </div>
    );
  }

  return (
    <div
      className={`text-sm px-3 py-2.5 ${className}`}
      style={{
        color: 'var(--foreground)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        minHeight: '5rem',
      }}
      // Safe: escapeHtml() is called on raw user input before any markdown
      // transforms, so no user-supplied HTML tags can reach the DOM.
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
      aria-label="Markdown preview"
      role="document"
    />
  );
}
