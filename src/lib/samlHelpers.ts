/**
 * SAML Helper Utilities
 *
 * Lightweight helpers for building SAML AuthnRequests, parsing responses,
 * and generating Service Provider metadata. These are used by the SSO
 * settings UI and the SSO API routes.
 *
 * IMPORTANT — PRODUCTION NOTE:
 * These helpers perform basic XML construction and parsing suitable for
 * the UI flow and development/testing. For production deployment, SAML
 * signature validation and XML canonicalization MUST use a dedicated
 * library such as `saml2-js`, `passport-saml`, or `@node-saml/node-saml`.
 * Without proper signature verification, SAML responses can be forged.
 */

import type { SSOProvider } from '@/types/sso';

// ============================================
// SAML Request Generation
// ============================================

/**
 * Generate a SAML 2.0 AuthnRequest and build the IdP redirect URL.
 *
 * The request is deflated and base64-encoded per the HTTP-Redirect binding
 * specification (SAMLCore 3.4.1). In this simplified version we skip
 * deflate and just base64-encode, which works with many IdPs in
 * development mode.
 *
 * PRODUCTION NOTE: Use a SAML library to properly deflate-encode and
 * optionally sign the AuthnRequest.
 */
export function generateSAMLRequest(
  provider: SSOProvider,
  callbackUrl: string
): { redirectUrl: string; requestId: string } {
  const requestId = `_${generateId()}`;
  const issueInstant = new Date().toISOString();
  const issuer = new URL(callbackUrl).origin;

  const authnRequest = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<samlp:AuthnRequest',
    '  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"',
    '  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"',
    `  ID="${requestId}"`,
    '  Version="2.0"',
    `  IssueInstant="${issueInstant}"`,
    `  Destination="${provider.ssoUrl}"`,
    `  AssertionConsumerServiceURL="${callbackUrl}"`,
    '  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">',
    `  <saml:Issuer>${issuer}</saml:Issuer>`,
    '  <samlp:NameIDPolicy',
    '    Format="urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress"',
    '    AllowCreate="true"/>',
    '</samlp:AuthnRequest>',
  ].join('\n');

  // Base64-encode the AuthnRequest
  // PRODUCTION NOTE: Should use zlib.deflateRaw() before base64 for HTTP-Redirect binding
  const encodedRequest = Buffer.from(authnRequest, 'utf-8').toString('base64');

  // Build redirect URL with SAMLRequest query parameter
  const redirectUrl = new URL(provider.ssoUrl);
  redirectUrl.searchParams.set('SAMLRequest', encodedRequest);
  redirectUrl.searchParams.set('RelayState', callbackUrl);

  return {
    redirectUrl: redirectUrl.toString(),
    requestId,
  };
}

// ============================================
// SAML Response Parsing
// ============================================

/**
 * Parsed user profile extracted from a SAML Response assertion.
 */
export interface ParsedSAMLUser {
  nameId: string;
  sessionIndex: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  department?: string;
  orcid?: string;
  attributes: Record<string, string>;
}

/**
 * Parse a base64-encoded SAML Response and extract user attributes.
 *
 * PRODUCTION NOTE: This performs basic XML string parsing WITHOUT
 * verifying the XML signature. In production, you MUST validate the
 * response signature against the IdP certificate using a proper SAML
 * library (e.g., `@node-saml/node-saml`). Without signature validation,
 * an attacker can forge SAML responses and impersonate any user.
 */
export function parseSAMLResponse(
  samlResponse: string,
  provider: SSOProvider
): ParsedSAMLUser | null {
  try {
    // Decode base64 response
    const xml = Buffer.from(samlResponse, 'base64').toString('utf-8');

    // Basic status check: ensure the response indicates success
    const statusCode = extractXmlAttribute(xml, 'StatusCode', 'Value');
    if (statusCode && !statusCode.endsWith(':Success')) {
      return null;
    }

    // Check assertion time conditions to prevent replay attacks
    const notBefore = extractXmlAttribute(xml, 'Conditions', 'NotBefore');
    const notOnOrAfter = extractXmlAttribute(xml, 'Conditions', 'NotOnOrAfter');
    const now = new Date();
    // Allow 5-minute clock skew
    const clockSkewMs = 5 * 60 * 1000;

    if (notBefore) {
      const notBeforeDate = new Date(notBefore);
      if (now.getTime() < notBeforeDate.getTime() - clockSkewMs) {
        return null; // Assertion not yet valid
      }
    }

    if (notOnOrAfter) {
      const notOnOrAfterDate = new Date(notOnOrAfter);
      if (now.getTime() >= notOnOrAfterDate.getTime() + clockSkewMs) {
        return null; // Assertion has expired
      }
    }

    // Verify the Issuer matches the expected IdP entityId
    const responseIssuer = extractXmlValue(xml, 'Issuer');
    if (responseIssuer && responseIssuer !== provider.entityId) {
      return null; // Issuer mismatch - possible spoofing attempt
    }

    // Extract NameID
    const nameId = extractXmlValue(xml, 'NameID') || '';

    // Extract SessionIndex from AuthnStatement
    const sessionIndex = extractXmlAttribute(xml, 'AuthnStatement', 'SessionIndex') || '';

    // Extract all attributes from the assertion
    const attributes = extractSAMLAttributes(xml);

    // Map SAML attributes to user profile fields using the provider's mapping
    const mapping = provider.attributeMapping;

    const email = attributes[mapping.email] || nameId;
    const firstName = attributes[mapping.firstName] || '';
    const lastName = attributes[mapping.lastName] || '';
    const displayName = mapping.displayName
      ? attributes[mapping.displayName]
      : undefined;
    const department = mapping.department
      ? attributes[mapping.department]
      : undefined;
    const orcid = mapping.orcid
      ? attributes[mapping.orcid]
      : undefined;

    if (!email) {
      return null;
    }

    return {
      nameId,
      sessionIndex,
      email,
      firstName,
      lastName,
      displayName,
      department,
      orcid,
      attributes,
    };
  } catch {
    return null;
  }
}

