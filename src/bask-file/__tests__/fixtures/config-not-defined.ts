import { task } from "#task.ts"

export const baskConfig = { shell: { echo: false } }

export const build = task(() => {
  console.log("ran build")
})
