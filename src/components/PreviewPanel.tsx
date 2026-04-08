import { useEffect, useRef, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, ChevronFirst } from 'lucide-react'
import { MediaClip } from '../lib/types'

interface Props {
  videoClips: MediaClip[]
  audioUrls: { url: string; start: number; duration: number; inPoint: number }[]
  currentTime: number
  isPlaying: boolean
  totalDuration: number
  onTogglePlay: () => void
  onSeek: (t: number) => void
}

function fmt(s: number) {
  s = Math.max(0, Math.round(s))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function PreviewPanel({ videoClips, audioUrls, currentTime, isPlaying, totalDuration, onTogglePlay, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map())
  const audioRefs = useRef<HTMLAudioElement[]>([])

  // Sync audio playback
  useEffect(() => {
    // Clean up old audios
    audioRefs.current.forEach(a => { a.pause(); a.src = '' })
    audioRefs.current = []

    if (!isPlaying) return

    audioUrls.forEach(({ url, start, duration, inPoint }) => {
      const el = new Audio(url)
      el.currentTime = inPoint + Math.max(0, currentTime - start)
      const delay = Math.max(0, start - currentTime) * 1000
      const stop = () => { el.pause() }
      el.addEventListener('timeupdate', () => {
        if (el.currentTime >= inPoint + duration) el.pause()
      })
      const t = setTimeout(() => { if (isPlaying) el.play().catch(() => {}) }, delay)
      audioRefs.current.push(el)
      return () => { clearTimeout(t); el.pause() }
    })

    return () => {
      audioRefs.current.forEach(a => { a.pause(); a.src = '' })
    }
  }, [isPlaying, currentTime])

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    ctx.fillStyle = '#0a0d1e'
    ctx.fillRect(0, 0, W, H)

    const active = videoClips.filter(c => c.start <= currentTime && c.start + c.duration > currentTime)
    if (!active.length) {
      ctx.fillStyle = 'rgba(255,255,255,.1)'
      ctx.font = '14px DM Sans, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Glissez des médias sur la timeline', W / 2, H / 2)
      return
    }

    const clip = active[active.length - 1]
    if (clip.type === 'image' && clip.url) {
      let img = imgCache.current.get(clip.url)
      if (!img) {
        img = new Image()
        img.onload = () => { imgCache.current.set(clip.url, img!); draw() }
        img.src = clip.url
        imgCache.current.set(clip.url, img)
        return
      }
      if (img.complete && img.naturalWidth > 0) {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, W, H)
        const s = Math.min(W / img.naturalWidth, H / img.naturalHeight)
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
      }
    } else {
      ctx.fillStyle = '#0d1428'
      ctx.fillRect(0, 0, W, H)
      if (clip.thumb) {
        let img = imgCache.current.get(clip.thumb)
        if (!img) {
          img = new Image(); img.src = clip.thumb
          img.onload = () => { imgCache.current.set(clip.thumb!, img!); draw() }
          imgCache.current.set(clip.thumb, img)
        }
        if (img.complete && img.naturalWidth > 0) {
          ctx.globalAlpha = 0.5
          const s = Math.min(W / img.naturalWidth, H / img.naturalHeight)
          ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
          ctx.globalAlpha = 1
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,.15)'
      ctx.font = '36px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🎬', W / 2, H / 2)
      ctx.fillStyle = 'rgba(255,255,255,.4)'
      ctx.font = '12px DM Sans, sans-serif'
      ctx.fillText(clip.name, W / 2, H / 2 + 40)
    }
  }, [videoClips, currentTime])

  useEffect(() => { draw() }, [draw])

  // Resize canvas
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const el = containerRef.current
      if (!el || !canvasRef.current) return
      const ratio = 16 / 9
      let w = el.clientWidth - 32, h = w / ratio
      if (h > el.clientHeight - 32) { h = el.clientHeight - 32; w = h * ratio }
      canvasRef.current.width = Math.floor(w)
      canvasRef.current.height = Math.floor(h)
      draw()
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [draw])

  const pct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: '#0f1228' }}>
      {/* Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center min-h-0 p-4">
        <canvas ref={canvasRef}
          className="rounded shadow-2xl"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,.1)' }} />
      </div>

      {/* Controls */}
      <div className="shrink-0 px-4 pb-3 pt-2" style={{ background: '#1e2347', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        {/* Progress bar */}
        <div className="relative h-1.5 rounded-full mb-3 cursor-pointer group" style={{ background: 'rgba(255,255,255,.1)' }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            onSeek((e.clientX - rect.left) / rect.width * totalDuration)
          }}>
          <div className="absolute left-0 top-0 h-full rounded-full transition-none"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #374493, #4a8fff)' }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity -ml-1.5"
            style={{ left: `${pct}%` }} />
        </div>

        <div className="flex items-center justify-center gap-3">
          <span className="text-white/40 text-xs tabular-nums w-10">{fmt(currentTime)}</span>
          <button onClick={() => onSeek(0)} className="text-white/50 hover:text-white transition-colors"><ChevronFirst size={16} /></button>
          <button onClick={() => onSeek(Math.max(0, currentTime - 5))} className="text-white/50 hover:text-white transition-colors"><SkipBack size={16} /></button>
          <button onClick={onTogglePlay}
            className="w-9 h-9 rounded-full flex items-center justify-center text-brand-dark font-bold transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #374493, #4a5bb5)', boxShadow: '0 2px 12px rgba(55,68,147,.5)' }}>
            {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
          </button>
          <button onClick={() => onSeek(Math.min(totalDuration, currentTime + 5))} className="text-white/50 hover:text-white transition-colors"><SkipForward size={16} /></button>
          <span className="text-white/40 text-xs tabular-nums w-10 text-right">{fmt(totalDuration)}</span>
        </div>
      </div>
    </div>
  )
}
