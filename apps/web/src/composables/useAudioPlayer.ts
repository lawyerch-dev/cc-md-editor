/**
 * 全局音频播放器单例 — 类似 Folo 的 AudioPlayer atom。
 * 所有组件共享同一个 <audio> 实例，避免重复创建。
 */
import { reactive, ref, toRefs } from 'vue'

interface AudioState {
  src: string
  title: string
  sourceTitle: string
  articleId: string | null
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  playbackRate: number
  visible: boolean
}

const audioEl = ref<HTMLAudioElement | null>(null)

const state = reactive<AudioState>({
  src: '',
  title: '',
  sourceTitle: '',
  articleId: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playbackRate: 1,
  visible: false,
})

let initialized = false

function ensureAudio() {
  if (initialized)
    return
  initialized = true
  const el = new Audio()
  el.volume = state.volume
  el.playbackRate = state.playbackRate
  el.addEventListener('timeupdate', () => { state.currentTime = el.currentTime })
  el.addEventListener('loadedmetadata', () => { state.duration = el.duration })
  el.addEventListener('ended', () => { state.playing = false })
  el.addEventListener('play', () => { state.playing = true })
  el.addEventListener('pause', () => { state.playing = false })
  audioEl.value = el
}

export function useAudioPlayer() {
  function play(src: string, opts?: { title?: string, sourceTitle?: string, articleId?: string }) {
    ensureAudio()
    const el = audioEl.value!
    const isNew = state.src !== src
    state.src = src
    state.title = opts?.title || ''
    state.sourceTitle = opts?.sourceTitle || ''
    state.articleId = opts?.articleId || null
    state.visible = true
    if (isNew) {
      el.src = src
      el.load()
    }
    void el.play()
  }

  function togglePlay() {
    const el = audioEl.value
    if (!el)
      return
    if (state.playing)
      el.pause()
    else void el.play()
  }

  function seek(time: number) {
    const el = audioEl.value
    if (el)
      el.currentTime = time
  }

  function seekRelative(delta: number) {
    const el = audioEl.value
    if (el)
      el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + delta))
  }

  function setVolume(v: number) {
    state.volume = Math.max(0, Math.min(1, v))
    if (audioEl.value)
      audioEl.value.volume = state.volume
  }

  function setPlaybackRate(rate: number) {
    state.playbackRate = rate
    if (audioEl.value)
      audioEl.value.playbackRate = rate
  }

  function close() {
    const el = audioEl.value
    if (el) {
      el.pause()
      el.src = ''
    }
    state.playing = false
    state.currentTime = 0
    state.duration = 0
    state.visible = false
    state.src = ''
    state.articleId = null
  }

  function isPlaying(src: string) {
    return state.src === src && state.playing
  }

  return {
    ...toRefs(state),
    play,
    togglePlay,
    seek,
    seekRelative,
    setVolume,
    setPlaybackRate,
    close,
    isPlaying,
  }
}
