import { useCallback, useEffect, useRef, useState } from 'react'
import type { DACommand, DeclarativeAttentionPod, MemoryState, ReadEvent } from './types'
import { applyCommand, initialState, replayThrough } from './simulation'

export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve()
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}

async function speakOrCancel(speak: () => Promise<boolean>, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false
  return new Promise(resolve => {
    const finish = (spoken = false) => { signal.removeEventListener('abort', cancel); resolve(spoken) }
    const cancel = () => finish(false)
    signal.addEventListener('abort', cancel, { once: true })
    speak().then(finish, () => finish(false))
  })
}

export default function useLessonPlayback(pod: DeclarativeAttentionPod, speak: (text: string) => Promise<boolean>, stopSpeaking: () => void) {
  const [state, setState] = useState(initialState)
  const current = useRef(state)
  const [beatIndex, setBeatIndex] = useState(-1)
  const [caption, setCaption] = useState('A GPU. A long context. Watch what changes—and what stays put.')
  const [playing, setPlaying] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [event, setEvent] = useState<ReadEvent | null>(null)
  const run = useRef(new AbortController())

  const update = (next: MemoryState) => { current.current = next; setState(next) }
  const stop = useCallback(() => {
    run.current.abort()
    stopSpeaking()
    setPlaying(false)
    setAnimate(false)
  }, [stopSpeaking])
  useEffect(() => () => { run.current.abort(); stopSpeaking() }, [stopSpeaking])

  const begin = () => { stop(); run.current = new AbortController(); return run.current.signal }

  async function perform(command: DACommand, signal: AbortSignal) {
    if (signal.aborted) return
    const next = applyCommand(current.current, command, pod.scene.params)
    update(next)
    const read = command.op === 'daDecode' ? next.events[next.events.length - 1] ?? null : null
    setEvent(read)
    const duration = read?.durationMs ?? (command.op === 'daStage' && command.args.stage === 'prefill' ? 2400 : 1700)
    setAnimate(command.op !== 'daMode')
    await wait(command.op === 'daMode' ? 650 : duration, signal)
    if (!signal.aborted) setAnimate(false)
  }

  async function runBeats(start: number, continueAfter: boolean) {
    const signal = begin()
    setPlaying(true)
    // Reconstruct a checkpoint instead of accumulating duplicate tokens on replay.
    update(replayThrough(pod.narration, start - 1, pod.scene.params))
    setEvent(null)
    for (let index = start; index < pod.narration.length; index++) {
      if (signal.aborted) return
      const beat = pod.narration[index]
      setBeatIndex(index)
      setCaption(beat.text)
      for (const command of beat.commands) await perform(command, signal)
      if (signal.aborted) return
      const spoken = await speakOrCancel(() => speak(beat.text), signal)
      await wait(spoken ? beat.hold_ms : Math.max(2500, beat.text.length / 15 * 1000), signal)
      if (!continueAfter) break
    }
    if (!signal.aborted) setPlaying(false)
  }

  async function explore(commands: DACommand[], text?: string) {
    const signal = begin()
    for (const command of commands) await perform(command, signal)
    if (signal.aborted) return
    if (text) { setCaption(text); await speakOrCancel(() => speak(text), signal) }
  }

  return {
    state, current, beatIndex, caption, setCaption, playing, animate, event, stop, explore,
    play: () => runBeats(beatIndex >= pod.narration.length - 1 ? 0 : Math.max(0, beatIndex), true),
    restart: () => runBeats(0, true),
    step: () => runBeats(Math.min(pod.narration.length - 1, beatIndex + 1), false),
    goTo: (index: number) => runBeats(index, false),
  }
}
