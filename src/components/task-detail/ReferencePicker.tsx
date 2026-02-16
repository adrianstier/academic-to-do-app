'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen,
  FileText,
  Search,
  X,
  Link2,
  Unlink,
  FlaskConical,
  GraduationCap,
  ScrollText,
  Globe,
  Clock,
  FolderOpen,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import type { ZoteroReference, ZoteroCollection, TaskReference } from '@/types/reference';
import { ZOTERO_ITEM_TYPE_CONFIG } from '@/types/reference';

// ============================================
// Types
// ============================================

interface ReferencePickerProps {
  todoId: string;
  linkedReferences: TaskReference[];
  onLinkReference: (ref: ZoteroReference, note?: string) => void;
  onUnlinkReference: (zoteroKey: string) => void;
}

type TabId = 'search' | 'collections' | 'recent' | 'linked';

// ============================================
// Helpers
// ============================================

/** Get the appropriate icon for a Zotero item type */
function ItemTypeIcon({ itemType, className }: { itemType: string; className?: string }) {
  const config = ZOTERO_ITEM_TYPE_CONFIG[itemType];
  const iconType = config?.icon || 'other';

  switch (iconType) {
    case 'article':
      return <FileText className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'conference':
      return <GraduationCap className={className} />;
    case 'thesis':
      return <ScrollText className={className} />;
    case 'report':
      return <FlaskConical className={className} />;
    default:
      return <Globe className={className} />;
  }
}

/** Format authors for display (truncated) */
function formatAuthors(authors: string[], maxLength = 60): string {
  if (authors.length === 0) return 'Unknown author';
  if (authors.length === 1) return authors[0];

  const joined = authors.join('; ');
  if (joined.length <= maxLength) return joined;

  // Show first author + "et al."
  return `${authors[0]} et al.`;
}

/** Format item type label */
function formatItemType(itemType: string): string {
  return ZOTERO_ITEM_TYPE_CONFIG[itemType]?.label || itemType;
}

// ============================================
// Sub-components
// ============================================

