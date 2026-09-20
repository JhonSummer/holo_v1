import type { MemoryConfig, MemoryState, ReadEvent } from './types'
import { selectedChunkIds, stageReached } from './simulation'
import PacketFlow, { slotX } from './PacketFlow'

export default function GpuStage({ state, config, event, animate, onChunk }: {
  state: MemoryState; config: MemoryConfig; event: ReadEvent | null; animate: boolean; onChunk: (id: number) => void
}) {
  const resident = stageReached(state, 'prefill')
  const selected = selectedChunkIds(state, config)
  const weights = stageReached(state, 'weights')
  const output = state.stage === 'decode'
  const tag = state.mode === 'focus' ? `<focus magic_chunks="${state.focusedChunks.join(',')}">` : `<${state.mode}>`
  return <svg className="da-stage" viewBox="0 0 1000 470" role="img" aria-label="GPU memory diagram. Masked chunks stay resident; packets show reads.">
    <defs><pattern id="da-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#293646" /></pattern></defs>
    <rect width="1000" height="470" fill="url(#da-grid)" opacity=".45" />
    <rect x="24" y="42" width="610" height="404" rx="16" className="da-gpu-outline" />
    <text x="45" y="72" className="da-svg-heading" fill="#8bd2b3">GPU</text>
    <text x="610" y="72" textAnchor="end" className="da-svg-small">schematic · not hardware telemetry</text>
    {Array.from({ length: 12 }, (_, i) => <g key={i}>
      <rect x={86 + (i % 4) * 126} y={97 + Math.floor(i / 4) * 34} width="110" height="26" rx="4" fill="#322641" stroke="#8766ac" />
      <text x={141 + (i % 4) * 126} y={115 + Math.floor(i / 4) * 34} textAnchor="middle" className="da-svg-small" fill="#d2bde6">SM</text>
    </g>)}
    <text x="325" y="220" textAnchor="middle" className="da-svg-small">COMPUTE · streaming multiprocessors</text>
    <rect x="48" y="238" width="562" height="32" rx="5" fill="#183349" stroke="#4b8bb2" />
    <text x="325" y="259" textAnchor="middle" className="da-svg-label">L2 cache · shared memory path</text>
    <rect x="48" y="285" width="562" height="144" rx="9" fill="#271c28" stroke="#b66073" />
    <rect x="64" y="296" width="530" height="25" rx="4" fill={weights ? '#c88a47' : 'transparent'} stroke="#d59a58" opacity={weights ? .95 : .3} />
    <text x="325" y="313" textAnchor="middle" className="da-svg-small" fill={weights ? '#111c25' : '#aa967e'}>{weights ? 'MODEL WEIGHTS · RESIDENT' : 'WEIGHTS · EMPTY'}</text>
    {[{ id: 0, label: 'SYS', tokens: config.scaffold_tokens, color: '#aeb8cb' }, ...config.chunks].map((chunk, i) => {
      const active = chunk.id === 0 || selected.includes(chunk.id)
      const toggle = () => { if (chunk.id && resident) onChunk(chunk.id) }
      return <g key={chunk.id} className={chunk.id && resident ? 'da-chunk' : ''}
        role={chunk.id ? 'button' : undefined} tabIndex={chunk.id && resident ? 0 : undefined}
        aria-label={chunk.id ? `${chunk.label}: ${resident ? 'resident' : 'empty'}, ${active ? 'read enabled' : 'masked'}. Toggle focus.` : undefined}
        onClick={toggle} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}>
        <rect x={slotX(i) - 6} y="337" width="94" height="54" rx="6" fill={resident ? chunk.color : 'transparent'}
          fillOpacity={active ? .28 : .045} stroke={resident ? chunk.color : '#60566a'} strokeOpacity={active ? 1 : .35} />
        <text x={slotX(i) + 41} y="358" textAnchor="middle" fill={chunk.color} className="da-svg-label" opacity={resident ? 1 : .4}>{chunk.label}</text>
        <text x={slotX(i) + 41} y="378" textAnchor="middle" className="da-svg-small">{resident ? `${chunk.tokens.toLocaleString()} tok` : 'empty seat'}</text>
        {resident && <text x={slotX(i) + 41} y="403" textAnchor="middle" className="da-svg-tiny" fill={active ? '#badfce' : '#b8a4b4'}>{active ? 'READABLE' : 'MASKED · RESIDENT'}</text>}
      </g>
    })}
    <text x="70" y="420" className="da-svg-tiny" fill="#b8a4b4">HBM · KV seats do not move</text>
    <text x="590" y="420" textAnchor="end" className="da-svg-tiny" fill="#77df9b">RESPONSE KV: {state.responseTokens} tok</text>
    <rect x="634" y="273" width="80" height="23" rx="3" fill="#222c35" stroke="#65737d" />
    <text x="674" y="265" textAnchor="middle" className="da-svg-small">PCIe</text>
    <rect x="714" y="42" width="264" height="404" rx="16" fill="#101a23" stroke="#526471" />
    <text x="737" y="73" className="da-svg-heading">HOST</text>
    <text x="955" y="73" textAnchor="end" className="da-svg-small">CPU + RAM</text>
    <text x="738" y="110" className="da-svg-small">{output ? 'MODEL OUTPUT · SCRIPTED EXAMPLE' : stageReached(state, 'request') ? 'THE REQUEST' : 'MODEL CHECKPOINT'}</text>
    {!stageReached(state, 'request') && <g opacity={weights ? .4 : .85}>
      <rect x="738" y="150" width="216" height="105" rx="8" fill="#49352a" stroke="#e5a15e" />
      <text x="846" y="205" textAnchor="middle" className="da-svg-label" fill="#f3bd8a">weights</text>
    </g>}
    {stageReached(state, 'request') && !output && [
      { label: 'SYS + question', color: '#aeb8cb' }, ...config.chunks,
    ].map((chunk, i) => <g key={i} opacity={resident ? .4 : 1}>
      <rect x="738" y={149 + i * 43} width="216" height="32" rx="4" fill={chunk.color} fillOpacity=".16" stroke={chunk.color} />
      <text x="750" y={170 + i * 43} className="da-svg-label" fill={chunk.color}>{i ? `magic chunk ${chunk.label}` : chunk.label}</text>
    </g>)}
    {output && <g>
      <rect x="733" y="136" width="227" height="35" rx="5" fill="#243341" />
      <text x="743" y="158" className="da-svg-code" fill="#f0d58c">{tag}</text>
      {state.events.slice(-6).map((item, i) => <text key={item.id} x="742" y={207 + i * 30} className="da-svg-label" fill={item.mode === 'global' ? '#b5c4d3' : '#88d7ad'}>{item.text.slice(0, 26)}</text>)}
      <text x="739" y="423" className="da-svg-tiny">ONE STEP = ONE SIMULATED TOKEN</text>
    </g>}
    <PacketFlow key={`${state.stage}-${event?.id ?? 0}`} state={state} config={config} event={event} animate={animate} />
  </svg>
}
