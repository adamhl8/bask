export interface TaskArg {
  /** A one-character short flag, like `w` for `-w`. */
  short?: string
  /** A boolean is `true` when passed. A string takes a value. */
  type?: "boolean" | "string"
  /** Shown on the task's help page. */
  desc?: string
}

export type TaskArgs = Record<string, TaskArg>

// oxlint-disable-next-line typescript/no-generated-empty-object-type - a task with no args has no arg values
export type NoArgs = Record<never, never>

/** The value each declared arg has in a task's context. */
export type ArgValues<A extends TaskArgs> = {
  [K in keyof A]: A[K]["type"] extends "string" ? string | undefined : boolean
}

export type ArgValue = boolean | string | undefined

export interface ParsedTaskArgs {
  args: Record<string, ArgValue>
  positionals: readonly string[]
}

export interface TaskArgOptions {
  args?: TaskArgs
  positionals?: boolean
}

/** Returns the args of a task that got none: every boolean `false`, every string `undefined`, and no positionals. */
export const toEmptyArgs = (options: TaskArgOptions): ParsedTaskArgs => {
  const argEntries = Object.entries(options.args ?? {}).map(([name, arg]): [string, ArgValue] => [
    name,
    arg.type === "string" ? undefined : false,
  ])
  return { args: Object.fromEntries(argEntries), positionals: [] }
}
