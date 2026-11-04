import path from "node:path"

import type { ShellCommand } from "#shell/command.ts"

/** Logs a command's output, because in-process tests can't see what a non-quiet command writes to stdout. */
export const logOutput = async (command: ShellCommand) => {
  const output = await command.text()
  console.log(output.trim())
}

/** Puts the `runtime` bin on `PATH`, which bask copies once the fixture has loaded. */
export const addRuntimeBinToPath = () => {
  const binDir = path.join(import.meta.dir, "bin")
  process.env["PATH"] = [binDir, process.env["PATH"]].join(path.delimiter)
}
