import { useState, useEffect, useRef, useCallback } from 'react'
import { TopBar } from './components/TopBar'
import { MediaLibrary } from './components/MediaLibrary'
import { PreviewPanel } from './components/PreviewPanel'
import { Timeline } from './components/Timeline'
import { ExportModal } from './components/ExportModal'
import { useProject, genId } from './hooks/useProject'
import { LibItem, MediaClip, AudioClip } from './lib/types'

// Panel resize
function useResize(initial: number) {
  const [w, setW] = useState(initial)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX, startW = w
    const onMove = (mv: MouseEvent) => setW(Math.min(520, Math.max(160, startW + mv.clientX - startX)))
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [w])
  return { w, onMouseDown }
}

// History (simple snapshot)
function useHistory(state: object, dispatch: Function) {
  const stack = useRef<string[]>([])
  const idx = useRef(-1)
  const snap = useRef('')

  const save = useCallback(() => {
    const s = JSON.stringify(state)
    if (s === snap.current) return
    snap.current = s
    stack.current = stack.current.slice(0, idx.current + 1)
    stack.current.push(s)
    idx.current = stack.current.length - 1
  }, [state])

  const undo = useCallback(() => {
    if (idx.current <= 0) return
    idx.current--
    // We'd need to restore — simplified: just track canUndo
  }, [])

  return { save, undo, canUndo: idx.current > 0 }
}

