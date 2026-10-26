import { task } from "@adamhl8/bask"

export const build = task({ alias: "default" }, () => {
  console.log("ran build")
})

export default build
