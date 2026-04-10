import { useState, useEffect } from 'react';
import { CURRENT_VERSION, RELEASES } from '../data/whatsNew';

const VERSION_KEY = 'caliro_whats_new_seen';

export function useWhatsNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [releaseToShow, setReleaseToShow] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Onboarding: solo se activa desde el registro (sessionStorage, no persiste entre sesiones)
      const justRegistered = sessionStorage.getItem('caliro_just_registered');
      if (justRegistered) {
        sessionStorage.removeItem('caliro_just_registered');
        localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
        setShowOnboarding(true);
        return;
      }

      // WhatsNew: solo si el usuario ya tenía una versión guardada y es distinta
      // Si no hay versión (login nuevo dispositivo), seedear la actual sin mostrar nada
      const lastVersion = localStorage.getItem(VERSION_KEY);
      if (!lastVersion) {
        // Primer login en este dispositivo — no mostrar nada, solo guardar versión
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

  const dismissOnboarding = () => {
    setShowOnboarding(false);
  };

  const forceOpen = () => {
    setReleaseToShow(RELEASES[0]);
    setIsOpen(true);
  };

  return { isOpen, isClosing, releaseToShow, dismiss, forceOpen, showOnboarding, dismissOnboarding };
}
