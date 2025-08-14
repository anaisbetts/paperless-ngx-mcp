import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { config } from 'dotenv'
import * as pkg from '../package.json'
import { createPaperlessClient } from './api-client'
import { createServer } from './server'

// Load environment variables
config({ quiet: true })

const paperlessServer = process.env.PAPERLESS_SERVER
const apiKey = process.env.PAPERLESS_API_KEY

if (!paperlessServer || !apiKey) {
  console.error(
    'Error: PAPERLESS_SERVER and PAPERLESS_API_KEY environment variables are required'
  )
  process.exit(1)
}

async function main(args: string[]) {
  /*
  const [client] = await createPaperlessClient(paperlessServer!, apiKey!)

  const ret = await client.GET('/api/documents/', {
    params: {
      query: {
        content__icontains: 'test',
      },
    },
  })

  console.log(JSON.stringify(ret.data, null, 2))
  */
  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
  })

  await createServer(paperlessServer!, apiKey!, server)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  return 0
}

main(process.argv.slice(2)).then(
  () => {
    console.error('Started up!')
  },
  (e) => {
    console.error(e)
    process.exit(1)
  }
)
