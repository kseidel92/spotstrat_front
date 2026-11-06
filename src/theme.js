const KEY = 'spotstrat.theme';

export function preferredTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  return next;
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || preferredTheme();
  return applyTheme(current === 'light' ? 'dark' : 'light');
}

export function initTheme() {
  return applyTheme(preferredTheme());
}
