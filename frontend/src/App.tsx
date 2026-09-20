import { useCallback, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { usePodStore } from './state/podStore'
import { fetchPods, fetchPod } from './api'
import ModelScene from './scene/ModelScene'
import CameraRig from './scene/CameraRig'
import ValueInspector from './ui/ValueInspector'
import { useVoice } from './voice/useVoice'
import { useSession } from './ai/useSession'
import { useNarration } from './ui/useNarration'
import { HoloMark, MicIcon, SendIcon } from './ui/icons'
import type { SessionUser } from './auth/session'
import type { Pod, PodSummary, TransformerPod } from './types'
import DeclarativeAttentionLesson from './lessons/declarative-attention/DeclarativeAttentionLesson'

interface AppProps { user: SessionUser; onSignOut: () => void }

export default function App(props: AppProps) {
  const [catalogue, setCatalogue] = useState<PodSummary[]>([])
  const [selected, setSelected] = useState(new URLSearchParams(location.search).get('lesson') || 'gpt2')
  const [lesson, setLesson] = useState<Pod | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { fetchPods().then(setCatalogue).catch(() => setError('Could not load lessons. Refresh to retry.')) }, [])
  useEffect(() => {
    let active = true
    setLesson(null)
    setError('')
    fetchPod(selected).then(pod => { if (active) setLesson(pod) })
      .catch(() => { if (active) setError('This lesson could not be loaded. Choose another lesson.') })
    return () => { active = false }
  }, [selected])
  const selectLesson = (id: string) => {
    if (!catalogue.some(pod => pod.id === id)) return
    const url = new URL(location.href)
    url.searchParams.set('lesson', id)
    history.replaceState(null, '', url)
    setSelected(id)
  }
  if (!lesson) return <div style={{ padding: 40 }} role="status">{error || 'Opening the lesson…'}
    {error && catalogue.map(item => <button key={item.id} onClick={() => selectLesson(item.id)}>{item.title}</button>)}
  </div>
  if (lesson.scene.type === 'gpu-memory') {
    return <DeclarativeAttentionLesson key={lesson.id} pod={lesson as import('./lessons/declarative-attention/types').DeclarativeAttentionPod}
      catalogue={catalogue} onSelect={selectLesson} onSignOut={props.onSignOut} />
  }
  return <TransformerApp key={lesson.id} {...props} lesson={lesson as TransformerPod} catalogue={catalogue} onSelect={selectLesson} />
}

function TransformerApp({ user, onSignOut, lesson, catalogue, onSelect }: AppProps & {
  lesson: TransformerPod; catalogue: PodSummary[]; onSelect: (id: string) => void
}) {
  const pods = usePodStore((s) => s.pods)
  const pod = usePodStore((s) => s.pod)
  const playing = usePodStore((s) => s.playing)
  const thinking = usePodStore((s) => s.thinking)
  const captions = usePodStore((s) => s.captions)
  const inputText = usePodStore((s) => s.inputText)

  const [query, setQuery] = useState('')

  const { speak, stopSpeaking, listen, stop, recording, serverVoice } = useVoice()
  const { ask } = useSession(pod?.id ?? null, speak)
  const { play, pause, restart, step } = useNarration(speak, stopSpeaking)

  // The shell chooses the lesson; this component owns only the transformer view.
  useEffect(() => {
    usePodStore.getState().setPods(catalogue)
    usePodStore.getState().setPod(lesson)
  }, [lesson, catalogue])

  const onAsk = useCallback(
    async (text: string) => {
      const q = text.trim()
      if (!q) return
      setQuery('')
      pause()
      await ask(q)
    },
    [ask, pause],
  )

  const onMic = useCallback(async () => {
    if (recording) {
      stop()
      return
    }
    const transcript = await listen()
    if (transcript) await onAsk(transcript)
  }, [recording, listen, stop, onAsk])

  return (
    <div className="app">
      <div className="canvas-wrap">
        <Canvas camera={{ position: [0, 8, 40], fov: 50 }} dpr={[1, 2]}>
          <color attach="background" args={['#05060a']} />
          <fog attach="fog" args={['#05060a', 40, 130]} />
          {pod && <ModelScene params={pod.scene.params} />}
          <CameraRig />
        </Canvas>
      </div>

      {/* top-left: title + pod picker */}
      <div className="hud top-left">
        <div className="panel">
          <div className="title">
            <HoloMark size={18} />
            Holodeck
            <span className="badge">{serverVoice.tts ? 'ElevenLabs' : 'Web Speech'}</span>
          </div>
          <div className="subtitle">{pod ? pod.title : 'Loading…'}</div>
          <div className="pod-list">
            {pods.map((p) => (
              <button
                key={p.id}
                className={`pod-item ${pod?.id === p.id ? 'active' : ''}`}
                onClick={() => onSelect(p.id)}
              >
                {p.title}
              </button>
            ))}
          </div>
          <div className="user-row">
            {user.picture ? (
              <img className="avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar avatar-fallback">{user.name[0]?.toUpperCase()}</span>
            )}
            <span className="user-name">{user.name}</span>
            <button className="linklike" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* top-right: inspector */}
      <div className="hud top-right">
        <div className="panel">
          <ValueInspector />
        </div>
      </div>

      {/* bottom-center: captions + transport + ask */}
      <div className="hud bottom-center">
        {(captions || thinking) && (
          <div className="panel captions">
            {thinking ? <span className="thinking">thinking…</span> : captions}
          </div>
        )}
        <div className="panel controls">
          {playing ? (
            <button onClick={pause}>⏸ Pause</button>
          ) : (
            <button className="primary" onClick={play}>
              ▶ Play
            </button>
          )}
          <button onClick={step}>⏭ Step</button>
          <button onClick={restart}>↺ Restart</button>
          <span className="spacer" />
        </div>
        <div className="panel ask-row">
          <input
            value={query}
            placeholder='Ask: "zoom into layer 5 attention" or "run the model on: the cat sat"'
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAsk(query)}
          />
          <button
            className={`icon-btn mic ${recording ? 'recording' : ''}`}
            title={recording ? 'Stop recording' : 'Ask by voice'}
            aria-label={recording ? 'Stop recording' : 'Ask by voice'}
            onClick={onMic}
          >
            <MicIcon />
          </button>
          <button className="ask-btn" onClick={() => onAsk(query)}>
            Ask
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
