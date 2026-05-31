import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const db = new Database('shop.db');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers] });

// 데이터베이스 초기화
function initDb() {
 db.exec(`
 CREATE TABLE IF NOT EXISTS users (
 user_id TEXT PRIMARY KEY,
 balance INTEGER DEFAULT 0
 );
 CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 price INTEGER NOT NULL,
 stock INTEGER DEFAULT 0
 );
 CREATE TABLE IF NOT EXISTS charges (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 amount INTEGER NOT NULL,
 status TEXT DEFAULT 'pending',
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
 );
 CREATE TABLE IF NOT EXISTS purchases (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 product_id INTEGER NOT NULL,
 amount INTEGER NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
 );
 `);
 console.log('✅ Database initialized');
}

// 명령어 로드
function loadCommands() {
 const commands = [
 new SlashCommandBuilder()
 .setName('잔액')
 .setDescription('현재 잔액을 확인합니다'),
 
 new SlashCommandBuilder()
 .setName('충전신청')
 .setDescription('충전을 신청합니다')
 .addIntegerOption(opt => opt.setName('금액').setDescription('충전 금액').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('충전완료')
 .setDescription('충전 완료 버튼을 표시합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 
 new SlashCommandBuilder()
 .setName('충전승인')
 .setDescription('충전을 승인합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addUserOption(opt => opt.setName('사용자').setDescription('승인할 사용자').setRequired(true))
 .addIntegerOption(opt => opt.setName('금액').setDescription('승인 금액').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('충전거절')
 .setDescription('충전을 거절합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addUserOption(opt => opt.setName('사용자').setDescription('거절할 사용자').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('상품추가')
 .setDescription('상품을 추가합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addStringOption(opt => opt.setName('이름').setDescription('상품명').setRequired(true))
 .addIntegerOption(opt => opt.setName('가격').setDescription('가격').setRequired(true))
 .addIntegerOption(opt => opt.setName('재고').setDescription('초기 재고').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('상품삭제')
 .setDescription('상품을 삭제합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addIntegerOption(opt => opt.setName('상품id').setDescription('상품 ID').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('재고추가')
 .setDescription('재고를 추가합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addIntegerOption(opt => opt.setName('상품id').setDescription('상품 ID').setRequired(true))
 .addIntegerOption(opt => opt.setName('수량').setDescription('추가 수량').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('재고확인')
 .setDescription('상품의 재고를 확인합니다')
 .addIntegerOption(opt => opt.setName('상품id').setDescription('상품 ID').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('상품목록')
 .setDescription('모든 상품을 표시합니다'),
 
 new SlashCommandBuilder()
 .setName('구매')
 .setDescription('상품을 구매합니다')
 .addIntegerOption(opt => opt.setName('상품id').setDescription('상품 ID').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('랜덤지급')
 .setDescription('랜덤 재고를 지급합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addUserOption(opt => opt.setName('사용자').setDescription('지급할 사용자').setRequired(true))
 .addIntegerOption(opt => opt.setName('상품id').setDescription('상품 ID').setRequired(true))
 .addIntegerOption(opt => opt.setName('수량').setDescription('지급 수량').setRequired(true)),
 
 new SlashCommandBuilder()
 .setName('구매로그')
 .setDescription('구매 로그를 표시합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 
 new SlashCommandBuilder()
 .setName('충전로그')
 .setDescription('충전 로그를 표시합니다')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 
 new SlashCommandBuilder()
 .setName('구매내역')
 .setDescription('내 구매 내역을 조회합니다'),
 ];
 return commands.map(cmd => cmd.toJSON());
}

client.on('ready', async () => {
 console.log(`✅ 봇 로그인: ${client.user.tag}`);
 console.log('슬래시 명령어 등록 중...');
 
 try {
 const commands = loadCommands();
 const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
 
 // 모든 서버에 명령어 등록
 for (const guild of client.guilds.cache.values()) {
 await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
 console.log(`✅ ${guild.name}에 명령어 등록 완료`);
 }
 } catch (error) {
 console.error('명령어 등록 실패:', error);
 }
});

client.on('interactionCreate', async (interaction) => {
 if (!interaction.isChatInputCommand()) return;
 const { commandName, user } = interaction;
 const userId = user.id;
 
 try {
 // 잔액 확인
 if (commandName === '잔액') {
 const userRow = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);
 const balance = userRow?.balance || 0;
 await interaction.reply(`💰 현재 잔액: **${balance}원**`);
 }
 // 충전 신청
 else if (commandName === '충전신청') {
 const amount = interaction.options.getInteger('금액');
 if (amount <= 0) return await interaction.reply('❌ 0원 이상의 금액을 입력하세요.');
 
 db.prepare('INSERT INTO charges (user_id, amount, status) VALUES (?, ?, ?)').run(userId, amount, 'pending');
 await interaction.reply(`✅ ${amount}원 충전을 신청했습니다. 관리자의 승인을 기다려주세요.`);
 }
 // 충전 완료 버튼
 else if (commandName === '충전완료') {
 const row = new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId('charge_complete').setLabel('입금 완료').setStyle(ButtonStyle.Success)
 );
 await interaction.reply({ content: '입금을 완료하셨으면 아래 버튼을 클릭하세요.', components: [row] });
 }
 // 충전 승인
 else if (commandName === '충전승인') {
 const targetUser = interaction.options.getUser('사용자');
 const amount = interaction.options.getInteger('금액');
 
 db.prepare('INSERT INTO users (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?')
 .run(targetUser.id, amount, amount);
 db.prepare('UPDATE charges SET status = ? WHERE user_id = ? AND status = ?').run('approved', targetUser.id, 'pending');
 
 await interaction.reply(`✅ ${targetUser.username}님의 ${amount}원 충전을 승인했습니다.`);
 await targetUser.send(`✅ 관리자가 ${amount}원 충전을 승인했습니다.`).catch(() => {});
 }
 // 충전 거절
 else if (commandName === '충전거절') {
 const targetUser = interaction.options.getUser('사용자');
 db.prepare('UPDATE charges SET status = ? WHERE user_id = ? AND status = ?').run('rejected', targetUser.id, 'pending');
 
 await interaction.reply(`❌ ${targetUser.username}님의 충전을 거절했습니다.`);
 await targetUser.send(`❌ 관리자가 충전을 거절했습니다.`).catch(() => {});
 }
 // 상품 추가
 else if (commandName === '상품추가') {
 const name = interaction.options.getString('이름');
 const price = interaction.options.getInteger('가격');
 const stock = interaction.options.getInteger('재고');
 
 if (price <= 0 || stock < 0) return await interaction.reply('❌ 올바른 값을 입력하세요.');
 
 db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)').run(name, price, stock);
 await interaction.reply(`✅ 상품 "${name}"을(를) 추가했습니다. (가격: ${price}원, 재고: ${stock}개)`);
 }
 // 상품 삭제
 else if (commandName === '상품삭제') {
 const productId = interaction.options.getInteger('상품id');
 const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId);
 
 if (!product) return await interaction.reply('❌ 해당 상품을 찾을 수 없습니다.');
 
 db.prepare('DELETE FROM products WHERE id = ?').run(productId);
 await interaction.reply(`✅ 상품 "${product.name}"을(를) 삭제했습니다.`);
 }
 // 재고 추가
 else if (commandName === '재고추가') {
 const productId = interaction.options.getInteger('상품id');
 const quantity = interaction.options.getInteger('수량');
 
 const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId);
 if (!product) return await interaction.reply('❌ 해당 상품을 찾을 수 없습니다.');
 
 db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, productId);
 await interaction.reply(`✅ "${product.name}"의 재고를 ${quantity}개 추가했습니다.`);
 }
 // 재고 확인
 else if (commandName === '재고확인') {
 const productId = interaction.options.getInteger('상품id');
 const product = db.prepare('SELECT name, stock FROM products WHERE id = ?').get(productId);
 
 if (!product) return await interaction.reply('❌ 해당 상품을 찾을 수 없습니다.');
 
 const status = product.stock > 0 ? '✅ 재고 있음' : '❌ 품절';
 await interaction.reply(`📦 ${product.name}: ${product.stock}개 (${status})`);
 }
 // 상품 목록
 else if (commandName === '상품목록') {
 const products = db.prepare('SELECT id, name, price, stock FROM products').all();
 
 if (products.length === 0) return await interaction.reply('❌ 등록된 상품이 없습니다.');
 
 const embed = new EmbedBuilder()
 .setTitle('📦 상품 목록')
 .setColor(0x00ff00)
 .addFields(products.map(p => ({
 name: `${p.id}. ${p.name}`,
 value: `가격: ${p.price}원 | 재고: ${p.stock}개`,
 inline: false
 })));
 
 await interaction.reply({ embeds: [embed] });
 }
 // 구매
 else if (commandName === '구매') {
 const productId = interaction.options.getInteger('상품id');
 const product = db.prepare('SELECT name, price, stock FROM products WHERE id = ?').get(productId);
 
 if (!product) return await interaction.reply('❌ 해당 상품을 찾을 수 없습니다.');
 if (product.stock <= 0) return await interaction.reply('❌ 품절된 상품입니다.');
 
 const userRow = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);
 const balance = userRow?.balance || 0;
 
 if (balance < product.price) return await interaction.reply(`❌ 잔액이 부족합니다. (필요: ${product.price}원, 보유: ${balance}원)`);
 
 db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ?').run(product.price, userId);
 db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(productId);
 db.prepare('INSERT INTO purchases (user_id, product_id, amount) VALUES (?, ?, ?)').run(userId, productId, product.price);
 
 await interaction.reply(`✅ 구매 완료! 상품: ${product.name}, 가격: ${product.price}원`);
 await user.send(`✅ 구매 완료! 상품: ${product.name}, 가격: ${product.price}원`).catch(() => {});
 
 if (product.stock - 1 === 0) {
 const channel = interaction.guild?.systemChannel;
 if (channel) await channel.send(`⚠️ 상품 "${product.name}"이(가) 품절되었습니다.`);
 }
 }
 // 랜덤 지급
 else if (commandName === '랜덤지급') {
 const targetUser = interaction.options.getUser('사용자');
 const productId = interaction.options.getInteger('상품id');
 const quantity = interaction.options.getInteger('수량');
 
 const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId);
 if (!product) return await interaction.reply('❌ 해당 상품을 찾을 수 없습니다.');
 
 db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, productId);
 await interaction.reply(`✅ ${targetUser.username}님에게 "${product.name}" ${quantity}개를 지급했습니다.`);
 await targetUser.send(`🎁 관리자가 "${product.name}" ${quantity}개를 지급했습니다.`).catch(() => {});
 }
 // 구매 로그
 else if (commandName === '구매로그') {
 const purchases = db.prepare('SELECT user_id, product_id, amount, created_at FROM purchases ORDER BY created_at DESC LIMIT 10').all();
 
 if (purchases.length === 0) return await interaction.reply('❌ 구매 로그가 없습니다.');
 
 const embed = new EmbedBuilder()
 .setTitle('📋 구매 로그')
 .setColor(0x0099ff)
 .addFields(purchases.map((p, i) => ({
 name: `${i + 1}. <@${p.user_id}>`,
 value: `상품 ID: ${p.product_id} | 금액: ${p.amount}원 | 시간: ${p.created_at}`,
 inline: false
 })));
 
 await interaction.reply({ embeds: [embed] });
 }
 // 충전 로그
 else if (commandName === '충전로그') {
 const charges = db.prepare('SELECT user_id, amount, status, created_at FROM charges ORDER BY created_at DESC LIMIT 10').all();
 
 if (charges.length === 0) return await interaction.reply('❌ 충전 로그가 없습니다.');
 
 const embed = new EmbedBuilder()
 .setTitle('💳 충전 로그')
 .setColor(0xff9900)
 .addFields(charges.map((c, i) => ({
 name: `${i + 1}. <@${c.user_id}>`,
 value: `금액: ${c.amount}원 | 상태: ${c.status} | 시간: ${c.created_at}`,
 inline: false
 })));
 
 await interaction.reply({ embeds: [embed] });
 }
 // 구매 내역
 else if (commandName === '구매내역') {
 const purchases = db.prepare('SELECT product_id, amount, created_at FROM purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(userId);
 
 if (purchases.length === 0) return await interaction.reply('❌ 구매 내역이 없습니다.');
 
 const embed = new EmbedBuilder()
 .setTitle('📦 내 구매 내역')
 .setColor(0x00ff00)
 .addFields(purchases.map((p, i) => ({
 name: `${i + 1}. 상품 ID: ${p.product_id}`,
 value: `금액: ${p.amount}원 | 시간: ${p.created_at}`,
 inline: false
 })));
 
 await interaction.reply({ embeds: [embed] });
 }
 } catch (error) {
 console.error('명령어 처리 오류:', error);
 await interaction.reply('❌ 오류가 발생했습니다.').catch(() => {});
 }
});

// 버튼 상호작용
client.on('interactionCreate', async (interaction) => {
 if (!interaction.isButton()) return;
 if (interaction.customId === 'charge_complete') {
 await interaction.reply('✅ 입금 완료 신청이 접수되었습니다. 관리자의 승인을 기다려주세요.');
 }
});

initDb();
client.login(process.env.DISCORD_TOKEN);
