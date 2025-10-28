// Types for UserAccount model

export interface UserAccountAttributes {
  id: number
  user_id: number
  username?: string
  password?: string
  external_user_id?: string
  platform: 'google' | 'microsoft' | 'moodle' | string
  access_token: string
  refresh_token?: string | null
  created_at: Date
  deleted: boolean
  expiry_date?: Date | null
  // Additional fields
  email?: string | null
  name?: string | null
  firstname?: string | null
  lastname?: string | null
  provider_url?: string | null
  provider_account_id?: string | null
}

export interface UserAccountCreationAttributes {
  user_id: number
  platform: 'google' | 'microsoft' | 'moodle' | string
  access_token: string
  refresh_token?: string | null
  username?: string
  password?: string
  external_user_id?: string
  expiry_date?: Date | null
  email?: string | null
  name?: string | null
  firstname?: string | null
  lastname?: string | null
  provider_url?: string | null
  provider_account_id?: string | null
}

export interface MoodleAccountData extends UserAccountCreationAttributes {
  platform: 'moodle'
  provider_url: string
  provider_account_id: string
  email: string
  name: string
  username: string
  firstname: string
  lastname: string
}

export interface GoogleAccountData extends UserAccountCreationAttributes {
  platform: 'google'
  expiry_date: Date
  email: string
  name?: string
}

export interface MicrosoftAccountData extends UserAccountCreationAttributes {
  platform: 'microsoft'
  expiry_date: Date
  email: string
  name?: string
}
