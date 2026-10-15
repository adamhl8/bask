#!/usr/bin/env bun

import path from "node:path"
import { parseArgs } from "node:util"

import bun from "bun"

import { formatTaskList, list, setBaskModule } from "#list.ts"
import { toExportName } from "#names.ts"
import { isTask } from "#task.ts"

const isModule = (value: unknown): value is Record<string, unknown> => typeof value === "object" && Boolean(value)

/** Finds the project's own bask CLI, so a global `bask` runs the version the project pins. */
const resolveLocalCli = () => {
  try {
    return bun.resolveSync("@adamhl8/bask/cli", process.cwd())
  } catch {
    return
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

  const { values, positionals } = parseArgs({
    options: { list: { type: "boolean", short: "l" } },
    allowPositionals: true,
  })

  const baskModule: unknown = await import(path.resolve("bask.ts"))
  if (!isModule(baskModule)) throw new Error("failed to import bask.ts")
  setBaskModule(baskModule)

  const [taskName] = positionals
  const hasDefaultTask = isTask(baskModule["default"])

  if (values.list || (taskName === undefined && !hasDefaultTask)) {
    await list()
    return
  }

  const selectedName = taskName ?? "default"
  const selectedTask = baskModule[toExportName(selectedName)]

  if (!isTask(selectedTask)) {
    console.error(`Unknown task "${selectedName}".\n\n${formatTaskList()}`)
    process.exitCode = 1
    return
  }

  await selectedTask()
}

await main()
