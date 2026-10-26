import { task } from "@adamhl8/bask"

export const build = task(() => {
  console.log("ran build")
})

void build()
