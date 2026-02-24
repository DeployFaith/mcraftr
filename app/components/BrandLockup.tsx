type Props = {
  size?: 'header' | 'hero'
  className?: string
}

export default function BrandLockup({ size = 'header', className = '' }: Props) {
  const markSize = size === 'header' ? 'w-8 h-8' : 'w-16 h-16'
  const textSize = size === 'header' ? 'text-[1.35rem] tracking-[0.08em]' : 'text-[3.1rem] tracking-[0.1em]'

  return (
    <div className={`flex items-center gap-1 ${className}`.trim()}>
      <img src="/m.svg" alt="Mcraftr mark" className={`${markSize} object-contain shrink-0`} />
      <span className={`font-mono font-bold leading-none uppercase ${textSize}`} style={{ color: 'var(--accent)' }}>
        CRAFTR
      </span>
    </div>
  )
}
