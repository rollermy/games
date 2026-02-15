class BaseMigration {
  async exec(sql, query) {
    await sql.unsafe(query)
  }

  async columnExists(sql, tableName, columnName) {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
      ) as exists
    `
    return result[0]?.exists || false
  }
}

export default class AddGameStateColumn extends BaseMigration {
  id = 6
  name = 'Add game_state to game_rooms'

  async up(sql) {
    const exists = await this.columnExists(sql, 'game_rooms', 'game_state')
    if (exists) {
      console.log('📝 game_state column already exists, skipping')
      return
    }

    console.log('🔄 Adding game_state column to game_rooms...')
    await this.exec(sql, `ALTER TABLE game_rooms ADD COLUMN game_state JSONB`)
    console.log('✅ game_state column added successfully!')
  }
}
