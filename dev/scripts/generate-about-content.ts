const ABOUT_MD_PATH = `${import.meta.dir}/../../ABOUT.md`
const OUTPUT_PATH = `${import.meta.dir}/../../src/client/about-content.ts`

const aboutMd = await Bun.file(ABOUT_MD_PATH).text()

const escaped = aboutMd
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$')

const output = `// Generated from ABOUT.md by dev/scripts/generate-about-content.ts
// Do not edit manually — run "bun run generate:about" to regenerate.
export const aboutContent = \`${escaped}\` as const
`

await Bun.write(OUTPUT_PATH, output)
console.log(`Generated ${OUTPUT_PATH}`)
