# AGENTS.md

## Lint

- `bask lint` runs `oxlint --fix --fix-dangerously`, which rewrites code as it fixes:
  - `null` becomes `undefined` (`unicorn/no-null`)
  - `() => undefined` becomes `() => {}`
  - an `async` function that never awaits loses its `async`
- So a test fixture that needs a visible "absent" value in JSON can't use `null`. Write a marker string such as
  `"undefined"` instead.

## Optique

bask parses command-line args with `@optique/core`, but the task API never exposes it.

- Wrap plain strings in `text()` inside `message` templates (`message`${text(desc)}``). A bare `${desc}` renders as a
  quoted value.
- `choice()` throws on an empty list, and a `bask.ts` with no tasks has one. Task names are checked by a small lookup
  value parser in `src/cli/bask-parser.ts` instead.
- `runParser()`'s sync overload types its result as the parsed value even when `onError` returns something else.
  `parseWithOptique` in `src/cli/optique.ts` writes out `T | undefined` for that reason.
- One Optique parser can't hold both bask's flags and a task's flags. Optique matches flags by name, so a shared name
  like `-l` throws, and `seq()` treats a `--` right after the task name as the end of the task's args. That's why
  `splitArgs` splits by position and each half gets its own parser.

## Tests

- `minimalEnv()` passes only `PATH` and `HOME`, so a test that runs bask in a terminal (`runInTerminal`) gets no color
  from `styleText` unless it also sets `TERM` (e.g. `xterm-256color`).
- Optique's colors come from the same `styleText` check as bask's own `error:` line (`toOptiqueOutput` in
  `src/cli/optique.ts`), so both follow `NO_COLOR`, `FORCE_COLOR`, and `TERM` the same way.
- In-process tests can't rely on `runInProcess`'s minimal env to control color, because `styleText` reads the real
  environment. bask sets `FORCE_COLOR` when it runs the tests in a terminal, so the test preload
  (`src/__tests__/test-setup.ts`) removes it. With color on, Optique marks values with color instead of quotes, and
  the assertions on quoted values fail.
