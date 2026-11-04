import { task } from "#task.ts"

const build = task({ alias: "default" }, () => {
  console.log("ran build")
})

export default build
