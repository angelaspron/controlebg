import React from 'react';

interface MeepleIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export function MeepleIcon({ size = 24, color = "currentColor", ...props }: MeepleIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill={color} 
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M 50 5 C 40 5, 35 25, 42 32 L 15 32 C 5 32, 5 50, 15 50 L 32 55 L 25 95 C 23 100, 42 100, 42 95 L 50 70 L 58 95 C 58 100, 77 100, 75 95 L 68 55 L 85 50 C 95 50, 95 32, 85 32 L 58 32 C 65 25, 60 5, 50 5 Z" />
    </svg>
  );
}
