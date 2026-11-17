import "@adamhl8/configs/test/preload"

// Remove `FORCE_COLOR` because `styleText` reads the real environment, not `runInProcess`'s minimal one.
// It's set whenever bask runs the tests in a terminal, and color replaces the quotes the tests assert on.
Reflect.deleteProperty(process.env, "FORCE_COLOR")
