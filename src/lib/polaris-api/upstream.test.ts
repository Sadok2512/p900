import { describe, it, expect } from 'vitest'
import { viaHostname } from './upstream'

describe('relay upstream host', () => {
  it('maps a bare lab IP to a hostname the edge accepts', () => {
    expect(viaHostname('http://151.242.147.49:8091')).toBe('http://151-242-147-49.sslip.io:8091')
  })
  it('leaves named hosts unchanged', () => {
    expect(viaHostname('https://lab.example.org')).toBe('https://lab.example.org')
  })
})
