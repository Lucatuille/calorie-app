import { useState, useEffect } from 'react';
import { CURRENT_VERSION, RELEASES } from '../data/whatsNew';

const VERSION_KEY = 'caliro_whats_new_seen';

export function useWhatsNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [releaseToShow, setReleaseToShow] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const lastVersion = localStorage.getItem(VERSION_KEY);
      if (!lastVersion) {
        // Primer login en este dispositivo — seedear versión sin mostrar nada
        localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
        return;
      }
      if (lastVersion !== CURRENT_VERSION) {
        setReleaseToShow(RELEASES[0]);
        setIsOpen(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };

  const forceOpen = () => {
    setReleaseToShow(RELEASES[0]);
    setIsOpen(true);
  };

  return { isOpen, isClosing, releaseToShow, dismiss, forceOpen };
}
