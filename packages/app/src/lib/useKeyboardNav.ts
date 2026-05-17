import { useEffect } from 'react';

export function useKeyboardNav() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const modal = document.querySelector<HTMLElement>('[role="dialog"]');
        if (modal) {
          const close = modal.querySelector<HTMLElement>('[data-close], [aria-label="Close"]');
          close?.click();
        }
      }
      // Cmd+K — placeholder for future search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
