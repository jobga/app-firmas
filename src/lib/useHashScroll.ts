/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scrolls to the element matching the URL hash (react-router doesn't do this). */
export function useHashScroll() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);
}
