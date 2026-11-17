import { styleText } from "node:util"

import { runParser } from "@optique/core/facade"
import type { Parser } from "@optique/core/parser"

/**
 * Returns Optique's output settings for `stream`: whether to use color, and the width to wrap to. Ask `styleText` about
 * color so Optique follows the same rules as bask's own error line, including `NO_COLOR`.
 */
export const toOptiqueOutput = (stream: NodeJS.WriteStream) => ({
  colors: styleText("red", "x", { stream }) !== "x",
  // Leave out a width of 0, which some terminals report and which wraps every usage term onto its own line.
  ...(stream.columns > 0 && { maxWidth: stream.columns }),
})

/**
 * Parses `argv`. Returns `undefined` when it's invalid, after Optique prints its usage line and error to stderr. The
 * return type is written out because `runParser`'s sync overload leaves out what `onError` returns.
 */
export const parseWithOptique = <T>(parser: Parser<"sync", T>, programName: string, argv: string[]): T | undefined =>
  runParser(parser, programName, argv, {
    ...toOptiqueOutput(process.stderr),
    stderr: (line) => {
      process.stderr.write(`${line}\n`)
    },
    onError: () => {
      /* empty */
    },
  })
