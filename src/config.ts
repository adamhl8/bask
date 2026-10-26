import type { ShellEnv } from "#shell/command.ts"

/** Settings for every shell, set by the `baskConfig` export in `bask.ts`. */
export interface ShellConfig {
  /**
   * The default working directory for commands run by every shell.
   *
   * @default process.cwd()
   */
  cwd: string | undefined
  /**
   * Environment variables for commands run by every shell, on top of `process.env` as it was when `bask.ts` loaded. Set
   * one to `undefined` to remove it.
   */
  env: ShellEnv
  /**
   * Whether commands run by every shell only buffer their output instead of also writing it to stdout and stderr.
   *
   * @default false
   */
  quiet: boolean
  /**
   * Whether commands run by every shell throw an exception on non-zero exit codes.
   *
   * @default true
   */
  throws: boolean
  /**
   * Whether every shell prints each command before running it.
   *
   * @default true
   */
  echo: boolean
  /**
   * Whether every shell runs `node_modules` bins and `node` under Bun (like Bun's `--bun` flag).
   *
   * @default true
   */
  bun: boolean
}

/** Project-wide settings, set by the `baskConfig` export in `bask.ts`. */
export interface BaskConfig {
  /** Default settings for every shell. `sh` and each command can override them. */
  shell: ShellConfig
}

/** The `baskConfig` that `defineConfig` accepts, where every setting is optional. */
export interface BaskConfigInput {
  shell?: Partial<ShellConfig>
}

/**
 * Fills in the default for each shell setting that `shellConfig` leaves out. The resolved `env` holds the whole
 * environment, with `shellConfig.env` on top of `baseEnv`.
 */
export const resolveShellConfig = (shellConfig: Partial<ShellConfig>, baseEnv: ShellEnv): ShellConfig => ({
  cwd: shellConfig.cwd,
  env: { ...baseEnv, ...shellConfig.env },
  quiet: shellConfig.quiet ?? false,
  throws: shellConfig.throws ?? true,
  echo: shellConfig.echo ?? true,
  bun: shellConfig.bun ?? true,
})

const configs = new WeakSet<object>()
export const isBaskConfig = (value: unknown): value is BaskConfigInput =>
  typeof value === "object" && value !== null && configs.has(value)

/** Marks a config for bask to read from the `baskConfig` export in `bask.ts`. */
export const defineConfig = (config: BaskConfigInput) => {
  configs.add(config)
  return config
}
