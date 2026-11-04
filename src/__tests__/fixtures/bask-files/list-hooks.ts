import { list, task } from "@adamhl8/bask"

export const build = task(() => {
  console.log("ran build")
})

list.after(() => {
  console.log("\nRun `bask <task>` to run a task.")
})
