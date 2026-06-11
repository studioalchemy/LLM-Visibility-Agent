import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        neutral: 'var(--neutral)',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        silk: ['Silkscreen', 'monospace'],
        mono: ['"JetBrains Mono"', '"Space Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '2px',
      },
      boxShadow: {
        glow: '0 0 0 1px var(--accent), 0 0 18px -2px rgba(224,32,46,0.55)',
        'glow-dim': '0 0 0 1px var(--accent-dim)',
      },
      transitionDuration: {
        snappy: '140ms',
      },
    },
  },
  plugins: [],
};

export default config;
