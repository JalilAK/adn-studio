import { useReducer, useCallback } from 'react'
import { ProjectState, MediaClip, AudioClip, Tool } from '../lib/types'

type Action =
  | { type: 'ADD_VIDEO'; clip: MediaClip }
  | { type: 'ADD_AUDIO'; clip: AudioClip }
  | { type: 'SET_VIDEO_CLIPS'; clips: MediaClip[] }
  | { type: 'SET_AUDIO_CLIPS'; clips: AudioClip[] }
  | { type: 'DELETE'; id: string }
  | { type: 'SELECT'; id: string | null }
  | { type: 'SET_TIME'; t: number }
  | { type: 'SET_PLAYING'; v: boolean }
  | { type: 'SET_TOOL'; tool: Tool }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'MOVE_CLIP'; id: string; start: number }
  | { type: 'SPLIT_CLIP'; id: string; at: number }
  | { type: 'SYNC_TO_AUDIO' }

const initial: ProjectState = {
  videoClips: [],
  audioClips: [],
  selectedId: null,
  currentTime: 0,
  isPlaying: false,
  tool: 'select',
  zoom: 80
}

let nextId = 1
export const genId = () => 'clip' + nextId++

function totalDuration(state: ProjectState) {
  const allClips = [...state.videoClips, ...state.audioClips]
  return allClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
}

function reducer(state: ProjectState, action: Action): ProjectState {
  switch (action.type) {
    case 'ADD_VIDEO':
      return { ...state, videoClips: [...state.videoClips, action.clip] }
    case 'ADD_AUDIO':
      return { ...state, audioClips: [...state.audioClips, action.clip] }
    case 'SET_VIDEO_CLIPS':
      return { ...state, videoClips: action.clips }
    case 'SET_AUDIO_CLIPS':
      return { ...state, audioClips: action.clips }
    case 'DELETE': {
      return {
        ...state,
        videoClips: state.videoClips.filter(c => c.id !== action.id),
        audioClips: state.audioClips.filter(c => c.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId
      }
    }
    case 'SELECT':
      return { ...state, selectedId: action.id }
    case 'SET_TIME':
      return { ...state, currentTime: Math.max(0, action.t) }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.v }
    case 'SET_TOOL':
      return { ...state, tool: action.tool, selectedId: null }
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom }
    case 'MOVE_CLIP': {
      const start = Math.max(0, Math.round(action.start * 10) / 10)
      return {
        ...state,
        videoClips: state.videoClips.map(c => c.id === action.id ? { ...c, start } : c),
        audioClips: state.audioClips.map(c => c.id === action.id ? { ...c, start } : c)
      }
    }
    case 'SPLIT_CLIP': {
      const MIN = 0.1
      // Find in video
      const vc = state.videoClips.find(c => c.id === action.id)
      if (vc) {
        const splitT = action.at
        if (splitT <= vc.start + MIN || splitT >= vc.start + vc.duration - MIN) return state
        const leftDur = Math.round((splitT - vc.start) * 1000) / 1000
        const rightDur = Math.round((vc.duration - leftDur) * 1000) / 1000
        const right: MediaClip = { ...vc, id: genId(), duration: rightDur, start: splitT, inPoint: (vc.inPoint || 0) + leftDur }
        return {
          ...state,
          videoClips: [...state.videoClips.map(c => c.id === action.id ? { ...c, duration: leftDur } : c), right]
        }
      }
      const ac = state.audioClips.find(c => c.id === action.id)
      if (ac) {
        const splitT = action.at
        if (splitT <= ac.start + MIN || splitT >= ac.start + ac.duration - MIN) return state
        const leftDur = Math.round((splitT - ac.start) * 1000) / 1000
        const rightDur = Math.round((ac.duration - leftDur) * 1000) / 1000
        const right: AudioClip = { ...ac, id: genId(), duration: rightDur, start: splitT, inPoint: (ac.inPoint || 0) + leftDur }
        return {
          ...state,
          audioClips: [...state.audioClips.map(c => c.id === action.id ? { ...c, duration: leftDur } : c), right]
        }
      }
      return state
    }
    case 'SYNC_TO_AUDIO': {
      const totalAudio = state.audioClips.reduce((s, c) => s + c.duration, 0)
      if (!totalAudio || !state.videoClips.length) return state
      const imgClips = state.videoClips.filter(c => c.type === 'image')
      const fixedDur = state.videoClips.filter(c => c.type === 'video').reduce((s, c) => s + c.duration, 0)
      const remaining = totalAudio - fixedDur
      if (!imgClips.length || remaining <= 0) return state
      const per = Math.round(remaining / imgClips.length * 10) / 10
      const sorted = [...state.videoClips].sort((a, b) => a.start - b.start)
      let cur = 0
      const newClips = sorted.map(c => {
        const dur = c.type === 'image' ? per : c.duration
        const clip = { ...c, duration: dur, start: Math.round(cur * 10) / 10 }
        cur += dur
        return clip
      })
      let aCur = 0
      const newAudio = [...state.audioClips].sort((a, b) => a.start - b.start).map(c => {
        const clip = { ...c, start: Math.round(aCur * 10) / 10 }
        aCur += c.duration
        return clip
      })
      return { ...state, videoClips: newClips, audioClips: newAudio }
    }
    default:
      return state
  }
}

export function useProject() {
  const [state, dispatch] = useReducer(reducer, initial)

  const getTotalDuration = useCallback(() => totalDuration(state), [state])

  return { state, dispatch, getTotalDuration }
}
