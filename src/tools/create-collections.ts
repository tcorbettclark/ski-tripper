#!/usr/bin/env bun

import { Command } from 'commander'
import PocketBase from 'pocketbase'
import {
  server_get_pocketbase_admin_email,
  server_get_pocketbase_admin_password,
  server_get_pocketbase_url,
} from '../shared/env'

const authRule = "@request.auth.id != ''"
const adminOnlyRule = null

const AUTHENTICATED_RULES = {
  listRule: authRule,
  viewRule: authRule,
  createRule: authRule,
  updateRule: authRule,
  deleteRule: authRule,
}

const ADMIN_ONLY_RULES = {
  listRule: adminOnlyRule,
  viewRule: adminOnlyRule,
  createRule: adminOnlyRule,
  updateRule: adminOnlyRule,
  deleteRule: adminOnlyRule,
}

async function createCollections() {
  const PB_URL = server_get_pocketbase_url()
  const PB_SUPERUSER_EMAIL = server_get_pocketbase_admin_email()
  const PB_SUPERUSER_PASSWORD = server_get_pocketbase_admin_password()
  const pb = new PocketBase(PB_URL)

  await pb
    .collection('_superusers')
    .authWithPassword(PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD)
  console.log('Authenticated as superuser')

  const usersId = (await pb.collections.getFirstListItem('name = "users"')).id
  console.log(`Found users collection: ${usersId}`)

  const collectionsToCreate = [
    {
      name: 'trips',
      type: 'base',
      fields: [
        { name: 'code', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_trips_code` ON `trips` (`code`)'],
      ...AUTHENTICATED_RULES,
    },
    {
      name: 'participants',
      type: 'base',
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: usersId,
          cascadeDelete: false,
        },
        { name: 'name', type: 'text', required: true },
        {
          name: 'trip',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: '@@trips@@',
          cascadeDelete: true,
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['coordinator', 'participant'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
      ...AUTHENTICATED_RULES,
    },
    {
      name: 'proposals',
      type: 'base',
      fields: [
        {
          name: 'proposer',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: usersId,
          cascadeDelete: false,
        },
        { name: 'proposer_name', type: 'text', required: true },
        {
          name: 'trip',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: '@@trips@@',
          cascadeDelete: true,
        },
        {
          name: 'state',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['draft', 'submitted', 'rejected'],
        },
        { name: 'description', type: 'text', required: true },
        { name: 'resort_name', type: 'text', required: true },
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date', required: true },
        { name: 'nearest_airport', type: 'text', required: true },
        { name: 'transfer_time', type: 'number', required: false },
        { name: 'country', type: 'text', required: true },
        { name: 'region', type: 'text', required: true },
        { name: 'summit_altitude', type: 'number', required: true },
        { name: 'base_altitude', type: 'number', required: true },
        { name: 'piste_km', type: 'number', required: true },
        { name: 'beginner_pct', type: 'number', required: true },
        { name: 'intermediate_pct', type: 'number', required: true },
        { name: 'advanced_pct', type: 'number', required: true },
        { name: 'lift_count', type: 'number', required: true },
        {
          name: 'snow_reliability',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['high', 'medium', 'low'],
        },
        { name: 'ski_season_months', type: 'text', required: true },
        { name: 'websites', type: 'json', required: false },
        { name: 'latitude', type: 'text', required: true },
        { name: 'longitude', type: 'text', required: true },
        { name: 'linked_resorts_description', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
      ...AUTHENTICATED_RULES,
    },
    {
      name: 'accommodations',
      type: 'base',
      fields: [
        {
          name: 'proposal',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: '@@proposals@@',
          cascadeDelete: true,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'url', type: 'url', required: false },
        { name: 'cost', type: 'text', required: false },
        { name: 'description', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
      ...AUTHENTICATED_RULES,
    },
    {
      name: 'polls',
      type: 'base',
      fields: [
        {
          name: 'creator',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: usersId,
          cascadeDelete: false,
        },
        { name: 'creator_name', type: 'text', required: true },
        {
          name: 'trip',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: '@@trips@@',
          cascadeDelete: true,
        },
        {
          name: 'state',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['open', 'closed'],
        },
        { name: 'proposal_ids', type: 'json', required: false },
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date', required: true },
        { name: 'outcome', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
      ...AUTHENTICATED_RULES,
    },
    {
      name: 'votes',
      type: 'base',
      fields: [
        {
          name: 'poll',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: '@@polls@@',
          cascadeDelete: true,
        },
        {
          name: 'voter',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: usersId,
          cascadeDelete: false,
        },
        { name: 'voter_name', type: 'text', required: true },
        { name: 'proposal_ids', type: 'json', required: false },
        { name: 'token_counts', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
      ...AUTHENTICATED_RULES,
    },
    {
      name: 'preferences',
      type: 'base',
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: usersId,
          cascadeDelete: false,
        },
        {
          name: 'ski_snowboard',
          type: 'select',
          required: true,
          maxSelect: 2,
          values: ['Ski', 'Snowboard'],
        },
        {
          name: 'difficulty',
          type: 'select',
          required: true,
          maxSelect: 3,
          values: ['Black', 'Red', 'Blue'],
        },
        {
          name: 'piste',
          type: 'select',
          required: true,
          maxSelect: 2,
          values: ['On-Piste', 'Off-Piste'],
        },
        { name: 'time_slopes', type: 'number', required: true },
        { name: 'time_eating', type: 'number', required: true },
        { name: 'time_apres', type: 'number', required: true },
        { name: 'time_hotel', type: 'number', required: true },
        {
          name: 'accommodation',
          type: 'select',
          required: true,
          maxSelect: 4,
          values: [
            '5-star hotel with spa etc',
            '4-star or below hotel',
            'Chalet',
            'Pension/guesthouse',
          ],
        },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_preferences_user` ON `preferences` (`user`)',
      ],
      ...AUTHENTICATED_RULES,
    },
    {
      name: 'discussion',
      type: 'base',
      fields: [
        {
          name: 'proposal',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: '@@proposals@@',
          cascadeDelete: true,
        },
        {
          name: 'author',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: usersId,
          cascadeDelete: false,
        },
        { name: 'author_name', type: 'text', required: true },
        { name: 'body', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['comment', 'system'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
      ...AUTHENTICATED_RULES,
    },
    {
      name: 'llm_cache',
      type: 'base',
      fields: [
        { name: 'input_hash', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['analysis', 'preference-search'],
        },
        {
          name: 'proposal',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: '@@proposals@@',
          cascadeDelete: true,
        },
        {
          name: 'trip',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: '@@trips@@',
          cascadeDelete: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['generating', 'complete', 'error'],
        },
        { name: 'thinking', type: 'text', required: false },
        { name: 'content', type: 'text', required: false },
        { name: 'model', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX `idx_llm_cache_input_hash` ON `llm_cache` (`input_hash`)',
      ],
      ...ADMIN_ONLY_RULES,
    },
    {
      name: 'resorts',
      type: 'base',
      fields: [
        { name: 'file', type: 'file', required: true, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
      listRule: authRule,
      viewRule: authRule,
      createRule: adminOnlyRule,
      updateRule: adminOnlyRule,
      deleteRule: adminOnlyRule,
    },
  ]

  const createdIds: Record<string, string> = {}

  for (const collectionDef of collectionsToCreate) {
    const collectionData = { ...collectionDef } as Record<string, unknown>
    const collectionName = collectionData.name as string

    const existing = await pb.collections
      .getFirstListItem(`name = '${collectionName}'`)
      .catch(() => null)

    const fields = (collectionData.fields as Record<string, unknown>[]).map(
      (field) => {
        const f = { ...field }
        if (
          f.type === 'relation' &&
          typeof f.collectionId === 'string' &&
          f.collectionId.startsWith('@@') &&
          f.collectionId.endsWith('@@')
        ) {
          const refName = f.collectionId.slice(2, -2)
          if (createdIds[refName]) {
            f.collectionId = createdIds[refName]
          } else {
            console.error(
              `Error: Collection '${refName}' referenced by relation in '${collectionName}' has not been created yet`
            )
            process.exit(1)
          }
        }
        return f
      }
    )

    const data: Record<string, unknown> = {
      ...collectionData,
      fields,
    }
    delete data.indexes

    if (existing) {
      await pb.collections.update(existing.id, data)
      createdIds[collectionName] = existing.id
      console.log(`Synced collection '${collectionName}' (id: ${existing.id})`)
    } else {
      const result = await pb.collections.create(data)
      createdIds[collectionName] = result.id
      console.log(`Created collection '${collectionName}' (id: ${result.id})`)
    }

    if (
      Array.isArray(collectionData.indexes) &&
      collectionData.indexes.length > 0
    ) {
      const indexArr = collectionData.indexes as string[]
      const normalizedIndexes = indexArr.map((idx) =>
        idx.replace(/`@@[^@]+@@`/g, (match) => {
          const refName = match.slice(3, -3)
          return `\`${createdIds[refName]}\``
        })
      )
      await pb.collections.update(createdIds[collectionName], {
        indexes: normalizedIndexes,
      })
      console.log(`  Synced ${normalizedIndexes.length} index(es)`)
    }
  }

  console.log('\nAll collections created successfully!')
  console.log('\nCollection IDs:')
  for (const [name, id] of Object.entries(createdIds)) {
    console.log(`  ${name}: ${id}`)
  }
}

async function deleteCollections() {
  const PB_URL = server_get_pocketbase_url()
  const PB_SUPERUSER_EMAIL = server_get_pocketbase_admin_email()
  const PB_SUPERUSER_PASSWORD = server_get_pocketbase_admin_password()
  const pb = new PocketBase(PB_URL)

  await pb
    .collection('_superusers')
    .authWithPassword(PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD)
  console.log('Authenticated as superuser')

  const collectionNames = [
    'resorts',
    'llm_cache',
    'discussion',
    'preferences',
    'votes',
    'polls',
    'accommodations',
    'proposals',
    'participants',
    'trips',
  ]

  for (const name of collectionNames) {
    try {
      await pb.collections.delete(name)
      console.log(`Deleted collection '${name}'`)
    } catch {
      console.log(`Collection '${name}' not found, skipping`)
    }
  }

  console.log('\nAll collections deleted!')
}

const program = new Command()

program
  .name('create-collections')
  .description('Manage PocketBase collections for ski-tripper')

program
  .command('create')
  .description('Create all collections')
  .action(createCollections)

program
  .command('delete')
  .description('Delete all collections (in reverse dependency order)')
  .action(deleteCollections)

program.parse()
