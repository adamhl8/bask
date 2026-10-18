import { task } from "@adamhl8/bask"

export const bumpDeps = task({ alias: "update-deps" }, () => {
  console.log("ran bump-deps")
})

export const upgrade = task({ alias: "updateDeps" }, () => {
  console.log("ran upgrade")
})
