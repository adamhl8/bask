import type { Task } from "#task/types.ts"

const failedTasks = new WeakMap<Error, Task>()

/** Records `failedTask` as the task that `error` failed, unless a task inside it already did. */
export const recordFailedTask = (error: unknown, failedTask: Task) => {
  // Record this task only if no task has yet, because the innermost task's catch runs first.
  if (error instanceof Error && !failedTasks.has(error)) failedTasks.set(error, failedTask)
}

/** Returns the innermost task that the error failed, so the CLI can name it. */
export const getFailedTask = (error: Error) => failedTasks.get(error)
