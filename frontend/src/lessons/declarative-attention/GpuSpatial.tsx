import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { MemoryConfig, MemoryState, VisualCue } from './types'
import { selectedChunkIds, stageReached } from './simulation'
import {
  COLORS,
  packetRoutes,
  pointAlong,
  slotCenter,
  slotWidth,
  weightNames,
  type PacketRoute,
} from './geometry'

type View = 'overview' | 'memory' | 'compute' | 'host'
const world = (x: number, y: number, z = 0): [number, number, number] => [
  (x - 500) / 60,
  (235 - y) / 60,
  z,
]

function Label({
  x,
  y,
  text,
  color = '#e6e9f0',
  size = 13,
  z = 0.8,
}: {
  x: number
  y: number
  text: string
  color?: string
  size?: number
  z?: number
}) {
  return (
    <Text
      position={world(x, y, z)}
      fontSize={size / 60}
      color={color}
      anchorX="center"
      anchorY="middle"
    >
      {text}
    </Text>
  )
}
function Slab({
  x,
  y,
  w,
  h,
  color,
  depth = 0.12,
  opacity = 1,
  onClick,
}: {
  x: number
  y: number
  w: number
  h: number
  color: string
  depth?: number
  opacity?: number
  onClick?: () => void
}) {
  return (
    <mesh
      position={world(x, y, depth / 2)}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation()
              onClick()
            }
          : undefined
      }
    >
      <boxGeometry args={[w / 60, h / 60, depth]} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.7}
      />
    </mesh>
  )
}
function Camera({ view }: { view: View }) {
  const { camera, invalidate, size } = useThree()
  const controls = useRef<any>(null)
  useEffect(() => {
    const positions: Record<View, [number, number, number]> = {
      // Fit the full board on narrow screens; close-up views remain intentional crops.
      overview: [0, 0.6, Math.max(10, 23 * size.height / size.width)],
      memory: [-2.8, -2, 5],
      compute: [-3, 2, 6],
      host: [5.7, 0.2, 9],
    }
    const targets: Record<View, [number, number, number]> = {
      overview: [0, 0, 0],
      memory: [-2.8, -2, 0],
      compute: [-3, 1.5, 0],
      host: [5.7, 0, 0],
    }
    camera.position.set(...positions[view])
    controls.current?.target.set(...targets[view])
    controls.current?.update()
    invalidate()
  }, [view, camera, invalidate, size.width, size.height])
  return (
    <OrbitControls
      ref={controls}
      enableDamping={false}
      minDistance={4}
      maxDistance={22}
      maxPolarAngle={Math.PI * 0.8}
    />
  )
}
function TravelingPacket({
  route,
  index,
  duration,
}: {
  route: PacketRoute
  index: number
  duration: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const start = useRef<number | null>(null)
  const { invalidate } = useThree()
  useFrame(({ clock }) => {
    if (!mesh.current) return
    start.current ??= clock.elapsedTime
    const elapsed = clock.elapsedTime - start.current - (index * duration * 0.3) / route.count
    const progress = elapsed / (duration * 0.65)
    mesh.current.visible = progress >= 0 && progress <= 1
    const point = pointAlong(route.points, progress)
    mesh.current.position.set(...world(point[0], point[1], 1.05))
    if (clock.elapsedTime - start.current < duration) invalidate()
  })
  return (
    <mesh ref={mesh}>
      <boxGeometry args={[0.09, 0.09, 0.09]} />
      <meshBasicMaterial color={route.color} />
    </mesh>
  )
}

export default function GpuSpatial({
  state,
  config,
  cue,
  declaration,
  prefilledSlots,
  onChunk,
  reducedMotion,
}: {
  state: MemoryState
  config: MemoryConfig
  cue: VisualCue | null
  declaration: string | null
  prefilledSlots: number
  onChunk: (id: number) => void
  reducedMotion: boolean
}) {
  const [view, setView] = useState<View>('overview')
  const selected = selectedChunkIds(state, config)
  const resident = stageReached(state, 'prefill')
  const responseCount = Math.max(
    0,
    state.responseTokens - (cue?.kind === 'read' || cue?.kind === 'response' ? 1 : 0),
  )
  const routes = useMemo(() => (cue ? packetRoutes(cue, config) : []), [cue, config])
  const slots = [
    { id: 0, label: 'SYS', tokens: config.scaffold_tokens, color: COLORS.scaffold },
    ...config.chunks,
  ]
  const tag =
    declaration ??
    (state.mode === 'focus'
      ? `focus: ${state.focusedChunks.map((id) => config.chunks.find((c) => c.id === id)?.label).join(' + ')}`
      : state.mode)
  return (
    <div className={`da-spatial ${cue?.kind === 'residency' ? 'da-residency-pulse' : ''}`}>
      <div className="da-camera-controls" aria-label="Camera views">
        {(['overview', 'memory', 'compute', 'host'] as View[]).map((name) => (
          <button key={name} aria-pressed={view === name} onClick={() => setView(name)}>
            {name}
          </button>
        ))}
      </div>
      <div
        className="da-canvas"
        role="img"
        aria-label={`Spatial GPU. ${state.mode} mode. ${resident ? 'KV resident' : 'KV empty'}. Use the controls below for accessible chunk selection.`}
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 1.25]}
          camera={{ position: [0, 0.6, 10], fov: 42 }}
          gl={{ antialias: true, powerPreference: 'low-power' }}
        >
          <color attach="background" args={['#05060a']} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[0, 5, 10]} intensity={2} />
          <Camera view={view} />
          <Suspense fallback={null}>
            <Slab x={330} y={239} w={615} h={405} color="#12221f" depth={0.16} />
            <Label x={90} y={66} text="GPU" color={COLORS.response} size={20} />
            <Label x={455} y={67} text="schematic · not telemetry" size={10} />
            {Array.from({ length: 12 }, (_, i) => (
              <group key={i}>
                <Slab
                  x={140 + (i % 4) * 125}
                  y={108 + Math.floor(i / 4) * 37}
                  w={105}
                  h={28}
                  color={COLORS.sm}
                  depth={0.55}
                />
                <Label
                  x={140 + (i % 4) * 125}
                  y={108 + Math.floor(i / 4) * 37}
                  text="SM"
                  size={12}
                />
              </group>
            ))}
            <Label x={325} y={214} text="COMPUTE" size={11} />
            <Slab x={325} y={254} w={560} h={30} color={COLORS.l2} depth={0.32} />
            <Label x={325} y={254} text="L2 CACHE · shared memory path" size={12} />
            <Slab x={325} y={364} w={560} h={147} color="#361c29" depth={0.18} />
            {weightNames.map((name, i) => (
              <group key={name}>
                <Slab
                  x={125 + i * 135}
                  y={310}
                  w={124}
                  h={24}
                  color={COLORS.weights}
                  opacity={
                    stageReached(state, 'weights') &&
                    (cue?.kind !== 'weights' || i < (cue.slot ?? 0))
                      ? 1
                      : 0.15
                  }
                  depth={0.38}
                />
                <Label
                  x={125 + i * 135}
                  y={310}
                  text={name}
                  size={10}
                  color={stageReached(state, 'weights') ? '#05060a' : '#b5bece'}
                />
              </group>
            ))}
            {slots.map((chunk, i) => {
              const active = chunk.id === 0 || selected.includes(chunk.id)
              const filled = resident && i < prefilledSlots
              return (
                <group key={chunk.id}>
                  <Slab
                    x={slotCenter(i, config.chunks.length)}
                    y={365}
                    w={slotWidth(config.chunks.length) - 9}
                    h={52}
                    color={chunk.color}
                    depth={0.48}
                    opacity={filled ? (active ? 0.85 : 0.16) : 0.08}
                    onClick={resident && chunk.id ? () => onChunk(chunk.id) : undefined}
                  />
                  <Label
                    x={slotCenter(i, config.chunks.length)}
                    y={358}
                    text={chunk.label}
                    color={filled && active ? '#071b12' : chunk.color}
                    size={16}
                  />
                  <Label
                    x={slotCenter(i, config.chunks.length)}
                    y={379}
                    text={!filled ? 'EMPTY' : active ? 'READ' : 'MASKED'}
                    color={filled && active ? '#071b12' : '#e6e9f0'}
                    size={10}
                  />
                </group>
              )
            })}
            <Label x={148} y={420} text="HBM · fixed KV seats" color={COLORS.hbm} size={10} />
            {Array.from({ length: Math.min(12, responseCount) }, (_, i) => (
              <Slab
                key={i}
                x={257 + i * 13}
                y={414}
                w={9}
                h={12}
                color={COLORS.response}
                depth={0.4}
              />
            ))}
            <Label
              x={513}
              y={417}
              text={`reply: ${responseCount} tok`}
              color={COLORS.response}
              size={10}
            />
            <Slab x={674} y={283} w={80} h={22} color="#67728d" />
            <Label x={674} y={260} text="PCIe" size={11} />
            <Slab x={846} y={239} w={264} h={405} color="#101727" depth={0.16} />
            <Label x={846} y={69} text="HOST · CPU + RAM" size={17} />
            <Label
              x={846}
              y={110}
              text={
                state.stage === 'decode'
                  ? 'SCRIPTED OUTPUT'
                  : stageReached(state, 'request')
                    ? 'THE REQUEST'
                    : 'MODEL CHECKPOINT'
              }
              size={11}
            />
            {!stageReached(state, 'request') ? (
              weightNames.map((name, i) => (
                <group key={name}>
                  <Slab
                    x={846}
                    y={185 + i * 38}
                    w={215}
                    h={28}
                    color={COLORS.weights}
                    opacity={stageReached(state, 'weights') ? 0.25 : 0.7}
                  />
                  <Label x={846} y={185 + i * 38} text={name} size={12} />
                </group>
              ))
            ) : state.stage !== 'decode' ? (
              slots.map((chunk, i) => (
                <Label
                  key={chunk.id}
                  x={846}
                  y={160 + i * 27}
                  text={chunk.id ? `magic chunk ${chunk.label}` : 'SYS + question'}
                  color={chunk.color}
                  size={13}
                />
              ))
            ) : (
              <>
                <Label x={846} y={151} text={tag} color="#ffd36e" size={tag.length > 25 ? 9 : 13} />
                {state.events
                  .slice(0, responseCount)
                  .slice(-6)
                  .map((event, i) => (
                    <Label
                      key={event.id}
                      x={846}
                      y={204 + i * 30}
                      text={event.text}
                      size={event.text.length > 24 ? 10 : 13}
                      color={event.mode === 'global' ? '#e6e9f0' : COLORS.response}
                    />
                  ))}
              </>
            )}
            {!reducedMotion && cue && (
              <group key={cue.serial}>
                {routes.flatMap((route, r) =>
                  Array.from({ length: route.count }, (_, i) => (
                    <TravelingPacket
                      key={`${r}-${i}`}
                      route={route}
                      index={i}
                      duration={cue.durationMs / 1000}
                    />
                  )),
                )}
              </group>
            )}
          </Suspense>
        </Canvas>
      </div>
      <span className="da-orbit-hint">
        Drag to orbit · scroll to zoom · camera buttons reset the view
      </span>
    </div>
  )
}
