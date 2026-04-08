import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { MediaClip, AudioClip } from '../lib/types'

interface Props {
  onClose: () => void
  videoClips: MediaClip[]
  audioClips: AudioClip[]
  totalDuration: number
}

export function ExportModal({ onClose, videoClips, audioClips, totalDuration }: Props) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'encoding' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const cancelRef = { current: false }

  const setP = (pct: number, label: string) => {
    setProgress(Math.min(100, pct))
    setProgressLabel(label)
  }

  async function fetchToBlobURL(url: string, mime: string) {
    const r = await fetch(url); const buf = await r.arrayBuffer()
    return URL.createObjectURL(new Blob([buf], { type: mime }))
  }

  async function doExport() {
    cancelRef.current = false
    setPhase('loading')
    setP(0, 'Chargement de FFmpeg…')

    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const ff = new FFmpeg()
      ff.on('progress', ({ progress: p }: { progress: number }) => setP(40 + p * 55, `Encodage ${Math.round(p * 100)}%…`))

      setP(5, 'Téléchargement du moteur (~30Mo, une seule fois)…')
      const coreURL = await fetchToBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js', 'text/javascript')
      const wasmURL = await fetchToBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm', 'application/wasm')
      await ff.load({ coreURL, wasmURL })

      setPhase('encoding')
      if (cancelRef.current) return

      const W = 1920, H = 1080
      const sorted = [...videoClips].sort((a, b) => a.start - b.start)
      const concatLines = ['ffconcat version 1.0']

      for (let i = 0; i < sorted.length; i++) {
        if (cancelRef.current) return
        const clip = sorted[i]
        setP(10 + i / sorted.length * 28, `Traitement média ${i + 1}/${sorted.length}…`)

        if (clip.type === 'image') {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = clip.url
          })
          const c = document.createElement('canvas'); c.width = W; c.height = H
          const cx = c.getContext('2d')!
          cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H)
          const s = Math.min(W / img.naturalWidth, H / img.naturalHeight)
          cx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
          const bytes = await new Promise<Uint8Array>(res => c.toBlob(async b => res(new Uint8Array(await b!.arrayBuffer())), 'image/jpeg', 0.92))
          await ff.writeFile(`v${i}.jpg`, bytes)
          concatLines.push(`file 'v${i}.jpg'\nduration ${clip.duration.toFixed(3)}`)
        } else {
          const r = await fetch(clip.url); const data = new Uint8Array(await r.arrayBuffer())
          await ff.writeFile(`vsrc${i}.mp4`, data)
          const ip = clip.inPoint || 0
          await ff.exec(['-ss', ip.toFixed(3), '-i', `vsrc${i}.mp4`, '-t', clip.duration.toFixed(3), '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', `v${i}.mp4`])
          concatLines.push(`file 'v${i}.mp4'\nduration ${clip.duration.toFixed(3)}`)
        }
      }
      if (sorted.length > 0) {
        const last = sorted[sorted.length - 1]
        concatLines.push(`file 'v${sorted.length - 1}.${last.type === 'image' ? 'jpg' : 'mp4'}'`)
      }
      await ff.writeFile('video_concat.txt', concatLines.join('\n'))

      setP(40, 'Encodage vidéo H.264…')
      const hasAudio = audioClips.length > 0
      const videoOut = hasAudio ? 'video_only.mp4' : 'output.mp4'
      await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'video_concat.txt',
        '-vf', `fps=25,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', videoOut])

      if (hasAudio) {
        setP(93, 'Intégration audio…')
        const sa = [...audioClips].sort((a, b) => a.start - b.start)
        const audioConcat = ['ffconcat version 1.0']
        for (let i = 0; i < sa.length; i++) {
          const r = await fetch(sa[i].url); const data = new Uint8Array(await r.arrayBuffer())
          const ip = sa[i].inPoint || 0
          await ff.writeFile(`asrc${i}.bin`, data)
          await ff.exec(['-ss', ip.toFixed(3), '-i', `asrc${i}.bin`, '-t', sa[i].duration.toFixed(3), '-c:a', 'aac', '-b:a', '192k', `a${i}.aac`])
          audioConcat.push(`file 'a${i}.aac'`)
        }
        await ff.writeFile('audio_concat.txt', audioConcat.join('\n'))
        await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'audio_concat.txt', '-c:a', 'copy', 'audio_merged.aac'])
        await ff.exec(['-i', 'video_only.mp4', '-i', 'audio_merged.aac', '-c:v', 'copy', '-c:a', 'copy', '-shortest', 'output.mp4'])
      }

      setP(99, 'Finalisation…')
      const out = await ff.readFile('output.mp4')
      const blob = new Blob([out instanceof Uint8Array ? out : new TextEncoder().encode(out as string)], { type: 'video/mp4' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = 'diaporama_adn_funeraire.mp4'; a.click()
      setPhase('done'); setP(100, '')

    } catch (err: unknown) {
      if (!cancelRef.current) {
        setPhase('error')
        setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.75)' }}>
      <div className="w-96 rounded-2xl p-8 text-center relative" style={{ background: '#1e2347', border: '1px solid rgba(255,255,255,.12)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"><X size={18} /></button>

        {phase === 'idle' && <>
          <div className="text-4xl mb-4">🎬</div>
          <h2 className="text-lg font-semibold mb-2">Exporter en MP4</h2>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            Votre diaporama sera encodé en H.264 1080p.<br />
            Durée : <strong className="text-white">{Math.round(totalDuration)}s</strong> · {videoClips.length} médias · {audioClips.length} piste(s) audio
          </p>
          <button onClick={doExport} className="w-full py-3 rounded-xl font-semibold text-brand-dark bg-white hover:bg-blue-50 transition-all">
            Lancer l'export
          </button>
        </>}

        {(phase === 'loading' || phase === 'encoding') && <>
          <h2 className="text-lg font-semibold mb-2">{phase === 'loading' ? 'Chargement…' : 'Encodage en cours…'}</h2>
          <p className="text-sm text-white/50 mb-5">{progressLabel}</p>
          <div className="h-2 rounded-full mb-2 overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #374493, #4a8fff)' }} />
          </div>
          <p className="text-xs text-white/30">{Math.round(progress)}%</p>
          <button onClick={() => { cancelRef.current = true; setPhase('idle') }} className="mt-5 text-xs text-white/30 hover:text-white/60 transition-colors">Annuler</button>
        </>}

        {phase === 'done' && <>
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-lg font-semibold mb-2">Export terminé !</h2>
          <p className="text-sm text-white/50 mb-6">Le fichier MP4 a été téléchargé dans vos téléchargements.</p>
          <button onClick={onClose} className="w-full py-3 rounded-xl font-semibold text-brand-dark bg-white hover:bg-blue-50 transition-all">Fermer</button>
        </>}

        {phase === 'error' && <>
          <AlertCircle size={32} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Erreur d'export</h2>
          <p className="text-xs text-red-400/80 mb-5 font-mono bg-red-500/10 p-3 rounded-lg break-words">{errorMsg}</p>
          <button onClick={() => setPhase('idle')} className="w-full py-3 rounded-xl font-semibold text-white" style={{ background: 'rgba(255,255,255,.1)' }}>Réessayer</button>
        </>}
      </div>
    </div>
  )
}
