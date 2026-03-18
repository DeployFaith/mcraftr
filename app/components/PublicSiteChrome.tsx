import Link from 'next/link'
import BrandLockup from './BrandLockup'

type SiteLink = {
  href: string
  label: string
  external?: boolean
}

type PublicSiteHeaderProps = {
  navLinks: SiteLink[]
  actionLinks: SiteLink[]
  mobilePrimaryLink?: SiteLink
  brandHref?: string
  mobileMenuLabel?: string
}

type PublicSiteFooterProps = {
  links: SiteLink[]
  tagline: string
  brandHref?: string
}

function renderLink(link: SiteLink, className: string) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
      </a>
    )
  }

  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  )
}

export function PublicSiteHeader({
  navLinks,
  actionLinks,
  mobilePrimaryLink,
  brandHref = '/',
  mobileMenuLabel = 'Open site menu',
}: PublicSiteHeaderProps) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={brandHref} className="shrink-0">
          <BrandLockup size="header" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <span key={`${link.label}-${link.href}`}>
              {renderLink(link, 'text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]')}
            </span>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {actionLinks.map((link, index) => (
            <span key={`${link.label}-${link.href}`}>
              {renderLink(
                link,
                index === 1
                  ? 'rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm text-[var(--text)] transition-all hover:border-[var(--accent)]'
                  : 'rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]'
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {mobilePrimaryLink ? (
            renderLink(
              mobilePrimaryLink,
              'rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-all hover:border-[var(--accent)]'
            )
          ) : null}

          <details className="group relative">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] [&::-webkit-details-marker]:hidden">
              <span className="sr-only">{mobileMenuLabel}</span>
              <svg className="h-5 w-5 group-open:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <svg className="hidden h-5 w-5 group-open:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </summary>

            <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_94%,transparent)] p-3 shadow-2xl backdrop-blur-md">
              <div className="grid gap-2">
                {navLinks.map((link) => (
                  <div key={`${link.label}-${link.href}`}>
                    {renderLink(
                      link,
                      'block rounded-xl border border-transparent px-3 py-2.5 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--border)] hover:bg-[var(--bg)]/50 hover:text-[var(--accent)]'
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 border-t border-[var(--border)] pt-3">
                {actionLinks.map((link) => (
                  <div key={`${link.label}-${link.href}`}>
                    {renderLink(
                      link,
                      'block rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]'
                    )}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}

export function PublicSiteFooter({ links, tagline, brandHref = '/' }: PublicSiteFooterProps) {
  return (
    <footer className="border-t border-[var(--border)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Link href={brandHref} className="flex items-center gap-2">
          <BrandLockup size="header" />
        </Link>

        <div className="flex items-center gap-6">
          {links.map((link) => (
            <span key={`${link.label}-${link.href}`}>
              {renderLink(link, 'text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]')}
            </span>
          ))}
        </div>

        <p className="text-xs text-[var(--text-dim)]">{tagline}</p>
      </div>
    </footer>
  )
}
