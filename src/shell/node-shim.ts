import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import type { ShellEnv } from "#shell/command.ts"

let nodeShimDir: string | undefined

/** Creates a temp folder whose `node` links to the running Bun, the same shim `bun run --bun` puts on `PATH`. */
const getNodeShimDir = () => {
  if (nodeShimDir !== undefined) return nodeShimDir

  // Use a fresh folder because another user could plant a `node` in a shared folder with a predictable name.
  const tempShimDir = fs.mkdtempSync(path.join(os.tmpdir(), "bask-node-"))
  fs.symlinkSync(process.execPath, path.join(tempShimDir, "node"))
  process.once("exit", () => {
    fs.rmSync(tempShimDir, { recursive: true, force: true })
  })

  nodeShimDir = tempShimDir
  return nodeShimDir
}

const NODE_SHIM_DIR = /^(?:bask|bun)-node-/v

/** Checks for a `node` shim folder from bask or from `bun run`, including one a parent process put on `PATH`. */
const isNodeShimDir = (dir: string) => NODE_SHIM_DIR.test(path.basename(dir))

/** Lists the `PATH` dirs without any `node` shim, including Bun's own. */
const getPathDirsWithoutShims = (PATH: string) => PATH.split(path.delimiter).filter((dir) => !isNodeShimDir(dir))

/** Takes every `node` shim off `PATH` so `node` is the real Node. */
export const removeNodeShims = (env: ShellEnv) => {
  const currentPath = env["PATH"]
  if (currentPath === undefined) return env

  const PATH = getPathDirsWithoutShims(currentPath).join(path.delimiter)

  return { ...env, PATH }
}

/** Puts bask's `node` shim first on `PATH`, in place of any other `node` shim. */
export const addNodeShim = (env: ShellEnv) => {
  const currentPath = env["PATH"]
  // Skip an env without `PATH` because adding one would change which commands it can find.
  if (currentPath === undefined) return env

  const PATH = [getNodeShimDir(), ...getPathDirsWithoutShims(currentPath)].join(path.delimiter)

  return { ...env, PATH }
}
