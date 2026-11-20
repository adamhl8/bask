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

// Hold every character the shell could expand or split on, so the value only comes back intact if it's quoted right.
// oxlint-disable-next-line no-template-curly-in-string - `${HOME}` is for the shell to leave alone
export const AWKWARD_VALUE = "a $HOME ${HOME} `id` $(id) \"b\" 'c' \\ * ? [a] ~ {a,b} !x ;|&<>() #\nd"
