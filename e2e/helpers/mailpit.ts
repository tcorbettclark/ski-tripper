const MAILPIT_API = 'http://localhost:8025/api/v1'

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

export async function waitForEmail(
  to: string,
  options?: { subject?: string; timeout?: number }
): Promise<MailpitMessage> {
  const timeout = options?.timeout ?? 5_000
  const subject = options?.subject
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const params = new URLSearchParams({
      query: `to:${to}${subject ? ` subject:${subject}` : ''}`,
    })
    const res = await fetch(`${MAILPIT_API}/search?${params}`)
    const data = (await res.json()) as MailpitSearchResponse

    if (data.messages.length > 0) {
      const messageId = data.messages[0].ID
      const msgRes = await fetch(`${MAILPIT_API}/message/${messageId}`)
      return (await msgRes.json()) as MailpitMessage
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(
    `Timed out waiting for email to ${to}${subject ? ` with subject containing "${subject}"` : ''}`
  )
}

export function extractLink(html: string): string {
  const hrefMatch = html.match(/href="([^"]*)"/)
  if (!hrefMatch) {
    throw new Error('Could not find href in email HTML')
  }
  return hrefMatch[1]
}

export async function deleteAllEmails(): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' })
}
