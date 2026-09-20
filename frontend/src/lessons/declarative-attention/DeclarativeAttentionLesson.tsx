import { useCallback, useEffect, useRef, useState } from 'react'
import type { PodSummary } from '../../types'
import { useVoice } from '../../voice/useVoice'
import type { AttentionMode, DeclarativeAttentionPod } from './types'
import { selectedChunkIds, stageReached } from './simulation'
import useLessonPlayback from './useLessonPlayback'
import { askTutor } from './tutor'
import GpuStage from './GpuStage'
import MemoryInspector from './MemoryInspector'
import './lesson.css'

export default function DeclarativeAttentionLesson({ pod, catalogue, onSelect, onSignOut }: {
  pod: DeclarativeAttentionPod; catalogue: PodSummary[]; onSelect: (id: string) => void; onSignOut: () => void
}) {
  const voice = useVoice()
  const voiceEnabled = useRef(true)
  const speech = useRef(voice.speak)
  speech.current = voice.speak
  const speak = useCallback((text: string) => voiceEnabled.current ? speech.current(text) : Promise.resolve(false), [])
  const lesson = useLessonPlayback(pod, speak, voice.stopSpeaking)
  const [question, setQuestion] = useState('')
  const [thinking, setThinking] = useState(false)
  const [muted, setMuted] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])

  const interrupt = () => { request.current?.abort(); setThinking(false); lesson.stop(); voice.stop() }
  const mode = (next: AttentionMode) => {
    interrupt()
    lesson.explore([{ op: 'daMode', args: { mode: next, chunks: lesson.state.focusedChunks } }])
  }
  const toggleChunk = (id: number) => {
    interrupt()
    const existing = lesson.state.mode === 'focus' ? lesson.state.focusedChunks : []
    const chunks = existing.includes(id) ? existing.filter(chunk => chunk !== id) : [...existing, id]
    lesson.explore([{ op: 'daMode', args: { mode: chunks.length ? 'focus' : 'local', chunks } }])
  }
  const ask = async (text: string) => {
    if (!text.trim()) return
    interrupt()
    const controller = new AbortController()
    request.current = controller
    setQuestion('')
    setThinking(true)
    try {
      const response = await askTutor(pod.id, text.trim(), lesson.current.current, controller.signal)
      if (controller.signal.aborted) return
      setThinking(false)
      await lesson.explore(response.commands, response.text)
    } catch (error) {
      if (!controller.signal.aborted) lesson.setCaption(error instanceof Error ? error.message : 'Tutor unavailable.')
    } finally { if (!controller.signal.aborted) setThinking(false) }
  }
  const microphone = async () => {
    if (voice.recording) { voice.stop(); return }
    interrupt()
    const controller = new AbortController()
    request.current = controller
    const transcript = await voice.listen()
    if (controller.signal.aborted) return
    if (transcript) await ask(transcript)
    else lesson.setCaption('No speech captured. You can try again or type your question.')
  }
  const ready = stageReached(lesson.state, 'prefill')
  const selected = selectedChunkIds(lesson.state, pod.scene.params)
  const action = (run: () => void) => { interrupt(); run() }
  return <main className="da-lesson">
    <header className="da-header">
      <a className="da-brand" href="?lesson=gpt2">✦ HOLODECK</a>
      <span className="da-divider" />
      <select aria-label="Choose lesson" value={pod.id} onChange={event => { interrupt(); onSelect(event.target.value) }}>
        {catalogue.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <span className="da-simulation-badge">PROTOCOL SIMULATION</span>
      <button className="da-signout" onClick={() => { interrupt(); onSignOut() }}>Sign out</button>
    </header>
    <section className="da-title-row">
      <div><div className="da-kicker">DECLARATIVE ATTENTION / BYTES ON THE BUS</div>
        <h1>Read less KV. <span>Move no KV.</span></h1>
        <p>Change what attention reads. Watch what stays resident.</p></div>
      <a className="da-paper" href="https://arxiv.org/abs/2609.02737" target="_blank" rel="noreferrer">Read the paper ↗<small>arXiv:2609.02737</small></a>
    </section>
    <section className="da-workspace">
      <div className="da-diagram-panel">
        <div className="da-stage-heading"><span>{lesson.beatIndex < 0 ? 'THE HARDWARE' : `${String(lesson.beatIndex + 1).padStart(2, '0')} / ${pod.narration[lesson.beatIndex].title}`}</span>
          <span className="da-stage-status">{ready ? 'KV RESIDENT' : 'KV EMPTY'} · {lesson.state.mode.toUpperCase()}</span></div>
        <GpuStage state={lesson.state} config={pod.scene.params} event={lesson.event} animate={lesson.animate} onChunk={toggleChunk} />
        <div className="da-legend"><span style={{ color: '#f3aa65' }}>● weights</span><span style={{ color: '#aeb8cb' }}>● scaffold</span><span style={{ color: '#e98772' }}>● context KV</span><span style={{ color: '#77df9b' }}>● response KV</span><span>Packets = KV payload · time is illustrative</span></div>
      </div>
      <MemoryInspector state={lesson.state} config={pod.scene.params} />
    </section>
    <section className="da-experiment" aria-label="Attention experiment">
      <div className="da-mode-buttons">{(['global', 'focus', 'local'] as AttentionMode[]).map(value =>
        <button key={value} disabled={!ready} className={lesson.state.mode === value ? 'selected' : ''} aria-pressed={lesson.state.mode === value} onClick={() => mode(value)}>{value}</button>)}</div>
      <div className="da-chunk-buttons">{pod.scene.params.chunks.map(chunk => <button key={chunk.id} disabled={!ready}
        aria-label={`Toggle ${chunk.label}`} aria-pressed={selected.includes(chunk.id)} style={{ borderColor: selected.includes(chunk.id) ? chunk.color : undefined }} onClick={() => toggleChunk(chunk.id)}>{chunk.label}</button>)}</div>
      <button className="da-primary" disabled={!ready || lesson.animate || lesson.state.events.length >= 128}
        onClick={() => action(() => { lesson.explore([{ op: 'daDecode', args: { text: `Token ${lesson.state.responseTokens + 1}` } }]) })}>Decode one token →</button>
      {!ready && <span className="da-hint">Play the lesson, or jump to Prefill to experiment.</span>}
    </section>
    <nav className="da-chapters" aria-label="Lesson chapters">{pod.narration.map((beat, index) =>
      <button key={beat.id} aria-current={index === lesson.beatIndex ? 'step' : undefined} title={beat.title}
        onClick={() => action(() => { lesson.goTo(index) })}><span>{String(index + 1).padStart(2, '0')}</span>{beat.title}</button>)}</nav>
    <section className="da-narrator">
      <div className="da-caption" aria-live="polite"><span className="da-kicker">{thinking ? 'GROK IS THINKING · YOUR SCENE IS HELD' : 'THE GUIDE'}</span><p>{lesson.caption}</p></div>
      <div className="da-transport">
        <button className="da-primary" onClick={() => lesson.playing ? interrupt() : action(() => { lesson.play() })}>{lesson.playing ? 'Ⅱ Pause' : lesson.beatIndex < 0 ? '▶ Start lesson' : '▶ Continue'}</button>
        <button onClick={() => action(() => { lesson.step() })}>Step →</button>
        <button onClick={() => action(() => { lesson.restart() })}>↺ Restart</button>
        <button onClick={() => { const next = !muted; setMuted(next); voiceEnabled.current = !next; if (next) voice.stopSpeaking() }} aria-pressed={muted}>{muted ? 'Voice off' : 'Voice on'}</button>
        {(thinking || voice.recording) && <button onClick={interrupt}>Cancel</button>}
      </div>
      <form className="da-ask" onSubmit={event => { event.preventDefault(); ask(question) }}>
        <input aria-label="Ask the DA tutor" placeholder='Ask: “Why does local still read some KV?”' value={question} onChange={event => setQuestion(event.target.value)} maxLength={4000} disabled={thinking} />
        <button type="button" aria-label={voice.recording ? 'Stop recording' : 'Ask by voice'} onClick={microphone}>{voice.recording ? '■ Stop mic' : 'Microphone'}</button>
        <button type="submit" disabled={thinking || !question.trim()}>Ask Grok ↗</button>
      </form>
    </section>
    <footer className="da-footnote"><span>PAPER RESULT, NOT THIS SIMULATION</span> Gemma-4-31B: 52.0% fewer attended tokens during decoding · −1.27 percentage points accuracy across 15 tasks. Not a measured GPU speedup.</footer>
  </main>
}
