import { task } from "@adamhl8/bask"

console.log("bask.ts ran")

export const build = task(() => {
  console.log("ran build")
})
