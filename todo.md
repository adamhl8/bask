# todo

- **Let a task set its exit code.** `runBask` returns 0 after a task that doesn't throw, and `main` sets
  `process.exitCode` from it, so a task's own `process.exitCode` is overwritten. Only a failed `sh` command turns into
  an exit code, and any other thrown error crashes with a stack trace. A task that runs a tool whose exit code means
  something, like tsinfra's 2 for drift in `plan`, has to call `process.exit` itself. Keep a `process.exitCode` the task
  set when it's not 0, or give the task a way to return one.
