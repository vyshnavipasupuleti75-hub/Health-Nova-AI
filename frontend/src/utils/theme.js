// Theme lives on <html data-theme="light|dark">. The saved user setting (MongoDB) is the source of truth;
// the cached user in localStorage is only read at boot so a refresh does not flash the light theme.
const TRANSITION_CLASS = 'theme-transition';
let transitionTimer;

export function applyTheme(theme, { animate = false } = {}) {
  const root = document.documentElement;
  const next = theme === 'dark' ? 'dark' : 'light';
  if (root.dataset.theme === next) return;
  if (animate) {
    root.classList.add(TRANSITION_CLASS);
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => root.classList.remove(TRANSITION_CLASS), 450);
  }
  root.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#070b1a' : '#1769e8');
}

export function applyCachedTheme() {
  try {
    const cached = localStorage.getItem('token') && JSON.parse(localStorage.getItem('user') || 'null');
    applyTheme(cached?.settings?.darkMode ? 'dark' : 'light');
  } catch {
    applyTheme('light');
  }
}
