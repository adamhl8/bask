import { ShellWrapper } from "#shell.ts"

interface TaskOptions {
  desc?: string
}

interface TaskContext {
  $: typeof ShellWrapper
}

type AsyncOrSyncReturn = Promise<void> | void

type TaskFn = (ctx: TaskContext) => AsyncOrSyncReturn

export interface Task {
  (): Promise<void>
  options: TaskOptions
}

const tasks = new WeakSet<object>()

export const isTask = (value: unknown): value is Task => typeof value === "function" && tasks.has(value)

/** Registers a task that runs at most once per bask invocation, however many times it's called. */
export function task(fn: TaskFn): Task
export function task(options: TaskOptions, fn: TaskFn): Task
export function task(optionsOrFn: TaskOptions | TaskFn, maybeFn?: TaskFn): Task {
  const [options, fn] = typeof optionsOrFn === "function" ? [{}, optionsOrFn] : [optionsOrFn, maybeFn]
  if (!fn) throw new Error("task() needs a callback")

  // Wrap `fn` so a sync `fn` still returns a promise.
  const runFn = async () => fn({ $: ShellWrapper })

  // Store the first call's promise so overlapping and later calls share it instead of rerunning `fn`.
  let taskFnPromise: Promise<void> | undefined

  const run = async () => {
    if (taskFnPromise) return taskFnPromise
    taskFnPromise = runFn()
    return taskFnPromise
  }

  const newTask: Task = Object.assign(run, { options })
  tasks.add(newTask)
  return newTask
}
