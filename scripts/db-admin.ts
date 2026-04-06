#!/usr/bin/env bun

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'
import type { Models, TablesDB } from 'node-appwrite'
import {
  Client as NodeClient,
  TablesDB as NodeTablesDB,
  Query,
} from 'node-appwrite'

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID as string
const TRIPS_TABLE_ID = process.env.PUBLIC_APPWRITE_TRIPS_TABLE_ID as string
const PARTICIPANTS_TABLE_ID = process.env
  .PUBLIC_APPWRITE_PARTICIPANTS_TABLE_ID as string
const PROPOSALS_TABLE_ID = process.env
  .PUBLIC_APPWRITE_PROPOSALS_TABLE_ID as string
const POLLS_TABLE_ID = process.env.PUBLIC_APPWRITE_POLLS_TABLE_ID as string
const VOTES_TABLE_ID = process.env.PUBLIC_APPWRITE_VOTES_TABLE_ID as string

export const TABLE_IDS = {
  trips: TRIPS_TABLE_ID,
  participants: PARTICIPANTS_TABLE_ID,
  proposals: PROPOSALS_TABLE_ID,
  polls: POLLS_TABLE_ID,
  votes: VOTES_TABLE_ID,
} as const

export type TableName = keyof typeof TABLE_IDS

const adminClient = new NodeClient()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT as string)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID as string)
  .setKey(process.env.APPWRITE_DATABASE_API_KEY as string)

export const adminTablesDb = new NodeTablesDB(adminClient)

async function listAllRows(
  tableId: string,
  db: TablesDB = adminTablesDb
): Promise<Models.Row[]> {
  const allRows: Models.Row[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const { rows } = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [Query.limit(limit), Query.offset(offset)],
    })
    allRows.push(...rows)
    if (rows.length < limit) break
    offset += limit
  }
  return allRows
}

export async function downloadAllTables(
  db = adminTablesDb
): Promise<Record<TableName, unknown[]>> {
  const tableNames = Object.keys(TABLE_IDS) as TableName[]
  const result = {} as Record<TableName, unknown[]>
  for (const name of tableNames) {
    const tableId = TABLE_IDS[name]
    console.log(`Downloading ${name}...`)
    const rows = await listAllRows(tableId, db)
    result[name] = rows
    console.log(`  -> Downloaded ${rows.length} rows from ${name}`)
  }
  return result
}

export async function deleteAllTables(db = adminTablesDb): Promise<void> {
  const tableNames = Object.keys(TABLE_IDS) as TableName[]
  for (const name of tableNames) {
    const tableId = TABLE_IDS[name]
    console.log(`Deleting all rows from ${name}...`)
    const existingRows = await listAllRows(tableId, db)
    await Promise.all(
      existingRows.map((row) =>
        db.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id })
      )
    )
    console.log(`  -> Deleted ${existingRows.length} rows from ${name}`)
  }
}

export async function uploadAllTables(
  data: Record<TableName, unknown[]>,
  db = adminTablesDb
): Promise<void> {
  const tableNames = Object.keys(TABLE_IDS) as TableName[]
  for (const name of tableNames) {
    const tableId = TABLE_IDS[name]
    const rows = data[name]
    console.log(`Uploading ${name}...`)
    let uploaded = 0
    for (const row of rows) {
      const rowData = row as unknown as Record<string, unknown>
      const rowId = rowData.$id
      delete rowData.$id
      delete rowData.$createdAt
      delete rowData.$updatedAt
      await db.createRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId: rowId as string,
        data: rowData,
      })
      uploaded++
    }
    console.log(`  -> Uploaded ${uploaded} rows to ${name}`)
  }
}

async function validateDirectory(dir: string): Promise<void> {
  try {
    const stats = await stat(dir)
    if (!stats.isDirectory()) {
      console.error(`Error: '${dir}' exists but is not a directory.`)
      process.exit(1)
    }
  } catch {
    console.error(`Error: Directory '${dir}' does not exist.`)
    process.exit(1)
  }
}

async function download(dataDir: string) {
  await mkdir(dataDir, { recursive: true })
  console.log(`Downloading all tables to '${dataDir}'...\n`)
  const data = await downloadAllTables()
  for (const [name, rows] of Object.entries(data)) {
    const filePath = resolve(dataDir, `${name}.json`)
    await writeFile(filePath, JSON.stringify(rows, null, 2), 'utf-8')
  }
  console.log(`\nAll tables saved to ${dataDir}/`)
}

async function upload(dataDir: string) {
  await validateDirectory(dataDir)
  console.log(`Uploading all tables from '${dataDir}'...\n`)
  const data: Record<TableName, unknown[]> = {} as Record<TableName, unknown[]>
  for (const name of Object.keys(TABLE_IDS) as TableName[]) {
    const filePath = resolve(dataDir, `${name}.json`)
    const content = await readFile(filePath, 'utf-8')
    data[name] = JSON.parse(content)
  }
  await uploadAllTables(data)
  console.log('\nUpload complete!')
}

async function reset() {
  console.log('Resetting all tables (deleting all rows)...\n')
  await deleteAllTables()
  console.log('\nReset complete!')
}

const program = new Command()

program
  .name('db-admin')
  .description('Tools to manage the appwrite database tables')
  .version('1.0.0')

program
  .command('download')
  .requiredOption('-d, --data-dir <directory>', 'directory to save JSON files')
  .description('Download all tables to JSON files')
  .action(async (options) => {
    await download(options.dataDir)
  })

program
  .command('upload')
  .requiredOption(
    '-d, --data-dir <directory>',
    'directory containing JSON files'
  )
  .description('Upload all tables from JSON files')
  .action(async (options) => {
    await upload(options.dataDir)
  })

program
  .command('reset')
  .description('Delete all rows from all tables')
  .action(reset)

program.parse()
