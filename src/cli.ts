#!/usr/bin/env bun

import path from "node:path"
import { parseArgs } from "node:util"

import bun from "bun"

import { BaskFileError, formatTaskList, getTaskIndex, list, setBaskModule } from "#registry.ts"
import { getFailedTask } from "#task.ts"
import type { Task } from "#task.ts"
import { printError } from "#utils.ts"

const cwd = process.cwd()

const isModule = (value: unknown): value is Record<string, unknown> => typeof value === "object" && Boolean(value)

const isParseArgsError = (error: unknown): error is TypeError & { code: string } =>
  error instanceof TypeError &&
  "code" in error &&
  typeof error.code === "string" &&
  error.code.startsWith("ERR_PARSE_ARGS_")

/** Finds the project's own bask CLI, so a global `bask` runs the version the project pins. */
const resolveLocalCli = () => {
  try {
    return bun.resolveSync("@adamhl8/bask/cli", cwd)
  } catch {
    return
  }
}

/** Lists `node_modules/.bin` for `dir` and each of its parents, nearest first. */
const getBinDirs = (dir: string): string[] => {
  const binDir = path.join(dir, "node_modules", ".bin")
  const parent = path.dirname(dir)
  return parent === dir ? [binDir] : [binDir, ...getBinDirs(parent)]
}

/** Prepends the project's `.bin` folders to `PATH`, like `bun run` does, so tasks can run installed bins by name. */
const addBinDirsToPath = () => {
  // oxlint-disable-next-line node/no-process-env - commands in `sh` look up bins on this `PATH`
  process.env["PATH"] = [...getBinDirs(cwd), process.env["PATH"]].filter(Boolean).join(path.delimiter)
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

  const baskPath = path.join(cwd, "bask.ts")
  if (!(await bun.file(baskPath).exists())) {
    printError(`no bask.ts in ${cwd}`)
    process.exitCode = 1
    return
  }

  addBinDirsToPath()
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
