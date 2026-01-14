'use client';

import React from 'react';

interface HighlightedTextProps {
  text: string;
  className?: string;
  highlightClassName?: string;
}

/**
 * Component to safely highlight quoted text without using dangerouslySetInnerHTML.
 *
 * Converts strings like 'Click "My add-ins"' into:
 * Click <strong>"My add-ins"</strong>
 */
export function HighlightedText({
  text,
  className = '',
  highlightClassName = 'text-[var(--foreground)] font-medium',
}: HighlightedTextProps) {
  // Split text by quoted sections
  const parts = text.split(/("(?:[^"\\]|\\.)*")/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part is a quoted string
        if (part.startsWith('"') && part.endsWith('"')) {
          return (
            <strong key={index} className={highlightClassName}>
              {part}
            </strong>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}

interface SafeHtmlLinkProps {
  text: string;
  className?: string;
}

/**
 * Component to safely render text with links.
 *
 * Supports a specific format: text with <a> tags
 * Only allows specific whitelisted URLs.
 */
export function SafeHtmlLink({
  text,
  className = '',
}: SafeHtmlLinkProps) {
  // Whitelist of allowed URLs
  const ALLOWED_URLS = [
    'https://aka.ms/olksideload',
    'https://support.microsoft.com',
    'https://outlook.office.com',
    'https://shared-todo-list-production.up.railway.app',
  ];

  // Parse the text for links
  const linkRegex = /<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(
        <React.Fragment key={`text-${lastIndex}`}>
          {text.substring(lastIndex, match.index)}
        </React.Fragment>
      );
    }

    const url = match[1];
    const linkText = match[2];

    // Check if URL is whitelisted
    const isAllowed = ALLOWED_URLS.some(allowed =>
      url.startsWith(allowed) || url === allowed
    );

    if (isAllowed) {
      parts.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:underline"
        >
          {linkText}
        </a>
      );
    } else {
      // For non-whitelisted URLs, just show the text
      parts.push(
        <span key={`blocked-${match.index}`} className="text-[var(--accent)]">
          {linkText}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <React.Fragment key={`text-end`}>
        {text.substring(lastIndex)}
      </React.Fragment>
    );
  }

  // If no links found, just render the text with HighlightedText
  if (parts.length === 0) {
    return <HighlightedText text={text} className={className} />;
  }

  return <span className={className}>{parts}</span>;
}

export default HighlightedText;
