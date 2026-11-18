import { task } from "#task.ts"

export const build = task({ args: { watch: { short: "w" } } }, ({ args }) => {
  console.log(`ran build watch=${args.watch}`)
})

build.before(() => {
  console.log("before build")
})
build.after(() => {
  console.log("after build")
})

const releaseBuild = build.wrap({ args: { release: { short: "r" } } }, async ({ args, original }) => {
  console.log(`wrap start release=${args.release} watch=${args.watch}`)
  await original()
  console.log("wrap end")
})

releaseBuild.after(({ args }) => {
  console.log(`after hook release=${args.release}`)
})

export const skipped = task(() => {
  console.log("ran skipped")
})

skipped.wrap(() => {
  console.log("replaced skipped")
})

export const stacked = task(() => {
  console.log("ran stacked")
})

stacked.wrap(async ({ original }) => {
  console.log("inner start")
  await original()
  console.log("inner end")
})
stacked.wrap(async ({ original }) => {
  console.log("outer start")
  await original()
  console.log("outer end")
})

export const twice = task(() => {
  console.log("ran twice")
})

twice.wrap(async ({ original }) => {
  await original()
  await original()
})

export const shelled = task(async ({ sh }) => {
  console.log(`X=${await sh`printf %s "$X"`.echo(false).text()}`)
})

shelled.wrap(async ({ sh, original }) => {
  sh.env({ X: "set" })
  await original()
})

export const ci = task(async () => {
  await build()
})

export const lateWrap = task(() => {
  lateWrap.wrap(() => {
    console.log("ran late wrap")
  })
})

export const selfWrap = task(() => {
  console.log("ran self-wrap")
})

selfWrap.wrap(async () => {
  await selfWrap()
})

export const layered = task(() => {
  console.log("ran layered")
})

layered.before(() => {
  console.log("first before")
})
layered.after(() => {
  console.log("first after")
})
layered.before(() => {
  console.log("second before")
})
layered.wrap(async ({ original }) => {
  console.log("wrap start")
  await original()
  console.log("wrap end")
})
layered.before(() => {
  console.log("outer before")
})
layered.after(() => {
  console.log("outer after")
})
