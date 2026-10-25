import { styleText } from "node:util"

import type { $ as BunShell } from "bun"

import { addNodeShim, removeNodeShims } from "#shell/node-shim.ts"

export type ShellEnv = Parameters<BunShell.ShellPromise["env"]>[0]

/**
 * Checks whether bask should turn on color for a command whose output goes to the terminal. Bun's pipes hide the
 * terminal from commands, so they turn color off unless forced.
 */
const shouldForceColor = (env: NonNullable<ShellEnv>) =>
  process.stdout.isTTY
  && process.stderr.isTTY
  && [process.env, env].every((vars) => vars["FORCE_COLOR"] === undefined && vars["NO_COLOR"] === undefined)

/** Wraps Bun's `ShellPromise` to print the command and set its environment when it runs. */
export class ShellCommand implements PromiseLike<BunShell.ShellOutput> {
  readonly #promise: BunShell.ShellPromise
  readonly #command: string
  #env: ShellEnv
  #shouldEcho: boolean
  #shouldUseBun: boolean
  #isQuiet = false
  #isPrepared = false

  public constructor(
    promise: BunShell.ShellPromise,
    {
      command,
      env,
      shouldEcho,
      shouldUseBun,
    }: { command: string; env: ShellEnv; shouldEcho: boolean; shouldUseBun: boolean },
  ) {
    this.#promise = promise
    this.#command = command
    this.#env = env
    this.#shouldEcho = shouldEcho
    this.#shouldUseBun = shouldUseBun
  }

  /**
   * Change the current working directory of the shell.
   *
   * @default process.cwd()
   */
  public cwd(newCwd: string) {
    void this.#promise.cwd(newCwd)
    return this
  }

  /**
   * Set environment variables for the shell.
   *
   * @default process.env
   */
  public env(newEnv: ShellEnv) {
    this.#env = newEnv
    return this
  }

  /** Configure the shell to only buffer the output instead of also writing it to stdout and stderr. */
  public quiet(isQuiet = true) {
    void this.#promise.quiet(isQuiet)
    this.#isQuiet = isQuiet
    return this
  }

  /** Configure the shell to not throw an exception on non-zero exit codes. */
  public nothrow() {
    void this.#promise.nothrow()
    return this
  }

  /**
   * Configure whether the shell should throw an exception on non-zero exit codes.
   *
   * @default true
   */
  public throws(shouldThrow: boolean) {
    void this.#promise.throws(shouldThrow)
    return this
  }

  /**
   * Configure whether the shell prints the command before running it.
   *
   * @default true
   */
  public echo(shouldEcho: boolean) {
    this.#shouldEcho = shouldEcho
    return this
  }

  /**
   * Configure whether `node_modules` bins and other `node` commands run under Bun (like Bun's `--bun` flag).
   *
   * @default true
   */
  public bun(shouldUseBun: boolean) {
    this.#shouldUseBun = shouldUseBun
    return this
  }

  /** Read from stdout as a string. Automatically calls {@link quiet}. */
  public async text(encoding?: BufferEncoding) {
    return this.#prepare(false).text(encoding)
  }

  /** Read from stdout as a JSON object. Automatically calls {@link quiet}. */
  public async json() {
    // oxlint-disable-next-line typescript/no-unsafe-return - match Bun's `json()`, which returns `any`
    return this.#prepare(false).json()
  }

  /** Read from stdout as a string, line by line. Automatically calls {@link quiet}. */
  public lines() {
    return this.#prepare(false).lines()
  }

  /** Read from stdout as an ArrayBuffer. Automatically calls {@link quiet}. */
  public async arrayBuffer() {
    return this.#prepare(false).arrayBuffer()
  }

  /** Read from stdout as a Blob. Automatically calls {@link quiet}. */
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

  /** Prints the command and sets its environment once, before Bun starts the command. */
  // oxlint-disable-next-line typescript/promise-function-async - an async function would await the command and start it
  #prepare(isShown: boolean) {
    // Skip a command that already started, because Bun rejects `env` on it.
    if (this.#isPrepared) return this.#promise
    this.#isPrepared = true

    // Write to `process.stderr` directly because Bun colors `console.error` output red in a terminal.
    if (this.#shouldEcho) process.stderr.write(`${styleText("bold", this.#command, { stream: process.stderr })}\n`)

    // Read `process.env` here because Bun copies it when the command is created, not when it runs.
    const baseEnv = this.#env ?? process.env
    const env = this.#shouldUseBun ? addNodeShim(baseEnv) : removeNodeShims(baseEnv)

    const shouldAddColor = isShown && shouldForceColor(env)
    const commandEnv = shouldAddColor ? { ...env, FORCE_COLOR: "1" } : env

    void this.#promise.env(commandEnv)
    return this.#promise
  }
}
