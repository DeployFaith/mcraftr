import type { Metadata } from 'next'
import { IBM_Plex_Mono, Press_Start_2P, Silkscreen, VT323 } from 'next/font/google'
import './globals.css'
import ThemeProvider from './components/ThemeProvider'
import SessionProviderWrapper from './components/SessionProviderWrapper'

const operatorFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-operator',
})

const minecraftFont = Silkscreen({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-minecraft',
})

const pixelFont = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-pixel',
})

const terminalFont = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-terminal',
})

export const metadata: Metadata = {
  title: 'Mcraftr',
  description: 'Minecraft server admin panel',
  icons: {
    icon: '/m.svg',
    shortcut: '/m.svg',
    apple: '/m.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${operatorFont.variable} ${minecraftFont.variable} ${pixelFont.variable} ${terminalFont.variable}`}
    >
      <head>
        {/* Anti-flash: apply theme + accent before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme  = localStorage.getItem('mcraftr-theme')  || 'dark';
              var accent = localStorage.getItem('mcraftr-accent') || 'cyan';
              var font   = localStorage.getItem('mcraftr-font')   || 'operator';
              var fontSize = localStorage.getItem('mcraftr-font-size') || 'md';
              var colors = {
                cyan: '#00ffc8', blue: '#4d9fff', purple: '#b57bff', pink: '#ff6eb4',
                orange: '#ff9500', yellow: '#ffd60a', red: '#ff453a', white: '#e8e8f0'
              };
              document.documentElement.setAttribute('data-theme', theme);
              document.documentElement.setAttribute('data-font', font);
              document.documentElement.setAttribute('data-font-size', fontSize);
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
