import { object } from "@optique/core/constructs"
import { message, text } from "@optique/core/message"
import { map, multiple, optional, withDefault } from "@optique/core/modifiers"
import type { Parser } from "@optique/core/parser"
import { argument, constant, flag, option } from "@optique/core/primitives"
import type { OptionName } from "@optique/core/usage"
import { string } from "@optique/core/valueparser"
import type { Result } from "ts-explicit-errors"
import { attempt, err, isErr } from "ts-explicit-errors"

import { joinBaskFileErrors } from "#bask-file/bask-file.ts"
import type { TaskIndex } from "#bask-file/task-index.ts"
import { toEmptyArgs } from "#task/args.ts"
import type { ArgValue, ParsedTaskArgs, TaskArg, TaskArgOptions } from "#task/args.ts"
import { toKebabCase } from "#utils.ts"

export type TaskParser = Parser<"sync", ParsedTaskArgs>

type ArgParser = Parser<"sync", ArgValue>

const SHORT_FLAG = /^[\dA-Za-z]$/v

const toArgParser = (name: string, arg: TaskArg): ArgParser => {
  const longName = `--${toKebabCase(name)}` as const
  const names: readonly [OptionName, ...OptionName[]] =
    arg.short === undefined ? [longName] : [`-${arg.short}`, longName]
  const argOptions = arg.desc === undefined ? {} : { description: message`${text(arg.desc)}` }
  if (arg.type === "string") return optional(option(...names, string({ metavar: "VALUE" }), argOptions))
  return withDefault(flag(...names, argOptions), false)
}

/** Builds the Optique parser for a task's args. Throws Optique's error when two args share a flag. */
export const toTaskParser = (options: TaskArgOptions): TaskParser => {
  const argParsers = Object.entries(options.args ?? {}).map(([name, arg]): [string, ArgParser] => [
    name,
    toArgParser(name, arg),
  ])
  const positionals = options.positionals ? multiple(argument(string({ metavar: "ARG" }))) : constant([])
  const emptyArgs = toEmptyArgs(options)
  // Merge over the empty args because Optique leaves out a string arg that wasn't passed.
  const argsParser = object(Object.fromEntries(argParsers))
  return map(object({ args: argsParser, positionals }), (parsed) => ({
    args: { ...emptyArgs.args, ...parsed.args },
    positionals: parsed.positionals,
  }))
}

/** Checks one task's arg declarations, and returns why they're invalid. */
const checkTaskArgs = (exportName: string, options: TaskArgOptions): Result => {
  for (const [argName, { short }] of Object.entries(options.args ?? {})) {
    if (short !== undefined && !SHORT_FLAG.test(short)) {
      return err(
        `task '${exportName}' has arg '${argName}' with short '${short}'. A short must be one letter or digit.`,
        undefined,
      )
    }
  }

  const parser = attempt(() => toTaskParser(options))
  // Copy Optique's message to leave out its error name, which `messageChain` prints.
  if (isErr(parser)) return err(`task '${exportName}' has invalid args: ${parser.message}`, undefined)
}

/** Checks every task's arg declarations, and returns every problem as a `bask.ts` problem. */
export const checkAllTaskArgs = (tasks: TaskIndex): Result => {
  const taskArgErrors = Array.from(tasks.byTask.values(), ({ exportName, task }) =>
    checkTaskArgs(exportName, task.options),
  ).filter(isErr)
  if (taskArgErrors.length > 0) return joinBaskFileErrors(taskArgErrors)
}
