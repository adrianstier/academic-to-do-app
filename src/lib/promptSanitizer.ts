/**
 * Prompt Sanitization Utility
 *
 * Protects AI endpoints from prompt injection attacks by sanitizing user input
 * before including it in prompts sent to Claude or other LLMs.
 */

/**
 * Common prompt injection patterns to filter
 */
const INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /disregard\s+(all\s+)?above/gi,
  /forget\s+(all\s+)?previous/gi,
  /ignore\s+(the\s+)?system\s+prompt/gi,

  // Role/mode switching attempts
  /\bsystem\s*:/gi,
  /\bassistant\s*:/gi,
  /\buser\s*:/gi,
  /\bhuman\s*:/gi,
  /\[\s*INST\s*\]/gi,
  /\[\s*\/INST\s*\]/gi,
  /<<\s*SYS\s*>>/gi,
  /<<\s*\/SYS\s*>>/gi,

  // Jailbreak attempts
  /\bdan\s+mode/gi,
  /\bdeveloper\s+mode/gi,
  /\bjailbreak/gi,
  /\bbypass\s+(safety|filter|restriction)/gi,

  // Code execution attempts
  /<script[\s>]/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,

  // XML/HTML injection
  /<\/?[a-z][\s\S]*>/gi,
];

/**
 * Sensitive data patterns that should trigger warnings
 */
const SENSITIVE_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  accountNumber: /\b(account\s*#?|acct\.?\s*#?)\s*\d{6,}\b/gi,
  policyNumber: /\b(policy\s*#?|pol\.?\s*#?)\s*[A-Z0-9]{6,}\b/gi,
  password: /\b(password|passwd|pwd)\s*[:=]\s*\S+/gi,
  apiKey: /\b(api[_-]?key|secret[_-]?key|auth[_-]?token)\s*[:=]\s*\S+/gi,
};

export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  warnings: SanitizationWarning[];
  blockedPatterns: string[];
}

export interface SanitizationWarning {
  type: 'sensitive_data' | 'injection_attempt' | 'length_exceeded';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Configuration options for sanitization
 */
export interface SanitizeOptions {
  maxLength?: number;
  allowHtml?: boolean;
  checkSensitiveData?: boolean;
  escapeXml?: boolean;
}

const DEFAULT_OPTIONS: SanitizeOptions = {
  maxLength: 10000,
  allowHtml: false,
  checkSensitiveData: true,
  escapeXml: true,
};

/**
 * Sanitize user input before including in AI prompts
 *
 * @param input - Raw user input
 * @param options - Sanitization options
 * @returns Sanitization result with cleaned input and any warnings
 */
export function sanitizePromptInput(
  input: string,
  options: SanitizeOptions = {}
): SanitizationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: SanitizationWarning[] = [];
  const blockedPatterns: string[] = [];
  let sanitized = input;
  let wasModified = false;

  // Truncate to max length
  if (sanitized.length > opts.maxLength!) {
    sanitized = sanitized.substring(0, opts.maxLength!);
    wasModified = true;
    warnings.push({
      type: 'length_exceeded',
      message: `Input truncated from ${input.length} to ${opts.maxLength} characters`,
      severity: 'low',
    });
  }

  // Remove prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    const matches = sanitized.match(pattern);
    if (matches) {
      blockedPatterns.push(...matches);
      sanitized = sanitized.replace(pattern, '[FILTERED]');
      wasModified = true;
      warnings.push({
        type: 'injection_attempt',
        message: `Potential prompt injection pattern detected and filtered`,
        severity: 'high',
      });
    }
  }

  // Check for sensitive data
  if (opts.checkSensitiveData) {
    for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
      if (pattern.test(sanitized)) {
        warnings.push({
          type: 'sensitive_data',
          message: `Potentially sensitive data detected: ${type}`,
          severity: 'high',
        });
      }
    }
  }

  // Escape XML/HTML if required
  if (opts.escapeXml && !opts.allowHtml) {
    const escaped = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    if (escaped !== sanitized) {
      wasModified = true;
    }
    sanitized = escaped;
  }

  // Normalize whitespace
  const normalized = sanitized.replace(/\s+/g, ' ').trim();
  if (normalized !== sanitized) {
    wasModified = true;
  }

  return {
    sanitized: normalized,
    wasModified,
    warnings,
    blockedPatterns,
  };
}

/**
 * Quick sanitization for simple cases
 * Returns just the sanitized string, logs warnings
 */
export function quickSanitize(input: string, maxLength = 10000): string {
  const result = sanitizePromptInput(input, { maxLength });

  if (result.blockedPatterns.length > 0) {
    console.warn('Prompt injection patterns blocked:', result.blockedPatterns);
  }

  if (result.warnings.some(w => w.type === 'sensitive_data')) {
    console.warn('Sensitive data detected in input');
  }

  return result.sanitized;
}

/**
 * Validate that input is safe for prompts without modifying it
 * Returns true if input is safe, false if it contains problematic patterns
 */
export function isInputSafe(input: string): boolean {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return false;
    }
  }
  return true;
}

/**
 * Extract and mask sensitive data for logging
 */
export function maskSensitiveData(input: string): string {
  let masked = input;

  // Mask SSNs
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****');

  // Mask credit cards
  masked = masked.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '****-****-****-****'
  );

  // Mask account numbers
  masked = masked.replace(
    /\b(account\s*#?|acct\.?\s*#?)\s*(\d{6,})\b/gi,
    '$1 ******'
  );

  // Mask policy numbers
  masked = masked.replace(
    /\b(policy\s*#?|pol\.?\s*#?)\s*([A-Z0-9]{6,})\b/gi,
    '$1 ******'
  );

  return masked;
}

/**
 * Create a sandboxed prompt wrapper that clearly delimits user input
 */
export function wrapUserInput(input: string, label = 'USER_INPUT'): string {
  const sanitized = quickSanitize(input);
  return `<${label}>\n${sanitized}\n</${label}>`;
}
