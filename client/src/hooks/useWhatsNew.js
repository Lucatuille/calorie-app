import { useState, useEffect } from 'react';
import { CURRENT_VERSION, RELEASES } from '../data/whatsNew';

const STORAGE_KEY = 'caliro_whats_new_seen';

export function useWhatsNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [releaseToShow, setReleaseToShow] = useState(null);

  useEffect(() => {
    // Esperar 1.5s — no interrumpir la carga inicial
    const timer = setTimeout(() => {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (lastSeen !== CURRENT_VERSION) {
        setReleaseToShow(RELEASES[0]);
        setIsOpen(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };

  // Para admins: forzar apertura sin tocar localStorage
  const forceOpen = () => {
    setReleaseToShow(RELEASES[0]);
    setIsOpen(true);
  };

  return { isOpen, isClosing, releaseToShow, dismiss, forceOpen };
}
