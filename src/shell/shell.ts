import bun from "bun"
import type { ShellExpression } from "bun"

import type { ShellConfig } from "#config.ts"
import { ShellCommand } from "#shell/command.ts"
import type { ShellEnv } from "#shell/command.ts"

/** Runs commands like Bun's `$`, with settings that apply to every later command from the same shell. */
export interface Shell {
  (strings: TemplateStringsArray, ...expressions: ShellExpression[]): ShellCommand
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
  /** Configure commands run by this shell to only buffer their output instead of also writing it to stdout and stderr. */
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

/** Formats an interpolated value the way Bun's shell escapes it. */
const formatExpression = (expression: ShellExpression): string => {
  if (Array.isArray(expression)) return expression.map(formatExpression).join(" ")
  if (typeof expression === "object" && expression !== null && "raw" in expression) return expression.raw
  // Print streams, files, and subprocesses as their default string because they have no command text.
  // oxlint-disable-next-line typescript/no-base-to-string - their default string is what bask prints
  return bun.$.escape(String(expression))
}

/** Creates a shell that prints each command to stderr before running it, starting from `shellConfig`. */
export const createShell = (shellConfig: ShellConfig) => {
  // Use a separate instance so settings on Bun's global `$` don't apply here.
  const bunShell = new bun.$.Shell()
  // Copy `shellConfig` so this shell's changes don't reach other shells.
  const settings: ShellConfig = { ...shellConfig }

  const run = (strings: TemplateStringsArray, ...expressions: ShellExpression[]) => {
    // Use `String.raw` because Bun's `$` also reads the raw template strings.
    const commandString = String.raw({ raw: strings.raw }, ...expressions.map(formatExpression)).trim()
    return new ShellCommand(bunShell(strings, ...expressions), commandString, settings)
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
