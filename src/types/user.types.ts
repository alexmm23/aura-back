export interface UserAttributes {
  id?: number
  name: string
  lastname: string
  email: string
  password: string
  role_id: number
  subscription_status?: 'cancelled' | 'none' | 'active' | 'expired'
  subscription_type?: string
  subscription_start?: Date | null
  subscription_end?: Date | null
  created_at?: Date
  deleted?: boolean
}

export interface UserCreationAttributes extends Omit<UserAttributes, 'id' | 'created_at'> {
  password: string
  role_id: number
  subscription_status?: 'cancelled' | 'none' | 'active' | 'expired'
  subscription_type?: string
  subscription_start?: Date | null
  subscription_end?: Date | null
}

export interface UserUpdateAttributes extends Partial<UserAttributes> {
  password?: string
  role_id?: number
  subscription_status?: 'cancelled' | 'none' | 'active' | 'expired'
  subscription_type?: string
  subscription_start?: Date | null
  subscription_end?: Date | null
}

export interface UserLoginAttributes {
  email: string
  password: string
}
