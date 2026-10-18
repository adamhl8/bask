import { task } from "@adamhl8/bask"

export const build = task({ desc: "Build the project", alias: "b" }, () => {
  console.log("ran build")
})

export const bumpDeps = task({ alias: ["up", "update-deps"] }, () => {
  console.log("ran bump-deps")
})

export const lint = task(() => {
  console.log("ran lint")
})

export const releaseRun = task({ desc: "Run from CI", hidden: true }, () => {
  console.log("ran release-run")
})

export default build
