import createClient, { Client } from 'openapi-fetch'
import { components, paths } from './api'

export type PaperlessClient = Client<paths>
export type TagMap = Map<number, components['schemas']['Tag']>
export type PaperlessDocument = components['schemas']['Document']

export interface PaperlessExtraMethods {
  fetchDocument: (id: number) => Promise<Response>
}

export async function createPaperlessClient(
  baseUrl: string,
  apiKey: string
): Promise<[PaperlessClient, TagMap, PaperlessExtraMethods]> {
  const client = createClient<paths>({
    baseUrl,
    headers: {
      Authorization: `Token ${apiKey}`,
    },
  })

  const downloader = {
    fetchDocument: (id: number) => {
      return fetch(`${baseUrl}/api/documents/${id}/download/`, {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      })
    },
  }

  const tags = await client.GET('/api/tags/', {
    params: { query: { page_size: 10000 } },
  })

  const tagMap = tags.data!.results.reduce((acc, tag) => {
    acc.set(tag.id, tag)
    return acc
  }, new Map<number, components['schemas']['Tag']>())

  console.error(
    Array.from(tagMap.entries())
      .map(([id, tag]) => `${id}: ${tag.name}`)
      .join(',')
  )

  return [client, tagMap, downloader]
}
