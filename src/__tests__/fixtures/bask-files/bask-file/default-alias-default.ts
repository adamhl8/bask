import { task } from "@adamhl8/bask"

const build = task({ alias: "default" }, () => {
  console.log("ran build")
})

export default build
