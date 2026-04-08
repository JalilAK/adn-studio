export type Tool = 'select' | 'razor'

export interface MediaClip {
  id: string
  libId: string
  name: string
  url: string
  thumb: string | null
  type: 'image' | 'video'
  duration: number
  start: number
  track: 'video'
  inPoint: number
}

export interface AudioClip {
  id: string
  libId: string
  name: string
  url: string
  duration: number
  start: number
  track: 'audio'
  inPoint: number
}

export type AnyClip = MediaClip | AudioClip

export interface LibItem {
  id: string
  name: string
  file: File
  url: string
  type: 'image' | 'video' | 'audio'
  duration: number
  thumb: string | null
}

export interface ProjectState {
  videoClips: MediaClip[]
  audioClips: AudioClip[]
  selectedId: string | null
  currentTime: number
  isPlaying: boolean
  tool: Tool
  zoom: number
}