// ============================================
// Certificate Validation
// ============================================

/**
 * Validate that a string is a properly formatted PEM certificate.
 *
 * Checks for:
 * - BEGIN/END CERTIFICATE markers
 * - Valid base64 content between markers
 * - Non-empty certificate data
 */
export function validateCertificate(pem: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = pem.trim();

  if (!trimmed) {
    return { valid: false, error: 'Certificate is empty' };
  }

  // Check for PEM markers
  const hasBegin = trimmed.includes('-----BEGIN CERTIFICATE-----');
  const hasEnd = trimmed.includes('-----END CERTIFICATE-----');

  if (!hasBegin || !hasEnd) {
    return {
      valid: false,
      error: 'Certificate must include -----BEGIN CERTIFICATE----- and -----END CERTIFICATE----- markers',
    };
  }

  // Extract the base64 body between markers
  const base64Match = trimmed.match(
    /-----BEGIN CERTIFICATE-----\s*([\s\S]*?)\s*-----END CERTIFICATE-----/
  );

  if (!base64Match || !base64Match[1]) {
    return { valid: false, error: 'No certificate data found between PEM markers' };
  }

  const base64Body = base64Match[1].replace(/\s/g, '');

  if (base64Body.length === 0) {
    return { valid: false, error: 'Certificate body is empty' };
  }

  // Validate base64 encoding
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Body)) {
    return { valid: false, error: 'Certificate contains invalid base64 characters' };
  }

  return { valid: true };
}

// ============================================
// IdP Metadata Extraction
// ============================================

/**
 * Parse an IdP SAML metadata XML document and extract
 * the entity ID, SSO URL, and X.509 certificate.
 *
 * PRODUCTION NOTE: Metadata documents can be signed.
 * In production, verify the metadata signature before trusting
 * the extracted values.
 */
export function extractMetadata(metadataXml: string): {
  entityId: string;
  ssoUrl: string;
  certificate: string;
} | null {
  try {
    // Extract entityID from EntityDescriptor
    const entityId =
      extractXmlAttribute(metadataXml, 'EntityDescriptor', 'entityID') ||
      extractXmlAttribute(metadataXml, 'md:EntityDescriptor', 'entityID') ||
      '';

    // Extract SSO URL from SingleSignOnService with HTTP-Redirect binding
    const ssoUrl = extractSSOUrl(metadataXml) || '';

    // Extract X.509 certificate from KeyDescriptor
    const certificate = extractX509Certificate(metadataXml) || '';

    if (!entityId && !ssoUrl) {
      return null;
    }

    return { entityId, ssoUrl, certificate };
  } catch {
    return null;
  }
}

// ============================================
// SP Metadata Generation
// ============================================

/**
 * Generate Service Provider SAML metadata XML.
 *
 * This metadata document is shared with the IdP's IT department
 * so they can configure the trust relationship. It describes our
 * SP's entity ID, assertion consumer service URL, and supported
 * name ID formats.
 */
