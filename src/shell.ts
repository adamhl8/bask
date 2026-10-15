import { styleText } from "node:util"

import bun from "bun"
import type { $ as BunShell, ShellExpression } from "bun"

/** Formats an interpolated value the way Bun's shell escapes it. */
const formatExpression = (expression: ShellExpression): string => {
  if (Array.isArray(expression)) return expression.map(formatExpression).join(" ")
  if (typeof expression === "object" && expression !== null && "raw" in expression) return expression.raw
  // Print streams, files, and subprocesses as their default string because they have no command text.
  // oxlint-disable-next-line typescript/no-base-to-string
  return bun.$.escape(String(expression))
}

/** Prints each command to stderr, then runs it with Bun's `$`. */
// oxlint-disable-next-line typescript/promise-function-async - return Bun's `ShellPromise` as is, because an async function would wrap it and drop `.quiet()` and `.text()`.
export const ShellWrapper = (
  strings: TemplateStringsArray,
  ...expressions: ShellExpression[]
): BunShell.ShellPromise => {
  // Use `String.raw` because Bun's `$` also reads the raw template strings.
  const command = String.raw({ raw: strings.raw }, ...expressions.map(formatExpression))
  // Write to `process.stderr` directly because Bun colors `console.error` output red in a terminal.
  process.stderr.write(`${styleText("bold", command.trim(), { stream: process.stderr })}\n`)
  return bun.$(strings, ...expressions)
}
