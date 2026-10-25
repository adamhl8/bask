<h1 align="center"><img align="top" style="color:#36BCF7; width:38px; height:38px;" src="https://raw.githubusercontent.com/adamhl8/bask/refs/heads/main/assets/logo.svg"> bask</h1>

A task runner where your tasks are TypeScript functions.

---

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [Tasks](#tasks)
  - [Defining tasks](#defining-tasks)
  - [Task options](#task-options)
  - [Task naming](#task-naming)
  - [The default task](#the-default-task)
  - [Task dependencies](#task-dependencies)
  - [Task hooks](#task-hooks)
- [Running commands](#running-commands)
  - [Shell settings](#shell-settings)
- [Extending/sharing tasks](#extendingsharing-tasks)
- [CLI Reference](#cli-reference)

<!-- tocstop -->

## Installation

bask requires [Bun](https://bun.sh) to be installed. Tasks are built on top of Bun's `$` shell.

- Your project does _not_ need to be Bun-based. You can use bask with any runtime (Node) or package manager (npm, yarn, pnpm, etc.).

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
> The global `bask` hands off to the project's copy when there is one, so each project will use its installed version of bask.

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

Run a task by its export name:

```sh
bask build
bask bump-deps # runs `bumpDeps`
```

> [!TIP]
> In scripts or CI, use `bunx bask` so you don't have to install bask globally.

Run `bask` with no task name to run the default export (`build` above).

```sh
bask # runs `build`
```

Run `bask --list` to list available tasks:

```
Available tasks:
    build     # Lint, then build [default]
    bump-deps
    lint
```

## Tasks

### Defining tasks

`task` takes a function, and optionally an [options](#task-options) object first. The function receives `sh`, a [shell](#running-commands) for running commands, and it can be async or sync:

```ts
export const build = task({ desc: "Build the project" }, async ({ sh }) => {
  await sh`tsdown`
})

export const hello = task(() => {
  console.log("hello")
})
```

---

### Task options

- `desc`: Shown next to the task in the task list
- `hidden`: Keeps the task runnable but leaves it out of the task list
- `alias`: Other names the task runs under, as a string or an array
  - Write them in kebab-case or camelCase, and either spelling runs the task

```ts
export const releaseRun = task({ desc: "Run from CI", hidden: true }, async ({ sh }) => {
  await sh`release-it --ci`
})

export const bumpDeps = task({ alias: ["up", "update-deps"] }, async ({ sh }) => {
  await sh`bunx npm-check-updates --upgrade`
})
```

Aliases show next to the task in the task list:

```
    bump-deps # [aliases: up, update-deps]
```

---

### Task naming

A task exported with a camelCase name can be run by using its equivalent kebab-case name.

```ts
export const bumpDeps = task(async ({ sh }) => {
  // ...
})
```

These will both run `bumpDeps`:

```sh
bask bumpDeps
bask bump-deps
```

---

### The default task

Running `bask` on its own runs the default export. If `bask.ts` has no default export, it lists your tasks instead (the same as `bask --list`).

```ts
import { task } from "@adamhl8/bask"

export const build = task(async ({ sh }) => {
  await sh`tsdown`
})

export default build
```

---

### Task dependencies

To depend on another task, call it. Each task runs at most once per invocation, however many tasks call it. If two tasks call it at the same time, they both wait on the same run.

```ts
export const check = task(async () => {
  await Promise.all([lint(), build()])
})

export const ci = task(async () => {
  await check()
  await lint() // already ran, so this does nothing
})
```

---

### Task hooks

> [!IMPORTANT]
> You'll generally only need hooks when [extending tasks](#extendingsharing-tasks) from another bask file. For tasks in your own `bask.ts`, it's simpler to call them directly from the task.

On tasks, use `before` and `after` to add hooks:

```ts
export const clean = task(async ({ sh }) => {
  await sh`rm -rf dist`
})

export const build = task(async ({ sh }) => {
  await sh`tsdown`
})

build.before(clean)
build.after(async ({ sh }) => {
  await sh`du -sh dist`
})
```

- Hooks take tasks or plain functions
- Hooks run in the order they were added
- Hooks run once per invocation, along with their task
  - This includes when another task calls the task
- Each hook gets its own `sh`, separate from the task's
- Adding a hook to a task that has already started throws an error

The built-in `list` task, which prints the task list, takes hooks too:

```ts
import { list } from "@adamhl8/bask"

list.after(() => {
  console.log("\nRun `bask <task>` to run a task.")
})
```

## Running commands

Every task gets a shell, `sh`, which works like Bun's `$`. One difference is that `sh` prints each command before running it:

```ts
export const lint = task(async ({ sh }) => {
  await sh`oxlint --fix`
  // prints "oxlint --fix", then runs it
})
```

> [!TIP]
> Like a `package.json` script, `sh` finds installed bins in `node_modules/.bin`, so `oxlint` and `bun oxlint` both work.
>
> By default, `sh` runs `node_modules` bins and other `node` commands under Bun, like Bun's `--bun` flag. To use the real Node, see `.bun()` in [Shell settings](#shell-settings).

To run a command without printing it, use `.echo(false)`:

```ts
export const release = task(async ({ sh }) => {
  const branch = await sh`git branch --show-current`.echo(false).text()
  if (branch.trim() === "main") await sh`gh workflow run release.yml`
})
```

See the [Bun Shell docs](https://bun.sh/docs/runtime/shell) for the full API.

### Shell settings

The following methods can be used on the `sh` instance _or_ on each command.

- `.cwd()` - Changes the working directory
  - Relative paths resolve from the directory you ran `bask` in, not from the `sh` instance's cwd
- `.env()` - Sets the environment variables
  - This replaces the whole environment, so spread `process.env` to keep it: `.env({ ...process.env, DEBUG: "1" })`
- `.nothrow()` - Doesn't throw an error when a command exits with a non-zero exit code
- `.throws()` - Sets whether a non-zero exit code throws an error
- `.echo()` - Sets whether the command is printed before it runs
- `.bun()` - Sets whether `node_modules` bins and other `node` commands run under Bun (on by default)
  - Turn it off for a tool that doesn't work on Bun: ``sh`some-tool`.bun(false)``

Each task gets its own fresh instance of `sh`, so changes to `sh` do not affect other tasks' `sh`. Using the above methods on `sh` will apply to every command after the call in the task.

```ts
export const buildWeb = task(async ({ sh }) => {
  sh.cwd("packages/web")
  await sh`bun install`
  await sh`bun run build`
  // Override `cwd` for just this command
  await sh`cp -r packages/web/dist packages/server/public`.cwd(".")
})
```

## Extending/sharing tasks

Tasks don't have to live in `bask.ts`. They can live in any other file or package, so many projects can use the same tasks.

```ts
// shared-tasks.ts
import { task } from "@adamhl8/bask"

export const lint = task(async ({ sh }) => {
  await sh`oxlint`
})

export const build = task(async ({ sh }) => {
  await lint()
  await sh`tsdown`
})
```

To make them runnable, re-export them from your `bask.ts`:

```ts
// bask.ts
import { task } from "@adamhl8/bask"

export * from "./shared-tasks.ts"

export const deploy = task(async ({ sh }) => {
  // ...
})
```

The `lint`, `build`, and `deploy` tasks will all be available.

> [!IMPORTANT]
> `export * from` never re-exports a default. If a shared tasks module has a default export, re-export it by name for it to apply:
>
> ```ts
> export * from "./shared-tasks.ts"
> export { default } from "./shared-tasks.ts"
> ```

If a project needs to do something before or after a shared task, use [hooks](#task-hooks). A hook you add to an imported task also runs when the shared tasks call it. For example:

```ts
// bask.ts
import { task } from "@adamhl8/bask"

import { build, lint } from "./shared-tasks.ts"

export * from "./shared-tasks.ts"

export const astroSync = task(async ({ sh }) => {
  await sh`astro sync`
})

export const astroBuild = task(async ({ sh }) => {
  await sh`astro build`
})

lint.before(astroSync)
build.after(astroBuild)
```

```sh
bask build
# runs astroSync -> lint -> build -> astroBuild
```

This way, each project extends the shared tasks without copying or replacing them.

## CLI Reference

`bask [options] [task]`

- `task`: The task to run, by its kebab-case name, camelCase name, or an alias (default: the default export)
- `-l`, `--list`: List the available tasks

If the task doesn't exist, bask prints an error followed by the task list.

**Exit codes:**

- `0`: The task succeeded
- `1`: There's no `bask.ts`, it has a problem (e.g. a task exported twice), or the task doesn't exist
- `2`: The arguments are invalid
- Otherwise, the exit code of the command that failed
