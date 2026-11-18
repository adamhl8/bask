import { AsyncLocalStorage } from "node:async_hooks"

import type { TaskIndex } from "#bask-file/task-index.ts"
import type { Task } from "#task/types.ts"

// Track the chain of tasks whose run the current code is inside, so a task that calls itself throws instead of hanging.
const runningTasks = new AsyncLocalStorage<Task[]>()

// Track which tasks each running task is waiting on, so a cycle between tasks that started separately still throws.
const waitingOn = new Map<Task, Set<Task>>()

const UNNAMED_TASK = "(unnamed)"

/** Returns the chain of tasks whose run the current code is inside. */
export const getRunningChain = () => runningTasks.getStore() ?? []

/** Runs `run` inside `chain` with `runningTask` added, so the calls it makes can see the chain. */
export const runInChain = async (chain: Task[], runningTask: Task, run: () => Promise<void>) =>
  runningTasks.run([...chain, runningTask], run)

/** Follows what `from` is waiting on, and returns the path to the first task it reaches in `chain`. */
const findWaitPath = (from: Task, chain: Task[], seen = new Set<Task>()): Task[] | undefined => {
  if (chain.includes(from)) return [from]
  if (seen.has(from)) return
  seen.add(from)
  const nextWaitPaths = Array.from(waitingOn.get(from) ?? [], (next) => findWaitPath(next, chain, seen))
  const waitPath = nextWaitPaths.find((nextWaitPath) => nextWaitPath !== undefined)
  return waitPath && [from, ...waitPath]
}

/** Returns the cycle that calling `calledTask` from inside `chain` would close, or `undefined` if there's none. */
export const findCycle = (calledTask: Task, chain: Task[]) => {
  const waitPath = findWaitPath(calledTask, chain)
  if (!waitPath) return
  const cycleStart = chain.indexOf(waitPath.at(-1) ?? calledTask)
  return [...chain.slice(cycleStart), ...waitPath]
}

/** Formats a cycle as an error message, naming each task the way the CLI does. */
export const formatCycleMessage = (cycle: Task[], tasks: TaskIndex) => {
  const names = cycle.map((cycleTask) => tasks.byTask.get(cycleTask)?.name ?? UNNAMED_TASK)
  return `Task '${names[0] ?? UNNAMED_TASK}' calls itself: ${names.join(" -> ")}`
}

/** Records that `caller` is waiting on `calledTask` until `calledRun` settles. */
export const waitOn = async (caller: Task, calledTask: Task, calledRun: Promise<void>) => {
  const calledTasks = waitingOn.get(caller) ?? new Set()
  waitingOn.set(caller, calledTasks.add(calledTask))
  try {
    await calledRun
  } finally {
    calledTasks.delete(calledTask)
  }
}
