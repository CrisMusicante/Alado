import React, { useEffect, useRef } from 'react'

export interface SlideTextStyle {
  font?: string
  size?: string
  color?: string
  position?: 'top' | 'center' | 'bottom'
  shadow?: boolean
  stroke?: boolean
}

export const DEFAULT_SLIDE_STYLE: SlideTextStyle = {
  size: 'lg',
  color: '#FFFFFF',
  position: 'bottom',
  shadow: true
}

const SIZE_MAP: Record<string, string> = {
  sm: '2.5rem',
  md: '3.5rem',
  lg: '4.5rem',
  xl: '6rem'
}

const POSITION_MAP: Record<string, string> = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end'
}

const FONT_MAP: Record<string, string> = {
  rounded: '"Nunito", "Segoe UI", sans-serif',
  'bold-condensed': '"Barlow Condensed", "Arial Narrow", sans-serif',
  sans: '"Inter", "Segoe UI", system-ui, sans-serif'
}

/**
 * What the congregation sees for one section: background video, dimmers and lyrics.
 * Fills its parent. Shared by the live window and the song editor's preview.
 */
export default function SlideView({ lines, textStyle, videoSrc, visible = true, fadeMs = 250 }: {
  lines: string[]
  textStyle: SlideTextStyle
  videoSrc: string | null
  visible?: boolean
  fadeMs?: number
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (videoSrc) {
      video.src = videoSrc
      video.play().catch(console.error)
    } else {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [videoSrc])

  const fontSize = SIZE_MAP[textStyle.size ?? 'lg'] ?? '4.5rem'
  const justifyContent = POSITION_MAP[textStyle.position ?? 'bottom'] ?? 'flex-end'
  const fontFamily = FONT_MAP[textStyle.font ?? 'sans'] ?? FONT_MAP.sans

  return (
    <>
      {/* Layer 0: Background video */}
      <video
        ref={videoRef}
        loop
        muted
        autoPlay
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0
        }}
      />

      {/* Layer 1: Dimmer — only when video is active */}
      {videoSrc && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 1
        }} />
      )}

      {/* Layer 2: Bottom gradient for readability when video active */}
      {videoSrc && textStyle.position === 'bottom' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)',
          zIndex: 2
        }} />
      )}

      {/* Layer 3: Lyrics */}
      {lines.length > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent,
          padding: '4rem 6rem',
          opacity: visible ? 1 : 0,
          transition: `opacity ${fadeMs}ms ease`
        }}>
          {lines.map((line, i) => (
            <p key={i} style={{
              color: textStyle.color ?? '#FFFFFF',
              fontSize,
              fontFamily,
              fontWeight: 700,
              lineHeight: 1.25,
              textAlign: 'center',
              textShadow: textStyle.shadow
                ? '0 2px 12px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)'
                : 'none',
              WebkitTextStroke: textStyle.stroke ? '1px rgba(0,0,0,0.5)' : 'none',
              marginBottom: '0.5rem',
              textRendering: 'optimizeLegibility',
              WebkitFontSmoothing: 'antialiased',
              wordBreak: 'break-word',
              maxWidth: '100%'
            } as React.CSSProperties}>
              {line}
            </p>
          ))}
        </div>
      )}
    </>
  )
}
