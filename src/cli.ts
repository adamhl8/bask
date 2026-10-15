#!/usr/bin/env bun

import path from "node:path"
import { parseArgs } from "node:util"

import { formatTaskList, list, setBaskModule } from "#list.ts"
import { toExportName } from "#names.ts"
import { isTask } from "#task.ts"

const isModule = (value: unknown): value is Record<string, unknown> => typeof value === "object" && Boolean(value)

const main = async () => {
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
