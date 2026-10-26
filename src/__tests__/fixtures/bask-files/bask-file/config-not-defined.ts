import { task } from "@adamhl8/bask"

export const baskConfig = { shell: { echo: false } }

export const build = task(() => {
  console.log("ran build")
})
