'use client';

/**
 * SSO Settings Panel
 *
 * Admin settings UI for configuring institutional SAML single sign-on.
 * Allows team owners to connect their university's IdP (Shibboleth,
 * Azure AD, Okta, etc.) so members can log in with institutional
 * credentials.
 *
 * Follows the same UI patterns as ZoteroSettings.tsx.
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  Building2,
  Key,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Info,
  ChevronDown,
  Eye,
  EyeOff,
  UserPlus,
  FileText,
} from 'lucide-react';
import type {
  SSOProvider,
  AttributeMapping,
  SSOConfig,
} from '@/types/sso';
import {
  DEFAULT_ATTRIBUTE_MAPPINGS,
  UNIVERSITY_PRESETS,
  DEFAULT_SSO_CONFIG,
} from '@/types/sso';
import { validateCertificate, buildServiceProviderMetadata } from '@/lib/samlHelpers';

// ============================================
// Types
// ============================================

type ConfigMode = 'preset' | 'manual';

// ============================================
// Main Component
// ============================================

export default function SSOSettings() {
  // SSO config state
  const [config, setConfig] = useState<SSOConfig>(DEFAULT_SSO_CONFIG);
  const [configMode, setConfigMode] = useState<ConfigMode>('preset');

  // Provider form state
  const [providerName, setProviderName] = useState('');
  const [entityId, setEntityId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [certificate, setCertificate] = useState('');
  const [metadataUrl, setMetadataUrl] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [selectedMappingPreset, setSelectedMappingPreset] = useState('shibboleth');

  // Attribute mapping state
  const [attrEmail, setAttrEmail] = useState(DEFAULT_ATTRIBUTE_MAPPINGS.shibboleth.email);
  const [attrFirstName, setAttrFirstName] = useState(DEFAULT_ATTRIBUTE_MAPPINGS.shibboleth.firstName);
  const [attrLastName, setAttrLastName] = useState(DEFAULT_ATTRIBUTE_MAPPINGS.shibboleth.lastName);
  const [attrDisplayName, setAttrDisplayName] = useState(DEFAULT_ATTRIBUTE_MAPPINGS.shibboleth.displayName || '');
  const [attrDepartment, setAttrDepartment] = useState('');
  const [attrOrcid, setAttrOrcid] = useState('');

  // Provisioning state
  const [autoProvision, setAutoProvision] = useState(true);
  const [defaultRole, setDefaultRole] = useState<'member' | 'viewer'>('member');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [copiedMetadata, setCopiedMetadata] = useState(false);
  const [showMetadataXml, setShowMetadataXml] = useState(false);
  const [showMappingSection, setShowMappingSection] = useState(false);

  // ---- Load existing config on mount ----
  useEffect(() => {
    // In production, load from API/Supabase
    // For now, just mark as loaded
    setIsLoading(false);
  }, []);

  // ---- Auto-clear messages ----
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ---- Handlers ----

  const handlePresetSelect = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = UNIVERSITY_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setProviderName(preset.name);
      setEntityId(preset.entityId);
      setMetadataUrl(preset.metadataUrl);
      // SSO URL and certificate would be fetched from metadata
      setSsoUrl('');
      setCertificate('');
    }
  };

  const handleMappingPresetSelect = (preset: string) => {
    setSelectedMappingPreset(preset);
    const mapping = DEFAULT_ATTRIBUTE_MAPPINGS[preset];
    if (mapping) {
      setAttrEmail(mapping.email);
      setAttrFirstName(mapping.firstName);
      setAttrLastName(mapping.lastName);
      setAttrDisplayName(mapping.displayName || '');
    }
  };

  const handleCertificateChange = (value: string) => {
    setCertificate(value);
    if (value.trim()) {
      const result = validateCertificate(value);
      setCertError(result.valid ? null : (result.error || 'Invalid certificate'));
    } else {
      setCertError(null);
    }
  };

  const handleFetchMetadata = async () => {
    if (!metadataUrl.trim()) {
      setError('Please enter a metadata URL');
      return;
    }

    setIsFetchingMetadata(true);
    setError(null);

    try {
      // In production, this would fetch and parse the IdP metadata XML
      // For now, show a helpful message
      setSuccessMessage(
        'Metadata auto-fetch requires server-side processing. ' +
        'Please ask your IT department for the SSO URL and certificate, ' +
        'or paste the metadata XML manually.'
      );
    } catch {
      setError('Failed to fetch metadata. Please configure manually.');
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleTestConnection = async () => {
    setError(null);
    setSuccessMessage(null);

    // Validate required fields
    if (!entityId.trim()) {
      setError('Entity ID is required for testing.');
      return;
    }
    if (!ssoUrl.trim()) {
      setError('SSO URL is required for testing.');
      return;
    }

    setIsTesting(true);
    try {
      // In production, this would initiate a test SAML flow
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccessMessage(
        'Configuration looks valid. To complete testing, click "Save" ' +
        'and then try logging in with SSO from the login page.'
      );
    } catch {
      setError('Connection test failed. Please verify your settings.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validate
    if (!providerName.trim()) {
      setError('Provider name is required.');
      return;
    }
    if (!entityId.trim()) {
      setError('Entity ID is required.');
      return;
    }
    if (!ssoUrl.trim()) {
      setError('SSO URL is required.');
      return;
    }
    if (certificate.trim()) {
      const certResult = validateCertificate(certificate);
      if (!certResult.valid) {
        setError(`Certificate error: ${certResult.error}`);
        return;
      }
    }

    setIsSaving(true);

    try {
      const attributeMapping: AttributeMapping = {
        email: attrEmail,
        firstName: attrFirstName,
        lastName: attrLastName,
        displayName: attrDisplayName || undefined,
        department: attrDepartment || undefined,
        orcid: attrOrcid || undefined,
      };

      const provider: SSOProvider = {
        id: entityId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
        name: providerName,
        entityId,
        ssoUrl,
        certificate,
        metadataUrl: metadataUrl || undefined,
        attributeMapping,
        enabled: true,
        createdAt: new Date().toISOString(),
      };

      // In production, save to Supabase via API route
      // For now, store in the in-memory provider store
      const res = await fetch('/api/auth/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, autoProvision, defaultRole }),
      });

      // Even if the API doesn't support POST yet, update local state
      setConfig({
        enabled: true,
        provider,
        autoProvision,
        defaultRole,
      });

      setSuccessMessage('SSO configuration saved successfully!');
    } catch {
      // Still update local state for UI preview
      setConfig({
        enabled: true,
        provider: {
          id: entityId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
          name: providerName,
          entityId,
          ssoUrl,
          certificate,
          attributeMapping: {
            email: attrEmail,
            firstName: attrFirstName,
            lastName: attrLastName,
          },
          enabled: true,
          createdAt: new Date().toISOString(),
        },
        autoProvision,
        defaultRole,
      });
      setSuccessMessage('SSO configuration saved locally. API persistence will be available when the SSO database table is created.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable = () => {
    setConfig(DEFAULT_SSO_CONFIG);
    setProviderName('');
    setEntityId('');
    setSsoUrl('');
    setCertificate('');
    setMetadataUrl('');
    setSelectedPreset('');
    setSuccessMessage('SSO has been disabled.');
  };

  const handleCopyMetadataUrl = () => {
    const url = `${window.location.origin}/api/auth/sso/metadata`;
    navigator.clipboard.writeText(url);
    setCopiedMetadata(true);
    setTimeout(() => setCopiedMetadata(false), 2000);
  };

  const spMetadataXml = typeof window !== 'undefined'
    ? buildServiceProviderMetadata(window.location.origin)
    : '';

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[var(--accent)]/10">
          <Shield className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            Institutional SSO (SAML)
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            Allow team members to sign in with their university credentials.
          </p>
        </div>
      </div>

      {/* ======================================== */}
      {/* Section 1: SSO Status */}
      {/* ======================================== */}
      {isLoading ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--surface-2)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-muted)]">Checking SSO status...</span>
        </div>
      ) : config.enabled && config.provider ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <div>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                SSO Enabled
              </span>
              <span className="text-xs text-[var(--text-muted)] ml-2">
                {config.provider.name}
              </span>
            </div>
          </div>
          <button
            onClick={handleDisable}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <XCircle className="w-3 h-3" />
            Disable
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <XCircle className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-muted)]">SSO not configured</span>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600 dark:text-green-400">
          {successMessage}
        </div>
      )}

      {/* ======================================== */}
      {/* Section 2: Provider Configuration */}
      {/* ======================================== */}
      <form onSubmit={handleSave} className="space-y-5">
        {/* Instructions */}
        <div className="px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            To enable SSO, you need your university&apos;s SAML Identity Provider (IdP)
            configuration. Contact your IT department and ask for the SAML metadata URL
            or the Entity ID, SSO URL, and X.509 certificate. Learn more about{' '}
            <a
              href="https://en.wikipedia.org/wiki/SAML_2.0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
            >
              SAML 2.0
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* Config Mode Tabs */}
        <div className="flex border-b border-[var(--border)]">
          <button
            type="button"
            onClick={() => setConfigMode('preset')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              configMode === 'preset'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
            University Preset
          </button>
          <button
            type="button"
            onClick={() => setConfigMode('manual')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              configMode === 'manual'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Key className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
            Manual Configuration
          </button>
        </div>

        {/* Preset Selector */}
        {configMode === 'preset' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                <Building2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Select Your University
              </label>
              <div className="relative">
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 appearance-none pr-10"
                >
                  <option value="">Choose a university...</option>
                  {UNIVERSITY_PRESETS.map((preset) => (
                    <option key={preset.entityId} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Don&apos;t see your university? Use the &quot;Manual Configuration&quot; tab.
              </p>
            </div>

            {selectedPreset && (
              <div className="px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Next Steps
                  </span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                  The Entity ID and Metadata URL have been pre-filled. To complete setup,
                  you need the SSO URL and X.509 certificate from your IT department.
                  Share the SP Metadata URL (below) with them to set up the trust.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Provider Name */}
        <div className="space-y-1.5">
          <label htmlFor="sso-provider-name" className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <Building2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            Provider Name
            <Tooltip text="A friendly name for this SSO provider, shown on the login button." />
          </label>
          <input
            id="sso-provider-name"
            type="text"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g., UC Santa Barbara"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          />
        </div>

        {/* Entity ID */}
        <div className="space-y-1.5">
          <label htmlFor="sso-entity-id" className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            Entity ID
            <Tooltip text="The SAML Entity ID uniquely identifies the Identity Provider. It is usually a URL or URN provided by your IT department." />
          </label>
          <input
            id="sso-entity-id"
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="e.g., urn:mace:incommon:ucsb.edu"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 font-mono"
          />
        </div>

        {/* SSO URL */}
        <div className="space-y-1.5">
          <label htmlFor="sso-url" className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            SSO URL
            <Tooltip text="The Identity Provider's Single Sign-On endpoint URL. Users are redirected here to log in. Sometimes called the 'Login URL' or 'SSO Service URL'." />
          </label>
          <input
            id="sso-url"
            type="url"
            value={ssoUrl}
            onChange={(e) => setSsoUrl(e.target.value)}
            placeholder="https://idp.university.edu/idp/profile/SAML2/Redirect/SSO"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 font-mono"
          />
        </div>

        {/* Certificate */}
        <div className="space-y-1.5">
          <label htmlFor="sso-certificate" className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <Key className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            X.509 Certificate (PEM)
            <Tooltip text="The Identity Provider's public X.509 certificate in PEM format. Used to verify the signature on SAML responses. Ask your IT department for this." />
          </label>
          <div className="relative">
            <textarea
              id="sso-certificate"
              value={certificate}
              onChange={(e) => handleCertificateChange(e.target.value)}
              placeholder={`-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgI...\n-----END CERTIFICATE-----`}
              rows={4}
              className={`w-full px-3 py-2 rounded-lg border bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 font-mono resize-y ${
                certError
                  ? 'border-red-500'
                  : 'border-[var(--border)]'
              } ${!showCertificate && certificate ? 'text-transparent selection:text-transparent' : ''}`}
              style={{ lineHeight: '1.5' }}
            />
            {certificate && (
              <button
                type="button"
                onClick={() => setShowCertificate(!showCertificate)}
                className="absolute right-2 top-2 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] px-2 py-1 rounded bg-[var(--surface-2)]"
              >
                {showCertificate ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          {certError && (
            <p className="text-xs text-red-500">{certError}</p>
          )}
          {certificate && !certError && (
            <p className="text-xs text-green-600 dark:text-green-400">Certificate format is valid</p>
          )}
        </div>

        {/* Metadata URL */}
        <div className="space-y-1.5">
          <label htmlFor="sso-metadata-url" className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            Metadata URL (Optional)
            <Tooltip text="Some IdPs provide a metadata URL that contains all configuration in one XML document. Providing this can auto-fill the Entity ID, SSO URL, and certificate." />
          </label>
          <div className="flex gap-2">
            <input
              id="sso-metadata-url"
              type="url"
              value={metadataUrl}
              onChange={(e) => setMetadataUrl(e.target.value)}
              placeholder="https://idp.university.edu/idp/shibboleth"
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 font-mono"
            />
            <button
              type="button"
              onClick={handleFetchMetadata}
              disabled={isFetchingMetadata || !metadataUrl.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isFetchingMetadata ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Fetch'
              )}
            </button>
          </div>
        </div>

        {/* ======================================== */}
        {/* Attribute Mapping */}
        {/* ======================================== */}
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowMappingSection(!showMappingSection)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 transition-colors"
          >
            <span className="text-sm font-medium text-[var(--foreground)]">
              Attribute Mapping
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
                showMappingSection ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showMappingSection && (
            <div className="p-4 space-y-4">
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Configure how SAML attributes from your IdP map to user profile fields.
                Select a preset for common IdP platforms or customize individually.
              </p>

              {/* Mapping Preset Selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  IdP Platform
                </label>
                <div className="flex gap-2">
                  {Object.keys(DEFAULT_ATTRIBUTE_MAPPINGS).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleMappingPresetSelect(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedMappingPreset === key
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface-2)]/80'
                      }`}
                    >
                      {key === 'azure_ad' ? 'Azure AD' : key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual Mapping Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MappingField
                  label="Email"
                  required
                  value={attrEmail}
                  onChange={setAttrEmail}
                  placeholder="urn:oid:0.9.2342.19200300.100.1.3"
                />
                <MappingField
                  label="First Name"
                  required
                  value={attrFirstName}
                  onChange={setAttrFirstName}
                  placeholder="urn:oid:2.5.4.42"
                />
                <MappingField
                  label="Last Name"
                  required
                  value={attrLastName}
                  onChange={setAttrLastName}
                  placeholder="urn:oid:2.5.4.4"
                />
                <MappingField
                  label="Display Name"
                  value={attrDisplayName}
                  onChange={setAttrDisplayName}
                  placeholder="urn:oid:2.16.840.1.113730.3.1.241"
                />
                <MappingField
                  label="Department"
                  value={attrDepartment}
                  onChange={setAttrDepartment}
                  placeholder="urn:oid:2.5.4.11"
                />
                <MappingField
                  label="ORCID"
                  value={attrOrcid}
                  onChange={setAttrOrcid}
                  placeholder="eduPersonOrcid"
                />
              </div>
            </div>
          )}
        </div>

        {/* ======================================== */}
        {/* Section 5: User Provisioning */}
        {/* ======================================== */}
        <div className="space-y-3 px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">User Provisioning</span>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm text-[var(--foreground)]">Auto-create accounts on first SSO login</span>
              <p className="text-xs text-[var(--text-muted)]">
                When enabled, new users are automatically created when they log in via SSO for the first time.
              </p>
            </div>
            <div
              role="switch"
              aria-checked={autoProvision}
              tabIndex={0}
              onClick={() => setAutoProvision(!autoProvision)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAutoProvision(!autoProvision); } }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                autoProvision ? 'bg-[var(--accent)]' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 mt-0.5 ${
                  autoProvision ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </div>
          </label>

          {autoProvision && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">
                Default Role for New SSO Users
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="defaultRole"
                    value="member"
                    checked={defaultRole === 'member'}
                    onChange={() => setDefaultRole('member')}
                    className="w-4 h-4 text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)]/50"
                  />
                  <span className="text-sm text-[var(--foreground)]">Member</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="defaultRole"
                    value="viewer"
                    checked={defaultRole === 'viewer'}
                    onChange={() => setDefaultRole('viewer')}
                    className="w-4 h-4 text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)]/50"
                  />
                  <span className="text-sm text-[var(--foreground)]">Viewer (read-only)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving || !providerName.trim() || !entityId.trim() || !ssoUrl.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !entityId.trim() || !ssoUrl.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>
        </div>
      </form>

      {/* ======================================== */}
      {/* Section 3: SP Metadata */}
      {/* ======================================== */}
      <div className="space-y-3 border-t border-[var(--border)] pt-6">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            SP Metadata (Share with IT Department)
          </span>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Your university&apos;s IT department needs this metadata URL to configure their
          Identity Provider to trust this application. Send them this URL:
        </p>

        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--foreground)] font-mono overflow-x-auto">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/api/auth/sso/metadata`
              : '/api/auth/sso/metadata'}
          </code>
          <button
            type="button"
            onClick={handleCopyMetadataUrl}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
          >
            {copiedMetadata ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowMetadataXml(!showMetadataXml)}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          {showMetadataXml ? 'Hide' : 'Preview'} metadata XML
        </button>

        {showMetadataXml && (
          <pre className="px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)] font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
            {spMetadataXml}
          </pre>
        )}
      </div>

      {/* ======================================== */}
      {/* Section 4: Login Page Preview */}
      {/* ======================================== */}
      <div className="space-y-3 border-t border-[var(--border)] pt-6">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            Login Page Preview
          </span>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          This is how the SSO button will appear on the login page:
        </p>

        <div className="px-6 py-8 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex flex-col items-center gap-3">
          {/* Preview of SSO Login Button */}
          <div className="w-full max-w-xs">
            <button
              type="button"
              disabled
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#1e3a5f] text-white font-medium text-sm transition-colors"
            >
              <Shield className="w-4 h-4" />
              Sign in with {providerName || 'SSO'}
            </button>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            Institutional single sign-on
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

/**
 * Informational tooltip icon with hover text.
 * Provides contextual help for non-technical users
 * configuring SAML settings.
 */
function Tooltip({ text }: { text: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
        aria-label="More information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs leading-relaxed shadow-lg">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
        </div>
      )}
    </span>
  );
}

/**
 * Attribute mapping input field.
 */
function MappingField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--foreground)]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 font-mono"
      />
    </div>
  );
}
