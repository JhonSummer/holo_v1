export interface Checkpoint {
  title: string
  question: string
  choices: { label: string; feedback: string; correct: boolean }[]
}

export const CHECKPOINTS: Record<string, Checkpoint> = {
  'read-set': {
    title: 'Predict the next read',
    question: 'After declaring focus on C3, what must the next token read?',
    choices: [
      { label: 'Only C3', correct: false, feedback: 'C3 is selected, but the scaffold and previous response KV are still needed too.' },
      { label: 'Scaffold + C3 + previous reply', correct: true, feedback: 'Exactly. Focus filters the context chunks—not the scaffold or the reply so far. Watch those three sources next.' },
      { label: 'Every chunk, just more slowly', correct: false, feedback: 'The mask actually removes the other chunks from this read set. Their storage stays put, but their bytes are not read by this simulated attention step.' },
    ],
  },
  residency: {
    title: 'Did we free any VRAM?',
    question: 'C1, C2 and C4 are dim. What happened to their cached keys and values?',
    choices: [
      { label: 'They moved to CPU RAM', correct: false, feedback: 'No offload occurs. Dim means excluded from the current read, not moved across PCIe.' },
      { label: 'They were deleted to save memory', correct: false, feedback: 'No eviction occurs. Global can read them immediately because their KV is still resident.' },
      { label: 'They stayed in their original seats', correct: true, feedback: 'Yes. Read traffic fell; resident cache size did not. Global can reopen access without fetching anything back.' },
    ],
  },
  local: {
    title: 'Does local read nothing?',
    question: 'Local excludes all magic chunks. Why is the next-read bar still above zero?',
    choices: [
      { label: 'Scaffold and previous reply remain readable', correct: true, feedback: 'Right. Local is not zero attention. It retains the instructions/question scaffold and the response generated so far.' },
      { label: 'The display has not refreshed', correct: false, feedback: 'The nonzero count is intentional: scaffold plus previous response KV are counted in every mode.' },
      { label: 'All chunks secretly remain selected', correct: false, feedback: 'The context chunks really are excluded. Residency is not the same thing as membership in the read set.' },
    ],
  },
}
