import path from "node:path"

import bun from "bun"
import type { Result } from "ts-explicit-errors"
import { attempt, err, getContext, isErr, messageChain } from "ts-explicit-errors"

import { setLoadedBaskFile } from "#bask-file/loaded.ts"
import { indexTasks } from "#bask-file/task-index.ts"
import type { TaskIndex } from "#bask-file/task-index.ts"
import { isBaskConfig, resolveShellConfig } from "#config.ts"
import type { BaskConfig, BaskConfigInput } from "#config.ts"
import { addBinDirsToPath } from "#shell/bin-dirs.ts"
import { isTask } from "#task.ts"

/** The exports of `bask.ts`, before bask checks them. */
export interface BaskFileExports {
  default?: unknown
  baskConfig?: unknown
  [exportName: string]: unknown
}

export interface BaskFile {
  tasks: TaskIndex
  /** The `baskConfig` export with its defaults filled in, and `shell.env` holding the whole starting environment. */
  config: BaskConfig
}

/** Returns a single error as is, or joins several into one error under a count with one per line. */
const joinBaskFileErrors = (baskFileErrors: Error[]) => {
  const [onlyError] = baskFileErrors
  if (onlyError && baskFileErrors.length === 1) return onlyError
  const lines = baskFileErrors.map((error) => `  ${messageChain(error)}`)
  return err([`bask.ts has ${baskFileErrors.length} problems:`, ...lines].join("\n"), undefined)
}

const isBaskFileExports = (value: unknown): value is BaskFileExports => typeof value === "object" && value !== null

/** Imports `bask.ts`, and returns an error that marks it invalid instead of throwing it. */
const importBaskFile = async (baskPath: string): Promise<Result<BaskFileExports>> => {
  const baskFileExports: unknown = await attempt(async (): Promise<unknown> => import(baskPath))
  if (isErr(baskFileExports) && getContext(baskFileExports, "invalidBaskFile")) return baskFileExports

  // Rethrow any other error, because a bug in `bask.ts` needs its stack trace.
  if (isErr(baskFileExports)) throw baskFileExports

  if (!isBaskFileExports(baskFileExports)) return err("failed to import bask.ts", undefined)

  return baskFileExports
}

/** Validates the exports of `bask.ts` and indexes its tasks. */
const resolveBaskFileExports = (
  baskFileExports: BaskFileExports,
): Result<{ tasks: TaskIndex; config: BaskConfigInput }> => {
  // Collect every error before returning, so one run reports all of them.
  const baskFileErrors: Error[] = []

  const { default: defaultExport, baskConfig } = baskFileExports

  // Reject a non-task default because bask runs it when no task is named, so it's always a mistake.
  if (defaultExport !== undefined && !isTask(defaultExport))
    baskFileErrors.push(err("the default export isn't a task. Wrap it in task().", undefined))

  let config: BaskConfigInput = {}
  if (isBaskConfig(baskConfig)) config = baskConfig
  else if (baskConfig !== undefined)
    baskFileErrors.push(err("baskConfig isn't a config. Wrap it in defineConfig().", undefined))

  const { tasks, errors: taskErrors } = indexTasks(baskFileExports)
  baskFileErrors.push(...taskErrors)

  if (baskFileErrors.length > 0) return joinBaskFileErrors(baskFileErrors)

  return { tasks, config }
}

/** Imports and validates `bask.ts`, then stores it for tasks to read when they run. */
export const loadBaskFile = async (baskPath: string): Promise<Result<BaskFile>> => {
  const baskDir = path.dirname(baskPath)
  if (!(await bun.file(baskPath).exists())) return err(`no bask.ts in ${baskDir}`, undefined)

  // Add the bin dirs before the import because loading copies `process.env` for every shell.
  addBinDirsToPath(baskDir)
  const baskFileExports = await importBaskFile(baskPath)
  if (isErr(baskFileExports)) return baskFileExports

  const resolvedExports = resolveBaskFileExports(baskFileExports)
  if (isErr(resolvedExports)) return resolvedExports

  const { tasks, config } = resolvedExports
  // Copy `process.env` once `bask.ts` has loaded, so later changes to it don't reach commands.
  const resolvedShellConfig = resolveShellConfig(config.shell ?? {}, process.env)
  const baskFile: BaskFile = { tasks, config: { shell: resolvedShellConfig } }
  setLoadedBaskFile(baskFile)

  return baskFile
}
