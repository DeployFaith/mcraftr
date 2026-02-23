import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
      colors: {
        accent: 'var(--accent)',
        background: 'var(--bg)',
        panel: 'var(--panel)',
        border: 'var(--border)',
      },
    },
  },
  plugins: [],
}

export default config
