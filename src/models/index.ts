// Importar todos los modelos primero
import ContentModel from './content.model.js'
import PageModel from './pages.model.js'
import NotebookModel from './notebook.model.js'
import { User as UserModel } from './user.model.js'
import { UserAccount as UserAccountModel } from './userAccount.model.js'

// Luego importar las asociaciones (esto configurará las relaciones)
import './associations.js'

// Exportar todos los modelos con las asociaciones ya configuradas
export const Content = ContentModel
export const Page = PageModel
export const Notebook = NotebookModel
export const User = UserModel
export const UserAccount = UserAccountModel

// Export default para compatibilidad
export default {
  Content,
  Page,
  Notebook,
  User,
  UserAccount,
}
