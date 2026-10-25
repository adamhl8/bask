import bun from "bun"
import type { ShellExpression } from "bun"

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
   * Change the default environment variables for commands run by this shell.
   *
   * @default process.env
   */
  env: (newEnv?: ShellEnv) => Shell
  /** Configure the shell to not throw an exception on non-zero exit codes. */
  nothrow: () => Shell
  /**
   * Configure whether the shell should throw an exception on non-zero exit codes.
   *
   * @default true
   */
  throws: (shouldThrow: boolean) => Shell
  /**
   * Configure whether the shell prints each command before running it.
   *
   * @default true
   */
  echo: (shouldEcho: boolean) => Shell
  /**
   * Configure whether `node_modules` bins and other `node` commands run under Bun (like Bun's `--bun` flag).
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

/** Creates a shell that prints each command to stderr before running it. */
export const createShell = () => {
  // Use a separate instance so settings on Bun's global `$` or another shell don't apply here.
  const bunShell = new bun.$.Shell()
  // Keep `env` here instead of on `bunShell` because `ShellCommand` passes it when each command runs.
  let shellEnv: ShellEnv
  let shouldEcho = true
  let shouldUseBun = true

  const run = (strings: TemplateStringsArray, ...expressions: ShellExpression[]) => {
    // Use `String.raw` because Bun's `$` also reads the raw template strings.
    const command = String.raw({ raw: strings.raw }, ...expressions.map(formatExpression)).trim()
    return new ShellCommand(bunShell(strings, ...expressions), { command, env: shellEnv, shouldEcho, shouldUseBun })
  }

  const shell: Shell = Object.assign(run, {
    cwd: (newCwd?: string) => {
      bunShell.cwd(newCwd)
      return shell
    },
    env: (newEnv?: ShellEnv) => {
      shellEnv = newEnv
      return shell
    },
    nothrow: () => {
      bunShell.nothrow()
      return shell
    },
    throws: (shouldThrow: boolean) => {
      bunShell.throws(shouldThrow)
      return shell
    },
    echo: (newShouldEcho: boolean) => {
      shouldEcho = newShouldEcho
      return shell
    },
    bun: (newShouldUseBun: boolean) => {
      shouldUseBun = newShouldUseBun
      return shell
    },
  })

  return shell
}
