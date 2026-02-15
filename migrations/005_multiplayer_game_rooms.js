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

export default class MultiplayerGameRooms extends BaseMigration {
  id = 5
  name = 'Add player_names to game_rooms'

  async up(sql) {
    const exists = await this.columnExists(sql, 'game_rooms', 'player_names')
    if (exists) {
      console.log('📝 player_names column already exists, skipping')
      return
    }

    console.log('🔄 Adding player_names column to game_rooms...')
    await this.exec(sql, `ALTER TABLE game_rooms ADD COLUMN player_names JSONB DEFAULT '[]'`)
    console.log('✅ player_names column added successfully!')
  }
}
