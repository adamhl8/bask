import { parseArgs } from "node:util"

/** Splits `args` at the task name, so flags before it are bask's and args after it are the task's. */
export const splitArgs = (args: string[]) => {
  const { tokens } = parseArgs({ args, strict: false, allowPositionals: true, tokens: true })
  const taskNameIndex = tokens.find((token) => token.kind === "positional")?.index
  if (taskNameIndex === undefined) return { baskArgs: args, taskName: undefined, taskArgs: [] }
  return {
    baskArgs: args.slice(0, taskNameIndex),
    taskName: args[taskNameIndex],
    taskArgs: args.slice(taskNameIndex + 1),
  }
}
