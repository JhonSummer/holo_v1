import type { DACommand, MemoryState } from './types'

/** Browser transport only. A cancelled/old request never mutates a new scene. */
export function askTutor(podId: string, query: string, scene: MemoryState, signal: AbortSignal): Promise<{ text: string; commands: DACommand[] }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Cancelled')); return }
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/session/${encodeURIComponent(podId)}`)
    let text = ''
    let commands: DACommand[] = []
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      ws.close()
      if (error) reject(error)
      else resolve({ text, commands })
    }
    const cancel = () => finish(new Error('Cancelled'))
    const timer = setTimeout(() => finish(new Error('The tutor timed out. The lesson still works.')), 100000)
    signal.addEventListener('abort', cancel, { once: true })
    ws.onopen = () => ws.send(JSON.stringify({ query, scene: { ...scene, events: scene.events.slice(-8) } }))
    ws.onerror = () => finish(new Error('Could not connect to the tutor. The lesson still works.'))
    ws.onclose = () => { if (!settled) finish(new Error('Tutor connection closed. Try again.')) }
    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'narration') text += message.text
        if (message.type === 'commands') commands = message.commands
        if (message.type === 'done') finish()
        if (message.type === 'error') finish(new Error('The tutor could not complete this request.'))
      } catch { finish(new Error('Invalid tutor response.')) }
    }
  })
}
