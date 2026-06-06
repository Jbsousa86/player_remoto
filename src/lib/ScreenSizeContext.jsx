import React, { createContext, useContext } from 'react';
import { useScreenSize } from './useScreenSize';

const ScreenSizeContext = createContext(null);

/**
 * Provider que fornece informações de tamanho e orientação de tela
 * Automaticamente detecta e comunica:
 * - Tamanho em polegadas e pixels
 * - Escala (0.85x a 1.6x)
 * - Orientação (portrait ou landscape)
 * - Aspect ratio
 */
export const ScreenSizeProvider = ({ children }) => {
  const screenSize = useScreenSize();

  return (
    <ScreenSizeContext.Provider value={screenSize}>
      {children}
    </ScreenSizeContext.Provider>
  );
};

export const useScreenSizeContext = () => {
  const context = useContext(ScreenSizeContext);
  if (!context) {
    console.warn('useScreenSizeContext deve ser usado dentro de ScreenSizeProvider');
    // Return default values if context is not available
    return {
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080,
      diagonal: 32,
      scaleClass: 'sm',
      scale: 1,
      orientation: 'landscape',
      isPortrait: false,
      isLandscape: true,
      aspectRatio: 16 / 9,
    };
  }
  return context;
};

