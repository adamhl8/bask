#!/usr/bin/env bun

import path from "node:path"

import bun from "bun"
import type { Result } from "ts-explicit-errors"
import { attempt, getContext, isErr, messageChain } from "ts-explicit-errors"

import { printError } from "#cli/print-error.ts"
import { runBask } from "#cli/run-bask.ts"

const cwd = process.cwd()

/** Finds the project's own bask CLI, so a global `bask` runs the version the project pins. */
const resolveLocalCli = () => {
  const localCli = attempt(() => bun.resolveSync("@adamhl8/bask/cli", cwd))
  if (isErr(localCli)) return
  return localCli
}

/** Hands off to the project's own bask CLI, or runs bask from this one and returns its exit code. */
const bask = async (): Promise<Result<number | undefined>> => {
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
  const exitCode = await bask()
  if (isErr(exitCode)) {
    printError(messageChain(exitCode))
    process.exitCode = getContext<number>(exitCode, "exitCode") ?? 1
    return
  }
  // Leave the exit code alone after a hand-off, because the local CLI sets its own.
  if (exitCode !== undefined) process.exitCode = exitCode
}

await main()
