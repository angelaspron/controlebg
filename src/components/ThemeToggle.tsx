import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', style, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`btn theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      style={{
        padding: '0.4rem 0.65rem',
        fontSize: '0.8rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'var(--transition)',
        ...style,
      }}
    >
      {isDark ? (
        <Sun size={16} color="#fbbf24" style={{ transition: 'transform 0.3s ease' }} />
      ) : (
        <Moon size={16} color="#6366f1" style={{ transition: 'transform 0.3s ease' }} />
      )}
      {showLabel && (
        <span>{isDark ? 'Tema Claro' : 'Tema Escuro'}</span>
      )}
    </button>
  );
}
