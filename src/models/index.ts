// Importar todos los modelos primero
import ContentModel from './content.model.js'
import PageModel from './pages.model.js'
import NotebookModel from './notebook.model.js'
import { User as UserModel } from './user.model.js'
import { UserAccount as UserAccountModel } from './userAccount.model.js'
import { UserSession as UserSessionModel } from './userSession.model.js'
import { Forum as ForumModel } from './forum.model.js'
import { ForumPost as ForumPostModel } from './forumPost.model.js'
import { ForumComment as ForumCommentModel } from './forumComment.model.js'
import { ForumAttachment as ForumAttachmentModel } from './forumAttachment.model.js'
import { Reminder as ReminderModel } from './reminder.model.js'
import { Chat as ChatModel } from './chat.model.js'
import { Message as MessageModel } from './message.model.js'
import { NotificationToken as NotificationTokenModel } from './notificationToken.model.js'
import { AssignmentSnapshot as AssignmentSnapshotModel } from './assignmentSnapshot.model.js'

// Luego importar las asociaciones (esto configurará las relaciones)
import './associations.js'

// Exportar todos los modelos con las asociaciones ya configuradas
export const Content = ContentModel
export const Page = PageModel
export const Notebook = NotebookModel
export const User = UserModel
export const UserAccount = UserAccountModel
export const UserSession = UserSessionModel
export const Forum = ForumModel
export const ForumPost = ForumPostModel
export const ForumComment = ForumCommentModel
export const ForumAttachment = ForumAttachmentModel
export const Reminder = ReminderModel
export const Chat = ChatModel
export const Message = MessageModel
export const NotificationToken = NotificationTokenModel
export const AssignmentSnapshot = AssignmentSnapshotModel

// Export default para compatibilidad
export default {
  Content,
  Page,
  Notebook,
  User,
  UserAccount,
  UserSession,
  Forum,
  ForumPost,
  ForumComment,
  ForumAttachment,
  Reminder,
  Chat,
  Message,
  NotificationToken,
  AssignmentSnapshot,
}
