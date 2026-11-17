import { styleText } from "node:util"

// Write to `process.stderr` directly because Bun colors all `console.error` output red in a terminal.
export const printError = (message: string) => {
  process.stderr.write(`${styleText(["bold", "red"], "error:", { stream: process.stderr })} ${message}\n`)
}
