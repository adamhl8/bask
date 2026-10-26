import { err } from "ts-explicit-errors"

import type { BaskFileExports } from "#bask-file/bask-file.ts"
import { isTask } from "#task.ts"
import type { Task } from "#task.ts"

interface TaskEntry {
  /** Export name as written in `bask.ts`, for error messages. */
  exportName: string
  /** Kebab-case export name, or `default` for a task that's only the default export. */
  name: string
  /** Kebab-case aliases from the task's `alias` option. */
  aliases: string[]
  task: Task
}

export interface TaskIndex {
  /** Each entry under every name and alias that runs it. */
  byName: Map<string, TaskEntry>
  /** Each entry once, under its task, in export order. */
  byTask: Map<Task, TaskEntry>
}

const toKebabCase = (name: string) => name.replaceAll(/[A-Z]/gv, (match) => `-${match.toLowerCase()}`)
const toCamelCase = (name: string) => name.replaceAll(/-[\da-z]/gv, (match) => match.slice(1).toUpperCase())

/** Indexes the bask file's tasks under both spellings of their export names and aliases, collecting any errors. */
export const indexTasks = (baskFileExports: BaskFileExports) => {
  const errors: Error[] = []

  // Put the default last so a task that's also exported by name keeps that name.
  const { default: defaultExport, ...namedExports } = baskFileExports
  const exportEntries = Object.entries(namedExports)
  if (defaultExport !== undefined) exportEntries.push(["default", defaultExport])

  // Index each task under its export name and kebab-case name, collecting tasks exported more than once.
  const byName: TaskIndex["byName"] = new Map()
  const byTask: TaskIndex["byTask"] = new Map()
  for (const [exportName, exportedTask] of exportEntries) {
    if (!isTask(exportedTask)) continue

    const existingEntry = byTask.get(exportedTask)
    // Point `default` at the existing entry, because exporting a named task as the default isn't a duplicate.
    if (existingEntry && exportName === "default") {
      byName.set("default", existingEntry)
      continue
    }
    if (existingEntry) {
      errors.push(
        err(
          `task '${exportName}' is also exported as '${existingEntry.exportName}'. Use the alias option instead.`,
          undefined,
        ),
      )
      continue
    }

    const kebabName = toKebabCase(exportName)
    const entry: TaskEntry = { exportName, name: kebabName, aliases: [], task: exportedTask }
    byTask.set(exportedTask, entry)
    byName.set(exportName, entry)
    byName.set(kebabName, entry)
  }

  // Index each alias under every spelling, collecting aliases that are `default` or already taken.
  // Every export name is already indexed, so a clash with a name is reported against the alias.
  for (const entry of byTask.values()) {
    const aliases = [entry.task.options.alias ?? []].flat()

    for (const alias of aliases) {
      const kebabAlias = toKebabCase(alias)
      const camelAlias = toCamelCase(alias)

      if (kebabAlias === "default") {
        errors.push(
          err(
            `task '${entry.exportName}' can't use 'default' as an alias. Export it as the default instead.`,
            undefined,
          ),
        )
        continue
      }

      // Skip an alias that repeats the task's own name or another of its aliases.
      if (byName.get(kebabAlias) === entry) continue

      const keys = [alias, kebabAlias, camelAlias]
      const owner = keys.map((key) => byName.get(key)).find(Boolean)
      if (owner) {
        errors.push(
          err(
            `task '${entry.exportName}' has alias '${alias}', which task '${owner.exportName}' already uses`,
            undefined,
          ),
        )
      } else {
        entry.aliases.push(kebabAlias)
        for (const key of keys) byName.set(key, entry)
      }
    }
  }

  const tasks: TaskIndex = { byName, byTask }
  return { tasks, errors }
}
