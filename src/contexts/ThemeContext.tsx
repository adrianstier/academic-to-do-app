'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'academic-pm-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start with 'dark' to match server render and avoid hydration mismatch.
  // Hydrate from localStorage in useEffect below.
  const [theme, setThemeState] = useState<Theme>('dark');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate theme from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        setThemeState(savedTheme);
      }
    } catch {
      // Ignore localStorage errors
    }
    setHydrated(true);
  }, []);

  // Apply theme class to document and save to localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    // Only persist after hydration to avoid writing the default back over the stored value
    if (hydrated) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        // Ignore localStorage errors (e.g., quota exceeded)
      }
    }
  }, [theme, hydrated]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  // Always render children immediately - no conditional rendering
  // This prevents blank page in WebKit while still defaulting to dark theme
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
