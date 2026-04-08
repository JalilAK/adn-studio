import { useRef } from 'react'
import { ImagePlus, Music, Plus, Check } from 'lucide-react'
import { LibItem } from '../lib/types'

interface Props {
  items: LibItem[]
  usedIds: Set<string>
  onAddMedia: (files: FileList) => void
  onAddAudio: (files: FileList) => void
  onClickItem: (item: LibItem) => void
  activeTab: 'media' | 'audio'
  onTabChange: (t: 'media' | 'audio') => void
}

export function MediaLibrary({ items, usedIds, onAddMedia, onAddAudio, onClickItem, activeTab, onTabChange }: Props) {
  const mediaRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)

  const mediaItems = items.filter(i => i.type !== 'audio')
  const audioItems = items.filter(i => i.type === 'audio')
  const shown = activeTab === 'media' ? mediaItems : audioItems

  return (
    <div className="flex flex-col h-full" style={{ background: '#1e2347', borderRight: '1px solid rgba(255,255,255,.08)' }}>
      {/* Tabs */}
      <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {(['media', 'audio'] as const).map(tab => (
          <button key={tab} onClick={() => onTabChange(tab)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all ${activeTab === tab ? 'text-white border-b-2 border-white' : 'text-white/40 hover:text-white/70'}`}>
            {tab === 'media' ? 'Photos / Vidéos' : 'Audio'}
          </button>
        ))}
      </div>

      {/* Import button */}
      <div className="px-3 pt-3 shrink-0">
        <input ref={mediaRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={e => e.target.files && onAddMedia(e.target.files)} />
        <input ref={audioRef} type="file" multiple accept="audio/*" className="hidden"
          onChange={e => e.target.files && onAddAudio(e.target.files)} />
        <button onClick={() => activeTab === 'media' ? mediaRef.current?.click() : audioRef.current?.click()}
          className="w-full py-2 rounded-lg text-xs font-medium text-white/50 hover:text-white transition-all flex items-center justify-center gap-2"
          style={{ background: 'rgba(255,255,255,.05)', border: '1.5px dashed rgba(255,255,255,.15)' }}>
          {activeTab === 'media' ? <ImagePlus size={14} /> : <Music size={14} />}
          {activeTab === 'media' ? '+ Importer photos / vidéos' : '+ Importer audio'}
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'media' ? (
          <div className="grid grid-cols-2 gap-2">
            {mediaItems.map(item => {
              const inUse = usedIds.has(item.id)
              return (
                <div key={item.id} onClick={() => onClickItem(item)}
                  className={`relative rounded-lg overflow-hidden cursor-pointer group transition-all ${inUse ? 'ring-2 ring-blue-400' : 'ring-1 ring-white/10 hover:ring-white/30'}`}
                  style={{ background: '#242a59' }}>
                  {item.thumb
                    ? <img src={item.thumb} alt="" className="w-full aspect-video object-cover" />
                    : <div className="w-full aspect-video flex items-center justify-center text-2xl">🎬</div>
                  }
                  <div className="absolute inset-0 bg-brand-mid/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Plus size={20} className="text-white" />
                  </div>
                  {inUse && (
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] text-white" style={{ background: 'rgba(0,0,0,.65)' }}>
                    {formatDur(item.duration)}
                  </div>
                  <div className="px-1.5 py-1" style={{ background: 'rgba(0,0,0,.4)' }}>
                    <p className="text-[9px] text-white/50 truncate">{item.name}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {audioItems.map(item => {
              const inUse = usedIds.has(item.id)
              return (
                <div key={item.id} onClick={() => onClickItem(item)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${inUse ? 'ring-2 ring-blue-400' : 'ring-1 ring-white/10 hover:ring-white/30'}`}
                  style={{ background: 'rgba(255,255,255,.05)' }}>
                  <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: 'rgba(55,68,147,.5)', border: '1px solid rgba(255,255,255,.1)' }}>
                    <Music size={14} className="text-white/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{formatDur(item.duration)}</p>
                  </div>
                  {inUse
                    ? <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0"><Check size={10} className="text-white" /></div>
                    : <Plus size={14} className="text-white/30 shrink-0" />
                  }
                </div>
              )
            })}
          </div>
        )}
        {shown.length === 0 && (
          <p className="text-center text-white/20 text-xs mt-8">Aucun fichier importé</p>
        )}
      </div>
    </div>
  )
}

function formatDur(s: number) {
  s = Math.round(s)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