export default function App() {
  const { state, dispatch, getTotalDuration } = useProject()
  const libStore = useRef<Map<string, LibItem>>(new Map())
  const [libItems, setLibItems] = useState<LibItem[]>([])
  const [activeTab, setActiveTab] = useState<'media' | 'audio'>('media')
  const [showExport, setShowExport] = useState(false)
  const panel = useResize(260)
  const playRef = useRef<{ raf: number; last: number } | null>(null)

  const totalDuration = getTotalDuration()

  // Playback loop
  useEffect(() => {
    if (!state.isPlaying) {
      if (playRef.current) { cancelAnimationFrame(playRef.current.raf); playRef.current = null }
      return
    }
    const loop = (ts: number) => {
      if (!playRef.current) return
      const dt = (ts - playRef.current.last) / 1000
      playRef.current.last = ts
      const next = state.currentTime + dt
      if (next >= totalDuration) {
        dispatch({ type: 'SET_PLAYING', v: false })
        dispatch({ type: 'SET_TIME', t: 0 })
        return
      }
      dispatch({ type: 'SET_TIME', t: next })
      playRef.current.raf = requestAnimationFrame(loop)
    }
    playRef.current = { raf: 0, last: performance.now() }
    playRef.current.raf = requestAnimationFrame(loop)
    return () => { if (playRef.current) cancelAnimationFrame(playRef.current.raf) }
  }, [state.isPlaying])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === ' ') { e.preventDefault(); dispatch({ type: 'SET_PLAYING', v: !state.isPlaying }) }
      if (e.key === 'v' || e.key === 'V') dispatch({ type: 'SET_TOOL', tool: 'select' })
      if (e.key === 'c' || e.key === 'C') dispatch({ type: 'SET_TOOL', tool: 'razor' })
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) dispatch({ type: 'DELETE', id: state.selectedId })
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.isPlaying, state.selectedId])

  // Import media files
  const addMedia = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file)
      const isVid = file.type.startsWith('video/')
      const id = 'lib' + genId()
      if (isVid) {
        const vid = document.createElement('video')
        vid.preload = 'metadata'; vid.muted = true; vid.src = url
        vid.addEventListener('loadedmetadata', () => { vid.currentTime = Math.min(0.5, vid.duration * 0.1) })
        vid.addEventListener('seeked', () => {
          const c = document.createElement('canvas'); c.width = 160; c.height = 90
          c.getContext('2d')!.drawImage(vid, 0, 0, 160, 90)
          const item: LibItem = { id, name: file.name, file, url, type: 'video', duration: vid.duration, thumb: c.toDataURL('image/jpeg', 0.7) }
          libStore.current.set(id, item)
          setLibItems(prev => [...prev, item])
        }, { once: true })
      } else {
        const img = new Image()
        img.onload = () => {
          const item: LibItem = { id, name: file.name, file, url, type: 'image', duration: 5, thumb: url }
          libStore.current.set(id, item)
          setLibItems(prev => [...prev, item])
        }
        img.src = url
      }
    }
  }, [])

  const addAudio = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file)
      const audio = new Audio(); audio.src = url
      audio.addEventListener('loadedmetadata', () => {
        const id = 'lib' + genId()
        const item: LibItem = { id, name: file.name, file, url, type: 'audio', duration: audio.duration, thumb: null }
        libStore.current.set(id, item)
        setLibItems(prev => [...prev, item])
      }, { once: true })
    }
  }, [])

  const addToTimeline = useCallback((item: LibItem, track: 'video' | 'audio', start?: number) => {
    if (track === 'video') {
      const end = start ?? state.videoClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
      const clip: MediaClip = { id: 'clip' + genId(), libId: item.id, name: item.name, url: item.url, thumb: item.thumb, type: item.type as 'image' | 'video', duration: item.duration, start: Math.round(end * 10) / 10, track: 'video', inPoint: 0 }
      dispatch({ type: 'ADD_VIDEO', clip })
    } else {
      const end = start ?? state.audioClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
      const clip: AudioClip = { id: 'clip' + genId(), libId: item.id, name: item.name, url: item.url, duration: item.duration, start: Math.round(end * 10) / 10, track: 'audio', inPoint: 0 }
      dispatch({ type: 'ADD_AUDIO', clip })
    }
  }, [state.videoClips, state.audioClips, dispatch])

  const usedIds = new Set([...state.videoClips.map(c => c.libId), ...state.audioClips.map(c => c.libId)])

  const fmtT = (s: number) => {
    s = Math.max(0, Math.round(s))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const audioForPreview = state.audioClips.map(c => ({ url: c.url, start: c.start, duration: c.duration, inPoint: c.inPoint }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar
        tool={state.tool}
        canSync={state.videoClips.length > 0 && state.audioClips.length > 0}
        duration={fmtT(totalDuration)}
        onTool={t => dispatch({ type: 'SET_TOOL', tool: t })}
        onDelete={() => state.selectedId && dispatch({ type: 'DELETE', id: state.selectedId })}
        onSync={() => dispatch({ type: 'SYNC_TO_AUDIO' })}
        onExport={() => setShowExport(true)}
        onUndo={() => {}}
        canUndo={false}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Library panel */}
        <div style={{ width: panel.w, minWidth: 160, maxWidth: 520, flexShrink: 0, position: 'relative' }}>
          <MediaLibrary
            items={libItems}
            usedIds={usedIds}
            onAddMedia={addMedia}
            onAddAudio={addAudio}
            onClickItem={item => addToTimeline(item, item.type === 'audio' ? 'audio' : 'video')}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          {/* Resize handle */}
          <div onMouseDown={panel.onMouseDown}
            style={{ position: 'absolute', top: 0, right: -4, width: 8, height: '100%', cursor: 'col-resize', zIndex: 10 }}
            className="hover:bg-brand-mid/50 transition-colors" />
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <PreviewPanel
            videoClips={state.videoClips}
            audioUrls={audioForPreview}
            currentTime={state.currentTime}
            isPlaying={state.isPlaying}
            totalDuration={totalDuration}
            onTogglePlay={() => dispatch({ type: 'SET_PLAYING', v: !state.isPlaying })}
            onSeek={t => { dispatch({ type: 'SET_PLAYING', v: false }); dispatch({ type: 'SET_TIME', t }) }}
          />

          <Timeline
            videoClips={state.videoClips}
            audioClips={state.audioClips}
            currentTime={state.currentTime}
            totalDuration={totalDuration}
            selectedId={state.selectedId}
            tool={state.tool}
            zoom={state.zoom}
            libStore={libStore.current}
            onSeek={t => dispatch({ type: 'SET_TIME', t })}
            onSelect={id => dispatch({ type: 'SELECT', id })}
            onMove={(id, start) => dispatch({ type: 'MOVE_CLIP', id, start })}
            onSplit={(id, at) => dispatch({ type: 'SPLIT_CLIP', id, at })}
            onDrop={(item, track, start) => addToTimeline(item, track, start)}
            onZoom={z => dispatch({ type: 'SET_ZOOM', zoom: z })}
          />
        </div>
      </div>

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          videoClips={state.videoClips}
          audioClips={state.audioClips}
          totalDuration={totalDuration}
        />
      )}
    </div>
  )
}
