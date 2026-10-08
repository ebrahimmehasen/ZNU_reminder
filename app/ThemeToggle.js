'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './icons';

export const THEME_KEY = 'mawaeed:theme';

/** Light by default; the choice is remembered per device. The layout applies it before paint. */
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable: the choice lasts for this visit only
    }
  }

  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      onClick={toggle}
      aria-label={dark ? 'الوضع الفاتح' : 'الوضع الغامق'}
      title={dark ? 'الوضع الفاتح' : 'الوضع الغامق'}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
