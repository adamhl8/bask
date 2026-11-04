import { task } from "#task.ts"

export const bumpDeps = task(() => {
  console.log("ran bump-deps")
})

export const update = task({ alias: "bump-deps" }, () => {
  console.log("ran update")
})
