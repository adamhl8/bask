<h1 align="center"><img align="top" style="color:#36BCF7; width:38px; height:38px;" src="https://raw.githubusercontent.com/adamhl8/bask/refs/heads/main/assets/logo.svg"> bask</h1>

A task runner for Bun where your tasks are TypeScript functions.

- Tasks are plain functions, so a dependency is just a function call
- A built-in shell (`sh`) that prints each command and keeps colored output
- Share tasks across projects as a package and extend them with `before` and `after` hooks
- A global `bask` that hands off to each project's own version

---

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [Why?](#why)
- [Tasks](#tasks)
  - [Defining tasks](#defining-tasks)
  - [Task options](#task-options)
  - [The default task](#the-default-task)
- [Running commands](#running-commands)
  - [Colored output](#colored-output)
  - [Shell settings](#shell-settings)
  - [Errors](#errors)
- [Extending tasks](#extending-tasks)
- [CLI](#cli)
- [API](#api)
  - [`task` Function](#task-function)
  - [`Task` Type](#task-type)
  - [`list` Task](#list-task)
  - [`isTask` Function](#istask-function)

<!-- tocstop -->

## Installation

bask requires [Bun](https://bun.sh). Tasks run on Bun, and commands run through Bun's `$` shell.

```sh
bun add --dev @adamhl8/bask
```

> [!TIP]
> To run tasks with a plain `bask` instead of `bunx bask`, also install it globally:
>
> ```sh
> bun add --global @adamhl8/bask
> ```
>
> The global `bask` hands off to the project's copy when there is one, so each project still runs the version it pins.

## Usage

Create a `bask.ts` in your project root and export some tasks:

```ts
import { task } from "@adamhl8/bask"

export const lint = task(async ({ sh }) => {
  await sh`oxlint`
})

export const build = task({ desc: "Lint, then build" }, async ({ sh }) => {
  await lint() // calling a task makes it a dependency
  await sh`tsdown`
})

export const bumpDeps = task(async ({ sh }) => {
  await sh`bunx npm-check-updates --upgrade`
})

export default build
```

Run a task by its export name in kebab-case:

```sh
bask build
bask bump-deps # runs `bumpDeps`
```

If you didn't install bask globally, use `bunx bask` instead. Use `bunx` rather than `bun`, because `bun bask` runs your `bask.ts` instead of the `bask` bin.

> [!NOTE]
> Scripts and CI should use `bunx bask`, because they can't count on a global install.

Run `bask` with no task name to run the default export (`build` above), or list your tasks with `bask --list`:

```
Available tasks:
    build     # Lint, then build [default]
    bump-deps
    lint
```

## Why?

Tasks usually end up in a justfile, a Makefile, or `package.json` scripts. Those work fine until you want the same tasks in more than one project. Then you end up copying them around and keeping the copies in sync.

bask tasks are just TypeScript, so:

- They get type checking, imports, and everything else TypeScript has
- They can be published as a package and shared across projects (`export * from "your-shared-tasks"`)
- Each project can extend a shared task with hooks instead of copying and editing it

## Tasks

### Defining tasks

`task` takes a function, and optionally an [options](#task-options) object first:

```ts
export const lint = task(async ({ sh }) => {
  await sh`oxlint`
})

export const build = task({ desc: "Lint, then build" }, async ({ sh }) => {
  await lint()
  await sh`tsdown`
})
```

To depend on another task, call it. Each task runs at most once per invocation, however many tasks call it. If two tasks call it at the same time, they both wait on the same run.

```ts
export const check = task(async () => {
  await Promise.all([lint(), typecheck()])
})

export const ci = task(async () => {
  await check()
  await lint() // already ran, so this does nothing
})
```

### Task options

- `desc`: Shown next to the task in the task list
- `hidden`: Keeps the task runnable but leaves it out of the task list
- `alias`: Other names the task runs under, as a string or an array
  - Write them in kebab-case or camelCase, and either spelling runs the task

```ts
export const releaseRun = task({ desc: "Run from CI", hidden: true }, async ({ sh }) => {
  await sh`bun release-it --ci`
})

export const bumpDeps = task({ alias: ["up", "update-deps"] }, async ({ sh }) => {
  await sh`bunx npm-check-updates --upgrade`
})
```

Aliases show next to the task in the task list:

```
    bump-deps # [aliases: up, update-deps]
```

Use `alias` rather than exporting the same task under a second name. bask can't tell which export is the original, so exporting a task twice is an error. `export default` is the exception.

### The default task

`bask` with no task name runs the default export. If `bask.ts` has no default export, it lists your tasks instead (the same as `bask --list`).

> [!IMPORTANT]
> `export * from` never re-exports a default. If a shared tasks module has a default export, re-export it by name for it to apply:
>
> ```ts
> export * from "./shared-tasks.ts"
> export { default } from "./shared-tasks.ts"
> ```

## Running commands

Every task gets a shell, `sh`, which works like Bun's `$`. The difference is that `sh` prints each command before running it:

```ts
export const lint = task(async ({ sh }) => {
  await sh`oxlint --fix`
  // prints "oxlint --fix", then runs it
})
```

To run a command without printing it, use `.echo(false)`:

```ts
export const release = task(async ({ sh }) => {
  const branch = await sh`git branch --show-current`.echo(false).text()
  if (branch.trim() === "main") await sh`gh workflow run release.yml`
})
```

Everything else works the same as Bun's `$`, so see the [Bun Shell docs](https://bun.sh/docs/runtime/shell) for the full API.

### Colored output

When bask's output goes to a terminal, commands keep their colors. This includes the `stdout` and `stderr` of an awaited command.

Commands you capture with `.text()`, `.json()`, `.lines()`, `.blob()`, or `.arrayBuffer()` give you plain text, and so do `.quiet()` commands.

<details>
  <summary><i>How does this work?</i></summary>

Bun's `$` pipes each command's output, so commands can't tell they're printing to a terminal and usually turn color off.

When bask's stdout and stderr are both terminals, `sh` sets `FORCE_COLOR=1` on the commands whose output you see. Captured and quiet commands don't get it.

If `FORCE_COLOR` or `NO_COLOR` is already set, either in your environment or with `.env()`, bask leaves it alone.

</details>

### Shell settings

`sh` takes the same settings as Bun's global `$`, plus `echo`:

- `sh.cwd()`
- `sh.env()`
- `sh.nothrow()`
- `sh.throws()`
- `sh.echo()`

They apply to every command the task runs after the call. A command's own setting (e.g. ``sh`...`.cwd()``) overrides them for that command.

```ts
export const buildWeb = task(async ({ sh }) => {
  sh.cwd("packages/web")
  await sh`bun install`
  await sh`bun run build`
})
```

- Each task and each of its hooks gets its own `sh`, so these settings never reach another task or hook.
- Settings on Bun's global `$` don't apply to `sh`.

### Errors

When a command fails, bask stops, names the task it failed in, and exits with the command's exit code:

```
error: task 'lint' failed with exit code 2
```

Any other error thrown in a task still shows its stack trace.

## Extending tasks

`before` and `after` add hooks that run around a task. A hook added in your `bask.ts` also runs when another task calls that task, including tasks you imported. This lets a project extend shared tasks without replacing them.

```ts
import { task } from "@adamhl8/bask"

import { build, lint } from "./shared-tasks.ts"

export * from "./shared-tasks.ts"

export const astroSync = task(async ({ sh }) => {
  await sh`bun astro sync`
})

lint.before(astroSync)
build.after(async ({ sh }) => {
  await sh`bun astro build`
})
```

- Hooks take tasks or plain functions
- Hooks run in the order they were added
- Hooks run once per invocation, along with their task
- Adding a hook to a task that has already started throws an error

The built-in `list` task, which prints the task list, takes hooks too:

```ts
import { list } from "@adamhl8/bask"

list.after(() => {
  console.log("\nRun `bask <task>` to run a task.")
})
```

## CLI

`bask [options] [task]`

- `task`: The task to run, by its kebab-case or camelCase name or an alias (default: the default export)
- `-l`, `--list`: List the available tasks

If the task doesn't exist, bask prints an error followed by the task list.

**Exit codes:**

- `0`: The task succeeded
- `1`: There's no `bask.ts`, it has a problem (e.g. a task exported twice), or the task doesn't exist
- `2`: The arguments are invalid
- Otherwise, the exit code of the command that failed

## API

bask exports:

- `task` Function
- `Task` Type
- `list` Task
- `isTask` Function

---

### `task` Function

```ts
function task(fn: (ctx: TaskContext) => Promise<void> | void): Task
function task(options: TaskOptions, fn: (ctx: TaskContext) => Promise<void> | void): Task

interface TaskOptions {
  desc?: string
  hidden?: boolean
  alias?: string | string[]
}

interface TaskContext {
  sh: Shell
}
```

`task` creates a task from a function. See [Tasks](#tasks) and [Task options](#task-options).

- The function receives a `TaskContext` with its own [`sh`](#running-commands)

---

### `Task` Type

```ts
interface Task {
  (): Promise<void>
  options: TaskOptions
  before: (...fns: ((ctx: TaskContext) => Promise<void> | void)[]) => void
  after: (...fns: ((ctx: TaskContext) => Promise<void> | void)[]) => void
}
```

A `Task` is a function. Calling it runs the task (and its hooks) or, if it already ran, returns the same result.

- `options` is the `TaskOptions` object passed to `task`
- `before` and `after` add [hooks](#extending-tasks)

---

### `list` Task

The built-in task that prints the task list. It runs for `bask --list`, or for `bask` when there's no default export.

You can add hooks to it like any other task:

```ts
list.before(() => {
  console.log("My project's tasks:\n")
})
```

---

### `isTask` Function

```ts
function isTask(value: unknown): value is Task
```

`isTask` checks if a value was created by `task`.
