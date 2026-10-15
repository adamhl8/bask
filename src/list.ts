import { toTaskName } from "#names.ts"
import { isTask, task } from "#task.ts"
import type { Task } from "#task.ts"

type BaskModule = Record<string, unknown>

let loadedModule: BaskModule | undefined

/** Stores the loaded `bask.ts` module so `formatTaskList` can read its tasks. */
export const setBaskModule = (baskModule: BaskModule) => {
  loadedModule = baskModule
}

export const formatTaskList = (): string => {
  if (!loadedModule) throw new Error("The task list was read before the CLI loaded bask.ts")

  const defaultTask = loadedModule["default"]
  const visibleTasks = Object.entries(loadedModule).filter(
    (entry): entry is [string, Task] => isTask(entry[1]) && !entry[1].options.hidden,
  )
  const namedTasks = visibleTasks.filter(([name]) => name !== "default")

  // List `default` by name only when no named export is the same task.
  const defaultHasName = namedTasks.some(([, namedTask]) => namedTask === defaultTask)
  const listedTasks = defaultHasName ? namedTasks : visibleTasks

  const rows = listedTasks.map(([name, listedTask]) => {
    const defaultMarker = name !== "default" && listedTask === defaultTask ? "[default]" : undefined
    const comment = [listedTask.options.desc, defaultMarker].filter(Boolean).join(" ")
    return { name: toTaskName(name), comment }
  })

  const nameWidth = Math.max(...rows.map((row) => row.name.length))
  const lines = rows.map(({ name, comment }) =>
    comment ? `    ${name.padEnd(nameWidth)} # ${comment}` : `    ${name}`,
  )
  return ["Available tasks:", ...lines].join("\n")
}

export const list = task(() => {
  console.log(formatTaskList())
})
