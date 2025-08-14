import createClient, { Client } from 'openapi-fetch'
import { paths } from './api'

export type PaperlessClient = Client<paths>

export function createPaperlessClient(
  baseUrl: string,
  apiKey: string
): PaperlessClient {
  return createClient<paths>({
    baseUrl,
    headers: {
      Authorization: `Token ${apiKey}`,
    },
  })
}
