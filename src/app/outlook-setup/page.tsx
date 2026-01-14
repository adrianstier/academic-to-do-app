'use client';

import { useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Mail, Zap, CheckCircle, HelpCircle, Monitor, Globe, ChevronDown, Sparkles } from 'lucide-react';
import { HighlightedText, SafeHtmlLink } from '@/components/HighlightedText';

export default function OutlookSetupPage() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingDesktop, setDownloadingDesktop] = useState(false);
  const [outlookVersion, setOutlookVersion] = useState<'new' | 'classic' | null>(null);
  const manifestUrl = 'https://shared-todo-list-production.up.railway.app/outlook/manifest.xml';
  const desktopManifestUrl = 'https://shared-todo-list-production.up.railway.app/outlook/manifest-desktop.xml';

  const copyManifestUrl = () => {
    navigator.clipboard.writeText(manifestUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const downloadManifest = async () => {
    setDownloading(true);
    try {
      const response = await fetch(manifestUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bealer-todo-manifest.xml';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(manifestUrl, '_blank');
    }
    setDownloading(false);
  };

  const downloadDesktopManifest = async () => {
    setDownloadingDesktop(true);
    try {
      const response = await fetch(desktopManifestUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bealer-todo-manifest-desktop.xml';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(desktopManifestUrl, '_blank');
    }
    setDownloadingDesktop(false);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--accent)]/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--accent-gold)]/8 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/4" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-10">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors mb-6 group text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Tasks
          </a>

          <div className="flex items-start gap-5">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-[var(--accent)]/20 rounded-2xl blur-xl" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-[var(--accent)] to-[#1D4ED8] rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-white/10">
                <Mail className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] tracking-tight">Outlook Add-in Setup</h1>
              <p className="text-[var(--text-muted)] mt-1">Turn emails into tasks in seconds</p>
            </div>
          </div>
        </div>

        {/* How It Works - Hero Card */}
        <div className="relative mb-8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00205B] via-[#0033A0] to-[#00205B] rounded-2xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[var(--accent-gold)]/20 via-transparent to-transparent rounded-2xl" />

          <div className="relative p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-5 h-5 text-[var(--accent-gold)]" />
              <h2 className="text-lg font-semibold text-white">How It Works</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Mail, label: 'Open email' },
                { icon: Zap, label: 'Click analyze' },
                { icon: CheckCircle, label: 'Review task' },
                { icon: Download, label: 'Add to list' },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-3 ring-1 ring-white/10">
                    <step.icon className="w-5 h-5 text-white/90" />
                  </div>
                  <span className="text-sm text-white/70 font-medium">{step.label}</span>
                </div>
              ))}
            </div>

            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent" />
          </div>
        </div>

        {/* AI Info Banner */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-8 shadow-sm">
          <p className="text-[var(--text-muted)] text-sm text-center">
            AI automatically extracts <span className="text-[var(--foreground)] font-medium">task description</span>, <span className="text-[var(--foreground)] font-medium">assignee</span>, <span className="text-[var(--foreground)] font-medium">priority</span>, and <span className="text-[var(--foreground)] font-medium">due date</span> from your emails
          </p>
        </div>

        {/* Step 1: Which Outlook */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[#1D4ED8] flex items-center justify-center text-white text-sm font-bold shadow-sm">
              1
            </div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Which Outlook do you use?</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setOutlookVersion('new')}
              className={`group p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                outlookVersion === 'new'
                  ? 'border-[var(--accent)] bg-[var(--accent-light)] shadow-sm'
                  : 'border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                  outlookVersion === 'new' ? 'bg-[var(--accent)]/15' : 'bg-[var(--surface-2)]'
                }`}>
                  <Globe className={`w-5 h-5 ${outlookVersion === 'new' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--foreground)]">Web or New Outlook</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">outlook.com, new app</p>
                </div>
                {outlookVersion === 'new' && (
                  <CheckCircle className="w-5 h-5 text-[var(--accent)]" />
                )}
              </div>
            </button>

            <button
              onClick={() => setOutlookVersion('classic')}
              className={`group p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                outlookVersion === 'classic'
                  ? 'border-[var(--accent)] bg-[var(--accent-light)] shadow-sm'
                  : 'border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                  outlookVersion === 'classic' ? 'bg-[var(--accent)]/15' : 'bg-[var(--surface-2)]'
                }`}>
                  <Monitor className={`w-5 h-5 ${outlookVersion === 'classic' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--foreground)]">Classic Desktop</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Traditional Outlook app</p>
                </div>
                {outlookVersion === 'classic' && (
                  <CheckCircle className="w-5 h-5 text-[var(--accent)]" />
                )}
              </div>
            </button>
          </div>

          {!outlookVersion && (
            <p className="text-xs text-[var(--text-muted)] mt-4 text-center">
              Not sure? If you use Outlook in a web browser or the newer-looking app, choose &quot;Web or New Outlook&quot;
            </p>
          )}
        </div>

        {/* Step 2: Download */}
        {outlookVersion && (
          <div className="relative mb-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)]/5 rounded-2xl" />
            <div className="relative border border-[var(--accent)]/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[#1D4ED8] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  2
                </div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Download the Add-in File</h2>
              </div>

              <button
                onClick={outlookVersion === 'new' ? downloadManifest : downloadDesktopManifest}
                disabled={outlookVersion === 'new' ? downloading : downloadingDesktop}
                className="w-full px-5 py-4 bg-gradient-to-r from-[var(--accent)] to-[#1D4ED8] text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-60 text-base shadow-md"
                style={{ boxShadow: '0 4px 16px rgba(37, 99, 235, 0.25)' }}
              >
                {(outlookVersion === 'new' ? downloading : downloadingDesktop) ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download Add-in File
                  </>
                )}
              </button>

              <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
                Save this file somewhere you can find it (like Downloads or Desktop)
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Installation */}
        {outlookVersion && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[#1D4ED8] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                3
              </div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Install in Outlook</h2>
            </div>

            <a
              href="https://aka.ms/olksideload"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-5 py-4 bg-gradient-to-r from-[var(--success)] to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 text-center text-base shadow-md mb-4 flex items-center justify-center gap-2"
              style={{ boxShadow: '0 4px 16px rgba(5, 150, 105, 0.25)' }}
            >
              Open Outlook Add-ins Page
              <ExternalLink className="w-4 h-4" />
            </a>

            <p className="text-xs text-[var(--text-muted)] text-center mb-5">
              This link opens the Add-ins manager in Outlook
            </p>

            <div className="bg-[var(--surface-2)] rounded-xl p-5 border border-[var(--border-subtle)]">
              <p className="text-sm font-semibold text-[var(--foreground)] mb-3">Then follow these steps:</p>
              <ol className="space-y-2.5 text-[var(--text-muted)] text-sm">
                {[
                  ['A', 'Click "My add-ins"'],
                  ['B', 'Scroll down to "Custom Addins"'],
                  ['C', 'Click "Add a custom add-in" → "Add from File..."'],
                  ['D', 'Select the file you downloaded and click Install'],
                ].map(([letter, text]) => (
                  <li key={letter} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] font-bold text-xs flex items-center justify-center">
                      {letter}
                    </span>
                    <HighlightedText text={text} />
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-5 p-4 bg-[var(--success-light)] border border-[var(--success)]/20 rounded-xl text-sm text-[var(--success)] flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>Once installed, the add-in syncs across all your Outlook apps automatically!</span>
            </div>
          </div>
        )}

        {/* Using the Add-in */}
        <div className="relative mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-gold-light)] to-[var(--accent-gold)]/5 rounded-2xl" />
          <div className="relative border border-[var(--accent-gold)]/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Mail className="w-5 h-5 text-[var(--accent-gold)]" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Using the Add-in</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { step: '1', text: 'Open an email and click "Bealer Todo" in the toolbar' },
                { step: '2', text: 'Click "Analyze Email" to extract task details' },
                { step: '3', text: 'Review, edit if needed, and click "Add Task"' },
              ].map((item) => (
                <div key={item.step} className="bg-[var(--surface)] rounded-xl p-4 text-center border border-[var(--border)]">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent-gold)]/15 flex items-center justify-center mx-auto mb-3">
                    <span className="text-[var(--accent-gold)] font-bold">{item.step}</span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    <HighlightedText text={item.text} />
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-5 text-center">
              Tip: On Outlook web, find the add-in under the <strong className="text-[var(--foreground)]">...</strong> (More actions) menu
            </p>
          </div>
        </div>

        {/* Troubleshooting */}
        <details className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl mb-8 shadow-sm">
          <summary className="p-5 cursor-pointer font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-2xl flex items-center gap-3 transition-colors">
            <HelpCircle className="w-5 h-5 text-[var(--text-muted)]" />
            Having trouble? Click here for help
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)] ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5 space-y-3">
            {[
              {
                q: 'Can\'t find "Add a custom add-in"?',
                a: 'Your organization may have disabled this. Ask IT to enable custom add-ins.',
                hasLink: false,
              },
              {
                q: 'Button not showing up?',
                a: 'Make sure you have an email open (not just selected). Try refreshing Outlook.',
                hasLink: false,
              },
              {
                q: 'Need to remove it?',
                a: 'Go to <a href="https://aka.ms/olksideload" target="_blank" rel="noopener noreferrer" class="text-[var(--accent)] hover:underline">aka.ms/olksideload</a>, find it under Custom Add-ins, and click Remove.',
                hasLink: true,
              },
            ].map((item, i) => (
              <div key={i} className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border-subtle)]">
                <p className="font-medium text-[var(--foreground)] text-sm">{item.q}</p>
                <p className="text-[var(--text-muted)] text-sm mt-1">
                  {item.hasLink ? <SafeHtmlLink text={item.a} /> : item.a}
                </p>
              </div>
            ))}
          </div>
        </details>

        {/* Footer */}
        <div className="text-center">
          <p className="text-[var(--text-muted)] text-sm">
            Questions? Contact the Bealer Agency team for help.
          </p>
        </div>
      </div>
    </div>
  );
}
