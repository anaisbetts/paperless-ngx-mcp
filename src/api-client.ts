import createClient, { Client } from 'openapi-fetch'
import { paths } from './api'

export function createPaperlessClient(
  baseUrl: string,
  apiKey: string
): Client<paths> {
  return createClient<paths>({
    baseUrl,
    headers: {
      Authorization: `Token ${apiKey}`,
    },
  })
}
