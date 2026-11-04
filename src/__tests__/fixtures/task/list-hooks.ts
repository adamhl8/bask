import { list } from "#bask-file/list.ts"
import { task } from "#task.ts"

export const build = task(() => {
  console.log("ran build")
})

list.after(() => {
  console.log("\nRun `bask <task>` to run a task.")
})
