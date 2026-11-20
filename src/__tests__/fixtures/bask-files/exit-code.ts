import { task } from "@adamhl8/bask"

export const plan = task(() => {
  console.log("ran plan")
  process.exitCode = 2
})

plan.after(() => {
  console.log("ran after")
})

export const planThenFail = task(async ({ sh }) => {
  process.exitCode = 2
  await sh`exit 3`
})
