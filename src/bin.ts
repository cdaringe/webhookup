#!/usr/bin/env node
const getGitConfigPath = require('git-config-path')
import { arrayFromString } from './util'
import { HookupError } from './errors'
import * as webhook from './webhook'
import createDebug from 'debug'
import meow from 'meow'
import parse = require('parse-git-config')

const debug = createDebug('webhookup:bin')

const opts = meow(
  `
Usage
  $ webhookup [options]

Options

--github, -g or env GITHUB_ENDPOINT. defaults to github.com's api
--owner, -o or env GITHUB_OWNER. repo owner/org. if none provided, tries to read owner from working directory
--repository, -r or env GITHUB_REPOSITORY. repo name. if none provided, tries to read from working directory
--token, -t or env WEBHOOK_GITHUB_TOKEN or GITHUB_TOKEN. github api token. must provide admin:repo_hook permission
--endpoint, -h or env WEBHOOK_ENDPOINT. url to the origin (host:<port>) where your webhook listener lives
--secret, -s or env WEBHOOK_SECRET. github webhook secret. your hook service uses this secret to verify that request is legitimate.
--events, -e or env WEBHOOK_EVENTS. csv list of events. e.g. \`status,push\`
--purge, -p delete all webhooks for repo.

Examples
  # minimal, if you configure your env for everything
  $ webhookup

  # pragmatic option 1, specify just events, cd to your github/.git enabled project,
  # use your env for the rest
  $ webhookup -e status,push

  # pragmatic option 2, if your PWD is a github & .git enabled project
  $ webhookup -t <token> -h my.webhook.host.com -s <super-secret> -e status,push

  # ignore PWD, specify org & repo
  $ webhookup -o cdaringe -r webhookup
`,
  {
    flags: {
      github: {
        type: 'string',
        alias: 'g'
      },
      owner: {
        type: 'string',
        alias: 'o'
      },
      repository: {
        type: 'string',
        alias: 'r'
      },
      token: {
        type: 'string',
        alias: 't'
      },
      endpoint: {
        type: 'string',
        alias: 'h'
      },
      secret: {
        type: 'string',
        alias: 's'
      },
      events: {
        type: 'string',
        alias: 'e'
      },
      purge: {
        type: 'boolean',
        alias: 'p'
      }
    }
  }
)
debug('cli:', opts)

async function go () {
  try {
    const config: webhook.Config = {
      githubEndpoint:
        opts.flags.github ||
        process.env.GITHUB_ENDPOINT ||
        'https://api.github.com',
      githubOwner: opts.flags.owner || process.env.GITHUB_OWNER,
      githubRepository: opts.flags.repository || process.env.GITHUB_REPOSITORY,
      githubToken:
        opts.flags.token ||
        process.env.WEBHOOK_GITHUB_TOKEN ||
        process.env.GITHUB_TOKEN,
      hookEndpoint: opts.flags.endpoint || process.env.WEBHOOK_ENDPOINT,
      hookSecret: opts.flags.secret || process.env.WEBHOOK_SECRET,
      hookEvents: arrayFromString(
        opts.flags.events || process.env.WEBHOOK_EVENTS || ''
      ),
      purge: !!opts.flags.purge
    }
    if (!config.githubOwner && !config.githubRepository) {
      debug('reading owner/repo from git')
      const gitConfigFilename: string | null = getGitConfigPath()
      if (!gitConfigFilename) throw new HookupError('unable to read git config')
      const gitConfig = await parse.promise({ path: gitConfigFilename })
      if (!gitConfig) throw new HookupError('unable to read git config')
      const [owner, repo] = gitConfig['remote "origin"'].url
        .match(/:(.+\/.+)\.git$/)[1]
        .split('/')
      config.githubOwner = owner
      config.githubRepository = repo
      debug(`found owner/repo:`, [owner, repo])
    } else if (!config.githubOwner || !config.githubRepository) {
      throw new HookupError(
        `if providing an owner or repo, you must provide both`
      )
    }
    if (config.purge) await webhook.purge(config)
    else await webhook.up(config)
  } catch (err) {
    if (err instanceof HookupError) {
      console.warn(err.message)
      process.exit(1)
    }
    throw err
  }
}
go()