export function buildServiceProviderMetadata(appUrl: string): string {
  const entityId = appUrl;
  const acsUrl = `${appUrl}/api/auth/sso/callback`;
  const metadataUrl = `${appUrl}/api/auth/sso/metadata`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<md:EntityDescriptor',
    '  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"',
    `  entityID="${entityId}">`,
    '  <md:SPSSODescriptor',
    '    AuthnRequestsSigned="false"',
    '    WantAssertionsSigned="true"',
    '    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">',
    '',
    '    <!-- Name ID Formats supported by this SP -->',
    '    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress</md:NameIDFormat>',
    '    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>',
    '    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</md:NameIDFormat>',
    '',
    '    <!-- Assertion Consumer Service (where IdP sends SAML Response) -->',
    '    <md:AssertionConsumerService',
    '      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"',
    `      Location="${acsUrl}"`,
    '      index="0"',
    '      isDefault="true"/>',
    '',
    '  </md:SPSSODescriptor>',
    '',
    '  <!-- Organization Information -->',
    '  <md:Organization>',
    '    <md:OrganizationName xml:lang="en">Academic Project Manager</md:OrganizationName>',
    '    <md:OrganizationDisplayName xml:lang="en">Academic Project Manager</md:OrganizationDisplayName>',
    `    <md:OrganizationURL xml:lang="en">${appUrl}</md:OrganizationURL>`,
    '  </md:Organization>',
    '',
    '  <!-- Technical Contact -->',
    '  <md:ContactPerson contactType="technical">',
    '    <md:GivenName>IT Admin</md:GivenName>',
    `    <md:EmailAddress>admin@${new URL(appUrl).hostname}</md:EmailAddress>`,
    '  </md:ContactPerson>',
    '',
    `  <!-- SP Metadata URL: ${metadataUrl} -->`,
    '</md:EntityDescriptor>',
  ].join('\n');
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Generate a cryptographically secure random identifier for SAML request IDs.
 * Uses the Web Crypto API (available in both Node.js and browser environments).
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (should not occur in modern environments)
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Extract the text content of an XML element by tag name.
 * Basic string-based extraction — NOT a full XML parser.
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  // Handle both prefixed and unprefixed tags
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'i'),
    new RegExp(`<[a-z]+:${tagName}[^>]*>([^<]+)</[a-z]+:${tagName}>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract an attribute value from an XML element by tag and attribute name.
 * Basic string-based extraction — NOT a full XML parser.
 */
function extractXmlAttribute(
  xml: string,
  tagName: string,
  attributeName: string
): string | null {
  const patterns = [
    new RegExp(`<${tagName}[^>]*${attributeName}="([^"]*)"`, 'i'),
    new RegExp(`<[a-z]+:${tagName}[^>]*${attributeName}="([^"]*)"`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract SAML attributes from a SAML Response XML.
 * Returns a map of attribute Name -> attribute Value.
 */
function extractSAMLAttributes(xml: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  // Match Attribute elements with Name and their AttributeValue children
  // Handles both saml: prefixed and unprefixed elements
  const attrPattern =
    /<(?:saml:)?Attribute\s+Name="([^"]*)"[^>]*>\s*<(?:saml:)?AttributeValue[^>]*>([^<]*)<\/(?:saml:)?AttributeValue>/gi;

  let match;
  while ((match = attrPattern.exec(xml)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    if (name && value) {
      attributes[name] = value;
    }
  }

  return attributes;
}

/**
 * Extract the SSO URL from IdP metadata.
 * Looks for SingleSignOnService with HTTP-Redirect or HTTP-POST binding.
 */
function extractSSOUrl(metadataXml: string): string | null {
  // Prefer HTTP-Redirect binding
  const redirectPattern =
    /SingleSignOnService[^>]*Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"[^>]*Location="([^"]*)"/i;
  const redirectMatch = metadataXml.match(redirectPattern);
  if (redirectMatch) {
    return redirectMatch[1];
  }

  // Fall back to HTTP-POST binding
  const postPattern =
    /SingleSignOnService[^>]*Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"[^>]*Location="([^"]*)"/i;
  const postMatch = metadataXml.match(postPattern);
  if (postMatch) {
    return postMatch[1];
  }

  // Try Location-first order
  const locationFirstPattern =
    /SingleSignOnService[^>]*Location="([^"]*)"[^>]*Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"/i;
  const locationFirstMatch = metadataXml.match(locationFirstPattern);
  if (locationFirstMatch) {
    return locationFirstMatch[1];
  }

  return null;
}

/**
 * Extract X.509 certificate from IdP metadata KeyDescriptor.
 * Returns the certificate wrapped in PEM markers.
 */
function extractX509Certificate(metadataXml: string): string | null {
  const certPattern =
    /<(?:ds:)?X509Certificate[^>]*>([\s\S]*?)<\/(?:ds:)?X509Certificate>/i;
  const match = metadataXml.match(certPattern);

  if (!match || !match[1]) {
    return null;
  }

  const certBody = match[1].replace(/\s/g, '');

  if (!certBody) {
    return null;
  }

  // Wrap in PEM markers, splitting into 64-char lines
  const lines: string[] = [];
  for (let i = 0; i < certBody.length; i += 64) {
    lines.push(certBody.substring(i, i + 64));
  }

  return [
    '-----BEGIN CERTIFICATE-----',
    ...lines,
    '-----END CERTIFICATE-----',
  ].join('\n');
}
