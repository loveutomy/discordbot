import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS commands (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        command_name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    client.release();
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('봇의 응답 시간을 확인합니다'),
  new SlashCommandBuilder()
    .setName('hello')
    .setDescription('인사합니다'),
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('사용자 정보를 저장합니다')
    .addStringOption(option =>
      option.setName('name').setDescription('이름').setRequired(true)
    ),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`✅ 봇 로그인: ${client.user.tag}`);
  
  try {
    console.log('슬래시 명령어 등록 중...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ 슬래시 명령어 등록 완료');
  } catch (error) {
    console.error('명령어 등록 실패:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;

  try {
    await pool.query(
      'INSERT INTO commands (user_id, command_name) VALUES ($1, $2)',
      [user.id, commandName]
    );

    if (commandName === 'ping') {
      await interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
    } else if (commandName === 'hello') {
      await interaction.reply(`👋 안녕하세요, ${user.username}님!`);
    } else if (commandName === 'info') {
      const name = interaction.options.getString('name');
      await interaction.reply(`✅ ${name} 정보가 저장되었습니다!`);
    }
  } catch (error) {
    console.error('명령어 처리 오류:', error);
    await interaction.reply('❌ 오류가 발생했습니다.');
  }
});

client.login(process.env.DISCORD_TOKEN);

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

await initDb();
