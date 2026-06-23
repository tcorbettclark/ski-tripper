import { expect } from '@playwright/test'

const MAILPIT_API = process.env.MAILPIT_API_URL!

interface MailpitMessageSummary {
  ID: string
  From: { Address: string; Name: string }
  To: { Address: string; Name: string }[]
  Subject: string
  Snippet: string
}

interface MailpitMessage {
  ID: string
  From: { Address: string; Name: string }
  To: { Address: string; Name: string }[]
  Subject: string
  HTML: string
  Text: string
}

interface MailpitSearchResponse {
  messages: MailpitMessageSummary[]
  total: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `Mailpit API error: ${res.status} ${res.statusText} at ${url}`
    )
  }
  return (await res.json()) as T
}

export async function waitForEmail(
  to: string,
  options?: { subject?: string; timeout?: number }
): Promise<MailpitMessage> {
  const timeout = options?.timeout ?? 10_000
  const subject = options?.subject

  const params = new URLSearchParams({
    query: `to:${to}${subject ? ` subject:${subject}` : ''}`,
  })

  let message: MailpitMessage | null = null

  await expect
    .poll(
      async () => {
        const data = await fetchJson<MailpitSearchResponse>(
          `${MAILPIT_API}/search?${params}`
        )
        if (data.messages.length === 0) return false
        message = await fetchJson<MailpitMessage>(
          `${MAILPIT_API}/message/${data.messages[0].ID}`
        )
        return true
      },
      {
        timeout,
        message: `Email to ${to}${subject ? ` with subject "${subject}"` : ''} not found`,
      }
    )
    .toBe(true)

  return message!
}

export function extractLink(html: string): string {
  const hrefMatch = html.match(/href="([^"]*)"/)
  if (!hrefMatch) {
    throw new Error('Could not find href in email HTML')
  }
  return hrefMatch[1]
}

export async function deleteAllEmails(): Promise<void> {
  const res = await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(
      `Failed to delete emails from Mailpit: ${res.status} ${res.statusText}`
    )
  }
}
