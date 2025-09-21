import Content from './content.model.js'
import Page from './pages.model.js'
import Notebook from './notebook.model.js'
import { User } from './user.model.js'
import { UserSession } from './userSession.model.js'

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

export { Content, Page, Notebook, User, UserSession }
