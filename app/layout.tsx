import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import ThemeProvider from './components/ThemeProvider'
import SessionProviderWrapper from './components/SessionProviderWrapper'
import BackToTopButton from './components/BackToTopButton'
import BackgroundMusicProvider from './components/BackgroundMusicProvider'

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host')?.toLowerCase() ?? ''
  const title = host === 'mcraftr.mesh' ? 'Mcraftr - Private' : 'Mcraftr by DeployFaith'

  return {
  metadataBase: new URL('https://mcraftr.deployfaith.xyz'),
    title,
    description: 'Minecraft server admin panel',
    icons: {
      icon: '/m.svg',
      shortcut: '/m.svg',
      apple: '/m.svg',
    },
  }
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
              var customAccent = localStorage.getItem('mcraftr-custom-accent') || '#7df9ff';
              var themePack = JSON.parse(localStorage.getItem('mcraftr-theme-pack') || 'null');
              var font   = localStorage.getItem('mcraftr-font')   || 'operator';
              var fontSize = localStorage.getItem('mcraftr-font-size') || 'md';
              var colors = {
                cyan: '#00ffc8', blue: '#4d9fff', purple: '#b57bff', pink: '#ff6eb4',
                orange: '#ff9500', yellow: '#ffd60a', red: '#ff453a'
              };
              document.documentElement.setAttribute('data-theme', theme);
              document.documentElement.setAttribute('data-font', font);
              document.documentElement.setAttribute('data-font-size', fontSize);
              document.documentElement.style.setProperty('--accent', themePack && themePack.accent ? themePack.accent : (accent === 'custom' ? customAccent : (colors[accent] || '#00ffc8')));
              if (themePack && themePack.vars) {
                ['--bg','--bg2','--panel','--border','--text','--text-dim','--red'].forEach(function(key) {
                  if (themePack.vars[key]) document.documentElement.style.setProperty(key, themePack.vars[key]);
                });
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>
        <SessionProviderWrapper>
          <ThemeProvider>
            <BackgroundMusicProvider>
              {children}
              <BackToTopButton />
            </BackgroundMusicProvider>
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
