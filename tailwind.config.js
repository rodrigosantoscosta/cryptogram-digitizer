/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#667eea',
          active: '#f0f4ff',
          hover: '#5a6fd6',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          muted: '#6b7280',
          faint: '#999999',
        },
        surface: {
          page: '#fafafa',
          card: '#ffffff',
          subtle: '#f8f9fa',
        },
        border: {
          DEFAULT: '#e5e5e5',
          light: '#e0e0e0',
        },
        success: {
          DEFAULT: '#22c55e',
          bg: '#d4edda',
          text: '#155724',
          border: '#c3e6cb',
        },
        error: {
          DEFAULT: '#ef4444',
          bg: '#f8d7da',
          text: '#721c24',
          border: '#f5c6cb',
        },
        warning: {
          DEFAULT: '#f59e0b',
          bg: '#fef08a',
          text: '#856404',
        },
        puzzle: {
          blue: '#0079d3',
          blueLight: '#dbeafe',
          paper: '#faf8f4',
          ink: '#1a1a1a',
          inkMuted: '#6b6358',
          border: '#c8c0b4',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', 'Playfair Display', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        input: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        elevated: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
}
