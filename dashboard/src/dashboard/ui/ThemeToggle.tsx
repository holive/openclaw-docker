import { useState, useEffect } from 'react';
import './ThemeToggle.css';

type Theme = 'system' | 'light' | 'dark';

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme;
    return stored || 'system';
  });

  const themeIndex = theme === 'system' ? 0 : theme === 'light' ? 1 : 2;

  useEffect(() => {
    localStorage.setItem('theme', theme);

    const root = document.documentElement;
    root.removeAttribute('data-theme');

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  return (
    <div
      className={`theme-toggle ${compact ? 'theme-toggle--compact' : ''}`}
      style={{ '--theme-index': themeIndex } as React.CSSProperties}
    >
      <div className="theme-toggle-track" role="group" aria-label="theme">
        <span className="theme-toggle-indicator" />

        <button
          className={`theme-toggle-btn ${theme === 'system' ? 'active' : ''}`}
          onClick={() => setTheme('system')}
          aria-label="system theme"
          title="system"
        >
          <svg viewBox="0 0 24 24">
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
        </button>

        <button
          className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
          onClick={() => setTheme('light')}
          aria-label="light theme"
          title="light"
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        </button>

        <button
          className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => setTheme('dark')}
          aria-label="dark theme"
          title="dark"
        >
          <svg viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
