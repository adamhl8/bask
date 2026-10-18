import { oxlintConfig } from "@adamhl8/configs"
import { defineConfig } from "oxlint"

const config = oxlintConfig({
  overrides: [
    {
      files: ["src/__tests__/fixtures/**"],
      rules: {
        "clean-modules/require-subpath-imports": "off",
        "import/no-default-export": "off",
      },
    },
  ],
})

export default defineConfig(config)
