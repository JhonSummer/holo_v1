import type { MemoryConfig, MemoryState, ReadEvent } from './types'

const scaffoldColor = '#aeb8cb'
export const slotX = (index: number) => 74 + index * 108

/** A bounded pool of SVG packets: packet count follows tokens, not frame rate. */
export default function PacketFlow({ state, config, event, animate }: {
  state: MemoryState; config: MemoryConfig; event: ReadEvent | null; animate: boolean
}) {
  if (!animate) return null
  const paths: { path: string; color: string; count: number }[] = []
  let duration = 1.6
  if (event) {
    duration = event.durationMs / 1000
    const sources = [{ x: slotX(0), tokens: config.scaffold_tokens, color: scaffoldColor },
      ...config.chunks.filter(c => event.chunkIds.includes(c.id)).map(c => ({
        x: slotX(config.chunks.indexOf(c) + 1), tokens: c.tokens, color: c.color,
      })),
      ...(event.responseTokens > 0 ? [{ x: 325, tokens: event.responseTokens, color: '#77df9b' }] : [])]
    sources.forEach(source => paths.push({ path: `M ${source.x} 338 L ${source.x} 255 L 310 180`, color: source.color,
      count: Math.max(1, Math.round(source.tokens / 256)) }))
    // The new response KV is written only after the read/compute phase.
    paths.push({ path: 'M 310 180 L 310 255 L 325 413', color: '#77df9b', count: 1 })
  } else if (state.stage === 'weights') {
    paths.push({ path: 'M 830 215 L 665 285 L 310 305', color: '#f3aa65', count: 14 })
  } else if (state.stage === 'prefill') {
    [scaffoldColor, ...config.chunks.map(c => c.color)].forEach((color, i) => {
      paths.push({ path: `M 815 ${180 + i * 30} L 665 285 L 310 255 L 310 180`, color, count: i ? 6 : 2 })
      paths.push({ path: `M 310 180 L 310 255 L ${slotX(i)} 352`, color, count: i ? 6 : 2 })
    })
  }
  return <g className="da-packets" aria-hidden="true">
    {paths.flatMap((route, routeIndex) => Array.from({ length: route.count }, (_, i) => (
      <rect key={`${routeIndex}-${i}`} x={-3} y={-3} width={6} height={6} rx={1} fill={route.color} opacity={0}>
        <animateMotion path={route.path} dur={`${duration * .65}s`} begin={`${i * duration * .3 / route.count}s`} fill="freeze" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.9;1"
          dur={`${duration * .65}s`} begin={`${i * duration * .3 / route.count}s`} fill="freeze" />
      </rect>
    )))}
  </g>
}
