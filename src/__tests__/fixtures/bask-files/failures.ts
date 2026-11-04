import { task } from "@adamhl8/bask"

export const fail = task({ alias: "f" }, async ({ sh }) => {
  await sh`exit 3`
})

export const compile = task(async ({ sh }) => {
  await sh`exit 4`
})

export const build = task(async () => {
  await compile()
})

const helper = task(async ({ sh }) => {
  await sh`exit 5`
})

export const deploy = task(async () => {
  await helper()
})

export const crash = task(() => {
  throw new Error("task bug")
})
