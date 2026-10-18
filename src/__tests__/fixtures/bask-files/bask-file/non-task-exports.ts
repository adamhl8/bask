import { task } from "@adamhl8/bask"

export const build = task(() => {
  console.log("ran build")
})

export const helper = () => {
  console.log("ran helper")
}

export const VERSION = "1.0.0"
