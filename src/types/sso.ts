/**
 * SSO / SAML Type Definitions
 *
 * Types for institutional single sign-on integration (SAML 2.0).
 * Supports Shibboleth, Azure AD, Okta, and other SAML-based IdPs
 * commonly used by universities and research institutions.
 */

// ============================================
// Core Interfaces
// ============================================

export interface SSOProvider {
  id: string;
  /** Display name, e.g., "UC Santa Barbara" */
  name: string;
  /** SAML Entity ID — uniquely identifies the IdP */
  entityId: string;
  /** IdP SSO endpoint (HTTP-Redirect or HTTP-POST binding) */
  ssoUrl: string;
  /** IdP X.509 certificate in PEM format for signature verification */
  certificate: string;
  /** IdP metadata URL for automatic configuration */
  metadataUrl?: string;
  /** Maps SAML assertion attributes to user profile fields */
  attributeMapping: AttributeMapping;
  /** Whether this provider is currently active */
  enabled: boolean;
  createdAt: string;
}

export interface AttributeMapping {
  /** SAML attribute for email (e.g., "urn:oid:0.9.2342.19200300.100.1.3") */
  email: string;
  /** SAML attribute for given/first name (e.g., "urn:oid:2.5.4.42") */
  firstName: string;
  /** SAML attribute for surname/last name (e.g., "urn:oid:2.5.4.4") */
  lastName: string;
  /** SAML attribute for display name (e.g., "urn:oid:2.16.840.1.113730.3.1.241") */
  displayName?: string;
  /** SAML attribute for academic department */
  department?: string;
  /** SAML attribute for ORCID identifier */
  orcid?: string;
}

// ============================================
// Default Attribute Mappings
// ============================================

/**
 * Pre-configured attribute mappings for common IdP platforms.
 * These cover the most widely deployed SAML identity providers
 * in academic and research environments.
 */
export const DEFAULT_ATTRIBUTE_MAPPINGS: Record<string, AttributeMapping> = {
  shibboleth: {
    email: 'urn:oid:0.9.2342.19200300.100.1.3',
    firstName: 'urn:oid:2.5.4.42',
    lastName: 'urn:oid:2.5.4.4',
    displayName: 'urn:oid:2.16.840.1.113730.3.1.241',
  },
  azure_ad: {
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    displayName: 'http://schemas.microsoft.com/identity/claims/displayname',
  },
  okta: {
    email: 'email',
    firstName: 'firstName',
    lastName: 'lastName',
    displayName: 'displayName',
  },
};

// ============================================
// Session Types
// ============================================

export interface SSOSession {
  /** SSO provider ID that authenticated this session */
  provider: string;
  /** SAML NameID — the user identifier from the IdP */
  nameId: string;
  /** SAML SessionIndex — used for single logout */
  sessionIndex: string;
  /** Extracted user attributes from the SAML assertion */
  attributes: Record<string, string>;
  /** ISO timestamp when this SSO session expires */
  expiresAt: string;
}

// ============================================
// University IdP Presets
// ============================================

/**
 * Well-known university Identity Provider presets.
 * These are InCommon Federation members with publicly
 * available SAML metadata endpoints.
 */
export const UNIVERSITY_PRESETS: {
  name: string;
  entityId: string;
  metadataUrl: string;
}[] = [
  {
    name: 'UC Santa Barbara',
    entityId: 'urn:mace:incommon:ucsb.edu',
    metadataUrl: 'https://sso.ucsb.edu/idp/shibboleth',
  },
  {
    name: 'Stanford University',
    entityId: 'urn:mace:incommon:stanford.edu',
    metadataUrl: 'https://idp.stanford.edu/shibboleth',
  },
  {
    name: 'MIT',
    entityId: 'urn:mace:incommon:mit.edu',
    metadataUrl: 'https://idp.mit.edu/shibboleth',
  },
  {
    name: 'UC Berkeley',
    entityId: 'urn:mace:incommon:berkeley.edu',
    metadataUrl: 'https://shib.berkeley.edu/idp/shibboleth',
  },
  {
    name: 'Harvard University',
    entityId: 'urn:mace:incommon:harvard.edu',
    metadataUrl: 'https://fed.huit.harvard.edu/idp/shibboleth',
  },
];

// ============================================
// SSO Configuration State (for settings UI)
// ============================================

export interface SSOConfig {
  /** Whether SSO is enabled for this team/instance */
  enabled: boolean;
  /** The configured SSO provider, if any */
  provider: SSOProvider | null;
  /** Whether to auto-create user accounts on first SSO login */
  autoProvision: boolean;
  /** Default role to assign to auto-provisioned users */
  defaultRole: 'member' | 'viewer';
}

export const DEFAULT_SSO_CONFIG: SSOConfig = {
  enabled: false,
  provider: null,
  autoProvision: true,
  defaultRole: 'member',
};
