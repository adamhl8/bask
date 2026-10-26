#!/usr/bin/env bun

import path from "node:path"
import { parseArgs } from "node:util"

import bun from "bun"
import type { Result } from "ts-explicit-errors"
import { attempt, err, getContext, isErr, messageChain } from "ts-explicit-errors"

import { loadBaskFile } from "#bask-file/bask-file.ts"
import { formatTaskList, list } from "#bask-file/list.ts"
import type { TaskIndex } from "#bask-file/task-index.ts"
import { hasHiddenOutput } from "#shell/command.ts"
import { getFailedTask } from "#task.ts"
import type { Task } from "#task.ts"
import { printError } from "#utils.ts"

const cwd = process.cwd()

/** Finds the project's own bask CLI, so a global `bask` runs the version the project pins. */
const resolveLocalCli = () => {
  const localCli = attempt(() => bun.resolveSync("@adamhl8/bask/cli", cwd))
  if (isErr(localCli)) return
  return localCli
}

/** Runs a task and returns a failed command as an error that names the innermost task that failed. */
const runTask = async (tasks: TaskIndex, taskToRun: Task, taskName: string): Promise<Result> => {
  const error = await attempt(async () => taskToRun())
  if (!error) return
  // Rethrow anything else, because a bug in a task file needs its stack trace.
  if (!(error instanceof bun.$.ShellError)) throw error

  // Print the output of a command that hid it, because it usually explains the failure.
  if (hasHiddenOutput(error)) {
    process.stdout.write(error.stdout)
    process.stderr.write(error.stderr)
  }

  const failedTask = getFailedTask(error)
  const failedEntry = failedTask && tasks.byTask.get(failedTask)
  // Fall back to the task you ran, because a task that isn't exported has no name.
  const failedName = failedEntry?.name ?? taskName
  return err(`task '${failedName}' failed with exit code ${error.exitCode}`, undefined, { exitCode: error.exitCode })
}

/** Runs the task named on the command line, or lists the tasks. */
const bask = async (): Promise<Result> => {
  // Import the local CLI and stop, because it runs its own `main` when loaded.
  // The local copy resolves to its own path, so it skips this and runs normally.
  const localCli = resolveLocalCli()
  if (localCli && localCli !== import.meta.path) {
    await import(localCli)
    return
  }

  const args = attempt(() => parseArgs({ options: { list: { type: "boolean", short: "l" } }, allowPositionals: true }))
  // Copy the message to leave out the `TypeError` name, which `messageChain` prints.
  if (isErr(args)) return err(args.message, undefined, { exitCode: 2 })
  const { values: flags, positionals } = args

  const baskFile = await loadBaskFile(path.join(cwd, "bask.ts"))
  if (isErr(baskFile)) return baskFile
  const { tasks } = baskFile

  const [taskName] = positionals
  const resolvedTaskName = taskName ?? "default"
  const selectedTaskEntry = tasks.byName.get(resolvedTaskName)

  // List the tasks when asked, or when no task is named and there's no default to run.
  if (flags.list || (taskName === undefined && !selectedTaskEntry)) return runTask(tasks, list, "list")

  if (!selectedTaskEntry) return err(`unknown task '${resolvedTaskName}'\n\n${formatTaskList(tasks)}`, undefined)

  const { task, name } = selectedTaskEntry
  return runTask(tasks, task, name)
}

const main = async () => {
  const result = await bask()
  if (isErr(result)) {
    printError(messageChain(result))
    // Set the exit code only on an error, because the local CLI sets its own.
    process.exitCode = getContext<number>(result, "exitCode") ?? 1
  }
}

await main()
