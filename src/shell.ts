import { styleText } from "node:util"

import bun from "bun"
import type { $ as BunShell, ShellExpression } from "bun"

type ShellEnv = Parameters<BunShell.ShellPromise["env"]>[0]

/** Changes each method of `T` that returns `From` to return `To`, keeping Bun's docs on it. */
type Rechain<T, From, To> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => From ? (...args: Args) => To : T[K]
}

// Leave out `stdin` because Bun's types declare it but the runtime doesn't have it.
type BunCommandMethods = Omit<BunShell.ShellPromise, keyof Promise<BunShell.ShellOutput> | "stdin">

// Treat every other member of Bun's `$` as a setting, so a new one fails to compile until `createShell` handles it.
type ShellSettingKey = Exclude<keyof BunShell, "braces" | "escape" | "Shell" | "ShellError" | "ShellPromise">

/** Runs commands like Bun's `$`, with settings that apply to every later command from the same shell. */
export interface Shell extends Rechain<Pick<BunShell, ShellSettingKey>, BunShell, Shell> {
  (strings: TemplateStringsArray, ...expressions: ShellExpression[]): ShellCommand
}

/** Formats an interpolated value the way Bun's shell escapes it. */
const formatExpression = (expression: ShellExpression): string => {
  if (Array.isArray(expression)) return expression.map(formatExpression).join(" ")
  if (typeof expression === "object" && expression !== null && "raw" in expression) return expression.raw
  // Print streams, files, and subprocesses as their default string because they have no command text.
  // oxlint-disable-next-line typescript/no-base-to-string
  return bun.$.escape(String(expression))
}

/** Checks whether bask should turn on color for a command whose output goes to the terminal. */
const shouldForceColor = (env: NonNullable<ShellEnv>) =>
  process.stdout.isTTY &&
  process.stderr.isTTY &&
  // oxlint-disable-next-line node/no-process-env - check the user's own color settings
  [process.env, env].every((vars) => vars["FORCE_COLOR"] === undefined && vars["NO_COLOR"] === undefined)

/**
 * Wraps Bun's `ShellPromise` to set `FORCE_COLOR` only on commands whose output is shown. Bun's pipes hide the terminal
 * from commands, so they turn color off unless forced.
 */
class ShellCommand
  implements PromiseLike<BunShell.ShellOutput>, Rechain<BunCommandMethods, BunShell.ShellPromise, ShellCommand>
{
  readonly #promise: BunShell.ShellPromise
  #env: ShellEnv
  #isQuiet = false
  #isPrepared = false

  public constructor(promise: BunShell.ShellPromise, env: ShellEnv) {
    this.#promise = promise
    this.#env = env
  }

  public cwd(newCwd: string) {
    void this.#promise.cwd(newCwd)
    return this
  }

  public env(newEnv: ShellEnv) {
    this.#env = newEnv
    return this
  }

  public quiet(isQuiet = true) {
    void this.#promise.quiet(isQuiet)
    this.#isQuiet = isQuiet
    return this
  }

  public nothrow() {
    void this.#promise.nothrow()
    return this
  }

  public throws(shouldThrow: boolean) {
    void this.#promise.throws(shouldThrow)
    return this
  }

  public async text(encoding?: BufferEncoding) {
    return this.#prepare(false).text(encoding)
  }

  public async json() {
    // oxlint-disable-next-line typescript/no-unsafe-return - match Bun's `json()`, which returns `any`
    return this.#prepare(false).json()
  }

  public lines() {
    return this.#prepare(false).lines()
  }

  public async arrayBuffer() {
    return this.#prepare(false).arrayBuffer()
  }

  public async blob() {
    return this.#prepare(false).blob()
  }

  // oxlint-disable-next-line unicorn/no-thenable - awaiting a command runs it, like Bun's `ShellPromise`
  public async then<TResult1 = BunShell.ShellOutput, TResult2 = never>(
    onfulfilled?: ((value: BunShell.ShellOutput) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.#prepare(!this.#isQuiet).then(onfulfilled, onrejected)
  }

  public async catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null) {
    return this.then(undefined, onrejected)
  }

  public async finally(onfinally?: (() => void) | null) {
    return this.#prepare(!this.#isQuiet).finally(onfinally)
  }

  /** Sets the command's environment once, before Bun starts the command. */
  // oxlint-disable-next-line typescript/promise-function-async - an async function would await the command and start it
  #prepare(isShown: boolean) {
    // Skip a command that already started, because Bun rejects `env` on it.
    if (this.#isPrepared) return this.#promise
    this.#isPrepared = true

    // Pass `process.env` even without color because Bun copies it when the command is created, not when it runs.
    // oxlint-disable-next-line node/no-process-env - read the environment as it is when the command runs
    const env = this.#env ?? process.env
    void this.#promise.env(isShown && shouldForceColor(env) ? { ...env, FORCE_COLOR: "1" } : env)
    return this.#promise
  }
}

/** Creates a shell that prints each command to stderr before running it. */
export const createShell = () => {
  // Use a separate instance so settings on Bun's global `$` or another shell don't apply here.
  const bunShell = new bun.$.Shell()
  // Keep `env` here instead of on `bunShell` because `ShellCommand` passes it when each command runs.
  let shellEnv: ShellEnv

  const run = (strings: TemplateStringsArray, ...expressions: ShellExpression[]) => {
    // Use `String.raw` because Bun's `$` also reads the raw template strings.
    const command = String.raw({ raw: strings.raw }, ...expressions.map(formatExpression))
    // Write to `process.stderr` directly because Bun colors `console.error` output red in a terminal.
    process.stderr.write(`${styleText("bold", command.trim(), { stream: process.stderr })}\n`)
    return new ShellCommand(bunShell(strings, ...expressions), shellEnv)
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
  })

  return shell
}
