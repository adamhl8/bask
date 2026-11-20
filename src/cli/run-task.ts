import type { Result } from "ts-explicit-errors"
import { attempt, err } from "ts-explicit-errors"

import type { TaskIndex } from "#bask-file/task-index.ts"
import { CommandError } from "#shell/command.ts"
import { getFailedTask } from "#task/failed-task.ts"

/** Runs a task and returns a failed command as an error that names the innermost task that failed. */
export const runTask = async (tasks: TaskIndex, taskName: string, run: () => Promise<void>): Promise<Result> => {
  const error = await attempt(run)
  if (!error) return
  // Rethrow anything else, because a bug in a task file needs its stack trace.
  if (!(error instanceof CommandError)) throw error

  // Print the output bask read instead of showing, because it usually explains the failure.
  process.stdout.write(error.stdout)
  process.stderr.write(error.stderr)

  const failedTask = getFailedTask(error)
  const failedEntry = failedTask && tasks.byTask.get(failedTask)
  // Fall back to the task you ran, because a task that isn't exported has no name.
  const failedName = failedEntry?.name ?? taskName
  return err(`task '${failedName}' failed with exit code ${error.exitCode}`, undefined, { exitCode: error.exitCode })
}
