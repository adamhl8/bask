import type { DocPage } from "@optique/core/doc"
import { formatDocPage } from "@optique/core/doc"
import { commandLine, message, text } from "@optique/core/message"
import type { Parser } from "@optique/core/parser"
import { getDocPage } from "@optique/core/parser"

import type { TaskEntry } from "#bask-file/task-index.ts"
import { toOptiqueOutput } from "#cli/optique.ts"
import { toTaskParser } from "#cli/task-parser.ts"

const EMPTY_DOC_PAGE: DocPage = { sections: [] }

const printHelpPage = (programName: string, page: DocPage) => {
  const helpPage = formatDocPage(programName, page, toOptiqueOutput(process.stdout))
  process.stdout.write(`${helpPage.trimEnd()}\n`)
}

/** Prints bask's own help page, which points to `bask -h <task>` for a task's args. */
export const printBaskHelp = (baskParser: Parser) => {
  const page = getDocPage(baskParser) ?? EMPTY_DOC_PAGE
  printHelpPage("bask", { ...page, footer: message`Run ${commandLine("bask -h <task>")} to see a task's args.` })
}

/** Prints a task's help page, with its `desc` above the usage line. */
export const printTaskHelp = (entry: TaskEntry) => {
  const { name, task } = entry
  const page = getDocPage(toTaskParser(task.options)) ?? EMPTY_DOC_PAGE
  const { desc } = task.options
  printHelpPage(`bask ${name}`, desc === undefined ? page : { ...page, brief: message`${text(desc)}` })
}
