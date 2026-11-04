import { task } from "#task.ts"

export const build = task({ alias: "default" }, () => {
  console.log("ran build")
})
