import { useRef, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { MediaClip, AudioClip, Tool } from '../lib/types'
import { LibItem } from '../lib/types'

interface Props {
  videoClips: MediaClip[]
  audioClips: AudioClip[]
  currentTime: number
  totalDuration: number
  selectedId: string | null
  tool: Tool
  zoom: number
  libStore: Map<string, LibItem>
  onSeek: (t: number) => void
  onSelect: (id: string | null) => void
  onMove: (id: string, start: number) => void
  onSplit: (id: string, at: number) => void
  onDrop: (item: LibItem, track: 'video' | 'audio', start: number) => void
  onZoom: (z: number) => void
}

function fmt(s: number) {
  s = Math.max(0, Math.round(s))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const TRACK_H = 52

export function Timeline({ videoClips, audioClips, currentTime, totalDuration, selectedId, tool, zoom, libStore, onSeek, onSelect, onMove, onSplit, onDrop, onZoom }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [razorX, setRazorX] = useState<number | null>(null)
  const [dropTrack, setDropTrack] = useState<'video' | 'audio' | null>(null)

  const total = Math.max(totalDuration + 5, 30)
  const contentW = Math.ceil(total * zoom) + 400

  const xToTime = useCallback((clientX: number) => {
    const rect = scrollRef.current!.getBoundingClientRect()
    return Math.max(0, (clientX - rect.left + scrollRef.current!.scrollLeft) / zoom)
  }, [zoom])

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.tl-clip')) return
    onSeek(xToTime(e.clientX))
    onSelect(null)
  }, [xToTime, onSeek, onSelect])

  // Ruler marks
  const step = zoom >= 300 ? 1 : zoom >= 80 ? 5 : zoom >= 30 ? 10 : 30
  const marks = []
  for (let t = 0; t <= total + step; t += step) {
    marks.push(t)
  }

  const renderClip = (clip: MediaClip | AudioClip, track: 'video' | 'audio') => {
    const isSelected = clip.id === selectedId
    const isAudio = track === 'audio'
    const w = Math.max(30, clip.duration * zoom)

    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      if (tool === 'razor') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const x = e.clientX - rect.left
        const splitAt = clip.start + x / zoom
        onSplit(clip.id, splitAt)
        return
      }

      onSelect(clip.id)
      const ox = e.clientX
      const os = clip.start

      const onMove_ = (mv: MouseEvent) => {
        const newStart = Math.max(0, Math.round((os + (mv.clientX - ox) / zoom) * 10) / 10)
        onMove(clip.id, newStart)
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove_)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove_)
      document.addEventListener('mouseup', onUp)
    }

    return (
      <div key={clip.id} className={`tl-clip absolute top-1.5 rounded-md overflow-hidden flex items-center border-2 transition-none ${isSelected ? 'border-white' : 'border-transparent hover:border-white/30'} ${tool === 'razor' ? 'cursor-crosshair' : 'cursor-grab'}`}
        style={{
          left: clip.start * zoom,
          width: w,
          height: TRACK_H - 12,
          background: isAudio ? 'linear-gradient(135deg,#163325dd,#235e3add)' : 'linear-gradient(135deg,#242a59dd,#374493dd)'
        }}
        onMouseDown={handleMouseDown}
        onClick={e => { e.stopPropagation(); if (tool === 'select') onSelect(clip.id) }}>

        <div className="flex items-center gap-1.5 px-2 w-full overflow-hidden h-full">
          {isAudio ? (
            <div className="flex items-end gap-px flex-1 overflow-hidden h-5">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="w-0.5 rounded-full shrink-0" style={{ height: `${25 + Math.sin(i * 0.7) * 40 + Math.sin(i * 1.5) * 25}%`, background: 'rgba(80,210,120,.7)' }} />
              ))}
            </div>
          ) : (
            (clip as MediaClip).thumb
              ? <img src={(clip as MediaClip).thumb!} className="w-7 h-6 object-cover rounded shrink-0" alt="" />
              : <span className="text-base shrink-0">🎬</span>
          )}
          {w > 60 && <span className="text-[10px] text-white/80 font-medium truncate">{clip.name}</span>}
          {w > 100 && <span className="text-[9px] text-white/40 ml-auto shrink-0">{fmt(clip.duration)}</span>}
        </div>
      </div>
    )
  }

  const handleDragOver = (e: React.DragEvent, track: 'video' | 'audio') => {
    e.preventDefault()
    setDropTrack(track)
  }
  const handleDrop = (e: React.DragEvent, track: 'video' | 'audio') => {
    e.preventDefault()
    setDropTrack(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id || !libStore.has(id)) return
    const item = libStore.get(id)!
    if (track === 'audio' && item.type !== 'audio') return
    if (track === 'video' && item.type === 'audio') return
    onDrop(item, track, xToTime(e.clientX))
  }

  return (
    <div className="flex flex-col shrink-0" style={{ height: 200, background: '#1a1f3a', borderTop: '1px solid rgba(255,255,255,.08)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 shrink-0" style={{ height: 34, background: '#161b33', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <span className="text-[10px] text-white/30 uppercase tracking-widest">Timeline</span>
        <div className="flex items-center gap-2 ml-2">
          <button onClick={() => onZoom(Math.max(10, zoom - (zoom > 100 ? 50 : 10)))} className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/10 transition-all"><ZoomOut size={12} /></button>
          <span className="text-[10px] text-white/25 w-14 text-center tabular-nums">{zoom}px/s</span>
          <button onClick={() => onZoom(Math.min(3000, zoom + (zoom >= 100 ? 50 : 10)))} className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/10 transition-all"><ZoomIn size={12} /></button>
        </div>
        <span className="ml-auto text-[10px] text-white/20">Clic = placer la tête · Glisser clip = déplacer · Outil ✂ = couper</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Labels */}
        <div className="flex flex-col shrink-0" style={{ width: 76, borderRight: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ height: 22, borderBottom: '1px solid rgba(255,255,255,.06)' }} />
          <div className="flex items-center px-2 gap-1.5 text-[10px] text-white/30 uppercase tracking-widest" style={{ height: TRACK_H, borderBottom: '1px solid rgba(255,255,255,.05)' }}>🎞 Vidéo</div>
          <div className="flex items-center px-2 gap-1.5 text-[10px] text-white/30 uppercase tracking-widest" style={{ height: TRACK_H }}>🎵 Audio</div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden" onClick={handleTimelineClick}
          style={{ cursor: tool === 'razor' ? 'crosshair' : 'crosshair' }}
          onMouseMove={e => {
            if (tool === 'razor') {
              const rect = scrollRef.current!.getBoundingClientRect()
              setRazorX(e.clientX - rect.left + scrollRef.current!.scrollLeft)
            } else setRazorX(null)
          }}
          onMouseLeave={() => setRazorX(null)}>

          <div className="relative" style={{ width: contentW, height: '100%' }}>
            {/* Ruler */}
            <div className="absolute top-0 left-0 right-0" style={{ height: 22, background: '#161b33', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              {marks.map(t => (
                <div key={t} className="absolute flex flex-col items-center" style={{ left: t * zoom }}>
                  <div className="w-px bg-white/15" style={{ height: 6, marginTop: 16 }} />
                  <span className="text-[9px] text-white/25 -translate-x-1/2 absolute" style={{ bottom: 2 }}>{fmt(t)}</span>
                </div>
              ))}
            </div>

            {/* Video track */}
            <div className="absolute left-0 right-0" style={{ top: 22, height: TRACK_H, borderBottom: '1px solid rgba(255,255,255,.05)' }}
              onDragOver={e => handleDragOver(e, 'video')}
              onDragLeave={() => setDropTrack(null)}
              onDrop={e => handleDrop(e, 'video')}>
              <div className="absolute inset-0" style={{ background: dropTrack === 'video' ? 'rgba(55,68,147,.15)' : undefined, border: dropTrack === 'video' ? '2px dashed rgba(255,255,255,.3)' : 'none', borderRadius: 6 }} />
              {videoClips.map(c => renderClip(c, 'video'))}
            </div>

            {/* Audio track */}
            <div className="absolute left-0 right-0" style={{ top: 22 + TRACK_H, height: TRACK_H }}
              onDragOver={e => handleDragOver(e, 'audio')}
              onDragLeave={() => setDropTrack(null)}
              onDrop={e => handleDrop(e, 'audio')}>
              <div className="absolute inset-0" style={{ background: dropTrack === 'audio' ? 'rgba(35,94,58,.2)' : undefined, border: dropTrack === 'audio' ? '2px dashed rgba(80,210,120,.3)' : 'none', borderRadius: 6 }} />
              {audioClips.map(c => renderClip(c, 'audio'))}
            </div>

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 pointer-events-none z-20" style={{ left: currentTime * zoom, width: 2, background: '#fff' }}>
              <div className="w-2.5 h-2.5 rounded-full bg-white absolute top-0 left-1/2 -translate-x-1/2" />
            </div>

            {/* Razor line */}
            {tool === 'razor' && razorX !== null && (
              <div className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: razorX, width: 2, background: 'rgba(255,80,80,.8)', boxShadow: '0 0 6px rgba(255,80,80,.5)' }}>
                <span className="absolute text-xs" style={{ top: 28, left: 4, color: 'rgba(255,80,80,.9)' }}>✂</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
