#!/usr/bin/env bun

import path from "node:path"

import bun from "bun"
import type { Result } from "ts-explicit-errors"
import { attempt, getContext, isErr, messageChain } from "ts-explicit-errors"

import { runBask } from "#run-bask.ts"
import { printError } from "#utils.ts"

const cwd = process.cwd()

/** Finds the project's own bask CLI, so a global `bask` runs the version the project pins. */
const resolveLocalCli = () => {
  const localCli = attempt(() => bun.resolveSync("@adamhl8/bask/cli", cwd))
  if (isErr(localCli)) return
  return localCli
}

/** Hands off to the project's own bask CLI, or runs bask from this one. */
const bask = async (): Promise<Result> => {
  // Import the local CLI and stop, because it runs its own `main` when loaded.
  // The local copy resolves to its own path, so it skips this and runs normally.
  const localCli = resolveLocalCli()
  if (localCli && localCli !== import.meta.path) {
    await import(localCli)
    return
  }

  return runBask(process.argv.slice(2), path.join(cwd, "bask.ts"))
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
