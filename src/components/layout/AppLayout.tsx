'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useTodoStore } from '@/store/todoStore';
import { useIsDesktopWide } from '@/hooks';
import { prefersReducedMotion, DURATION } from '@/lib/animations';

interface AppLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  header?: ReactNode;
}

/**
 * AppLayout provides a CSS Grid-based layout system that:
 * 1. Eliminates fixed positioning hacks for the chat sidebar
 * 2. Maintains consistent content width across list and kanban views
 * 3. Smoothly handles focus mode transitions
 * 4. Properly responds to all breakpoints
 *
 * Grid Structure:
 * - Desktop (xl+): Two columns - [main content] [sidebar]
 * - Mobile/Tablet: Single column with floating chat modal
 */
export default function AppLayout({ children, sidebar, header }: AppLayoutProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const { focusMode } = useTodoStore((state) => state.ui);
  const isWideDesktop = useIsDesktopWide(1280);

  // Determine if sidebar should be visible
  const showSidebar = isWideDesktop && !focusMode && sidebar;

  return (
    <div
      className={`
        min-h-screen
        transition-colors duration-200
        bg-[var(--background)]
      `}
    >
      {/* Header - Full width, sticky */}
      {header && (
        <div className="sticky top-0 z-40">
          {header}
        </div>
      )}

      {/* Main Grid Container */}
      <div
        className={`
          grid
          transition-all duration-300 ease-out
          ${showSidebar
            ? 'xl:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_420px]'
            : 'grid-cols-1'
          }
        `}
      >
        {/* Main Content Area */}
        <main
          id="main-content"
          className="min-w-0 min-h-[calc(100vh-72px)]"
        >
          {children}
        </main>

        {/* Sidebar - Only rendered on wide desktop when not in focus mode */}
        <AnimatePresence mode="wait">
          {showSidebar && (
            <motion.aside
              key="sidebar"
              initial={prefersReducedMotion() ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion() ? undefined : { opacity: 0, x: 20 }}
              transition={{ duration: DURATION.normal }}
              className={`
                hidden xl:block
                h-[calc(100vh-72px)]
                sticky top-[72px]
                border-l
                ${darkMode
                  ? 'bg-[var(--surface)] border-white/10'
                  : 'bg-white border-[var(--border)]'
                }
              `}
              aria-label="Sidebar"
            >
              {sidebar}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * ContentContainer provides consistent max-width and padding for content
 * regardless of whether we're in list or kanban view
 */
interface ContentContainerProps {
  children: ReactNode;
  className?: string;
  /** If true, allows content to be wider (for kanban) but still constrained */
  wide?: boolean;
}

export function ContentContainer({ children, className = '', wide = false }: ContentContainerProps) {
  return (
    <div
      className={`
        mx-auto px-4 sm:px-6 py-6
        ${wide
          ? 'max-w-full xl:max-w-[1400px] 2xl:max-w-[1600px]'
          : 'max-w-4xl lg:max-w-5xl xl:max-w-6xl'
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * ViewTransition wraps view content (list/kanban) with smooth animations
 */
interface ViewTransitionProps {
  children: ReactNode;
  viewKey: string;
}

export function ViewTransition({ children, viewKey }: ViewTransitionProps) {
  const reducedMotion = prefersReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
        transition={{ duration: DURATION.fast }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
