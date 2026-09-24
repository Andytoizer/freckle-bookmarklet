import React from 'react';
import { ICONS, type IconName } from './icons';

interface IconProps {
  name: IconName;
  size?: 12 | 16;
  color?: string;
  className?: string;
}

// Tabler glyphs from the design system, rendered inline so the page ships no icon font or CDN set.
// The extracted bodies carry their own fill; it is stripped so the color prop applies.
const Icon: React.FC<IconProps> = ({ name, size = 16, color = 'currentColor', className }) => {
  const glyph = ICONS[name][size];
  const body = glyph.body.replace(/\sfill="[^"]*"/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox={glyph.viewBox}
      fill={color}
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
};

export default Icon;
