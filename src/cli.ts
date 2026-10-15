#!/usr/bin/env bun

import path from "node:path"

import { isTask } from "#index.ts"

const isModule = (value: unknown): value is Record<string, unknown> => typeof value === "object" && Boolean(value)

/** Converts a kebab-case task name to the camelCase export name, so `bump-deps` finds `bumpDeps`. */
const toExportName = (taskName: string) => taskName.replaceAll(/-[a-z\d]/gv, (match) => match.slice(1).toUpperCase())

const main = async () => {
  const taskName = process.argv[2] ?? "default"

  const baskModule: unknown = await import(path.resolve("bask.ts"))
  if (!isModule(baskModule)) throw new Error("failed to import bask.ts")

  const selectedTask = baskModule[toExportName(taskName)]

  if (!isTask(selectedTask)) {
    const baskExports = Object.entries(baskModule)
    const taskExports = baskExports.filter(([, value]) => isTask(value) && !value.options.hidden)
    const taskNames = taskExports.map(([name]) => name)

    console.error(`Unknown task "${taskName}". Available tasks: ${taskNames.join(", ")}`)
    process.exitCode = 1
    return
  }

  await selectedTask()
}

await main()
