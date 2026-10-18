import { task } from "@adamhl8/bask"

export const build = task({ alias: ["build", "b", "b"] }, () => {
  console.log("ran build")
})
