import type { Shell } from "#shell/shell.ts"
import type { ArgValues, NoArgs, TaskArgs } from "#task/args.ts"

export interface Task<A extends TaskArgs = NoArgs> {
  (): Promise<void>
  options: TaskOptions<A>
  before: (...fns: Hook<A>[]) => void
  after: (...fns: Hook<A>[]) => void
  /** Replaces the task's function in place. The new function can run the one it replaced with `original()`. */
  wrap: {
    (fn: WrapFn<A>): Task<A>
    <const B extends TaskArgs = NoArgs>(options: WrapOptions<B>, fn: WrapFn<A & B>): Task<A & B>
  }
}

export interface TaskOptions<A extends TaskArgs = NoArgs> {
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

export interface TaskContext<A extends TaskArgs = NoArgs> {
  sh: Shell
  args: ArgValues<A>
  positionals: string[]
}

type AsyncOrSyncReturn = Promise<void> | void

export type TaskFn<A extends TaskArgs = NoArgs> = (ctx: TaskContext<A>) => AsyncOrSyncReturn

/** A task used as a hook. It leaves out the call signature so TypeScript still infers an inline hook's parameter. */
type HookTask = Pick<Task, "options">

/** A hook added with `before` or `after`: a function that gets the task's context, or another task. */
export type Hook<A extends TaskArgs = NoArgs> = TaskFn<A> | HookTask

interface WrapContext<A extends TaskArgs = NoArgs> extends TaskContext<A> {
  /** Runs the function this wrap replaced. */
  original: () => Promise<void>
}

export type WrapFn<A extends TaskArgs = NoArgs> = (ctx: WrapContext<A>) => AsyncOrSyncReturn

export interface WrapOptions<B extends TaskArgs> {
  /** Args to add to the task's args. */
  args?: B
}
