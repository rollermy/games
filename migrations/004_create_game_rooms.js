class BaseMigration {
  async exec(sql, query) {
    await sql.unsafe(query)
  }

  async tableExists(sql, tableName) {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ) as exists
    `
    return result[0]?.exists || false
  }
}

export default class CreateGameRooms extends BaseMigration {
  id = 4
  name = 'Create game_rooms table'

  async up(sql) {
    const exists = await this.tableExists(sql, 'game_rooms')
    if (exists) {
      console.log('📝 game_rooms table already exists, skipping')
      return
    }

    console.log('🔄 Creating game_rooms table...')
    await this.exec(sql, `
      CREATE TABLE game_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(8) UNIQUE NOT NULL,
        game_type VARCHAR(50) NOT NULL DEFAULT 'dos',
        host_user_id UUID NOT NULL REFERENCES users(id),
        guest_name VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'waiting',
        winner VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await this.exec(sql, `CREATE INDEX idx_game_rooms_code ON game_rooms(code)`)
    await this.exec(sql, `CREATE INDEX idx_game_rooms_host ON game_rooms(host_user_id)`)
    await this.exec(sql, `CREATE INDEX idx_game_rooms_status ON game_rooms(status)`)
    console.log('✅ game_rooms table created successfully!')
  }
}
