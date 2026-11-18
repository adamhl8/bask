import type { ShellConfig } from "#config.ts"
import { getLoadedBaskFile } from "#loaded-bask-file.ts"
import { createShell } from "#shell/shell.ts"
import { toEmptyArgs } from "#task/args.ts"
import type { ArgValues, NoArgs, ParsedTaskArgs, TaskArgs } from "#task/args.ts"
import { getCommandLineArgs } from "#task/command-line-args.ts"
import { findCycle, formatCycleMessage, getRunningChain, runInChain, waitOn } from "#task/cycles.ts"
import { recordFailedTask } from "#task/failed-task.ts"
import type { Hook, Task, TaskContext, TaskFn, TaskOptions, WrapFn, WrapOptions } from "#task/types.ts"

const HOOK_AFTER_START = "Can't add a hook to a task that has already started"
const WRAP_AFTER_START = "Can't wrap a task that has already started"

const createdByTask = new WeakSet<object>()
export const isTask = (value: unknown): value is Task => typeof value === "function" && createdByTask.has(value)

/** Registers a task that runs at most once per bask invocation, however many times it's called. */
export function task(fn: TaskFn): Task
export function task<const A extends TaskArgs = NoArgs>(options: TaskOptions<A>, fn: TaskFn<A>): Task<A>
export function task<A extends TaskArgs>(optionsOrFn: TaskOptions<A> | TaskFn<A>, maybeFn?: TaskFn<A>): Task<A> {
  const [passedOptions, fn] = typeof optionsOrFn === "function" ? [{}, optionsOrFn] : [optionsOrFn, maybeFn]
  // Copy the options because `wrap` adds args to them, and tasks can share the object they were given.
  const options: TaskOptions<A> = { ...passedOptions }
  if (!fn) throw new Error("task() needs a callback")

  // Hold the hooks of the current layer, which each `wrap` folds into the function it replaces.
  let beforeFns: Hook<A>[] = []
  let afterFns: Hook<A>[] = []
  // Widen the options so `wrap` can add args to the object `task.options` exposes.
  const taskOptions: TaskOptions<TaskArgs> = options

  // Store the first call's promise so overlapping and later calls share it instead of rerunning the task.
  let runPromise: Promise<void> | undefined
  // Track the start separately because `runAll` calls the task before `runPromise` is assigned.
  let hasStarted = false
  let hasFinished = false

  const assertNotStarted = (message: string) => {
    if (hasStarted) throw new Error(message)
  }

  const before = (...fns: Hook<A>[]) => {
    assertNotStarted(HOOK_AFTER_START)
    beforeFns.push(...fns)
  }

  const after = (...fns: Hook<A>[]) => {
    assertNotStarted(HOOK_AFTER_START)
    afterFns.push(...fns)
  }

  // Give each hook, wrap, and the task its own shell so settings like `sh.cwd()` stay inside the function that made them.
  const toContext = (shellConfig: ShellConfig, taskArgs: ParsedTaskArgs): TaskContext<A> => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion - `taskArgs` was parsed from this task's own `args` declaration
    const args = taskArgs.args as ArgValues<A>
    return { sh: createShell(shellConfig), args, positionals: [...taskArgs.positionals] }
  }

  type LayerFn = (shellConfig: ShellConfig, taskArgs: ParsedTaskArgs) => Promise<void>

  // Hold the task's current function, which each `wrap` replaces.
  let currentFn: LayerFn = async (shellConfig, taskArgs) => {
    await fn(toContext(shellConfig, taskArgs))
  }

  // Run the current layer: its before hooks, its function, then its after hooks.
  const toLayerFn =
    (layerFn: LayerFn, layerBeforeFns: Hook<A>[], layerAfterFns: Hook<A>[]): LayerFn =>
    async (shellConfig, taskArgs) => {
      // Call a task used as a hook bare, because this task's args aren't its args.
      const runHook = async (hook: Hook<A>) => {
        if (isTask(hook)) return hook()
        if (typeof hook === "function") return hook(toContext(shellConfig, taskArgs))
      }
      // oxlint-disable-next-line no-await-in-loop - hooks run in order
      for (const beforeFn of layerBeforeFns) await runHook(beforeFn)
      await layerFn(shellConfig, taskArgs)
      // oxlint-disable-next-line no-await-in-loop - hooks run in order
      for (const afterFn of layerAfterFns) await runHook(afterFn)
    }

  const wrap = (wrapOptionsOrFn: WrapOptions<TaskArgs> | WrapFn<A>, maybeWrapFn?: WrapFn<A>) => {
    assertNotStarted(WRAP_AFTER_START)
    const [wrapOptions, wrapFn] =
      typeof wrapOptionsOrFn === "function" ? [{}, wrapOptionsOrFn] : [wrapOptionsOrFn, maybeWrapFn]
    if (!wrapFn) throw new Error("wrap() needs a callback")

    const wrapArgs: TaskArgs = wrapOptions.args ?? {}
    const duplicateArg = Object.keys(wrapArgs).find((argName) => Object.hasOwn(taskOptions.args ?? {}, argName))
    if (duplicateArg !== undefined)
      throw new Error(`Can't add arg '${duplicateArg}' with wrap() because the task already has it`)
    taskOptions.args = { ...taskOptions.args, ...wrapArgs }

    // Wrap the task as it stands, hooks included, and start a new layer for hooks added after this.
    const replacedFn = toLayerFn(currentFn, beforeFns, afterFns)
    beforeFns = []
    afterFns = []
    currentFn = async (shellConfig, taskArgs) => {
      const original = async () => replacedFn(shellConfig, taskArgs)
      await wrapFn({ ...toContext(shellConfig, taskArgs), original })
    }
    // oxlint-disable-next-line no-use-before-define - `wrap` only runs after `newTask` is assigned
    return newTask
  }

  const runAll = async (shellConfig: ShellConfig, taskArgs: ParsedTaskArgs) => {
    hasStarted = true
    try {
      await toLayerFn(currentFn, beforeFns, afterFns)(shellConfig, taskArgs)
    } finally {
      hasFinished = true
    }
  }

  // Assign `runPromise` before any await so a concurrent call can't start a second run.
  const runOnce = async (shellConfig: ShellConfig, taskArgs: ParsedTaskArgs, chain: Task[]) => {
    // oxlint-disable-next-line no-use-before-define - `runOnce` only runs after `newTask` is assigned
    runPromise ??= runInChain(chain, newTask, async () => runAll(shellConfig, taskArgs))
    try {
      await runPromise
    } catch (error) {
      // oxlint-disable-next-line no-use-before-define - `runOnce` only runs after `newTask` is assigned
      recordFailedTask(error, newTask)
      throw error
    }
  }

  // oxlint-disable-next-line typescript/promise-function-async - an async function would turn the throw into a rejection
  const run = () => {
    const baskFile = getLoadedBaskFile()

    const chain = getRunningChain()
    // Skip the check once the task has finished, because a call then only gets the finished run and can't wait on itself.
    // oxlint-disable-next-line no-use-before-define - `run` only runs after `newTask` is assigned
    const cycle = hasFinished ? undefined : findCycle(newTask, chain)
    if (cycle) throw new Error(formatCycleMessage(cycle, baskFile.tasks))

    // oxlint-disable-next-line no-use-before-define - `run` only runs after `newTask` is assigned
    const taskArgs = getCommandLineArgs(newTask) ?? toEmptyArgs(options)
    const calledRun = runOnce(baskFile.config.shell, taskArgs, chain)
    const caller = chain.at(-1)
    if (!caller) return calledRun
    // oxlint-disable-next-line no-use-before-define - `run` only runs after `newTask` is assigned
    return waitOn(caller, newTask, calledRun)
  }

  const newTask: Task<A> = Object.assign(run, { options, before, after, wrap })
  createdByTask.add(newTask)
  return newTask
}
