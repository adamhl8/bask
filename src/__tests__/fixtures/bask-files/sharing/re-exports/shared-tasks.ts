import { task } from "@adamhl8/bask"

export const lint = task(() => {
  console.log("ran lint")
})

export const build = task(async () => {
  await lint()
  console.log("ran build")
})

export default build
