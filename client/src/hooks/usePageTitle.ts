import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — Caliro` : 'Caliro';
    return () => { document.title = 'Caliro'; };
  }, [title]);
}
