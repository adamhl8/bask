import { task } from "#task.ts"

export const test = task(
  {
    desc: "Run tests",
    alias: "t",
    args: {
      watch: { short: "w", desc: "Rerun when files change" },
      timeout: { type: "string", desc: "Per-test timeout" },
      lines: { short: "l" },
      dryRun: {},
    },
    positionals: true,
  },
  ({ args, positionals }) => {
    // Write `undefined` as a string so an absent string arg still shows up in the JSON.
    console.log(
      JSON.stringify({ args, positionals }, (_, value: unknown) => (value === undefined ? "undefined" : value)),
    )
  },
)

export const lint = task(() => {
  console.log("ran lint")
})

export default test
