import { task } from "#task.ts"

export const build = task({ alias: ["build", "b", "b"] }, () => {
  console.log("ran build")
})
