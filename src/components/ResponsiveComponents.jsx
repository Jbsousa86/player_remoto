import React from 'react';
import { useScreenSizeContext } from '../lib/ScreenSizeContext';

/**
 * ResponsiveGrid - Componente grid que se adapta ao tamanho da tela E orientação
 * Automaticamente ajusta número de colunas baseado no tamanho da TV e orientação
 * 
 * Portrait: 1-2 colunas (mais estreito)
 * Landscape: 2-6 colunas (mais largo)
 */
export const ResponsiveGrid = ({ 
  children, 
  gap = 6,
  minColsXs = 1,
  minColsSm = 2,
  minColsMd = 3,
  minColsLg = 4,
  portraitCols = null, // Override para portrait
  className = ''
}) => {
  const screenSize = useScreenSizeContext();

  const getGridCols = () => {
    // Se estiver em portrait e tiver override, usar isso
    if (screenSize.isPortrait && portraitCols) {
      return portraitCols;
    }

    // Para portrait, reduzir número de colunas
    if (screenSize.isPortrait) {
      switch (screenSize.scaleClass) {
        case 'xs': return 'grid-cols-1';
        case 'sm': return 'grid-cols-1';
        case 'md': return 'grid-cols-1 sm:grid-cols-2';
        case 'lg': return 'grid-cols-1 sm:grid-cols-2';
        default: return 'grid-cols-1';
      }
    }

    // Para landscape (padrão)
    switch (screenSize.scaleClass) {
      case 'xs':
        return `grid-cols-${minColsXs} sm:grid-cols-2`;
      case 'sm':
        return `grid-cols-${minColsSm} lg:grid-cols-${minColsMd} xl:grid-cols-${minColsLg}`;
      case 'md':
        return `grid-cols-${minColsMd} lg:grid-cols-${minColsLg} xl:grid-cols-5`;
      case 'lg':
        return `grid-cols-${minColsLg} lg:grid-cols-5 xl:grid-cols-6`;
      default:
        return `grid-cols-${minColsSm} lg:grid-cols-${minColsMd}`;
    }
  };

  return (
    <div 
      className={`grid ${getGridCols()} gap-${gap} ${className}`}
      data-screen-size={screenSize.scaleClass}
      data-orientation={screenSize.orientation}
    >
      {children}
    </div>
  );
};

/**
 * ResponsiveContainer - Wrapper para conteúdo que precisa escalar
 * Adapta padding baseado no tamanho e orientação
 */
export const ResponsiveContainer = ({ 
  children, 
  padding = 4,
  className = ''
}) => {
  const screenSize = useScreenSizeContext();

  return (
    <div 
      className={`p-${padding} ${className}`}
      data-screen-size={screenSize.scaleClass}
      data-orientation={screenSize.orientation}
      style={{ '--scale-factor': screenSize.scale }}
    >
      {children}
    </div>
  );
};

/**
 * ResponsiveText - Texto que se adapta ao tamanho da tela E orientação
 * Em portrait, pode ser ligeiramente maior para compensar o formato
 */
export const ResponsiveText = ({ 
  children, 
  variant = 'base',
  className = ''
}) => {
  const screenSize = useScreenSizeContext();

  const textSizeMap = {
    xs: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
    },
    sm: {
      xs: 'text-sm',
      sm: 'text-base',
      base: 'text-lg',
      lg: 'text-xl',
      xl: 'text-2xl',
      '2xl': 'text-3xl',
      '3xl': 'text-4xl',
    },
    md: {
      xs: 'text-base',
      sm: 'text-lg',
      base: 'text-xl',
      lg: 'text-2xl',
      xl: 'text-3xl',
      '2xl': 'text-4xl',
      '3xl': 'text-5xl',
    },
    lg: {
      xs: 'text-lg',
      sm: 'text-xl',
      base: 'text-2xl',
      lg: 'text-3xl',
      xl: 'text-4xl',
      '2xl': 'text-5xl',
      '3xl': 'text-6xl',
    },
  };

  const sizeClass = textSizeMap[screenSize.scaleClass]?.[variant] || 'text-base';

  return (
    <span 
      className={`${sizeClass} ${className}`}
      data-orientation={screenSize.orientation}
    >
      {children}
    </span>
  );
};

/**
 * ResponsiveStack - Componente que automaticamente muda entre row/col baseado na orientação
 * Portrait: flex-col (vertical/coluna)
 * Landscape: flex-row (horizontal/linha)
 */
export const ResponsiveStack = ({ 
  children, 
  gap = 4,
  className = '',
  forceDirection = null // 'row' ou 'col' para forçar
}) => {
  const screenSize = useScreenSizeContext();

  const direction = forceDirection || (screenSize.isPortrait ? 'col' : 'row');
  const directionClass = direction === 'col' ? 'flex-col' : 'flex-row';

  return (
    <div 
      className={`flex ${directionClass} gap-${gap} ${className}`}
      data-orientation={screenSize.orientation}
    >
      {children}
    </div>
  );
};

/**
 * ResponsiveImage - Imagem que se adapta mantendo aspect ratio
 * Em portrait: mais estreita
 * Em landscape: mais larga
 */
export const ResponsiveImage = ({ 
  src, 
  alt,
  className = '',
  aspectRatio = 'aspect-video'
}) => {
  const screenSize = useScreenSizeContext();

  return (
    <img 
      src={src}
      alt={alt}
      className={`w-full ${aspectRatio} object-cover ${className}`}
      data-orientation={screenSize.orientation}
    />
  );
};

export default ResponsiveGrid;
