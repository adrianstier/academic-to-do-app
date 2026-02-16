'use client';

import { useState } from 'react';
import { Calendar, BookOpen, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';

const CalendarSyncSettings = dynamic(() => import('./settings/CalendarSyncSettings'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-[var(--surface-2)] rounded-xl" />,
});

const ZoteroSettings = dynamic(() => import('./settings/ZoteroSettings'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-[var(--surface-2)] rounded-xl" />,
});

type IntegrationPanel = 'list' | 'google-calendar' | 'zotero';

const integrations = [
  {
    id: 'google-calendar' as const,
    name: 'Google Calendar',
    description: 'Sync tasks with due dates to Google Calendar events',
    icon: Calendar,
    color: '#4285F4',
  },
  {
    id: 'zotero' as const,
    name: 'Zotero',
    description: 'Link references from your Zotero library to tasks',
    icon: BookOpen,
    color: '#CC2936',
  },
];

export default function IntegrationsPage() {
  const [activePanel, setActivePanel] = useState<IntegrationPanel>('list');

  if (activePanel === 'google-calendar') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => setActivePanel('list')}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] mb-4 transition-colors"
        >
          &larr; Back to Integrations
        </button>
        <CalendarSyncSettings onClose={() => setActivePanel('list')} />
      </div>
    );
  }

  if (activePanel === 'zotero') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => setActivePanel('list')}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] mb-4 transition-colors"
        >
          &larr; Back to Integrations
        </button>
        <ZoteroSettings />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-xl font-bold text-[var(--foreground)] mb-1">Integrations</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Connect external services to enhance your academic workflow.
      </p>

      <div className="space-y-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <button
              key={integration.id}
              onClick={() => setActivePanel(integration.id)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)] transition-all text-left group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: integration.color + '18' }}
              >
                <Icon className="w-5 h-5" style={{ color: integration.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">{integration.name}</h3>
                <p className="text-xs text-[var(--text-muted)]">{integration.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
