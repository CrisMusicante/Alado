import React, { useEffect, useRef, useState } from 'react'

interface TextStyle {
  font?: string
  size?: string
  color?: string
  position?: 'top' | 'center' | 'bottom'
  shadow?: boolean
  stroke?: boolean
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

export default function VideoOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lines, setLines] = useState<string[]>([])
  const [textStyle, setTextStyle] = useState<TextStyle>({
    size: 'lg',
    color: '#FFFFFF',
    position: 'bottom',
    shadow: true
  })
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [blackout, setBlackout] = useState(false)
  const [whiteout, setWhiteout] = useState(false)
  const [visible, setVisible] = useState(true)

  // Use refs so setTimeout callbacks always see fresh values
  const transitionDurationRef = useRef(250)
  const transitionTypeRef = useRef<'fade' | 'cut'>('fade')

  useEffect(() => {
    const onShowSection = (payload: any) => {
      const duration = transitionTypeRef.current === 'cut' ? 0 : transitionDurationRef.current
      setVisible(false)
      setTimeout(() => {
        setLines(payload.lines ?? [])
        if (payload.textStyle) setTextStyle(payload.textStyle)
        setVisible(true)
      }, duration)
    }

    const onSetVideo = (payload: any) => {
      setVideoPath(payload.videoPath)
    }

    const onBlackout = (payload: any) => {
      setBlackout(payload.active)
    }

    const onWhiteout = (payload: any) => {
      setWhiteout(payload.active)
    }

    const onTransition = (payload: any) => {
      if (payload.type) transitionTypeRef.current = payload.type
      if (typeof payload.duration === 'number') transitionDurationRef.current = payload.duration
    }

    window.api.on('live:show-section', onShowSection)
    window.api.on('live:set-video', onSetVideo)
    window.api.on('live:blackout', onBlackout)
    window.api.on('live:whiteout', onWhiteout)
    window.api.on('live:transition', onTransition)

    return () => {
      window.api.off('live:show-section', onShowSection)
      window.api.off('live:set-video', onSetVideo)
      window.api.off('live:blackout', onBlackout)
      window.api.off('live:whiteout', onWhiteout)
      window.api.off('live:transition', onTransition)
    }
  }, [])

  useEffect(() => {
    if (!videoRef.current) return
    if (videoPath) {
      videoRef.current.src = `file://${videoPath}`
      videoRef.current.play().catch(console.error)
    } else {
      videoRef.current.pause()
      videoRef.current.src = ''
      videoRef.current.load()
    }
  }, [videoPath])

  const fontSize = SIZE_MAP[textStyle.size ?? 'lg'] ?? '4.5rem'
  const justifyContent = POSITION_MAP[textStyle.position ?? 'bottom'] ?? 'flex-end'
  const fontFamily = FONT_MAP[textStyle.font ?? 'sans'] ?? FONT_MAP.sans
  const fadeDuration = transitionDurationRef.current

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: '#000'
    }}>
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
      {videoPath && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 1
        }} />
      )}

      {/* Layer 2: Bottom gradient for readability when video active */}
      {videoPath && textStyle.position === 'bottom' && (
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
          transition: `opacity ${fadeDuration}ms ease`
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

      {/* Layer 100: Blackout */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        background: '#000',
        opacity: blackout ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: 'none'
      }} />

      {/* Layer 101: Whiteout */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 101,
        background: '#fff',
        opacity: whiteout ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: 'none'
      }} />
    </div>
  )
}
