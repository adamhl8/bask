import { task } from "#task.ts"

export const build = task(() => {
  console.log("ran build")
})

export const helper = () => {
  console.log("ran helper")
}

export const VERSION = "1.0.0"
