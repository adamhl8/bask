import path from "node:path"

import bun from "bun"

import { printError } from "#cli/print-error.ts"

// Stop a `bun bask` run because Bun runs bask.ts itself instead of the bask CLI.
if (path.basename(bun.main) === "bask.ts") {
  const command = ["bask", ...process.argv.slice(2)].join(" ")
  printError(
    `bask.ts can't be run directly. Use \`bunx\` instead of \`bun\`.\nEither run \`bunx ${command}\` or run \`${command}\` directly (if installed globally).`,
  )
  process.exit(1)
}

export { defineConfig } from "#config.ts"
export type { BaskConfigInput } from "#config.ts"
export { list } from "#cli/list.ts"
export { isTask, task } from "#task.ts"
export type { Task } from "#task/types.ts"
export type { NoArgs } from "#task/args.ts"
export { CommandError } from "#shell/command.ts"
export type { CommandOutput, ShellCommand } from "#shell/command.ts"
export type { Shell, ShellValue } from "#shell/shell.ts"
