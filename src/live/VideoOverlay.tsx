import { useEffect, useRef, useState } from 'react'
import SlideView, { SlideTextStyle, DEFAULT_SLIDE_STYLE } from './SlideView'

export default function VideoOverlay() {
  const [lines, setLines] = useState<string[]>([])
  const [textStyle, setTextStyle] = useState<SlideTextStyle>(DEFAULT_SLIDE_STYLE)
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

    // Notify main process that listeners are attached and ready to receive IPC
    window.api.signalReady()

    return () => {
      window.api.off('live:show-section', onShowSection)
      window.api.off('live:set-video', onSetVideo)
      window.api.off('live:blackout', onBlackout)
      window.api.off('live:whiteout', onWhiteout)
      window.api.off('live:transition', onTransition)
    }
  }, [])

  // file:///C:/path/... is required on Windows (three slashes for absolute paths)
  const videoSrc = videoPath ? `file:///${videoPath.replace(/\\/g, '/')}` : null

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: '#000'
    }}>
      <SlideView
        lines={lines}
        textStyle={textStyle}
        videoSrc={videoSrc}
        visible={visible}
        fadeMs={transitionDurationRef.current}
      />

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
