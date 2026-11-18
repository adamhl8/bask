import type { Result } from "ts-explicit-errors"
import { isErr } from "ts-explicit-errors"

import { loadBaskFile } from "#bask-file/bask-file.ts"
import type { TaskIndex } from "#bask-file/task-index.ts"
import { anyTaskName, toBaskParser, toTaskNameParser } from "#cli/bask-parser.ts"
import { printBaskHelp, printTaskHelp } from "#cli/help.ts"
import { formatTaskList, list } from "#cli/list.ts"
import { parseWithOptique } from "#cli/optique.ts"
import { runTask } from "#cli/run-task.ts"
import { splitArgs } from "#cli/split-args.ts"
import { checkAllTaskArgs, toTaskParser } from "#cli/task-parser.ts"
import { runWithArgs } from "#task/command-line-args.ts"

const ARGS_ERROR_EXIT_CODE = 2

/** Loads bask.ts and checks its tasks' arg declarations. */
const loadTasks = async (baskPath: string): Promise<Result<TaskIndex>> => {
  const baskFile = await loadBaskFile(baskPath)
  if (isErr(baskFile)) return baskFile

  const checkResult = checkAllTaskArgs(baskFile.tasks)
  if (isErr(checkResult)) return checkResult

  return baskFile.tasks
}

/**
 * Runs the task that `args` names from the bask file at `baskPath`, or lists the tasks. Returns the exit code, which is
 * 2 when Optique has already reported invalid args. An error is one of bask's own problems.
 */
export const runBask = async (args: string[], baskPath: string): Promise<Result<number>> => {
  const { baskArgs, taskName, taskArgs } = splitArgs(args)
  const baskInput = taskName === undefined ? baskArgs : [...baskArgs, taskName]

  // Check bask's flags before loading bask.ts, so they work without one and before its top-level code runs.
  const baskParser = toBaskParser(anyTaskName)
  const baskFlags = parseWithOptique(baskParser, "bask", baskInput)
  if (!baskFlags) return ARGS_ERROR_EXIT_CODE

  if (baskFlags.help && taskName === undefined) {
    printBaskHelp(baskParser)
    const listedTasks = await loadTasks(baskPath)
    if (isErr(listedTasks)) return listedTasks
    process.stdout.write(`\n${formatTaskList(listedTasks)}\n`)
    return 0
  }

  const tasks = await loadTasks(baskPath)
  if (isErr(tasks)) return tasks

  // Check the task name now that bask.ts has loaded, so an unknown task gets Optique's error.
  const isUnknownTask =
    taskName !== undefined && !parseWithOptique(toBaskParser(toTaskNameParser(tasks)), "bask", baskInput)
  if (isUnknownTask) return ARGS_ERROR_EXIT_CODE

  const selectedTaskEntry = tasks.byName.get(taskName ?? "default")

  if (baskFlags.help && selectedTaskEntry) {
    printTaskHelp(selectedTaskEntry)
    return 0
  }

  // List the tasks when asked, or when no task is named and there's no default to run.
  if (baskFlags.list || !selectedTaskEntry) {
    const listResult = await runTask(tasks, "list", async () => list())
    if (isErr(listResult)) return listResult
    return 0
  }

  const { name, task } = selectedTaskEntry
  const parsedTaskArgs = parseWithOptique(toTaskParser(task.options), `bask ${name}`, taskArgs)
  if (!parsedTaskArgs) return ARGS_ERROR_EXIT_CODE

  const runResult = await runTask(tasks, name, async () => runWithArgs(task, parsedTaskArgs))
  if (isErr(runResult)) return runResult
  return 0
}
