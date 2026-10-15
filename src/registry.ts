import { isTask, task } from "#task.ts"
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

type TaskIndex = Map<string, TaskEntry>

/** Reports a mistake in `bask.ts` that the CLI prints without a stack trace. */
export class BaskFileError extends Error {
  public override name = "BaskFileError"
}

let taskIndex: TaskIndex | undefined

const toKebabCase = (name: string) => name.replaceAll(/[A-Z]/gv, (match) => `-${match.toLowerCase()}`)
const toCamelCase = (name: string) => name.replaceAll(/-[a-z\d]/gv, (match) => match.slice(1).toUpperCase())

/** Formats one problem as a single line, or several under a count with one per line. */
const formatProblems = (problems: string[]) => {
  if (problems.length === 1) return problems.join("\n")
  return [`bask.ts has ${problems.length} problems:`, ...problems.map((problem) => `  ${problem}`)].join("\n")
}

/** Indexes the loaded `bask.ts` module's tasks under both spellings of their export names and aliases. */
export const setBaskModule = (baskModule: Record<string, unknown>) => {
  const defaultTask = baskModule["default"]
  // Collect every problem before throwing, so one run reports all of them.
  const problems: string[] = []

  // Reject a non-task default because bask runs it when no task is named, so it's always a mistake.
  if ("default" in baskModule && !isTask(defaultTask))
    problems.push("the default export isn't a task. Wrap it in task().")

  // Collect named task exports, then add the default under `default` only when it has no other name.
  const taskExports = Object.entries(baskModule).filter(
    (entry): entry is [string, Task] => entry[0] !== "default" && isTask(entry[1]),
  )
  const defaultHasName = taskExports.some(([, exportedTask]) => exportedTask === defaultTask)
  if (isTask(defaultTask) && !defaultHasName) taskExports.push(["default", defaultTask])

  // Index each task under its export name and kebab-case name, collecting tasks exported more than once.
  const index: TaskIndex = new Map()
  for (const [exportName, exportedTask] of taskExports) {
    const existingEntry = index.values().find((entry) => entry.task === exportedTask)
    if (existingEntry) {
      problems.push(
        `task '${exportName}' is also exported as '${existingEntry.exportName}'. Use the alias option instead.`,
      )
      continue
    }

    const kebabName = toKebabCase(exportName)
    const entry: TaskEntry = { exportName, name: kebabName, aliases: [], task: exportedTask }
    index.set(exportName, entry)
    index.set(kebabName, entry)
  }

  // Index each alias under every spelling, collecting aliases that are `default` or already taken.
  // Every export name is already indexed, so a clash with a name is reported against the alias.
  // Collect the entries into a `Set` first because the loop adds alias keys to `index`.
  for (const entry of new Set(index.values())) {
    const aliases = [entry.task.options.alias ?? []].flat()

    for (const alias of aliases) {
      const kebabAlias = toKebabCase(alias)
      // Skip an alias that repeats the task's own name or another of its aliases.
      if (index.get(kebabAlias) === entry) continue

      const keys = [alias, kebabAlias, toCamelCase(alias)]
      const owner = keys.map((key) => index.get(key)).find(Boolean)
      if (kebabAlias === "default")
        problems.push(`task '${entry.exportName}' can't use 'default' as an alias. Export it as the default instead.`)
      else if (owner)
        problems.push(`task '${entry.exportName}' has alias '${alias}', which task '${owner.exportName}' already uses`)
      else {
        entry.aliases.push(kebabAlias)
        for (const key of keys) index.set(key, entry)
      }
    }
  }

  if (problems.length > 0) throw new BaskFileError(formatProblems(problems))

  const defaultEntry = index.values().find((entry) => entry.task === defaultTask)
  if (defaultEntry) index.set("default", defaultEntry)

  taskIndex = index
}

export const getTaskIndex = () => {
  if (!taskIndex) throw new Error("Tasks were read before the CLI loaded bask.ts")
  return taskIndex
}

const formatAliases = (aliases: string[]) => {
  if (aliases.length === 0) return
  return `[${aliases.length === 1 ? "alias" : "aliases"}: ${aliases.join(", ")}]`
}

export const formatTaskList = () => {
  const index = getTaskIndex()
  const defaultEntry = index.get("default")

  // Collect the entries into a `Set` because every name of a task shares one entry.
  const rows = [...new Set(index.values())]
    .filter((entry) => !entry.task.options.hidden)
    .map((entry) => {
      const defaultMarker = entry === defaultEntry && entry.name !== "default" ? "[default]" : undefined
      const comment = [entry.task.options.desc, defaultMarker, formatAliases(entry.aliases)].filter(Boolean).join(" ")
      return { name: entry.name, comment }
    })
    .toSorted((a, b) => a.name.localeCompare(b.name))

  const nameWidth = Math.max(...rows.map((row) => row.name.length))
  const lines = rows.map(({ name, comment }) =>
    comment ? `    ${name.padEnd(nameWidth)} # ${comment}` : `    ${name}`,
  )
  return ["Available tasks:", ...lines].join("\n")
}

export const list = task(() => {
  console.log(formatTaskList())
})
