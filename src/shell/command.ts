import { styleText } from "node:util"

import bun from "bun"
import type { $ as BunShell } from "bun"

import type { ShellConfig } from "#config.ts"
import { addNodeShim, removeNodeShims } from "#shell/node-shim.ts"

export type ShellEnv = Record<string, string | undefined>

/**
 * Checks whether bask should turn on color for a command whose output goes to the terminal. Bun's pipes hide the
 * terminal from commands, so they turn color off unless forced.
 */
const shouldForceColor = (env: ShellEnv) =>
  process.stdout.isTTY && process.stderr.isTTY && env["FORCE_COLOR"] === undefined && env["NO_COLOR"] === undefined

const errorsWithHiddenOutput = new WeakSet<BunShell.ShellError>()

/** Checks whether the command that failed with `error` hid its output, so the CLI can print it. */
export const hasHiddenOutput = (error: BunShell.ShellError) => errorsWithHiddenOutput.has(error)

/** Records that a failed command hid its output, so the CLI can print it. */
const markHiddenOutput = (error: unknown) => {
  if (error instanceof bun.$.ShellError) errorsWithHiddenOutput.add(error)
}

/** Wraps Bun's `ShellPromise` to print the command and apply its settings when it runs. */
export class ShellCommand implements PromiseLike<BunShell.ShellOutput> {
  readonly #shellPromise: BunShell.ShellPromise
  readonly #commandString: string
  readonly #settings: ShellConfig
  #isPrepared = false

  /** Starts from the shell's settings, which the command's own methods can then override. */
  public constructor(shellPromise: BunShell.ShellPromise, commandString: string, shellConfig: ShellConfig) {
    this.#shellPromise = shellPromise
    this.#commandString = commandString
    // Copy `shellConfig` so later changes to the shell don't reach this command.
    this.#settings = { ...shellConfig }
  }

  /**
   * Change the working directory for the command.
   *
   * @default process.cwd()
   */
  public cwd(newCwd: string) {
    this.#settings.cwd = newCwd
    return this
  }

  /** Add environment variables for the command, on top of the shell's. Set one to `undefined` to remove it. */
  public env(newEnv: ShellEnv) {
    this.#settings.env = { ...this.#settings.env, ...newEnv }
    return this
  }

  /** Configure the command to only buffer its output instead of also writing it to stdout and stderr. */
  public quiet(isQuiet = true) {
    this.#settings.quiet = isQuiet
    return this
  }

  /** Configure the command to not throw an exception on a non-zero exit code. */
  public nothrow() {
    this.#settings.throws = false
    return this
  }

  /**
   * Configure whether the command throws an exception on a non-zero exit code.
   *
   * @default true
   */
  public throws(shouldThrow: boolean) {
    this.#settings.throws = shouldThrow
    return this
  }

  /**
   * Configure whether the command is printed before it runs.
   *
   * @default true
   */
  public echo(shouldEcho: boolean) {
    this.#settings.echo = shouldEcho
    return this
  }

  /**
   * Configure whether the command runs `node_modules` bins and `node` under Bun (like Bun's `--bun` flag).
   *
   * @default true
   */
  public bun(shouldUseBun: boolean) {
    this.#settings.bun = shouldUseBun
    return this
  }

  /** Read from stdout as a string. Automatically calls {@link quiet}. */
  public async text(encoding?: BufferEncoding) {
    this.quiet()
    const output = await this.#run()
    return output.text(encoding)
  }

  /** Read from stdout as a JSON object. Automatically calls {@link quiet}. */
  public async json() {
    this.quiet()
    const output = await this.#run()
    // oxlint-disable-next-line typescript/no-unsafe-return - match Bun's `json()`, which returns `any`
    return output.json()
  }

  /** Read from stdout as an ArrayBuffer. Automatically calls {@link quiet}. */
  public async arrayBuffer() {
    this.quiet()
    const output = await this.#run()
    return output.arrayBuffer()
  }

  /** Read from stdout as a Blob. Automatically calls {@link quiet}. */
  public async blob() {
    this.quiet()
    const output = await this.#run()
    return output.blob()
  }

  /**
   * Read from stdout as a string, line by line. Automatically calls {@link quiet}.
   *
   * @yields {string} Each line of stdout.
   */
  public async *lines() {
    this.quiet()
    // Use Bun's `lines()` because `ShellOutput` has no line reader.
    try {
      yield* this.#prepare().lines()
    } catch (error) {
      markHiddenOutput(error)
      throw error
    }
  }

  // oxlint-disable-next-line unicorn/no-thenable - awaiting a command runs it, like Bun's `ShellPromise`
  public async then<TResult1 = BunShell.ShellOutput, TResult2 = never>(
    onfulfilled?: ((value: BunShell.ShellOutput) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.#run().then(onfulfilled, onrejected)
  }

  public async catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null) {
    return this.then(undefined, onrejected)
  }

  public async finally(onfinally?: (() => void) | null) {
    try {
      return await this
    } finally {
      onfinally?.()
    }
  }

  /** Runs the command, and records a failure whose output was hidden so the CLI can print it. */
  async #run() {
    try {
      return await this.#prepare()
    } catch (error) {
      if (this.#settings.quiet) markHiddenOutput(error)
      throw error
    }
  }

  /** Prints the command and applies its settings once, before Bun starts the command. */
  // oxlint-disable-next-line typescript/promise-function-async - an async function would await the command and start it
  #prepare() {
    // Skip a command that already started, because Bun rejects settings on it.
    if (this.#isPrepared) return this.#shellPromise
    this.#isPrepared = true

    const {
      cwd,
      env: settingsEnv,
      quiet: isQuiet,
      throws: shouldThrow,
      echo: shouldEcho,
      bun: shouldUseBun,
    } = this.#settings

    const env = shouldUseBun ? addNodeShim(settingsEnv) : removeNodeShims(settingsEnv)
    const shouldAddColor = !isQuiet && shouldForceColor(env)
    const commandEnv = shouldAddColor ? { ...env, FORCE_COLOR: "1" } : env

    void this.#shellPromise.env(commandEnv)
    if (isQuiet) void this.#shellPromise.quiet()
    if (cwd !== undefined) void this.#shellPromise.cwd(cwd)
    void this.#shellPromise.throws(shouldThrow)

    // Write to `process.stderr` directly because Bun colors `console.error` output red in a terminal.
    if (shouldEcho) process.stderr.write(`${styleText("bold", this.#commandString, { stream: process.stderr })}\n`)

    return this.#shellPromise
  }
}
