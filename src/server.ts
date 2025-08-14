import {
  McpServer,
  ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ZodRawShape, z } from 'zod'
import { components } from './api'
import { createPaperlessClient, PaperlessClient, TagMap } from './api-client'

export async function createServer(
  paperlessServer: string,
  apiKey: string,
  server: McpServer,
  readOnly = true
) {
  const [client, tagMap] = await createPaperlessClient(paperlessServer, apiKey)
  createDocumentHandlers(client, server, tagMap)
}

function createDocumentHandlers(
  paperlessClient: PaperlessClient,
  server: McpServer,
  tagMap: Map<number, components['schemas']['Tag']>
) {
  server.tool(
    'search_documents',
    'Search Paperless documents with optional date filtering',
    {
      searchTerm: z
        .string()
        .describe(
          'The search term to use (searches across title, content, and other fields)'
        ),

      dateFrom: z
        .string()
        .optional()
        .describe(
          'Filter documents created on or after this date (YYYY-MM-DD)'
        ),
      dateTo: z
        .string()
        .optional()
        .describe(
          'Filter documents created on or before this date (YYYY-MM-DD)'
        ),
    },
    catchAndReportErrors(async (args) => {
      const query: Record<string, any> = {
        search: args.searchTerm,
      }

      if (args.dateFrom) {
        query.created__date__gte = args.dateFrom
      }

      if (args.dateTo) {
        query.created__date__lte = args.dateTo
      }

      const ret = await paperlessClient.GET('/api/documents/', {
        params: { query },
      })

      if (!ret.data || ret.data?.results.length === 0) {
        return {
          content: [{ type: 'text', text: 'No documents found' }],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: ret
              .data!.results.map((d) => renderDocument(d, tagMap))
              .join('\n---\n'),
          },
        ],
      }
    })
  )
}

function renderDocument(
  doc: components['schemas']['Document'],
  tagMap: TagMap
) {
  let content = doc.content ?? ''
  if (content.length > 500) {
    content =
      content.slice(0, 500) +
      '\nDocument truncated, request document by ID to fetch full contents'
  }

  return `
    Title: ${doc.title ?? doc.original_file_name}
    ID: ${doc.id}
    Created: ${doc.created}
    ${doc.notes ? `Notes: ${doc.notes}` : ''}
    Tags: ${doc.tags.map((t) => tagMap.get(t)?.name).join(', ')}
    Content: ${content}
  `
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
