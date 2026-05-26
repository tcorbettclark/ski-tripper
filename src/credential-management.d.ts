interface PasswordCredentialData {
  id: string
  name?: string
  password: string
  iconURL?: string
}

declare class PasswordCredential extends Credential {
  constructor(data: PasswordCredentialData)
  readonly name: string | null
  readonly iconURL: string | null
  readonly password: string
}
