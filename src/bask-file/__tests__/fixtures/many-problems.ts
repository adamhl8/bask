import { task } from "#task.ts"

export const build = task({ alias: "default" }, () => {
  console.log("ran build")
})

export const compile = build

const defaultTaskName = "build"

export default defaultTaskName
