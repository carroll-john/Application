#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const NOTION_API_VERSION = '2022-06-28'

function parseArgs(argv) {
  const args = { file: '', title: '' }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--file' || arg === '-f') {
      args.file = argv[i + 1] ?? ''
      i += 1
      continue
    }

    if (arg === '--title' || arg === '-t') {
      args.title = argv[i + 1] ?? ''
      i += 1
      continue
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }
  }

  return args
}

function usage() {
  console.log(`Usage: node scripts/publish-stakeholder-note-to-notion.mjs --file <markdown-path> [--title <notion-title>]

Required environment variables:
  NOTION_TOKEN         Internal integration token for Notion
  NOTION_DATABASE_ID   Target Notion database ID

Example:
  NOTION_TOKEN=... NOTION_DATABASE_ID=... \\
    node scripts/publish-stakeholder-note-to-notion.mjs \\
    --file docs/stakeholder-updates/2026-04-27-eligibility-note.md
`)
}

function textBlock(content) {
  return {
    type: 'text',
    text: {
      content: content.slice(0, 2000),
    },
  }
}

function lineToBlock(line) {
  const trimmed = line.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('## ')) {
    return {
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [textBlock(trimmed.slice(3))] },
    }
  }

  if (trimmed.startsWith('### ')) {
    return {
      object: 'block',
      type: 'heading_3',
      heading_3: { rich_text: [textBlock(trimmed.slice(4))] },
    }
  }

  if (trimmed.startsWith('- ')) {
    return {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: { rich_text: [textBlock(trimmed.slice(2))] },
    }
  }

  if (/^\d+\.\s+/.test(trimmed)) {
    const content = trimmed.replace(/^\d+\.\s+/, '')
    return {
      object: 'block',
      type: 'numbered_list_item',
      numbered_list_item: { rich_text: [textBlock(content)] },
    }
  }

  if (trimmed.startsWith('# ')) {
    return {
      object: 'block',
      type: 'heading_1',
      heading_1: { rich_text: [textBlock(trimmed.slice(2))] },
    }
  }

  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [textBlock(trimmed)] },
  }
}

function markdownToBlocks(markdown) {
  const blocks = []
  const lines = markdown.split('\n')

  for (const line of lines) {
    const block = lineToBlock(line)
    if (block) blocks.push(block)
  }

  return blocks
}

async function notionRequest(endpoint, token, body) {
  const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Notion API error ${response.status}: ${text}`)
  }

  return response.json()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }

  if (!args.file) {
    usage()
    throw new Error('Missing required --file argument.')
  }

  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID

  if (!notionToken || !notionDatabaseId) {
    throw new Error('NOTION_TOKEN and NOTION_DATABASE_ID are required environment variables.')
  }

  const filePath = path.resolve(process.cwd(), args.file)
  const content = await readFile(filePath, 'utf8')
  const lines = content.split('\n')
  const firstHeading = lines.find((line) => line.startsWith('# '))
  const inferredTitle = firstHeading ? firstHeading.slice(2).trim() : path.basename(filePath)
  const title = args.title?.trim() || inferredTitle

  const blocks = markdownToBlocks(content)

  const payload = {
    parent: { database_id: notionDatabaseId },
    properties: {
      title: {
        title: [
          {
            type: 'text',
            text: { content: title.slice(0, 2000) },
          },
        ],
      },
    },
    children: blocks.slice(0, 100),
  }

  const page = await notionRequest('pages', notionToken, payload)
  console.log(`Created Notion page: ${page.url}`)

  const remainingBlocks = blocks.slice(100)
  if (remainingBlocks.length > 0) {
    console.log(`Warning: ${remainingBlocks.length} blocks were not uploaded due to Notion's 100-child create limit.`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
