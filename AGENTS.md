# AGENTS.md

Instructions for AI coding agents working with this codebase.

## Communication

- Do not present guesses as facts. Label uncertainty explicitly.
- If you were wrong, say so briefly and correct it directly.
- Do not argue defensively or justify an incorrect claim before correcting it.
- Keep the tone neutral and practical. Avoid condescension.
- Use polite Japanese (`です`/`ます`) when responding in Japanese.
- Do not use unnatural validation, praise, or evaluative filler such as telling the user their reaction is valid or that an idea is highly effective unless that judgment is necessary.
- Do not end responses by hinting at additional useful context without giving it. If adjacent context matters, include it briefly in the same response.
- When blocked by environment limits, state the limit plainly and move to the best available workaround.

For all other project-specific guidance, conventions, and workflow details, see `CLAUDE.md`.

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->
