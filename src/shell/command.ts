import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import { Readable } from "node:stream"
import { styleText } from "node:util"

import bun from "bun"

import type { ShellConfig } from "#config.ts"
import { addNodeShim, removeNodeShims } from "#shell/node-shim.ts"

export type ShellEnv = Record<string, string | undefined>

/** What a finished command printed and its exit code. A stream the command wrote to the terminal is empty here. */
export interface CommandOutput {
  exitCode: number
  stdout: string
  stderr: string
}

/** Thrown when a command exits with a non-zero exit code. */
export class CommandError extends Error {
  public readonly exitCode: number
  /** What the command printed to stdout, when bask read it instead of writing it to the terminal. */
  public readonly stdout: string
  /** What the command printed to stderr, when bask read it instead of writing it to the terminal. */
  public readonly stderr: string

  public constructor(command: string, output: CommandOutput) {
    super(`'${command}' failed with exit code ${output.exitCode}`)
    this.name = "CommandError"
    this.exitCode = output.exitCode
    this.stdout = output.stdout
    this.stderr = output.stderr
  }
}

/**
 * Which streams bask reads instead of passing the terminal through. `none` gives the command the terminal, `stdout`
 * reads its output and leaves stderr on the terminal, and `all` reads both.
 */
type Capture = "none" | "stdout" | "all"

interface RawOutput {
  exitCode: number
  stdout: Uint8Array
  stderr: Uint8Array
}

const EMPTY = new Uint8Array()
const decoder = new TextDecoder()

const toCommandOutput = ({ exitCode, stdout, stderr }: RawOutput): CommandOutput => ({
  exitCode,
  stdout: decoder.decode(stdout),
  stderr: decoder.decode(stderr),
})

/** Drops the variables set to `undefined`, which `ShellEnv` uses to remove a variable. */
const toSpawnEnv = (env: ShellEnv): Record<string, string> =>
  Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined))

/** Reads a piped stream to the end. A stream left on the terminal is a number or `undefined`, and reads as empty. */
const readStream = async (stream: ReadableStream<Uint8Array> | number | undefined) =>
  stream instanceof ReadableStream ? stream.bytes() : EMPTY

/** Wraps a command, printing it and applying its settings when it runs. Awaiting it runs it once. */
export class ShellCommand implements PromiseLike<CommandOutput> {
  readonly #commandString: string
  readonly #settings: ShellConfig
  #result: Promise<RawOutput> | undefined

  /** Starts from the shell's settings, which the command's own methods can then override. */
  public constructor(commandString: string, shellConfig: ShellConfig) {
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

  /** Configure the command to only buffer its output instead of writing it to the terminal. */
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

  /** Read from stdout as a string. stderr still goes to the terminal unless the command is quiet. */
  public async text(encoding?: BufferEncoding) {
    const { stdout } = await this.#run(this.#readerCapture())
    return Buffer.from(stdout).toString(encoding)
  }

  /** Read from stdout as a JSON object. stderr still goes to the terminal unless the command is quiet. */
  public async json() {
    const text = await this.text()
    // oxlint-disable-next-line typescript/no-unsafe-return - match `Response.json()`, which returns `any`
    return JSON.parse(text)
  }

  /** Read from stdout as an ArrayBuffer. stderr still goes to the terminal unless the command is quiet. */
  public async arrayBuffer() {
    const { stdout } = await this.#run(this.#readerCapture())
    return stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength)
  }

  /** Read from stdout as a Blob. stderr still goes to the terminal unless the command is quiet. */
  public async blob() {
    const { stdout } = await this.#run(this.#readerCapture())
    return new Blob([stdout])
  }

  /**
   * Read from stdout as a string, line by line. stderr still goes to the terminal unless the command is quiet.
   *
   * @yields {string} Each line of stdout.
   */
  public async *lines() {
    const subprocess = this.#spawn(this.#readerCapture())
    // Read stderr alongside stdout, because a full stderr pipe would stall the command.
    const stderr = readStream(subprocess.stderr)

    if (subprocess.stdout instanceof ReadableStream) {
      // Set `crlfDelay` so a `\r\n` split across two chunks still ends one line.
      yield* readline.createInterface({ input: Readable.fromWeb(subprocess.stdout), crlfDelay: Infinity })
    }

    // Leave stdout out of the error, because the task already got every line.
    this.#check({ exitCode: await subprocess.exited, stdout: EMPTY, stderr: await stderr })
  }

  // oxlint-disable-next-line unicorn/no-thenable - awaiting a command runs it
  public async then<TResult1 = CommandOutput, TResult2 = never>(
    onfulfilled?: ((value: CommandOutput) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.#output().then(onfulfilled, onrejected)
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

  /** Runs the command with the terminal, or with both streams read when the command is quiet. */
  async #output() {
    return toCommandOutput(await this.#run(this.#settings.quiet ? "all" : "none"))
  }

  /** Picks what a reader pipes: stdout, and stderr too when the command is quiet. */
  #readerCapture(): Capture {
    return this.#settings.quiet ? "all" : "stdout"
  }

  /** Runs the command the first time it's called, and returns the same result after that, whatever `capture` is. */
  async #run(capture: Capture) {
    this.#result ??= this.#runOnce(capture)
    return this.#result
  }

  async #runOnce(capture: Capture): Promise<RawOutput> {
    const subprocess = this.#spawn(capture)
    const [stdout, stderr, exitCode] = await Promise.all([
      readStream(subprocess.stdout),
      readStream(subprocess.stderr),
      subprocess.exited,
    ])
    const output = { exitCode, stdout, stderr }
    this.#check(output)
    return output
  }

  /** Throws when the command failed and throwing is on. */
  #check(output: RawOutput) {
    if (output.exitCode !== 0 && this.#settings.throws)
      throw new CommandError(this.#commandString, toCommandOutput(output))
  }

  /** Prints the command and starts it under `/bin/sh` with stdin on the terminal. */
  #spawn(capture: Capture) {
    const { cwd, env: settingsEnv, echo: shouldEcho, bun: shouldUseBun } = this.#settings
    const env = shouldUseBun ? addNodeShim(settingsEnv) : removeNodeShims(settingsEnv)

    // Write to `process.stderr` directly because Bun colors `console.error` output red in a terminal.
    if (shouldEcho) process.stderr.write(`${styleText("bold", this.#commandString, { stream: process.stderr })}\n`)

    // Set `PWD` like `cd` does, because `sh` trusts an inherited `PWD` that names the same folder by another path.
    const cwdEnv = cwd === undefined ? env : { ...env, PWD: path.resolve(cwd) }

    try {
      return bun.spawn(["/bin/sh", "-c", this.#commandString], {
        ...(cwd !== undefined && { cwd }),
        env: toSpawnEnv(cwdEnv),
        stdin: "inherit",
        stdout: capture === "none" ? "inherit" : "pipe",
        stderr: capture === "all" ? "pipe" : "inherit",
      })
    } catch (error) {
      // Name the cwd because Bun blames `/bin/sh` when the cwd is missing.
      if (cwd !== undefined && !fs.existsSync(cwd))
        throw new Error(`Can't run '${this.#commandString}' because its cwd '${cwd}' doesn't exist`, { cause: error })

      throw error
    }
  }
}
