import Content from './content.model.js'
import Page from './pages.model.js'
import Notebook from './notebook.model.js'
import { User } from './user.model.js'
import { UserSession } from './userSession.model.js'
import { Forum } from './forum.model.js'
import { ForumPost } from './forumPost.model.js'
import { ForumComment } from './forumComment.model.js'
import { ForumAttachment } from './forumAttachment.model.js'

// Definir todas las asociaciones aquí para evitar dependencias circulares

// Content pertenece a Page
Content.belongsTo(Page, { foreignKey: 'page_id', as: 'page' })

// Page tiene muchos Contents
Page.hasMany(Content, { foreignKey: 'page_id', as: 'contents' })

// Page pertenece a Notebook
Page.belongsTo(Notebook, { foreignKey: 'notebook_id', as: 'notebook' })

// Notebook tiene muchas Pages
Notebook.hasMany(Page, { foreignKey: 'notebook_id', as: 'pages' })

// Notebook pertenece a User
Notebook.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

// User tiene muchos Notebooks
User.hasMany(Notebook, { foreignKey: 'user_id', as: 'notebooks' })

// User tiene muchas UserSessions
User.hasMany(UserSession, { foreignKey: 'user_id', as: 'sessions' })

// UserSession pertenece a User
UserSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

// ==================== FORUM ASSOCIATIONS ====================

// Forum pertenece a User (creador)
Forum.belongsTo(User, { foreignKey: 'created_by', as: 'creator' })

// User tiene muchos Forums creados
User.hasMany(Forum, { foreignKey: 'created_by', as: 'created_forums' })

// Forum tiene muchos Posts
Forum.hasMany(ForumPost, { foreignKey: 'forum_id', as: 'posts' })

// ForumPost pertenece a Forum
ForumPost.belongsTo(Forum, { foreignKey: 'forum_id', as: 'forum' })

// ForumPost pertenece a User
ForumPost.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

// User tiene muchos ForumPosts
User.hasMany(ForumPost, { foreignKey: 'user_id', as: 'forum_posts' })

// ForumPost tiene muchos Comments
ForumPost.hasMany(ForumComment, { foreignKey: 'post_id', as: 'comments' })

// ForumComment pertenece a ForumPost
ForumComment.belongsTo(ForumPost, { foreignKey: 'post_id', as: 'post' })

// ForumComment pertenece a User
ForumComment.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

// User tiene muchos ForumComments
User.hasMany(ForumComment, { foreignKey: 'user_id', as: 'forum_comments' })

// ForumComment puede tener un comentario padre (respuestas anidadas)
ForumComment.belongsTo(ForumComment, { foreignKey: 'parent_comment_id', as: 'parent_comment' })

// ForumComment puede tener muchas respuestas
ForumComment.hasMany(ForumComment, { foreignKey: 'parent_comment_id', as: 'replies' })

// ForumPost tiene muchos Attachments
ForumPost.hasMany(ForumAttachment, { foreignKey: 'post_id', as: 'attachments' })

// ForumComment tiene muchos Attachments
ForumComment.hasMany(ForumAttachment, { foreignKey: 'comment_id', as: 'attachments' })

// ForumAttachment pertenece a ForumPost (opcional)
ForumAttachment.belongsTo(ForumPost, { foreignKey: 'post_id', as: 'post' })

// ForumAttachment pertenece a ForumComment (opcional)
ForumAttachment.belongsTo(ForumComment, { foreignKey: 'comment_id', as: 'comment' })

// ForumAttachment pertenece a User
ForumAttachment.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

// User tiene muchos ForumAttachments
User.hasMany(ForumAttachment, { foreignKey: 'user_id', as: 'forum_attachments' })

export {
  Content,
  Page,
  Notebook,
  User,
  UserSession,
  Forum,
  ForumPost,
  ForumComment,
  ForumAttachment,
}
