'use client'

import Image, { type StaticImageData } from 'next/image'
import { useState } from 'react'

type ProgressiveScreenshotProps = {
  src: StaticImageData
  alt: string
  sizes: string
  className?: string
  priority?: boolean
}

export default function ProgressiveScreenshot({
  src,
  alt,
  sizes,
  className = '',
  priority = false,
}: ProgressiveScreenshotProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`screenshot-shell ${loaded ? 'is-loaded' : ''}`}>
      <div className="screenshot-skeleton" aria-hidden="true" />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        placeholder="blur"
        onLoad={() => setLoaded(true)}
        className={`screenshot-image ${className}`.trim()}
      />
    </div>
  )
}
