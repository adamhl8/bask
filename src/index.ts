import { ShellWrapper } from "#shell.ts"

interface TaskOptions {
  desc?: string
}

interface TaskContext {
  sh: typeof ShellWrapper
}

type AsyncOrSyncReturn = Promise<void> | void

type TaskFn = (ctx: TaskContext) => AsyncOrSyncReturn

export interface Task {
  (): Promise<void>
  options: TaskOptions
  before: (...fns: TaskFn[]) => void
  after: (...fns: TaskFn[]) => void
}

const tasks = new WeakSet<object>()

export const isTask = (value: unknown): value is Task => typeof value === "function" && tasks.has(value)

/** Registers a task that runs at most once per bask invocation, however many times it's called. */
export function task(fn: TaskFn): Task
export function task(options: TaskOptions, fn: TaskFn): Task
export function task(optionsOrFn: TaskOptions | TaskFn, maybeFn?: TaskFn): Task {
  const [options, fn] = typeof optionsOrFn === "function" ? [{}, optionsOrFn] : [optionsOrFn, maybeFn]
  if (!fn) throw new Error("task() needs a callback")

  const ctx: TaskContext = { sh: ShellWrapper }
  const beforeFns: TaskFn[] = []
  const afterFns: TaskFn[] = []

  // Store the first call's promise so overlapping and later calls share it instead of rerunning the task.
  let runPromise: Promise<void> | undefined

  const assertNotStarted = () => {
    if (runPromise) throw new Error("Can't add a hook to a task that has already started")
  }

  const before = (...fns: TaskFn[]) => {
    assertNotStarted()
    beforeFns.push(...fns)
  }

  const after = (...fns: TaskFn[]) => {
    assertNotStarted()
    afterFns.push(...fns)
  }

  const runAll = async () => {
    // oxlint-disable-next-line no-await-in-loop - hooks run in order
    for (const beforeFn of beforeFns) await beforeFn(ctx)
    await fn(ctx)
    // oxlint-disable-next-line no-await-in-loop - hooks run in order
    for (const afterFn of afterFns) await afterFn(ctx)
  }

  // Assign `runPromise` before any await so a concurrent call can't start a second run.
  const run = async () => {
    runPromise ??= runAll()
    return runPromise
  }

  const newTask: Task = Object.assign(run, { options, before, after })
  tasks.add(newTask)
  return newTask
}
