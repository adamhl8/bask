#!/usr/bin/env bun

import path from "node:path"

import { getContext, isErr, messageChain } from "ts-explicit-errors"

import { findLocalCli, provideRunningCopy } from "#cli/local-cli.ts"
import { printError } from "#cli/print-error.ts"
import { runBask } from "#cli/run-bask.ts"

const cwd = process.cwd()

const main = async () => {
  // Hand off to the project's copy, so a global `bask` runs the version the project pins.
  // Leave `import` unwrapped, because the project's copy runs its whole CLI as it loads.
  const localCli = findLocalCli(cwd, import.meta.path)
  if (localCli && !localCli.isRunning) {
    await import(localCli.cliPath)
    return
  }
  if (!localCli) await provideRunningCopy()

  const exitCode = await runBask(process.argv.slice(2), path.join(cwd, "bask.ts"))
  if (isErr(exitCode)) {
    printError(messageChain(exitCode))
    process.exitCode = getContext<number>(exitCode, "exitCode") ?? 1
    return
  }
  // Leave `process.exitCode` alone on success, because the task may have set it.
  if (exitCode !== 0) process.exitCode = exitCode
}

await main()
