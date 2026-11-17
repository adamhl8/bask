import type { ShellConfig } from "#config.ts"
import { getLoadedBaskFile } from "#loaded-bask-file.ts"
import { createShell } from "#shell/shell.ts"
import type { Shell } from "#shell/shell.ts"
import { toEmptyArgs } from "#task/args.ts"
import type { ArgValues, NoArgs, ParsedTaskArgs, TaskArgs } from "#task/args.ts"

type AsyncOrSyncReturn = Promise<void> | void

interface TaskOptions<A extends TaskArgs = NoArgs> {
  desc?: string
  /** Keeps the task runnable but leaves it out of the task list. */
  hidden?: boolean
  /** Additional names to run the task. */
  alias?: string | string[]
  /** Args the task takes from the command line, by name. */
  args?: A
  /** Lets the task take positionals, including everything after `--`. */
  positionals?: boolean
}

interface TaskContext<A extends TaskArgs = NoArgs> {
  sh: Shell
  args: ArgValues<A>
  positionals: string[]
}

type TaskFn<A extends TaskArgs = NoArgs> = (ctx: TaskContext<A>) => AsyncOrSyncReturn

/** A task used as a hook. It leaves out the call signature so TypeScript still infers an inline hook's parameter. */
type HookTask = Pick<Task, "options">

/** A hook added with `before` or `after`: a function that gets the task's context, or another task. */
type Hook<A extends TaskArgs = NoArgs> = TaskFn<A> | HookTask

export interface Task<A extends TaskArgs = NoArgs> {
  (): Promise<void>
  options: TaskOptions<A>
  before: (...fns: Hook<A>[]) => void
  after: (...fns: Hook<A>[]) => void
}

const createdByTask = new WeakSet<object>()
export const isTask = (value: unknown): value is Task => typeof value === "function" && createdByTask.has(value)

const failedTasks = new WeakMap<Error, Task>()
/** Returns the innermost task that the error failed, so the CLI can name it. */
export const getFailedTask = (error: Error) => failedTasks.get(error)

// Hold the command line's args for the task it named, because tasks are called without args.
const commandLineArgs = new WeakMap<Task, ParsedTaskArgs>()

/** Runs the task the command line named, with the args parsed from it. */
export const runWithArgs = async (taskToRun: Task, taskArgs: ParsedTaskArgs) => {
  commandLineArgs.set(taskToRun, taskArgs)
  await taskToRun()
}

/** Registers a task that runs at most once per bask invocation, however many times it's called. */
export function task(fn: TaskFn): Task
export function task<const A extends TaskArgs = NoArgs>(options: TaskOptions<A>, fn: TaskFn<A>): Task<A>
export function task<A extends TaskArgs>(optionsOrFn: TaskOptions<A> | TaskFn<A>, maybeFn?: TaskFn<A>): Task<A> {
  const [options, fn] = typeof optionsOrFn === "function" ? [{}, optionsOrFn] : [optionsOrFn, maybeFn]
  if (!fn) throw new Error("task() needs a callback")

  const beforeFns: Hook<A>[] = []
  const afterFns: Hook<A>[] = []

  // Store the first call's promise so overlapping and later calls share it instead of rerunning the task.
  let runPromise: Promise<void> | undefined
  // Track the start separately because `runAll` calls the task before `runPromise` is assigned.
  let hasStarted = false

  const assertNotStarted = () => {
    if (hasStarted) throw new Error("Can't add a hook to a task that has already started")
  }

  const before = (...fns: Hook<A>[]) => {
    assertNotStarted()
    beforeFns.push(...fns)
  }

  const after = (...fns: Hook<A>[]) => {
    assertNotStarted()
    afterFns.push(...fns)
  }

  const runAll = async (shellConfig: ShellConfig, taskArgs: ParsedTaskArgs) => {
    hasStarted = true
    // Give each hook and the task its own shell so settings like `sh.cwd()` stay inside the function that made them.
    // Call a task used as a hook bare, because this task's args aren't its args.
    const runHook = async (hook: Hook<A>) => {
      if (isTask(hook)) return hook()
      if (typeof hook !== "function") return
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion - `taskArgs` was parsed from this task's own `args` declaration
      const args = taskArgs.args as ArgValues<A>
      return hook({ sh: createShell(shellConfig), args, positionals: [...taskArgs.positionals] })
    }

    // oxlint-disable-next-line no-await-in-loop - hooks run in order
    for (const beforeFn of beforeFns) await runHook(beforeFn)
    await runHook(fn)
    // oxlint-disable-next-line no-await-in-loop - hooks run in order
    for (const afterFn of afterFns) await runHook(afterFn)
  }

  // Assign `runPromise` before any await so a concurrent call can't start a second run.
  const runOnce = async (shellConfig: ShellConfig, taskArgs: ParsedTaskArgs) => {
    runPromise ??= runAll(shellConfig, taskArgs)
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
    // oxlint-disable-next-line no-use-before-define - `run` only runs after `newTask` is assigned
    const taskArgs = commandLineArgs.get(newTask) ?? toEmptyArgs(options)
    return runOnce(baskFile.config.shell, taskArgs)
  }

  const newTask: Task<A> = Object.assign(run, { options, before, after })
  createdByTask.add(newTask)
  return newTask
}
