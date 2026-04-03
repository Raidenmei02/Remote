import { mkdir } from 'fs/promises'
import { join } from 'path'

const frontendSourceDir = join(process.cwd(), 'src', 'frontend')
const frontendBuildDir = join(process.cwd(), 'data', 'frontend-assets')

export function servePublicAsset(pathname: string): Response | null {
  if (pathname === '/' || pathname === '/index.html') {
    return new Response(Bun.file(join(frontendSourceDir, 'index.html')))
  }
  if (pathname === '/styles.css') {
    return new Response(Bun.file(join(frontendSourceDir, 'styles.css')))
  }
  if (
    pathname === '/main.js' ||
    pathname === '/main.js.map' ||
    pathname === '/app.js' ||
    pathname === '/app.js.map'
  ) {
    const filename =
      pathname === '/app.js'
        ? 'main.js'
        : pathname === '/app.js.map'
          ? 'main.js.map'
          : pathname.slice(1)
    return new Response(Bun.file(join(frontendBuildDir, filename)))
  }
  return null
}

export async function buildFrontendBundle(): Promise<void> {
  await mkdir(frontendBuildDir, { recursive: true })

  const result = await Bun.build({
    entrypoints: [join(process.cwd(), 'src', 'frontend', 'main.tsx')],
    outdir: frontendBuildDir,
    target: 'browser',
    format: 'esm',
    minify: false,
    sourcemap: 'external',
  })

  if (!result.success) {
    const message =
      result.logs.map((log: { message: string }) => log.message).join('\n') ||
      'Frontend build failed'
    throw new Error(message)
  }
}
