/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── Warm Café colour system ──────────────────────────────────────
      colors: {
        espresso:    '#2B1B14',
        cream:       '#FBF6EE',
        paper:       '#FFFFFF',
        terracotta:  '#E8590C',
        'terra-dark':'#C2410C',
        caramel:     '#C98B4B',
        matcha:      '#4F7F4A',
        chili:       '#C0392B',
        ink:         '#1F1611',
        muted:       '#7A6A5F',
        line:        '#EADFD0',

        // Tint pairs  [light bg, strong accent]
        amber:  { DEFAULT: '#D9822B', light: '#FFF1DC' },
        teal:   { DEFAULT: '#1E8E94', light: '#E3F4F4' },
        yellow: { DEFAULT: '#C99A00', light: '#FFF6CC' },
        rose:   { DEFAULT: '#C8503A', light: '#FDE5E0' },
        plum:   { DEFAULT: '#B0457F', light: '#F8E8F3' },

        // Keep brand alias for legacy billing components
        brand: {
          50:  '#fdf6e3',
          100: '#FDE8D5',
          200: '#FBC89A',
          300: '#F9A060',
          400: '#F07030',
          500: '#E8590C',
          600: '#C2410C',
          700: '#9A3309',
        },
      },

      // ── Typography ──────────────────────────────────────────────────
      fontFamily: {
        display: ['"DM Serif Display"', '"Fraunces"', 'Georgia', 'serif'],
        sans:    ['"DM Sans"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },

      fontSize: {
        'kpi':   ['36px', { lineHeight: '1.1', fontWeight: '700' }],
        'page':  ['32px', { lineHeight: '1.1', fontWeight: '700' }],
        'card':  ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        'body':  ['18px', { lineHeight: '1.55' }],
        'ui':    ['17px', { lineHeight: '1.4' }],
        'label': ['16px', { lineHeight: '1.3' }],
        'small': ['15px', { lineHeight: '1.3' }],
      },

      // ── Shape ────────────────────────────────────────────────────────
      borderRadius: {
        card:   '16px',
        btn:    '12px',
        pill:   '9999px',
        DEFAULT: '8px',
      },

      // ── Shadows (warm brown, two levels) ─────────────────────────────
      boxShadow: {
        rest:   '0 1px 4px rgba(43,27,20,0.08), 0 1px 2px rgba(43,27,20,0.04)',
        raised: '0 4px 16px rgba(43,27,20,0.12), 0 2px 6px rgba(43,27,20,0.06)',
        active: '0 0 0 3px rgba(232,89,12,0.35)',
      },

      // ── Transitions ──────────────────────────────────────────────────
      transitionDuration: { DEFAULT: '150ms' },
    },
  },
  plugins: [],
};
