import { useEffect, useState } from 'react';

function readTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/** Horizontal SpotStrat lockup; swaps for light / dark theme. */
export default function BrandLogo({ className = '', height = 28 }) {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(readTheme());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const src = theme === 'light' ? '/brand/logo-light.png' : '/brand/logo-dark.png';
  return (
    <img
      className={className}
      src={src}
      alt="SpotStrat"
      height={height}
      width={Math.round(height * (1851 / 575))}
      decoding="async"
    />
  );
}
