#!/usr/bin/env bun

import path from "node:path"
import { parseArgs, styleText } from "node:util"

import bun from "bun"

import { BaskFileError, formatTaskList, getTaskIndex, list, setBaskModule } from "#registry.ts"
import { getFailedTask } from "#task.ts"
import type { Task } from "#task.ts"

const isModule = (value: unknown): value is Record<string, unknown> => typeof value === "object" && Boolean(value)

// Write to `process.stderr` directly because Bun colors all `console.error` output red in a terminal.
const printError = (message: string) => {
  process.stderr.write(`${styleText(["bold", "red"], "error:", { stream: process.stderr })} ${message}\n`)
}

const isParseArgsError = (error: unknown): error is TypeError & { code: string } =>
  error instanceof TypeError &&
  "code" in error &&
  typeof error.code === "string" &&
  error.code.startsWith("ERR_PARSE_ARGS_")

/** Finds the project's own bask CLI, so a global `bask` runs the version the project pins. */
const resolveLocalCli = () => {
  try {
    return bun.resolveSync("@adamhl8/bask/cli", process.cwd())
  } catch {
    return
  }
}

const parseCliArgs = () => {
  try {
    return parseArgs({ options: { list: { type: "boolean", short: "l" } }, allowPositionals: true })
  } catch (error) {
    if (!isParseArgsError(error)) throw error
    printError(error.message)
    process.exitCode = 2
    return
  }
}

/** Runs a task and reports a failed command in one line, naming the innermost task that failed. */
const runTask = async (taskToRun: Task, taskName: string) => {
  try {
    await taskToRun()
  } catch (error) {
    // Rethrow anything else, because a bug in a task file needs its stack trace.
    if (!(error instanceof bun.$.ShellError)) throw error

    const failedTask = getFailedTask(error)
    const failedEntry = getTaskIndex()
      .values()
      .find((entry) => entry.task === failedTask)
    // Fall back to the task you ran, because a task that isn't exported has no name.
    const failedName = failedEntry?.name ?? taskName
    printError(`task '${failedName}' failed with exit code ${error.exitCode}`)
    process.exitCode = error.exitCode
  }
}

const main = async () => {
  // Import the local CLI and stop, because it runs its own `main` when loaded.
  // The local copy resolves to its own path, so it skips this and runs normally.
  const localCli = resolveLocalCli()
  if (localCli && localCli !== import.meta.path) {
    await import(localCli)
    return
  }

  const args = parseCliArgs()
  if (!args) return
  const { values, positionals } = args

  const baskPath = path.resolve("bask.ts")
  if (!(await bun.file(baskPath).exists())) {
    printError(`no bask.ts in ${process.cwd()}`)
    process.exitCode = 1
    return
  }

  const baskModule: unknown = await import(baskPath)
  if (!isModule(baskModule)) throw new Error("failed to import bask.ts")
  try {
    setBaskModule(baskModule)
  } catch (error) {
    if (!(error instanceof BaskFileError)) throw error
    printError(error.message)
    process.exitCode = 1
    return
  }

  const [taskName] = positionals

  if (values.list || (taskName === undefined && !getTaskIndex().has("default"))) {
    await runTask(list, "list")
    return
  }

  const selectedEntry = getTaskIndex().get(taskName ?? "default")

  if (!selectedEntry) {
    printError(`unknown task '${taskName ?? "default"}'`)
    process.stderr.write(`\n${formatTaskList()}\n`)
    process.exitCode = 1
    return
  }

  await runTask(selectedEntry.task, selectedEntry.name)
}

await main()
