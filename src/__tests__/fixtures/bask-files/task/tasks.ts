import { task } from "@adamhl8/bask"

export const setup = task(async () => {
  await Bun.sleep(50)
  console.log("ran setup")
})

export const lint = task(async () => {
  await setup()
  console.log("ran lint")
})

export const build = task(async () => {
  await setup()
  console.log("ran build")
})

export const check = task(async () => {
  await lint()
  await build()
  await setup()
})

export const parallel = task(async () => {
  await Promise.all([lint(), build()])
})

const clean = task(() => {
  console.log("ran clean")
})

export const compile = task(() => {
  console.log("ran compile")
})

compile.before(clean)
compile.before(() => {
  console.log("ran before hook")
})
compile.after(() => {
  console.log("ran after hook")
})

export const release = task(async () => {
  await compile()
  await compile()
  console.log("ran release")
})

export const deploy = task(() => {
  console.log("ran deploy")
})

deploy.after(async ({ sh }) => {
  await sh`exit 6`
})

export const lateBefore = task(() => {
  lateBefore.before(() => {
    console.log("ran late hook")
  })
})

export const lateAfter = task(() => {
  lateAfter.after(() => {
    console.log("ran late hook")
  })
})

export const verify = task(async ({ sh }) => {
  await sh`exit 7`
})

export const publish = task(() => {
  console.log("ran publish")
})

publish.before(verify)

export const flaky = task(async ({ sh }) => {
  console.log("ran flaky")
  await sh`exit 8`
})

export const retry = task(async () => {
  try {
    await flaky()
  } catch {
    console.log("caught flaky")
  }
  await flaky()
})
