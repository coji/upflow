import { defineHook, runHook } from 'cc-hooks-ts'
import { execFileSync } from 'node:child_process'

const FORMATTABLE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.css',
]

const formatHook = defineHook({
  trigger: {
    PostToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: (context) => {
    const toolInput = context.input.tool_input
    const filePath = toolInput.file_path

    if (
      filePath &&
      FORMATTABLE_EXTENSIONS.some((ext) => filePath.endsWith(ext))
    ) {
      try {
        execFileSync('pnpm', ['exec', 'prettier', '--write', filePath], {
          stdio: 'inherit',
        })
      } catch (error) {
        console.error(`Failed to format ${filePath}:`, error)
      }
    }

    return context.success()
  },
})

await runHook(formatHook)
