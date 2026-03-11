import { useEffect, useRef, useState } from 'react'

interface Section {
  lines: string[]
}

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

export default function VideoOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lines, setLines] = useState<string[]>([])
  const [textStyle, setTextStyle] = useState<TextStyle>({ size: 'lg', color: '#FFFFFF', position: 'bottom', shadow: true })
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [blackout, setBlackout] = useState(false)
  const [whiteout, setWhiteout] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    window.api.on('live:show-section', (payload: any) => {
      setVisible(false)
      setTimeout(() => {
        setLines(payload.lines ?? [])
        if (payload.textStyle) setTextStyle(payload.textStyle)
        setVisible(true)
      }, 250)
    })

    window.api.on('live:set-video', (payload: any) => {
      setVideoPath(payload.videoPath)
    })

    window.api.on('live:blackout', (payload: any) => {
      setBlackout(payload.active)
    })

    window.api.on('live:whiteout', (payload: any) => {
      setWhiteout(payload.active)
    })
  }, [])

  useEffect(() => {
    if (videoRef.current && videoPath) {
      videoRef.current.src = `file://${videoPath}`
      videoRef.current.play().catch(console.error)
    }
  }, [videoPath])

  const fontSize = SIZE_MAP[textStyle.size ?? 'lg'] ?? '4.5rem'
  const justifyContent = POSITION_MAP[textStyle.position ?? 'bottom'] ?? 'flex-end'

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* Layer 0: Background video */}
      <video
        ref={videoRef}
        loop
        muted
        autoPlay
        playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
      />

      {/* Layer 1: Dimmer */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1 }} />

      {/* Layer 2: Lyrics */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent,
        padding: '4rem 6rem',
        opacity: visible ? 1 : 0,
        transition: 'opacity 250ms ease'
      }}>
        {lines.map((line, i) => (
          <p key={i} style={{
            color: textStyle.color ?? '#FFFFFF',
            fontSize,
            fontFamily: textStyle.font === 'rounded' ? 'Nunito, sans-serif'
              : textStyle.font === 'bold-condensed' ? '"Barlow Condensed", sans-serif'
              : 'Inter, sans-serif',
            fontWeight: 700,
            lineHeight: 1.2,
            textAlign: 'center',
            textShadow: textStyle.shadow ? '0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' : 'none',
            WebkitTextStroke: textStyle.stroke ? '1px rgba(0,0,0,0.6)' : 'none',
            marginBottom: '0.5rem'
          }}>
            {line}
          </p>
        ))}
      </div>

      {/* Layer 100: Blackout */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: '#000',
        opacity: blackout ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: 'none'
      }} />

      {/* Layer 101: Whiteout */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 101,
        background: '#fff',
        opacity: whiteout ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: 'none'
      }} />
    </div>
  )
}
