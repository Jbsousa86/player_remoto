import { useState, useEffect } from 'react';

/**
 * Hook para detectar tamanho de tela e fornecer classe de escala
 * Adaptado para TVs de 24" até 50"+ polegadas
 * Suporta orientação vertical (portrait) e horizontal (landscape)
 * 
 * Breakpoints:
 * - XS: 24" (1366x768 ou similar)
 * - SM: 28-32" (1920x1080)
 * - MD: 40-43" (3840x2160 ou Full HD com zoom)
 * - LG: 50"+ (4K ou maior)
 * 
 * Orientações:
 * - landscape: largura > altura (padrão para TVs)
 * - portrait: altura > largura (vertical/vertical flip)
 */
export const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    diagonal: 0,
    scaleClass: 'sm',
    scale: 1,
    orientation: 'landscape',
    isPortrait: false,
    isLandscape: true,
    aspectRatio: 16 / 9,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Determinar orientação
      const isPortrait = height > width;
      const orientation = isPortrait ? 'portrait' : 'landscape';
      const aspectRatio = width / height;
      
      // Calcular diagonal em polegadas (assumindo 96 DPI)
      const diagonalPixels = Math.sqrt(width * width + height * height);
      const diagonal = diagonalPixels / 96; // Convert pixels to inches at 96 DPI

      let scaleClass = 'xs';
      let scale = 0.85;

      if (diagonal < 27) {
        // 24" TV - 1366x768
        scaleClass = 'xs';
        scale = 0.85;
      } else if (diagonal < 35) {
        // 28-32" TV - 1920x1080
        scaleClass = 'sm';
        scale = 1;
      } else if (diagonal < 45) {
        // 40-43" TV - 2560x1440 ou 3840x2160
        scaleClass = 'md';
        scale = 1.3;
      } else {
        // 50"+ TV - 4K ou maior
        scaleClass = 'lg';
        scale = 1.6;
      }

      setScreenSize({
        width,
        height,
        diagonal: Math.round(diagonal),
        scaleClass,
        scale,
        orientation,
        isPortrait,
        isLandscape: !isPortrait,
        aspectRatio,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Call once on mount

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screenSize;
};

/**
 * Retorna classes Tailwind baseadas no tamanho da tela
 * Considera tanto tamanho quanto orientação
 */
export const getResponsiveClasses = (screenSize) => {
  const { scaleClass, isPortrait } = screenSize;
  
  const classMap = {
    xs: {
      gap: 'gap-4',
      padding: 'p-3',
      gridCols: isPortrait ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
      textLg: 'text-lg',
      textMd: 'text-base',
      textSm: 'text-sm',
      fontSize: 'text-2xl',
    },
    sm: {
      gap: 'gap-6',
      padding: 'p-4',
      gridCols: isPortrait ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      textLg: 'text-xl',
      textMd: 'text-lg',
      textSm: 'text-base',
      fontSize: 'text-3xl',
    },
    md: {
      gap: 'gap-8',
      padding: 'p-5',
      gridCols: isPortrait ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
      textLg: 'text-2xl',
      textMd: 'text-xl',
      textSm: 'text-lg',
      fontSize: 'text-5xl',
    },
    lg: {
      gap: 'gap-10',
      padding: 'p-6',
      gridCols: isPortrait ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
      textLg: 'text-3xl',
      textMd: 'text-2xl',
      textSm: 'text-xl',
      fontSize: 'text-6xl',
    },
  };

  return classMap[scaleClass] || classMap.sm;
};

export default useScreenSize;
