import { useEffect, useState } from 'react';
import { applyTheme, preferredTheme, toggleTheme } from '../theme';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => (
    typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-theme') || preferredTheme())
      : 'dark'
  ));

  useEffect(() => {
    setTheme(applyTheme(preferredTheme()));
  }, []);

  function onToggle() {
    setTheme(toggleTheme());
  }

  const light = theme === 'light';
  return (
    <button
      type="button"
      className={`${styles.toggle} ${className}`}
      onClick={onToggle}
      aria-label={light ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={light ? 'Modo escuro' : 'Modo claro'}
    >
      {light ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
