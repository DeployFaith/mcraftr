'use client'
import { useState, useCallback } from 'react'
import { playSound } from '@/app/components/soundfx'

export type ToastVariant = 'ok' | 'error' | 'deactivated'
export type Toast = { id: number; variant: ToastVariant; message: string }

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((variant: ToastVariant, message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, variant, message }])
    playSound(variant === 'ok' ? 'success' : variant === 'error' ? 'error' : 'notify')
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return { toasts, addToast }
}
