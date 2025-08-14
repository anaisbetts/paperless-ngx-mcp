import {
  McpServer,
  ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ZodRawShape, z } from 'zod'
import { createPaperlessClient, PaperlessClient } from './api-client'

export function createServer(
  paperlessServer: string,
  apiKey: string,
  server: McpServer,
  readOnly = true
) {
  const client = createPaperlessClient(paperlessServer, apiKey)
  createDocumentHandlers(client, server)
}

function createDocumentHandlers(
  paperlessClient: PaperlessClient,
  server: McpServer
) {
  server.tool(
    'search_documents',
    'Do a full-text search in Paperless for document content',
    {
      searchTerm: z.string().describe('The search term to use'),
    },
    catchAndReportErrors(async (args) => {
      const ret = await paperlessClient.GET('/api/documents/', {
        params: {
          query: {
            content__icontains: args.searchTerm,
          },
        },
      })

      return {
        content: [
          {
            type: 'text',
            text: ret.data?.results[0].content ?? '',
          },
        ],
      }
    })
  )
}

function catchAndReportErrors<Args extends ZodRawShape>(
  block: ToolCallback<Args>
): ToolCallback<Args> {
  // @ts-expect-error - I have no idea why tsc says this doesn't match and it
  // won't tell me what part doesn't match
  const ret: ToolCallback<Args> = (args, extra) => {
    try {
      const result: CallToolResult | Promise<CallToolResult> = block(
        args,
        extra
      )

      if (result instanceof Promise) {
        return result.catch((e: any) => {
          console.error(e)

          return {
            isError: true,
            content: [
              {
                type: 'text',
                text:
                  'An error occurred while processing the request: ' +
                  e.message,
              },
            ],
          }
        })
      } else {
        return result
      }
    } catch (e: any) {
      console.error(e)

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text:
              'An error occurred while processing the request: ' + e.message,
          },
        ],
      }
    }
  }

  return ret
}
