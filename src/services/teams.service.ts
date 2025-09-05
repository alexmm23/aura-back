import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import env from '@/config/enviroment'

const credential = new ClientSecretCredential(
  process.env.MS_TENANT_ID || env.MS_TENANT_ID,
  process.env.MS_CLIENT_ID || env.MS_CLIENT_ID,
  process.env.MS_CLIENT_SECRET || env.MS_CLIENT_SECRET,
)

async function getAccessToken() {
  const token = await credential.getToken('https://graph.microsoft.com/.default')
  return token?.token
}

export async function getGraphClient() {
  const accessToken = await getAccessToken()
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken)
    },
  })
}

// Example: Send a message to a Teams channel
export async function sendTeamsMessage(teamId: string, channelId: string, message: string) {
  const client = await getGraphClient()
  await client.api(`/teams/${teamId}/channels/${channelId}/messages`).post({
    body: {
      contentType: 'html',
      content: message,
    },
  })
}

export async function getUserTeams(accessToken: string) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken)
    },
  })
  const teams = await client.api('/me/joinedTeams').get()
  return teams.value
}

//Obtener tareas pendientes de teams
export async function getTeamsTasks(accessToken: string) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken)
    },
  })
  // Tareas asignadas al usuario en Planner (Teams)
  const tasks = await client.api('/me/planner/tasks').get()
  return tasks.value
}
