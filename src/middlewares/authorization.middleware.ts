import { Request, Response, NextFunction } from 'express'
import { UserAttributes } from '@/types/user.types'
import { User } from '@/models/user.model'
import { Console } from 'console'

export interface RoutePermission {
  path: string
  roles: number[]
  requiredSubscription?: string[]
}
//subscription_status: 'none' | 'expired' | 'active' | 'premium'
// Configuración de permisos por ruta
const ROUTE_PERMISSIONS: RoutePermission[] = [
  {
    path: '/api/student/*',
    roles: [2], // role_id 2 = student
    requiredSubscription: ['none', 'expired', 'active']
  },
  {
    path: '/api/admin/*', 
    roles: [1], // role_id 1 = admin
  },
  {
    path: '/api/teacher/*',
    roles: [3], // role_id 3 = teacher
    requiredSubscription: ['none', 'active']
  },
  {
    path: '/api/notebook/create',
    roles: [2, 3], // estudiantes y profesores
    requiredSubscription: ['none', 'active']
  },
  {
    path: '/api/notebook/premium/*',
    roles: [2, 3],
    requiredSubscription: ['active']
  }
]

export const authorizeRoute = (requiredRoles: number[], requiredSubscription?: string[]) => {
  return async (req: Request & { user?: UserAttributes }, res: Response, next: NextFunction) => {
    try {
      const { user } = req
      
      if (!user) {
        res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        })
        return
      }

      // Obtener datos actualizados del usuario desde la DB
      const currentUser = await User.findOne({
        where: { id: user.id, deleted: false },
        attributes: ['id', 'role_id', 'subscription_status', 'subscription_type']
      })

      if (!currentUser) {
        res.status(401).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        })
        return
      }

      // Validar rol
      if (!requiredRoles.includes(currentUser.role_id)) {
        res.status(403).json({ 
          error: 'Insufficient role permissions',
          code: 'INSUFFICIENT_ROLE',
          required: requiredRoles,
          current: currentUser.role_id
        })
        return
      }

      // Validar suscripción si es requerida
      if (requiredSubscription) {
        console.log('Required subscription:', requiredSubscription)
        console.log('User subscription status:', currentUser.subscription_status)
        const userSubscription = currentUser.subscription_status || 'none'
        
        if (!requiredSubscription.includes(userSubscription)) {
          res.status(403).json({ 
            error: 'Subscription upgrade required',
            code: 'SUBSCRIPTION_REQUIRED',
            required: requiredSubscription,
            current: userSubscription
          })
          return
        }
      }

      // Actualizar req.user con datos frescos
      req.user = currentUser.toJSON() as UserAttributes
      next()

    } catch (error: any) {
      res.status(500).json({ 
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_ERROR'
      })
    }
  }
}

export const checkRouteAccess = (path: string, userRole: number, userSubscription?: string): boolean => {
  const routePermission = ROUTE_PERMISSIONS.find(permission => 
    new RegExp(permission.path.replace('*', '.*')).test(path)
  )

  if (!routePermission) {
    return true // Ruta pública
  }

  // Verificar rol
  const hasRoleAccess = routePermission.roles.includes(userRole)
  
  // Verificar suscripción
  const hasSubscriptionAccess = !routePermission.requiredSubscription || 
    (userSubscription !== undefined && routePermission.requiredSubscription.includes(userSubscription))

  return hasRoleAccess && hasSubscriptionAccess
}
