#!/usr/bin/env node
/**
 * Build-time migration script.
 * Run with: node scripts/migrate.mjs
 */

import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readdir, readFile } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)

// Load .env file
async function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = await readFile(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex)
      const value = trimmed.slice(eqIndex + 1)
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // .env file not found, continue with existing env vars
  }
}

await loadEnv()
const __dirname = dirname(__filename)

async function loadMigrationsFromDir(dir, source) {
  try {
    const files = await readdir(dir)
    const migrationFiles = files
      .filter(file => file.endsWith('.js'))
      .sort()

    const migrations = []

    for (const file of migrationFiles) {
      const match = file.match(/^(\d+)_(.+)\.js$/)
      if (!match) {
        console.warn(`Skipping invalid migration file: ${file}`)
        continue
      }

      const id = parseInt(match[1], 10)
      const filePath = join(dir, file)

      try {
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`
        const migrationModule = await import(fileUrl)
        const MigrationClass = migrationModule.default

        if (!MigrationClass) {
          console.warn(`Migration file ${file} does not export a default class`)
          continue
        }

        const migrationInstance = new MigrationClass()

        if (migrationInstance.id !== id) {
          console.warn(`Migration file ${file} has mismatched ID: expected ${id}, got ${migrationInstance.id}`)
          continue
        }

        migrationInstance.source = source
        migrations.push(migrationInstance)
      } catch (error) {
        console.error(`Failed to load migration ${file}:`, error)
        continue
      }
    }

    return migrations.sort((a, b) => a.id - b.id)
  } catch {
    return []
  }
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required')
    process.exit(1)
  }

  console.log('🚀 Running build-time migrations...')

  const isInternal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') || process.env.DATABASE_SSL === 'false'

  const sql = postgres(databaseUrl, {
    ssl: isInternal ? false : 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
    onnotice: () => {},
  })

  try {
    // Create migrations table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_id INTEGER NOT NULL,
        source TEXT NOT NULL,
        name TEXT NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source, migration_id)
      )
    `

    // One-time fixup: migrate old 'project' source records to 'base'
    // This handles the transition from layer-based to local migrations
    const projectRecords = await sql`
      SELECT migration_id FROM migrations WHERE source = 'project'
    `
    if (projectRecords.length > 0) {
      for (const record of projectRecords) {
        const newId = record.migration_id + 3 // offset by the 3 base migrations
        console.log(`🔄 Migrating DB record: source='project' id=${record.migration_id} → source='base' id=${newId}`)
        await sql`
          UPDATE migrations
          SET source = 'base', migration_id = ${newId}
          WHERE source = 'project' AND migration_id = ${record.migration_id}
        `
      }
    }

    // Load all migrations from ../migrations (relative to this script)
    const migrationsDir = join(__dirname, '..', 'migrations')
    console.log('🔍 Loading migrations from:', migrationsDir)
    const allMigrations = await loadMigrationsFromDir(migrationsDir, 'base')
    console.log(`✅ Found ${allMigrations.length} migration(s)`)

    if (allMigrations.length === 0) {
      console.log('📝 No migrations found')
      await sql.end()
      return
    }

    // Get executed migrations
    const rows = await sql`SELECT source, migration_id FROM migrations ORDER BY id`
    const executedKeys = new Set(rows.map(row => `${row.source}:${row.migration_id}`))

    const pendingMigrations = allMigrations.filter(
      m => !executedKeys.has(`${m.source}:${m.id}`)
    )

    if (pendingMigrations.length === 0) {
      console.log('✅ All migrations are up to date')
      await sql.end()
      return
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s)`)

    for (const migration of pendingMigrations) {
      console.log(`⏳ Running migration ${migration.id}: ${migration.name}`)

      await sql.begin(async (tx) => {
        await migration.up(tx)
        await tx`
          INSERT INTO migrations (migration_id, source, name)
          VALUES (${migration.id}, ${migration.source}, ${migration.name})
        `
      })

      console.log(`✅ Migration ${migration.id} completed`)
    }

    console.log('🎉 All migrations completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    await sql.end()
    process.exit(1)
  }

  await sql.end()
}

runMigrations()
