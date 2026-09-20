# Declarative Attention: the memory lesson

This lesson is an explicit **protocol simulation**, not a DA model deployment or live GPU profiler. It follows the supplied Manim/storyboard sequence without rendering or running Manim. The original transformer scene and GPT-2 inference implementation are retained.

## Read the implementation

- `backend/app/pods/declarative-attention.json`: authored story, cadence and numerical assumptions.
- `frontend/src/lessons/declarative-attention/simulation.ts`: pure state transitions and counters. Start here.
- `GpuStage.tsx` / `PacketFlow.tsx`: the persistent diagram and bounded packet animations.
- `MemoryInspector.tsx`: accounting and its explicit limitations.
- `useLessonPlayback.ts`: cancelable chapter playback, checkpoint reconstruction, speech and reading-time fallback.
- `DeclarativeAttentionLesson.tsx`: controls, navigation and tutor handoff.
- `backend/app/lessons/declarative_attention/`: schema validation and the scene-specific tutor. The normal Messages proxy is reused.

Holo's shell selects the renderer by `scene.type`; DA has its own state, not extra fields mixed into GPT-2's store. Selecting another lesson unmounts the old view, cancels playback and ignores stale tutor results.

## Accounting contract

Four chunks contain 2,048 tokens each; the always-attended scaffold contains 256. For one illustrative global-attention layer, KV bytes per token = 2 × 8 KV heads × 128 dimensions × 2 bytes = 4,096 bytes.

Global reads all chunks. Focus reads the selected set. Local reads none of the chunks. All modes read the scaffold and previously generated response tokens. Every decode step computes its read event **before** appending one new response token. The vanilla comparison uses that same decode position. Packet count follows token mass with a minimum visible packet for tiny regions, so it is a visual quantization, not literal one-packet-per-byte transport.

The inspector shows the **next** token's read set. Cumulative counters sum completed simulation steps. Mode changes do not change resident bytes. KV addresses/seats are fixed; new response KV grows separately. Reads still move data through the memory hierarchy: “Move no KV” means no cache relocation/compaction, not zero traffic.

The animation duration is a pedagogical scale, not a GPU latency estimate. Output phrases label individual simulated tokens; they are not a tokenizer trace or real generated answer. Weight traffic during decode, cache hits, page alignment and kernel overhead are outside this toy accounting model.

## Cadence

The authored spine is empty → weights → request → prefill → vanilla → focus → sparse read → global → local → conclusion. Visual actions settle before their spoken explanation. Each line has a breathing gap; with voice disabled, captions use a roughly 15-character/second reading hold. Chapter selection reconstructs prior state without speaking all earlier chapters. Continue replays the current chapter from its checkpoint. Direct manipulation pauses the guide; it does not auto-resume.

One browser voice is used unless an existing TTS provider is configured. Microphone access stays browser-controlled. The Grok tutor explains this simulated state, not its own private model internals. It may control only three validated DA operations. Inference failures leave the scene unchanged.

## Verification

Run `npm run test:da` in `frontend`: no new test-runner dependency, using the existing TypeScript compiler and Node assertions. Run `pytest tests/test_declarative_attention.py` in `backend` with the project dependencies. Existing proxy contract tests must still pass.

Browser acceptance: start, pause, chapter seek, repeat prefill, select C3 then C1+C3, local/global, decode, cancel a tutor query, switch to GPT-2 and back, and test voice separately. Validate the production build with TypeScript before deployment.

## Scientific references

- https://arxiv.org/abs/2609.02737 — Language Models Can Control Their Own Attention. The 52.0% attended-token reduction and 1.27-point accuracy drop are paper benchmark results, not this toy's counters or a measured GPU speedup.
- https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html — memory hierarchy; L2 is a cache, not the memory bus itself.

Deployment configuration, OAuth credentials, runtime environments and built assets remain outside this repository. Deploy exact Git revisions; do not synchronize `.env` or the user's SSH/OAuth credentials.
