import { task } from "#task.ts"

export const build = task(() => {
  console.log("ran build")
})

export const compile = build
