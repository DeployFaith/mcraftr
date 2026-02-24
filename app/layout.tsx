import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from './components/ThemeProvider'
import SessionProviderWrapper from './components/SessionProviderWrapper'

export const metadata: Metadata = {
  title: 'Mcraftr',
  description: 'Minecraft server admin panel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Anti-flash: apply theme + accent before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme  = localStorage.getItem('mcraftr-theme')  || 'dark';
              var accent = localStorage.getItem('mcraftr-accent') || 'cyan';
              var colors = {
                cyan: '#00ffc8', blue: '#4d9fff', purple: '#b57bff', pink: '#ff6eb4',
                orange: '#ff9500', yellow: '#ffd60a', red: '#ff453a', white: '#e8e8f0'
              };
              document.documentElement.setAttribute('data-theme', theme);
              document.documentElement.style.setProperty('--accent', colors[accent] || '#00ffc8');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>
        <SessionProviderWrapper>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
