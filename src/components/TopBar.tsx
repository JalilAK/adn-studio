import { Undo2, Trash2, Scissors, MousePointer2, Zap, Upload, ChevronLeft } from 'lucide-react'
import { Tool } from '../lib/types'

interface Props {
  tool: Tool
  canSync: boolean
  duration: string
  onTool: (t: Tool) => void
  onDelete: () => void
  onSync: () => void
  onExport: () => void
  onUndo: () => void
  canUndo: boolean
}

export function TopBar({ tool, canSync, duration, onTool, onDelete, onSync, onExport, onUndo, canUndo }: Props) {
  return (
    <div className="h-12 flex items-center gap-2 px-3 shrink-0"
      style={{ background: 'linear-gradient(90deg, #242a59, #374493)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>

      <a href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-medium mr-2"
        style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)' }}>
        <ChevronLeft size={14} /> Retour
      </a>

      <span className="text-white font-semibold text-sm tracking-widest mr-2">ADN STUDIO</span>

      <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,.2)' }} />

      <button onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)"
        className="w-8 h-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">
        <Undo2 size={15} />
      </button>

      <button onClick={onDelete} title="Supprimer (Suppr)"
        className="w-8 h-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-all">
        <Trash2 size={15} />
      </button>

      <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,.2)' }} />

      {/* Tools */}
      <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,.08)' }}>
        <button onClick={() => onTool('select')} title="Sélectionner (V)"
          className={`w-7 h-7 flex items-center justify-center rounded transition-all ${tool === 'select' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
          <MousePointer2 size={14} />
        </button>
        <button onClick={() => onTool('razor')} title="Couteau (C)"
          className={`w-7 h-7 flex items-center justify-center rounded transition-all ${tool === 'razor' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
          <Scissors size={14} />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-white/40 text-xs tabular-nums">{duration}</span>

        <button onClick={onSync} disabled={!canSync}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-medium disabled:opacity-30 transition-all hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)' }}>
          <Zap size={13} /> Caler sur l'audio
        </button>

        <button onClick={onExport}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-brand-dark text-xs font-semibold bg-white hover:bg-blue-50 transition-all">
          <Upload size={13} /> Exporter MP4
        </button>
      </div>
    </div>
  )
}
