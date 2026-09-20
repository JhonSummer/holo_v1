import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

// Transpile this small dependency graph in memory, without DOM, server or network.
const base = new URL('../src/lessons/declarative-attention/',import.meta.url)
const cache = new Map()
function moduleUrl(url) {
  if(cache.has(url.href)) return cache.get(url.href)
  let code=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText
  code=code.replace(/from ['"](.\/.+?)['"]/g,(_,path)=>`from '${moduleUrl(new URL(path+'.ts',url))}'`)
  const result=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  cache.set(url.href,result)
  return result
}
const sim=await import(moduleUrl(new URL('simulation.ts',base)))
const {LessonPlayback}=await import(moduleUrl(new URL('playback.ts',base)))
const {packetRoutes,slotX,slotWidth,COLORS}=await import(moduleUrl(new URL('geometry.ts',base)))
const {validateCommands}=await import(moduleUrl(new URL('tutor.ts',base)))
const {CHECKPOINTS}=await import(moduleUrl(new URL('checkpoints.ts',base)))
const voice=await import(moduleUrl(new URL('../../voice/voicePlayback.ts',base)))
const pod=JSON.parse(readFileSync(new URL('../../backend/app/pods/declarative-attention.json',import.meta.url),'utf8'))
const config=pod.scene.params
const instant=async()=>{}
const make=(narration=pod.narration,sleep=instant,speak=async()=>true)=>new LessonPlayback({...pod,narration},speak,()=>{},sleep)
const tick=async()=>{for(let i=0;i<20;i++) await Promise.resolve()}

test('empty stage is a complete reset',()=>{
  let state=sim.applyCommand({...sim.initialState(config),stage:'prefill'},{op:'daDecode',args:{text:'a'}},config)
  state=sim.applyCommand(state,{op:'daStage',args:{stage:'empty'}},config)
  assert.equal(state.events.length,0);assert.equal(state.responseTokens,0)
})
test('valid non-default IDs choose an available default focus',()=>{
  const other={...config,chunks:[{...config.chunks[0],id:7}]}
  assert.deepEqual(sim.initialState(other).focusedChunks,[7])
})
test('all accepted chunk counts fit inside HBM',()=>{
  for(let count=1;count<=8;count++) assert.ok(slotX(count,count)+slotWidth(count)-8<610)
})
test('read cue contains no response write; write follows as a distinct cue',()=>{
  const event=sim.nextRead({...sim.initialState(config),stage:'prefill'},config)
  const reads=packetRoutes({kind:'read',durationMs:2400,event,serial:1},config)
  assert.ok(reads.every(route=>route.points.at(-1)[1]===170))
  const writes=packetRoutes({kind:'response',durationMs:450,event,serial:2},config)
  assert.equal(writes.length,1);assert.deepEqual(writes[0].points.at(-1),[580,414])
})
test('prefill input and storage paths are separate phases',()=>{
  const input=packetRoutes({kind:'input',slot:3,durationMs:650,serial:1},config)
  const write=packetRoutes({kind:'write',slot:3,durationMs:500,serial:2},config)
  assert.deepEqual(input[0].points.at(-1),[320,170]);assert.equal(write[0].points.at(-1)[1],362)
})
test('packet routes cross both ends of the drawn PCIe channel',()=>{
  for(const kind of ['weights','input']) {
    const points=packetRoutes({kind,slot:0,durationMs:650,serial:1},config)[0].points
    assert.ok(points.some(p=>p[0]===713&&p[1]===283));assert.ok(points.some(p=>p[0]===634&&p[1]===283))
  }
})
test('focused reads never include masked chunk routes',()=>{
  const state={...sim.initialState(config),stage:'prefill',mode:'focus',focusedChunks:[3]}
  const routes=packetRoutes({kind:'read',event:sim.nextRead(state,config),durationMs:1000,serial:1},config)
  assert.deepEqual(routes.map(r=>r.color),[COLORS.scaffold,config.chunks[2].color])
})
test('prefill visibly completes seats in order',async()=>{
  const player=make([pod.narration[3]])
  const steps=[];player.subscribe(()=>{const s=player.getSnapshot();if(s.visual) steps.push(s.visual.kind+':'+s.visual.slot)})
  await player.play()
  assert.deepEqual([...new Set(steps)],Array.from({length:5},(_,i)=>['input:'+i,'write:'+i]).flat())
  assert.equal(player.getSnapshot().prefilledSlots,5)
})
test('declaration appears while the old mask is still active',async()=>{
  let release
  const player=make([{...pod.narration[6],checkpoint:undefined}],()=>new Promise(resolve=>{release=resolve}))
  const playing=player.play();await tick()
  assert.equal(player.getSnapshot().state.mode,'global');assert.ok(player.getSnapshot().declaration.includes('3'))
  player.stop();release();await playing
  assert.equal(player.getSnapshot().state.mode,'global')
})
test('continue after experiment retains its mask and does not duplicate tokens',async()=>{
  const beats=[pod.narration[3],{...pod.narration[4],commands:[{op:'daDecode',args:{text:'new'}}]}]
  const player=make(beats)
  await player.step()
  await player.explore([{op:'daMode',args:{mode:'focus',chunks:[1]}}])
  await player.play()
  assert.equal(player.getSnapshot().state.mode,'focus')
  assert.deepEqual(player.getSnapshot().state.focusedChunks,[1]);assert.equal(player.getSnapshot().state.responseTokens,1)
})
test('manual interaction replaces stale authored captions',async()=>{
  const player=make([pod.narration[3]])
  await player.step();await player.explore([{op:'daMode',args:{mode:'local',chunks:[]}}])
  assert.ok(player.getSnapshot().caption.startsWith('Local reads'))
})
test('checkpoints hold guide until explicit continuation',async()=>{
  const player=make([{...pod.narration[0],checkpoint:'read-set'},pod.narration[1]])
  await player.play();assert.equal(player.getSnapshot().checkpoint,'read-set')
  await player.play();assert.equal(player.getSnapshot().beatIndex,0)
  player.resolveCheckpoint();await player.play();assert.equal(player.getSnapshot().beatIndex,1)
})
test('three misconception checks have specific feedback and one correct answer',()=>{
  assert.equal(Object.keys(CHECKPOINTS).length,3)
  for(const item of Object.values(CHECKPOINTS)) {assert.equal(item.choices.filter(c=>c.correct).length,1);assert.ok(item.choices.every(c=>c.feedback.length>40))}
})
test('runtime tutor validation rejects unknown operations and bad focus',()=>{
  assert.throws(()=>validateCommands([{op:'delete',args:{}}],config))
  assert.throws(()=>validateCommands([{op:'daMode',args:{mode:'focus',chunks:[99]}}],config))
  assert.throws(()=>validateCommands([{op:'daMode',args:{mode:'focus',chunks:[]}}],config))
  assert.equal(validateCommands([{op:'daMode',args:{mode:'focus',chunks:[3]}}],config).length,1)
})
test('speech recognition ending without a result resolves and clears recording',async()=>{
  let recording=false
  class Recognition {start(){} stop(){} }
  globalThis.window={SpeechRecognition:Recognition}
  const ref={current:null};const promise=voice.browserListen(value=>recording=value,ref,new AbortController().signal)
  ref.current.onend();assert.equal(await promise,'');assert.equal(recording,false);assert.equal(ref.current,null)
})
test('canceling audio stops playback and removes its source',async()=>{
  const handlers={};let pauses=0,removed=false
  const element={src:'',play:async()=>{},pause:()=>{pauses++},removeAttribute:()=>{removed=true},addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener:name=>delete handlers[name]}
  const controller=new AbortController();const promise=voice.playAudio(element,'blob:test','hello',controller.signal)
  controller.abort();assert.equal(await promise,false);assert.equal(pauses,1);assert.equal(removed,true)
})
