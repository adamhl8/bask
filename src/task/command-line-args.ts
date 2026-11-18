import type { ParsedTaskArgs } from "#task/args.ts"
import type { Task } from "#task/types.ts"

// Hold the command line's args for the task it named, because tasks are called without args.
const commandLineArgs = new WeakMap<Task, ParsedTaskArgs>()

/** Runs the task the command line named, with the args parsed from it. */
export const runWithArgs = async (taskToRun: Task, taskArgs: ParsedTaskArgs) => {
  commandLineArgs.set(taskToRun, taskArgs)
  await taskToRun()
}

/** Returns the args the command line gave `calledTask`, or `undefined` when it isn't the task the command line named. */
export const getCommandLineArgs = (calledTask: Task) => commandLineArgs.get(calledTask)
