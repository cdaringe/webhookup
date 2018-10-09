import fetch from 'node-fetch'
import createDebug from 'debug'

const debug = createDebug('webhookup:webhookup')

const JSON_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}

export function withJsonHeaders (headers?: {[key: string]: string }) {
  headers = headers || {}
  return {
    ...JSON_HEADERS,
    ...headers
  }
}

// https://developer.github.com/v3/repos/hooks/#create-hook-config-params
export type GithubCreateWebHookConfig = {
  url: string
  content_type: string
  secret: string
  insecure_ssl: string
}

export type Config = {
  githubEndpoint: string
  githubOwner: string
  githubRepository: string
  githubToken: string
  hookEndpoint: string
  hookSecret: string
  hookEvents: string[]
}
export async function up (config: Config) {
  const {
    githubEndpoint,
    githubOwner,
    githubRepository,
    githubToken,
    hookEndpoint,
    hookSecret,
    hookEvents,
  } = config
  validateWebhookConfig(config)
  const apiEndpoint = `${githubEndpoint}/repos/${githubOwner}/${githubRepository}/hooks`
  const hookConfig: GithubCreateWebHookConfig = {
    url: hookEndpoint,
    content_type: 'json',
    insecure_ssl: '0',
    secret: hookSecret
  }
  const res = await fetch(apiEndpoint, {
    method: 'post',
    headers: withJsonHeaders({ Authorization: `token ${githubToken}`}),
    body: JSON.stringify({
      config: hookConfig,
      events: hookEvents,
      name: 'web',
    })
  })
  const resJson = await res.json()
  if (res.status >= 300) {
    if (resJson.message) throw new Error(resJson.message)
    throw new Error(JSON.stringify(resJson))
  }
  debug('hook created successfully', resJson)
}

export function validateWebhookConfig (config: Config) {
  debug('validating config')
  if (
    !config.githubEndpoint ||
    !config.githubOwner ||
    !config.githubRepository ||
    !config.githubToken ||
    !config.hookEndpoint ||
    !config.hookSecret ||
    (!config.hookEvents || !config.hookEvents.length)
  ) {
    const received = JSON.stringify({
      githubEndpoint: config.githubEndpoint,
      githubOwner: config.githubOwner,
      githubRepository: config.githubRepository,
      githubToken: config.githubToken,
      hookEndpoint: config.hookEndpoint,
      hookSecret: config.hookSecret,
      hookEvents: config.hookEvents,
    }, null, 2)
    throw new Error(`incomplete hook setup received:\n${received.replace(/\n/g, '\n\t')}`)
  }
  debug('config OK')
}
