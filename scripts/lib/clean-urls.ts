export function cleanUrls(urls: string[]): string[] {
  type Entry = { hostname: string; pathname: string; key: string }

  const entries: Entry[] = urls.map((url) => {
    let u = url.trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      u = `https://${u}`
    }
    const parsed = new URL(u)
    let hostname = parsed.hostname.toLowerCase()
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4)
    }
    const pathname = parsed.pathname.replace(/\/+$/, '')
    return { hostname, pathname, key: hostname + pathname }
  })

  const unique = new Map<string, Entry>()
  for (const entry of entries) {
    if (!unique.has(entry.key)) {
      unique.set(entry.key, entry)
    }
  }

  const all = [...unique.values()]

  const dominated = new Set<string>()
  for (let i = 0; i < all.length; i++) {
    for (let j = 0; j < all.length; j++) {
      if (i === j) continue
      if (all[i].hostname !== all[j].hostname) continue
      if (all[i].pathname === '') {
        if (all[j].pathname !== '') dominated.add(all[j].key)
      } else if (all[j].pathname.startsWith(`${all[i].pathname}/`)) {
        dominated.add(all[j].key)
      }
    }
  }

  const nonDominated = all.filter((e) => !dominated.has(e.key))

  const byHost = new Map<string, Entry[]>()
  for (const entry of nonDominated) {
    let group = byHost.get(entry.hostname)
    if (!group) {
      group = []
      byHost.set(entry.hostname, group)
    }
    group.push(entry)
  }

  const result: string[] = []
  for (const [hostname, group] of byHost) {
    if (group.length <= 1) {
      for (const e of group) {
        result.push(hostname + e.pathname)
      }
      continue
    }

    const segments = group.map((e) =>
      e.pathname === '' ? [] : e.pathname.slice(1).split('/')
    )

    let prefixLen = 0
    while (true) {
      const vals = new Set<string>()
      let allHaveSegment = true
      for (let i = 0; i < segments.length; i++) {
        if (prefixLen >= segments[i].length) {
          allHaveSegment = false
          break
        }
        vals.add(segments[i][prefixLen])
      }
      if (!allHaveSegment || vals.size !== 1) break
      prefixLen++
    }

    if (prefixLen === 0) {
      for (const e of group) {
        result.push(hostname + e.pathname)
      }
    } else {
      const prefix = `/${segments[0].slice(0, prefixLen).join('/')}`
      result.push(hostname + prefix)
    }
  }

  return result.sort()
}
