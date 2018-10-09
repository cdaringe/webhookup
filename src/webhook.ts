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
  purge: boolean
}
export function getGitHubEndpoint (config: Config) {
  return `${config.githubEndpoint}/repos/${config.githubOwner}/${config.githubRepository}/hooks`
}

export function maybeThrowGitHubApiError (res: any, json: any) {
  if (res.status >= 300) {
    if (json.message) throw new Error(`[github error]: ${json.message}`)
    throw new Error(`[github error]: ${JSON.stringify(json)}`)
  }
}

export async function up (config: Config) {
  validateWebhookConfig(config)
  const {
    githubEndpoint,
    githubOwner,
    githubRepository,
    githubToken,
    hookEndpoint,
    hookSecret,
    hookEvents,
  } = config
  const apiEndpoint = getGitHubEndpoint(config)
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
  maybeThrowGitHubApiError(res, resJson)
  debug('hook created successfully', resJson)
}

export async function purge (config: Partial<Config>) {
  validateWebhookConfig(config as Config, { githubOnly: true })
  const apiEndpoint = getGitHubEndpoint(config as Config)
  const res = await fetch(apiEndpoint, {
    method: 'get',
    headers: withJsonHeaders({ Authorization: `token ${config.githubToken}`}),
  })
  const resJson = await res.json()
  maybeThrowGitHubApiError(res, resJson)
  const hooks = resJson
  for (let hook of hooks) {
    const deleteUri = `${apiEndpoint}/${hook.id}`
    debug(`deleting hook id: ${hook.id} [${deleteUri}]`)
    const delRes = await fetch(deleteUri, {
      method: 'delete',
      headers: withJsonHeaders({ Authorization: `token ${config.githubToken}`}),
    })
    const delResJson = await delRes.json()
    maybeThrowGitHubApiError(delRes, delResJson)
  }
  debug('purged')
}

export function validateWebhookConfig (config: Config, opts?: { githubOnly: boolean }) {
  debug('validating config')
  const { githubOnly = false } = opts || {}
  if (
    githubOnly &&
    !config.githubEndpoint ||
    !config.githubOwner ||
    !config.githubRepository ||
    !config.githubToken
  ) {
    const received = JSON.stringify({
      githubEndpoint: config.githubEndpoint,
      githubOwner: config.githubOwner,
      githubRepository: config.githubRepository,
      githubToken: config.githubToken
    }, null, 2)
    throw new Error(`incomplete github setup received:\n${received.replace(/\n/g, '\n\t')}`)
  } else if (
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
