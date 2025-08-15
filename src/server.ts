import {
  McpServer,
  ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { pathToFileURL } from 'url'
import { ZodRawShape, z } from 'zod'
import { components } from './api'
import {
  createPaperlessClient,
  PaperlessClient,
  PaperlessDocument,
  PaperlessExtraMethods,
  TagMap,
} from './api-client'

export async function createServer(
  paperlessServer: string,
  apiKey: string,
  server: McpServer,
  readOnly = true
) {
  const [client, tagMap, extraMethods] = await createPaperlessClient(
    paperlessServer,
    apiKey
  )
  createDocumentHandlers(client, server, tagMap, extraMethods)
}

function createDocumentHandlers(
  paperlessClient: PaperlessClient,
  server: McpServer,
  tagMap: Map<number, components['schemas']['Tag']>,
  extraMethods: PaperlessExtraMethods
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
        page_size: 100000,
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

      console.error(`search_documents ${JSON.stringify(query)}`)
      console.error(JSON.stringify(ret.data))

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

  server.tool(
    'get_document',
    'Get the full contents of the document text, by ID',
    {
      documentId: z.number().describe('The ID of the document to get'),
    },
    catchAndReportErrors(async (args) => {
      const ret = await paperlessClient.GET('/api/documents/{id}/', {
        params: {
          path: { id: args.documentId },
        },
      })

      console.error(`get_document ${args.documentId}`)

      if (!ret.data) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Document with ID ${args.documentId} not found`,
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: renderDocument(ret.data, tagMap, true),
          },
        ],
      }
    })
  )

  server.tool(
    'download_document',
    'Download the document, usually as a PDF',
    {
      documentId: z.number().describe('The ID of the document to get'),
    },
    catchAndReportErrors(async (args) => {
      const ret = await paperlessClient.GET('/api/documents/{id}/', {
        params: {
          path: { id: args.documentId },
        },
      })

      console.error(`get_document ${args.documentId}`)

      if (!ret.data) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Document with ID ${args.documentId} not found`,
            },
          ],
        }
      }

      // Fetch the document and save to a temp file, then return a resource link
      const response = await extraMethods.fetchDocument(args.documentId)

      if (!response.ok) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to download document with ID ${args.documentId}: ${response.status} ${response.statusText}`,
            },
          ],
        }
      }

      const buffer = await response.arrayBuffer()
      const contentType =
        response.headers.get('content-type') || 'application/octet-stream'
      const filename =
        ret.data.original_file_name || `document_${args.documentId}.pdf`

      // Create a temporary file with cross-platform support
      const tempDir = os.tmpdir()
      const sanitizedFilename = filename.replace(/[<>:"/\\|?*]/g, '_') // Sanitize filename for Windows
      const tempFilePath = path.join(
        tempDir,
        `paperless_${args.documentId}_${sanitizedFilename}`
      )

      console.error(`tempFilePath: ${tempFilePath}`)

      try {
        // Write the document to the temporary file
        await fs.promises.writeFile(tempFilePath, Buffer.from(buffer))

        return {
          content: [
            {
              type: 'resource_link',
              uri: pathToFileURL(tempFilePath).toString(),
              name: filename,
              description: `Downloaded document: ${ret.data.title || filename}`,
              mimeType: contentType,
              annotations: {
                audience: ['user'],
                priority: 0.9,
              },
            },
          ],
        }
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to save document to temporary file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        }
      }
    })
  )
}

function renderDocument(
  doc: PaperlessDocument,
  tagMap: TagMap,
  fullContent = false
) {
  let content = doc.content ?? ''
  if (!fullContent && content.length > 500) {
    content =
      content.slice(0, 500) +
      '\nDocument truncated, request document by ID to fetch full contents'
  }

  return `
    Title: ${doc.title ?? doc.original_file_name}
    ID: ${doc.id}
    Created: ${doc.created}
    ${doc.notes ? `Notes: ${doc.notes}` : ''}
    Tags: ${doc.tags.map((t) => tagMap.get(t)?.name).join(',')}
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
