import bun from "bun"

import type { ShellConfig } from "#config.ts"
import { ShellCommand } from "#shell/command.ts"
import type { ShellEnv } from "#shell/command.ts"

/** A value interpolated into a command. `{ raw }` goes in as written, and an array's items become separate words. */
export type ShellValue = string | number | { raw: string } | readonly ShellValue[]

/** Runs commands in `/bin/sh`, with settings that apply to every later command from the same shell. */
export interface Shell {
  (strings: TemplateStringsArray, ...values: ShellValue[]): ShellCommand
  /**
   * Change the default working directory for commands run by this shell.
   *
   * @default process.cwd()
   */
  cwd: (newCwd?: string) => Shell
  /**
   * Add environment variables for commands run by this shell, on top of `process.env` as it was when `bask.ts` loaded
   * and `baskConfig`. Set one to `undefined` to remove it. With no argument, go back to the `baskConfig` variables.
   */
  env: (newEnv?: ShellEnv) => Shell
  /** Configure commands run by this shell to only buffer their output instead of writing it to the terminal. */
  quiet: (isQuiet?: boolean) => Shell
  /** Configure commands run by this shell to not throw an exception on non-zero exit codes. */
  nothrow: () => Shell
  /**
   * Configure whether commands run by this shell throw an exception on non-zero exit codes.
   *
   * @default true
   */
  throws: (shouldThrow: boolean) => Shell
  /**
   * Configure whether this shell prints each command before running it.
   *
   * @default true
   */
  echo: (shouldEcho: boolean) => Shell
  /**
   * Configure whether this shell runs `node_modules` bins and `node` under Bun (like Bun's `--bun` flag).
   *
   * @default true
   */
  bun: (shouldUseBun: boolean) => Shell
}

/** Formats an interpolated value as shell words. */
const formatValue = (value: ShellValue): string => {
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return bun.$.escape(value)
  if ("raw" in value) return value.raw
  return value.map(formatValue).join(" ")
}

/** Creates a shell that prints each command to stderr before running it, starting from `shellConfig`. */
export const createShell = (shellConfig: ShellConfig) => {
  // Copy `shellConfig` so this shell's changes don't reach other shells.
  const settings: ShellConfig = { ...shellConfig }

  const run = (strings: TemplateStringsArray, ...values: ShellValue[]) => {
    // Use the raw template strings so a `\n` reaches the shell as written, for commands like `printf` to read.
    const commandString = String.raw({ raw: strings.raw }, ...values.map(formatValue)).trim()
    return new ShellCommand(commandString, settings)
  }

  const shell: Shell = Object.assign(run, {
    cwd: (newCwd?: string) => {
      settings.cwd = newCwd ?? shellConfig.cwd
      return shell
    },
    env: (newEnv?: ShellEnv) => {
      settings.env = newEnv === undefined ? shellConfig.env : { ...settings.env, ...newEnv }
      return shell
    },
    quiet: (isQuiet = true) => {
      settings.quiet = isQuiet
      return shell
    },
    nothrow: () => {
      settings.throws = false
      return shell
    },
    throws: (shouldThrow: boolean) => {
      settings.throws = shouldThrow
      return shell
    },
    echo: (shouldEcho: boolean) => {
      settings.echo = shouldEcho
      return shell
    },
    bun: (shouldUseBun: boolean) => {
      settings.bun = shouldUseBun
      return shell
    },
  })

  return shell
}