function ReferenceItem({
  reference,
  isLinked,
  onLink,
  onUnlink,
}: {
  reference: ZoteroReference;
  isLinked: boolean;
  onLink: () => void;
  onUnlink: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors rounded-lg group">
      {/* Item type icon */}
      <div className="mt-0.5 flex-shrink-0">
        <ItemTypeIcon itemType={reference.itemType} className="w-4 h-4 text-[var(--text-muted)]" />
      </div>

      {/* Reference info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-[var(--foreground)] leading-snug line-clamp-2">
          {reference.title}
        </p>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {formatAuthors(reference.authors)}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {reference.year && (
            <span className="text-xs text-[var(--text-muted)]">{reference.year}</span>
          )}
          {reference.journal && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-2)] text-[var(--text-muted)] truncate max-w-[200px]">
              {reference.journal}
            </span>
          )}
          <span className="text-[10px] text-[var(--text-muted)]">
            {formatItemType(reference.itemType)}
          </span>
        </div>
      </div>

      {/* Link/unlink button */}
      <div className="flex-shrink-0 mt-1">
        {isLinked ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnlink();
            }}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={`Unlink reference: ${reference.title}`}
            title="Unlink reference"
          >
            <Unlink className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLink();
            }}
            className="p-1.5 rounded-lg text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={`Link reference: ${reference.title}`}
            title="Link reference"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function LinkedReferenceItem({
  taskRef,
  onUnlink,
}: {
  taskRef: TaskReference;
  onUnlink: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors rounded-lg group">
      <div className="mt-0.5 flex-shrink-0">
        <ItemTypeIcon itemType={taskRef.reference.itemType} className="w-4 h-4 text-[var(--text-muted)]" />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-[var(--foreground)] leading-snug line-clamp-2">
          {taskRef.reference.title}
        </p>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {formatAuthors(taskRef.reference.authors)}
          {taskRef.reference.year ? ` (${taskRef.reference.year})` : ''}
        </p>
        {taskRef.note && (
          <div className="flex items-start gap-1 mt-1">
            <MessageSquare className="w-3 h-3 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[var(--text-muted)] italic line-clamp-2">{taskRef.note}</p>
          </div>
        )}
        {taskRef.reference.doi && (
          <a
            href={`https://doi.org/${taskRef.reference.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[var(--accent)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            DOI: {taskRef.reference.doi}
          </a>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onUnlink();
        }}
        className="flex-shrink-0 mt-1 p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label={`Unlink reference: ${taskRef.reference.title}`}
        title="Unlink reference"
      >
        <Unlink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CollectionTree({
  collections,
  parentKey,
  onSelectCollection,
  selectedKey,
  depth = 0,
}: {
  collections: ZoteroCollection[];
  parentKey: string | null;
  onSelectCollection: (key: string) => void;
  selectedKey: string | null;
  depth?: number;
}) {
  const children = collections.filter((c) => c.parentCollection === parentKey);

  if (children.length === 0) return null;

  return (
    <div className={depth > 0 ? 'ml-4' : ''}>
      {children.map((col) => {
        const hasChildren = collections.some((c) => c.parentCollection === col.key);
        const isSelected = selectedKey === col.key;

        return (
          <div key={col.key}>
            <button
              onClick={() => onSelectCollection(col.key)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                isSelected
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {hasChildren ? (
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
              ) : (
                <FolderOpen className="w-3 h-3 flex-shrink-0 text-[var(--text-muted)]" />
              )}
              <span className="truncate">{col.name}</span>
              <span className="ml-auto text-[10px] text-[var(--text-muted)] flex-shrink-0">
                {col.numItems}
              </span>
            </button>
            {hasChildren && (
              <CollectionTree
                collections={collections}
                parentKey={col.key}
                onSelectCollection={onSelectCollection}
                selectedKey={selectedKey}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NoteInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] rounded-lg">
      <input
        ref={inputRef}
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit(note);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Add a note about this reference (optional)..."
        className="flex-1 text-xs bg-transparent border-none outline-none text-[var(--foreground)] placeholder-[var(--text-muted)]"
      />
      <button
        onClick={() => onSubmit(note)}
        className="text-xs font-medium text-[var(--accent)] hover:underline"
      >
        Link
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]"
      >
        Cancel
      </button>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function ReferencePicker({
  todoId,
  linkedReferences,
  onLinkReference,
  onUnlinkReference,
}: ReferencePickerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ZoteroReference[]>([]);
  const [collections, setCollections] = useState<ZoteroCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionItems, setCollectionItems] = useState<ZoteroReference[]>([]);
  const [recentItems, setRecentItems] = useState<ZoteroReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLinkRef, setPendingLinkRef] = useState<ZoteroReference | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linkedKeys = new Set(linkedReferences.map((r) => r.zotero_key));

  // ---- Check connection status on mount ----
  useEffect(() => {
    async function checkConnection() {
      try {
        const res = await fetch('/api/integrations/zotero');
        if (res.ok) {
          const json = await res.json();
          setIsConnected(json.data?.connected ?? false);
          if (json.data?.recentItems) {
            setRecentItems(json.data.recentItems);
          }
        } else {
          setIsConnected(false);
        }
      } catch {
        setIsConnected(false);
      }
    }
    checkConnection();
  }, []);

  // ---- Debounced search ----
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query, mode: 'search' });
      const res = await fetch(`/api/integrations/zotero/search?${params}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Search failed' }));
        setError(errJson.error || 'Search failed');
        return;
      }

      const json = await res.json();
      setSearchResults(json.data || []);
    } catch {
      setError('Failed to search Zotero library');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 400);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // ---- Fetch collections when tab activated ----
  useEffect(() => {
    if (activeTab !== 'collections' || collections.length > 0) return;

    async function fetchCollections() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/integrations/zotero/search?mode=collections');
        if (res.ok) {
          const json = await res.json();
          setCollections(json.data || []);
        }
      } catch {
        setError('Failed to load collections');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCollections();
  }, [activeTab, collections.length]);

  // ---- Fetch items when a collection is selected ----
  useEffect(() => {
    if (!selectedCollection) {
      setCollectionItems([]);
      return;
    }

    async function fetchCollectionItems() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          mode: 'items',
          collection: selectedCollection!,
        });
        const res = await fetch(`/api/integrations/zotero/search?${params}`);
        if (res.ok) {
          const json = await res.json();
          setCollectionItems(json.data || []);
        }
      } catch {
        setError('Failed to load collection items');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCollectionItems();
  }, [selectedCollection]);

  // ---- Fetch recent when tab activated ----
  useEffect(() => {
    if (activeTab !== 'recent' || recentItems.length > 0) return;

    async function fetchRecent() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/integrations/zotero');
        if (res.ok) {
          const json = await res.json();
          setRecentItems(json.data?.recentItems || []);
        }
      } catch {
        // Silent fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchRecent();
  }, [activeTab, recentItems.length]);

  // ---- Handlers ----
  const handleLinkWithNote = (ref: ZoteroReference) => {
    setPendingLinkRef(ref);
  };

  const handleConfirmLink = (note: string) => {
    if (pendingLinkRef) {
      onLinkReference(pendingLinkRef, note || undefined);
      setPendingLinkRef(null);
    }
  };

  // ---- Not connected state ----
  if (isConnected === false) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">References</span>
        </div>
        <div className="px-3 py-4 text-center rounded-lg border border-dashed border-[var(--border)]">
          <BookOpen className="w-6 h-6 mx-auto mb-2 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">
            Connect your Zotero library to link references to tasks.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Go to Settings to configure Zotero integration.
          </p>
        </div>
      </div>
    );
  }

  // ---- Loading initial state ----
  if (isConnected === null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">References</span>
        </div>
        <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
          Checking Zotero connection...
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'search', label: 'Search' },
    { id: 'collections', label: 'Collections' },
    { id: 'recent', label: 'Recent' },
    { id: 'linked', label: 'Linked', count: linkedReferences.length },
  ];

  // Determine which references to show
  let displayedRefs: ZoteroReference[] = [];
  if (activeTab === 'search') displayedRefs = searchResults;
  else if (activeTab === 'collections') displayedRefs = collectionItems;
  else if (activeTab === 'recent') displayedRefs = recentItems;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-[var(--text-muted)]" />
        <span className="text-sm font-medium text-[var(--foreground)]">References</span>
        {linkedReferences.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-[var(--surface-2)] text-[var(--text-muted)]">
            {linkedReferences.length}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (activeTab !== 'search') setActiveTab('search');
          }}
          placeholder="Search Zotero library..."
          className="flex-1 text-sm bg-transparent border-none outline-none text-[var(--foreground)] placeholder-[var(--text-muted)]"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}
            className="p-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded-full text-[10px] bg-[var(--surface-2)]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Note input overlay */}
      {pendingLinkRef && (
        <NoteInput
          onSubmit={handleConfirmLink}
          onCancel={() => setPendingLinkRef(null)}
        />
      )}

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="max-h-60 overflow-y-auto -mx-1 px-1">
        {/* Loading state */}
        {isLoading && (
          <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
            <div className="inline-block w-4 h-4 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin mb-2" />
            <p>Searching Zotero...</p>
          </div>
        )}

        {/* Linked tab */}
        {activeTab === 'linked' && !isLoading && (
          <>
            {linkedReferences.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                <BookOpen className="w-5 h-5 mx-auto mb-2 opacity-50" />
                <p>No references linked to this task yet.</p>
                <p className="mt-1">Search your Zotero library to link references.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {linkedReferences.map((taskRef) => (
                  <LinkedReferenceItem
                    key={taskRef.zotero_key}
                    taskRef={taskRef}
                    onUnlink={() => onUnlinkReference(taskRef.zotero_key)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Collections tab — show tree + items */}
        {activeTab === 'collections' && !isLoading && (
          <div className="space-y-2">
            {collections.length === 0 && !isLoading ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                <FolderOpen className="w-5 h-5 mx-auto mb-2 opacity-50" />
                <p>No collections found in your library.</p>
              </div>
            ) : (
              <>
                <CollectionTree
                  collections={collections}
                  parentKey={null}
                  onSelectCollection={setSelectedCollection}
                  selectedKey={selectedCollection}
                />
                {selectedCollection && collectionItems.length > 0 && (
                  <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-0.5">
                    {collectionItems.map((ref) => (
                      <ReferenceItem
                        key={ref.key}
                        reference={ref}
                        isLinked={linkedKeys.has(ref.key)}
                        onLink={() => handleLinkWithNote(ref)}
                        onUnlink={() => onUnlinkReference(ref.key)}
                      />
                    ))}
                  </div>
                )}
                {selectedCollection && collectionItems.length === 0 && !isLoading && (
                  <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                    No items in this collection.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Search and Recent tabs — show reference list */}
        {(activeTab === 'search' || activeTab === 'recent') && !isLoading && (
          <>
            {displayedRefs.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                {activeTab === 'search' && !searchQuery && (
                  <>
                    <Search className="w-5 h-5 mx-auto mb-2 opacity-50" />
                    <p>Type to search your Zotero library.</p>
                  </>
                )}
                {activeTab === 'search' && searchQuery && searchQuery.length < 2 && (
                  <p>Type at least 2 characters to search.</p>
                )}
                {activeTab === 'search' && searchQuery.length >= 2 && (
                  <p>No results found for &ldquo;{searchQuery}&rdquo;</p>
                )}
                {activeTab === 'recent' && (
                  <>
                    <Clock className="w-5 h-5 mx-auto mb-2 opacity-50" />
                    <p>No recent items found.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {displayedRefs.map((ref) => (
                  <ReferenceItem
                    key={ref.key}
                    reference={ref}
                    isLinked={linkedKeys.has(ref.key)}
                    onLink={() => handleLinkWithNote(ref)}
                    onUnlink={() => onUnlinkReference(ref.key)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
