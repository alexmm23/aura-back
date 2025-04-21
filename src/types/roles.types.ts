type StudentRole = 'student'
type TeacherRole = 'teacher'
type AdminRole = 'admin'
type GuestRole = 'guest'
type Role = StudentRole | TeacherRole | AdminRole | GuestRole
type User = {
  id: number
  name: string
  role: Role
}
type RoleAttributes = {
  id?: number
  name: string
  description?: string
  created_at?: Date
  updated_at?: Date
  deleted?: boolean
}
export { Role, User, RoleAttributes, StudentRole, TeacherRole, AdminRole, GuestRole }
