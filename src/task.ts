import { getLoadedBaskFile } from "#bask-file/loaded.ts"
import type { ShellConfig } from "#config.ts"
import { createShell } from "#shell/shell.ts"
import type { Shell } from "#shell/shell.ts"

type AsyncOrSyncReturn = Promise<void> | void

interface TaskOptions {
  desc?: string
  /** Keeps the task runnable but leaves it out of the task list. */
  hidden?: boolean
  /** Additional names to run the task. */
  alias?: string | string[]
}

interface TaskContext {
  sh: Shell
}

type TaskFn = (ctx: TaskContext) => AsyncOrSyncReturn

export interface Task {
  (): Promise<void>
  options: TaskOptions
  before: (...fns: TaskFn[]) => void
  after: (...fns: TaskFn[]) => void
}

const createdByTask = new WeakSet<object>()
export const isTask = (value: unknown): value is Task => typeof value === "function" && createdByTask.has(value)

const failedTasks = new WeakMap<Error, Task>()
/** Returns the innermost task that the error failed, so the CLI can name it. */
export const getFailedTask = (error: Error) => failedTasks.get(error)

/** Registers a task that runs at most once per bask invocation, however many times it's called. */
export function task(fn: TaskFn): Task
export function task(options: TaskOptions, fn: TaskFn): Task
export function task(optionsOrFn: TaskOptions | TaskFn, maybeFn?: TaskFn): Task {
  const [options, fn] = typeof optionsOrFn === "function" ? [{}, optionsOrFn] : [optionsOrFn, maybeFn]
  if (!fn) throw new Error("task() needs a callback")

  const beforeFns: TaskFn[] = []
  const afterFns: TaskFn[] = []

  // Store the first call's promise so overlapping and later calls share it instead of rerunning the task.
  let runPromise: Promise<void> | undefined
  // Track the start separately because `runAll` calls the task before `runPromise` is assigned.
  let hasStarted = false

  const assertNotStarted = () => {
    if (hasStarted) throw new Error("Can't add a hook to a task that has already started")
  }

  const before = (...fns: TaskFn[]) => {
    assertNotStarted()
    beforeFns.push(...fns)
  }

  const after = (...fns: TaskFn[]) => {
    assertNotStarted()
    afterFns.push(...fns)
  }

  const runAll = async (shellConfig: ShellConfig) => {
    hasStarted = true
    // Give each hook and the task its own shell so settings like `sh.cwd()` stay inside the function that made them.
    const runWithShell = async (taskFn: TaskFn) => taskFn({ sh: createShell(shellConfig) })

    // oxlint-disable-next-line no-await-in-loop - hooks run in order
    for (const beforeFn of beforeFns) await runWithShell(beforeFn)
    await runWithShell(fn)
    // oxlint-disable-next-line no-await-in-loop - hooks run in order
    for (const afterFn of afterFns) await runWithShell(afterFn)
  }

  // Assign `runPromise` before any await so a concurrent call can't start a second run.
  const runOnce = async (shellConfig: ShellConfig) => {
    runPromise ??= runAll(shellConfig)
    try {
      await runPromise
    } catch (error) {
      // Record this task only if no task has yet, because the innermost task's catch runs first.
      // oxlint-disable-next-line no-use-before-define - `runOnce` only runs after `newTask` is assigned
      if (error instanceof Error && !failedTasks.has(error)) failedTasks.set(error, newTask)
      throw error
    }
  }

  // oxlint-disable-next-line typescript/promise-function-async - an async function would turn the throw into a rejection
  const run = () => {
    const baskFile = getLoadedBaskFile()
    return runOnce(baskFile.config.shell)
  }

  const newTask: Task = Object.assign(run, { options, before, after })
  createdByTask.add(newTask)
  return newTask
}
