import { object } from "@optique/core/constructs"
import { commandLine, message } from "@optique/core/message"
import { optional, withDefault } from "@optique/core/modifiers"
import { argument, flag } from "@optique/core/primitives"
import { string } from "@optique/core/valueparser"
import type { ValueParser } from "@optique/core/valueparser"

import type { TaskIndex } from "#bask-file/task-index.ts"

/** Builds the parser for bask's own args, with `taskName` checking the task name. */
export const toBaskParser = (taskName: ValueParser<"sync", string>) =>
  object({
    list: withDefault(flag("-l", "--list", { description: message`List the tasks` }), false),
    help: withDefault(flag("-h", "--help", { description: message`Show bask's help, or a task's help` }), false),
    version: withDefault(flag("--version", { description: message`Show bask's version` }), false),
    task: optional(argument(taskName, { description: message`The task to run (default: the default export)` })),
  })

/** Accepts any task name, for parsing bask's args before bask.ts loads and its task names are known. */
export const anyTaskName = string({ metavar: "TASK" })

/**
 * Checks a task name against every name and alias that runs a task. It looks names up itself because `choice()` throws
 * on an empty list, which a bask.ts with no tasks has.
 */
export const toTaskNameParser = (tasks: TaskIndex): ValueParser<"sync", string> => ({
  mode: "sync",
  metavar: "TASK",
  placeholder: "task",
  parse: (input) => {
    if (tasks.byName.has(input)) return { success: true, value: input }
    return {
      success: false,
      error: message`Unknown task ${input}. Run ${commandLine("bask --list")} to see the tasks.`,
    }
  },
  format: String,
})
