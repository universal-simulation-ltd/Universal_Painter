import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The pre-paint theme script in index.html is allowed by its sha256 in the
// Content-Security-Policy (public/_headers). Change the script and the hash has
// to change with it, or the live site refuses it and dark mode flashes light.
const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8')

describe('the Content-Security-Policy', () => {
  it('allows the inline theme script by its exact hash', () => {
    const html = read('index.html')
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    expect(scripts.length).toBe(1)
    const hash = createHash('sha256').update(scripts[0]).digest('base64')
    expect(read('public/_headers')).toContain(`'sha256-${hash}'`)
  })
})
