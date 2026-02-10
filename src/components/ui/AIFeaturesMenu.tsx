'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Upload, Mic, Mail, ChevronDown } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/animations';

interface AIFeaturesMenuProps {
  onSmartParse: () => void;
  onVoiceInput: () => void;
  onFileImport: () => void;
  onEmailGenerate?: () => void;
  disabled?: boolean;
  showEmailOption?: boolean;
  voiceSupported?: boolean;
  className?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: typeof Sparkles;
  shortcut: string;
  onClick: () => void;
  description: string;
}

export function AIFeaturesMenu({
  onSmartParse,
  onVoiceInput,
  onFileImport,
  onEmailGenerate,
  disabled = false,
  showEmailOption = false,
  voiceSupported = true,
  className = ''
}: AIFeaturesMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  // Calculate dropdown position when menu opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 288; // w-72 = 288px
      const dropdownHeight = 300; // Approximate height

      let left = rect.left;
      let top = rect.bottom + 8;

      // Adjust if goes off screen horizontally
      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }

      // If dropdown would go below viewport, position it above the button
      if (top + dropdownHeight > window.innerHeight) {
        top = rect.top - dropdownHeight - 8;
      }

      setDropdownPosition({ top, left });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInputField && (e.metaKey || e.ctrlKey)) {
        // Allow Cmd/Ctrl shortcuts even in input fields
        if (e.key === 'p') {
          e.preventDefault();
          onSmartParse();
          setIsOpen(false);
        } else if (e.key === 'j' && voiceSupported) {
          e.preventDefault();
          onVoiceInput();
          setIsOpen(false);
        } else if (e.key === 'e' && showEmailOption && onEmailGenerate) {
          e.preventDefault();
          onEmailGenerate();
          setIsOpen(false);
        }
      }

      // ESC to close menu
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSmartParse, onVoiceInput, onEmailGenerate, voiceSupported, showEmailOption]);

  const menuItems: MenuItem[] = [
    {
      id: 'parse',
      label: 'AI Parse Task',
      icon: Sparkles,
      shortcut: '⌘P',
      onClick: () => {
        onSmartParse();
        setIsOpen(false);
      },
      description: 'Break down complex text into tasks'
    },
    ...(voiceSupported ? [{
      id: 'voice',
      label: 'Voice Input',
      icon: Mic,
      shortcut: '⌘J',
      onClick: () => {
        onVoiceInput();
        setIsOpen(false);
      },
      description: 'Dictate task using your voice'
    }] : []),
    {
      id: 'upload',
      label: 'Import File',
      icon: Upload,
      shortcut: '',
      onClick: () => {
        onFileImport();
        setIsOpen(false);
      },
      description: 'Upload PDF, image, or audio file'
    },
    ...(showEmailOption && onEmailGenerate ? [{
      id: 'email',
      label: 'Generate Email',
      icon: Mail,
      shortcut: '⌘E',
      onClick: () => {
        onEmailGenerate();
        setIsOpen(false);
      },
      description: 'Create email from task details'
    }] : [])
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          p-2.5 rounded-full transition-all duration-200
          min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5
          touch-manipulation
          ${isOpen
            ? 'bg-[var(--accent)] text-white shadow-sm'
            : 'text-[var(--accent)] hover:bg-[var(--accent-light)]'
          }
          active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label="AI Features Menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Sparkles className="w-4.5 h-4.5" />
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu - Portal for proper positioning */}
      {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            initial={prefersReducedMotion() ? false : { opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion() ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="
              fixed w-72
              rounded-xl border border-[var(--border)]
              bg-[var(--surface)] shadow-2xl
              overflow-hidden z-[9999]
            "
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left
            }}
            role="menu"
            aria-orientation="vertical"
          >
            <div className="p-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className="
                      w-full flex items-start gap-3 px-3 py-2.5
                      rounded-lg text-left transition-colors
                      hover:bg-[var(--surface-2)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                      group
                      min-h-[44px]
                    "
                    role="menuitem"
                  >
                    <Icon
                      className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {item.label}
                        </span>
                        {item.shortcut && (
                          <kbd className="
                            px-1.5 py-0.5 text-xs font-mono
                            rounded border border-[var(--border)]
                            bg-[var(--surface-2)] text-[var(--text-muted)]
                            opacity-0 group-hover:opacity-100 transition-opacity
                          ">
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-2)]">
              <p className="text-xs text-[var(--text-muted)] text-center">
                Use <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)]">?</kbd> to see all shortcuts
              </p>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
