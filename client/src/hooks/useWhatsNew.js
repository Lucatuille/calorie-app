import { useState, useEffect } from 'react';
import { CURRENT_VERSION, RELEASES } from '../data/whatsNew';

const VERSION_KEY    = 'caliro_whats_new_seen';
const ONBOARDING_KEY = 'caliro_onboarding_seen';

export function useWhatsNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [releaseToShow, setReleaseToShow] = useState(null);
  // Onboarding: mostrar HelpModal la primera vez, en vez de WhatsNew
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const onboardingSeen = localStorage.getItem(ONBOARDING_KEY);
      const lastVersion    = localStorage.getItem(VERSION_KEY);

      if (!onboardingSeen) {
        // Primera vez del usuario → abrir HelpModal (onboarding)
        setShowOnboarding(true);
      } else if (lastVersion !== CURRENT_VERSION) {
        // Ya hizo onboarding pero hay version nueva → WhatsNew
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

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    setShowOnboarding(false);
  };

  // Para admins: forzar apertura sin tocar localStorage
  const forceOpen = () => {
    setReleaseToShow(RELEASES[0]);
    setIsOpen(true);
  };

  return { isOpen, isClosing, releaseToShow, dismiss, forceOpen, showOnboarding, dismissOnboarding };
}
