import fs from "node:fs"
import path from "node:path"

import bun from "bun"
import { attempt, isErr } from "ts-explicit-errors"

/** The project's own copy of bask's CLI. */
export interface LocalCli {
  cliPath: string
  /** Whether the project's copy is the running copy, in which case bask doesn't hand off. */
  isRunning: boolean
}

// Treat a copy as installed only when a `node_modules` is up the tree.
// Without one, Bun resolves a package by installing it from the registry.
const hasNodeModules = (dir: string): boolean => {
  if (fs.existsSync(path.join(dir, "node_modules"))) return true
  const parentDir = path.dirname(dir)
  return parentDir !== dir && hasNodeModules(parentDir)
}

/**
 * Finds the bask CLI installed in the project at `cwd`, or `undefined` when there isn't one. `runningCliPath` is the
 * running CLI's own path, which the project's copy matches when it's the one running.
 */
export const findLocalCli = (cwd: string, runningCliPath: string): LocalCli | undefined => {
  if (!hasNodeModules(cwd)) return undefined

  const cliPath = attempt(() => bun.resolveSync("@adamhl8/bask/cli", cwd))
  if (isErr(cliPath)) return undefined

  return { cliPath, isRunning: cliPath === runningCliPath }
}

/**
 * Serves this copy's exports as `@adamhl8/bask`, so a `bask.ts` with no local copy gets the running one. `isTask` only
 * recognizes tasks made by its own copy, and Bun would otherwise auto-install another.
 */
export const provideRunningCopy = async () => {
  const exports = await import("#index.ts")
  // Use `build.module` because a runtime plugin's `onResolve` never fires for a bare package name.
  bun.plugin({
    name: "bask-running-copy",
    setup: (build) => {
      build.module("@adamhl8/bask", () => ({ exports, loader: "object" }))
    },
  })
}
