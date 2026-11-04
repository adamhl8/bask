import { task } from "#task.ts"

export const bumpDeps = task({ alias: "update-deps" }, () => {
  console.log("ran bump-deps")
})

export const upgrade = task({ alias: "updateDeps" }, () => {
  console.log("ran upgrade")
})
