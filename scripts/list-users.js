import { Client, Users } from 'node-appwrite'

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)

const users = new Users(client)

const response = await users.list()

console.log(`Total users: ${response.total}\n`)
for (const user of response.users) {
  console.log(`- ${user.name || '(no name)'} <${user.email}> [${user.$id}]`)
}
