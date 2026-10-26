import { getLoadedBaskFile } from "#bask-file/loaded.ts"
import type { TaskIndex } from "#bask-file/task-index.ts"
import { task } from "#task.ts"

const collator = new Intl.Collator()

const formatAliases = (aliases: string[]) => {
  if (aliases.length === 0) return
  return `[${aliases.length === 1 ? "alias" : "aliases"}: ${aliases.join(", ")}]`
}

export const formatTaskList = (tasks: TaskIndex) => {
  const defaultEntry = tasks.byName.get("default")

  const rows = [...tasks.byTask.values()]
    .filter((entry) => !entry.task.options.hidden)
    .map((entry) => {
      const defaultMarker = entry === defaultEntry && entry.name !== "default" ? "[default]" : undefined
      const comment = [entry.task.options.desc, defaultMarker, formatAliases(entry.aliases)].filter(Boolean).join(" ")
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
