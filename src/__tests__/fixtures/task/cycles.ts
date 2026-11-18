import { sleep } from "bun"

import { task } from "#task.ts"

export const selfCall = task(async () => {
  await selfCall()
})

export const hooked = task(() => {
  console.log("ran hooked")
})

hooked.after(async () => {
  await hooked()
})

export const first = task(async () => {
  // oxlint-disable-next-line no-use-before-define - `second` is assigned before `first` runs
  await second()
})

export const second = task(async () => {
  await first()
})

export const outer = task(async () => {
  await first()
})

export const concurrent = task(async () => {
  // oxlint-disable-next-line no-use-before-define - both tasks are assigned before `concurrent` runs
  await Promise.all([slowCycle(), fastCycle()])
})

export const slowCycle = task(async () => {
  await sleep(20)
  // oxlint-disable-next-line no-use-before-define - `fastCycle` is assigned before `slowCycle` runs
  await fastCycle()
})

export const fastCycle = task(async () => {
  await slowCycle()
})

// Hold a call that `finished` starts during its run but that only reaches `finished` after the run is over.
let lateCall: Promise<void> | undefined

export const finished = task(() => {
  console.log("ran finished")
  lateCall = (async () => {
    await sleep(10)
    await finished()
  })()
})

export const afterFinished = task(async () => {
  await finished()
  await lateCall
  console.log("late call joined")
})
