import { formatUsage } from "@optique/core/usage"

import type { TaskIndex } from "#bask-file/task-index.ts"
import { toTaskParser } from "#cli/task-parser.ts"
import type { TaskParser } from "#cli/task-parser.ts"
import { getLoadedBaskFile } from "#loaded-bask-file.ts"
import { task } from "#task.ts"

const collator = new Intl.Collator()

const formatAliases = (aliases: string[]) => {
  if (aliases.length === 0) return
  return `[${aliases.length === 1 ? "alias" : "aliases"}: ${aliases.join(", ")}]`
}

/** Formats a task's args as its usage line, without the task name. */
const formatArgs = (name: string, parser: TaskParser) => {
  if (parser.usage.length === 0) return
  // Format with the task's name and then remove it, because `formatUsage` requires a program name.
  return formatUsage(name, parser.usage, { colors: false }).slice(name.length + 1)
}

export const formatTaskList = (tasks: TaskIndex) => {
  const defaultEntry = tasks.byName.get("default")

  const rows = [...tasks.byTask.values()]
    .filter((entry) => !entry.task.options.hidden)
    .map((entry) => {
      const defaultMarker = entry === defaultEntry && entry.name !== "default" ? "[default]" : undefined
      const comment = [
        entry.task.options.desc,
        defaultMarker,
        formatAliases(entry.aliases),
        formatArgs(entry.name, toTaskParser(entry.task.options)),
      ]
        .filter(Boolean)
        .join(" ")
      return { name: entry.name, comment }
    })
    .toSorted((a, b) => collator.compare(a.name, b.name))

  const nameWidth = Math.max(...rows.map((row) => row.name.length))
  const lines = rows.map(({ name, comment }) =>
    comment ? `    ${name.padEnd(nameWidth)} # ${comment}` : `    ${name}`,
  )
  return ["Available tasks:", ...lines].join("\n")
}

export const list = task(() => {
  const { tasks } = getLoadedBaskFile()
  console.log(formatTaskList(tasks))
})
