import { describe, expect, test } from 'vitest'
import { escapeXml } from './escape-xml'

describe('escapeXml', () => {
  test('escapes ampersands', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b')
  })

  test('escapes angle brackets', () => {
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;')
  })

  test('escapes double quotes', () => {
    expect(escapeXml('attr="val"')).toBe('attr=&quot;val&quot;')
  })

  test('handles multiple special characters', () => {
    expect(escapeXml('<a href="x&y">')).toBe(
      '&lt;a href=&quot;x&amp;y&quot;&gt;',
    )
  })

  test('returns plain text unchanged', () => {
    expect(escapeXml('hello world')).toBe('hello world')
  })
})
