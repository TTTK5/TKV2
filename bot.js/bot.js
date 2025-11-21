const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

const TOKEN = '887895ccc0c376c49d88425faead2b36f948194f9e9675446030ef2cba5f5fcd';
const CLIENT_ID = '1428357309708370082';
const GUILD_ID = '1412095240097107971';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

let queue = [];
let player = createAudioPlayer();
let connection;
let isPlaying = false;

// ⚡ ลงทะเบียนคำสั่งภาษาไทย
const commands = [
  new SlashCommandBuilder()
    .setName('เล่น')
    .setDescription('เล่นเพลงจาก YouTube หรือค้นหาชื่อเพลง')
    .addStringOption(option =>
      option.setName('เพลง')
        .setDescription('ชื่อเพลงหรือ URL')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('คิว')
    .setDescription('ดูรายการเพลงที่อยู่ในคิว'),
  new SlashCommandBuilder()
    .setName('ข้าม')
    .setDescription('ข้ามเพลงปัจจุบัน'),
  new SlashCommandBuilder()
    .setName('หยุด')
    .setDescription('หยุดเพลงทั้งหมด')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('⏳ กำลังลงทะเบียนคำสั่ง...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ ลงทะเบียนคำสั่งสำเร็จ!');
  } catch (err) {
    console.error(err);
  }
})();

client.once('ready', () => {
  console.log(`🤖 ${client.user.tag} พร้อมใช้งานแล้ว`);
});

// ✨ ฟังก์ชันเล่นเพลง
async function playNext(channel) {
  if (queue.length === 0) {
    isPlaying = false;
    if (connection) connection.destroy();
    return;
  }

  const song = queue.shift();
  isPlaying = true;

  if (!connection) {
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    });
  }

  const stream = ytdl(song.url, { filter: 'audioonly' });
  const resource = createAudioResource(stream);

  player.play(resource);
  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    playNext(channel);
  });
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  // 🎵 คำสั่ง /เล่น
  if (command === 'เล่น') {
    const query = interaction.options.getString('เพลง');
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) return interaction.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน');

    let songInfo;
    if (ytdl.validateURL(query)) {
      songInfo = { title: 'เพลงจากลิงก์', url: query };
    } else {
      const r = await ytSearch(query);
      const video = r.videos.length > 0 ? r.videos[0] : null;
      if (!video) return interaction.reply('❌ ไม่พบเพลง');
      songInfo = { title: video.title, url: video.url };
    }

    queue.push(songInfo);
    interaction.reply(`✅ เพิ่มเพลงลงคิว: ${songInfo.title}`);

    if (!isPlaying) playNext(voiceChannel);
  }

  // 📜 คำสั่ง /คิว
  if (command === 'คิว') {
    if (queue.length === 0) return interaction.reply('📭 ไม่มีเพลงในคิว');
    const list = queue.map((song, i) => `${i + 1}. ${song.title}`).join('\n');
    interaction.reply(`🎶 เพลงในคิว:\n${list}`);
  }

  // ⏭️ คำสั่ง /ข้าม
  if (command === 'ข้าม') {
    if (!isPlaying) return interaction.reply('❌ ไม่มีเพลงกำลังเล่น');
    player.stop();
    interaction.reply('⏭️ ข้ามเพลงเรียบร้อย');
  }

  // ⏹️ คำสั่ง /หยุด
  if (command === 'หยุด') {
    queue = [];
    player.stop();
    if (connection) connection.destroy();
    isPlaying = false;
    interaction.reply('⏹️ หยุดเพลงทั้งหมดแล้ว');
  }
});

client.login(TOKEN);