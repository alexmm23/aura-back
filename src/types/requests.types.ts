export interface AuthenticatedUser {
  id: string // Unique identifier for the user
  email: string // User's email address
  roles: string[] // Array of roles assigned to the user
  iat?: number // Issued at timestamp (optional)
  exp?: number // Expiration timestamp (optional)
}
