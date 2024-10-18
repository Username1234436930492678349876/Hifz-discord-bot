const express = require("express");
const app = express();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require("fs");

// Initialize the client with intents
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

// Surah Data: Number of verses in each Surah
const surahData = [
    { name: "Al-Fatiha", verses: 7 },
    { name: "Al-Baqarah", verses: 286 },
    { name: "Aali Imran", verses: 200 },
    { name: "An-Nisa", verses: 176 },
    { name: "Al-Ma'idah", verses: 120},
];

// Total verses in Qur'an and verses per Juzz
const totalVersesInQuran = surahData.reduce((sum, surah) => sum + surah.verses, 0);
const versesPerJuzz = 604;

// Load progress data from a JSON file
let progress = {};
if (fs.existsSync("progress.json")) {
    progress = JSON.parse(fs.readFileSync("progress.json"));
}

// Save progress data to a JSON file
function saveProgress() {
    fs.writeFileSync("progress.json", JSON.stringify(progress, null, 2));
}

// Helper function to get a random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Helper function to get Surah name from chapter number
function getSurah(chapter) {
    return surahData[chapter - 1]?.name || "Unknown Surah";
}

// Helper function to calculate completed Juzz
function calculateJuzz(completedVerses) {
    return (completedVerses / versesPerJuzz).toFixed(2);
}

// Helper function to calculate percentage completed
function calculatePercentage(completedVerses) {
    return ((completedVerses / totalVersesInQuran) * 100).toFixed(2);
}

// Track reminders in memory
let reminderIntervals = {};

// Function to set reminder
function setReminder(userId, interval) {
    if (reminderIntervals[userId]) clearInterval(reminderIntervals[userId]);
    reminderIntervals[userId] = setInterval(() => {
        client.users.cache.get(userId)?.send("Time to continue memorizing your Qur'an!");
    }, interval);
}

// Command handlers
client.on("interactionCreate", async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, user, options } = interaction;

    // Handle /complete command
    if (commandName === 'complete') {
        const chapter = options.getInteger('chapter');
        const verse = options.getInteger('verse');

        if (!progress[user.id]) progress[user.id] = { completed: [] };
        progress[user.id].completed.push(`${chapter}:${verse}`);
        saveProgress();

        await interaction.reply({ 
            embeds: [
                new EmbedBuilder()
                    .setColor(getRandomColor())
                    .setDescription(`You have marked Surah ${getSurah(chapter)} as completed at verse ${verse}.`)
            ] 
        });
    }

    // Handle /memorized command
    if (commandName === 'memorized') {
        const startChapter = options.getInteger('start_chapter');
        const endChapter = options.getInteger('end_chapter');

        if (!progress[user.id]) progress[user.id] = { completed: [] };

        for (let i = startChapter; i <= endChapter; i++) {
            for (let v = 1; v <= surahData[i - 1].verses; v++) {
                progress[user.id].completed.push(`${i}:${v}`);
            }
        }

        saveProgress();
        await interaction.reply({ 
            embeds: [
                new EmbedBuilder()
                    .setColor(getRandomColor())
                    .setDescription(`You have marked Surahs ${getSurah(startChapter)} to ${getSurah(endChapter)} as memorized.`)
            ] 
        });
    }

    // Handle /progress command
    if (commandName === 'progress') {
        const completedVerses = progress[user.id]?.completed.length || 0;
        const juzzCompleted = calculateJuzz(completedVerses);
        const percentage = calculatePercentage(completedVerses);

        await interaction.reply({ 
            embeds: [
                new EmbedBuilder()
                    .setColor(getRandomColor())
                    .setTitle("Your Progress")
                    .setDescription(`You have completed approximately ${juzzCompleted} Juzz (${percentage}% of the Qur'an).`)
            ] 
        });
    }

    // Handle /hifzcalc command
    if (commandName === 'hifzcalc') {
        const timeForJuzz = options.getInteger('time_for_juzz');
        const remainingJuzz = 30 - calculateJuzz(progress[user.id]?.completed.length || 0);
        const totalTimeNeeded = (remainingJuzz * timeForJuzz).toFixed(2);

        await interaction.reply({ 
            embeds: [
                new EmbedBuilder()
                    .setColor(getRandomColor())
                    .setDescription(`You have approximately ${remainingJuzz} Juzz remaining. Based on your time, you will need approximately ${totalTimeNeeded} units of time to finish.`)
            ] 
        });
    }

    // Handle /remind command
    if (commandName === 'remind') {
        const timeValue = options.getInteger('time');
        const timeUnit = options.getString('unit');

        let interval;
        if (timeUnit === 'minutes') {
            interval = timeValue * 60 * 1000; // Convert to milliseconds
        } else if (timeUnit === 'hours') {
            interval = timeValue * 60 * 60 * 1000; // Convert to milliseconds
        } else {
            await interaction.reply("Invalid time unit. Please use 'minutes' or 'hours'.");
            return;
        }

        setReminder(user.id, interval);
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(getRandomColor())
                    .setDescription(`You will be reminded every ${timeValue} ${timeUnit} to continue your Hifz in your DMs.`)
            ]
        });
    }

    // Handle /help command
    if (commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(getRandomColor())
            .setTitle("Available Commands")
            .setDescription("Here are the available commands:")
            .addFields(
                { name: "/complete", value: "Mark a verse as completed. **Usage:** `/complete chapter: [number] verse: [number]`" },
                { name: "/memorized", value: "Mark Surahs as memorized. **Usage:** `/memorized start_chapter: [number] end_chapter: [number]`" },
                { name: "/progress", value: "Shows memorization progress based on Juzz and percentage." },
                { name: "/hifzcalc", value: "Calculate how much time you need to memorize the remaining Qur'an. **Usage:** `/hifzcalc time_for_juzz: [number]`" },
                { name: "/remind", value: "Set reminders to memorize. **Usage:** `/remind time: [number] unit: [minutes/hours]`" }
            );

        await interaction.reply({ embeds: [helpEmbed] });
    }
});

// BotDM Command (Send DM to a mentioned user)
client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!botdm')) return; // Only handle !botdm command

    const args = message.content.slice(7).trim().split(/ +/g);
    const userMention = message.mentions.users.first();
    const text = args.slice(1).join(' ');

    if (!userMention) {
        return message.reply('Please mention a valid user.');
    }

    if (!text) {
        return message.reply('Please provide a message to send.');
    }

    // DM the mentioned user
    userMention.send(text)
        .then(() => message.channel.send('Message sent successfully.'))
        .catch(() => message.channel.send('Failed to send the message.'));
});

// Command Registration (Slash commands)
client.on('ready', async () => {
    const guild = client.guilds.cache.get('816700950323527680'); // Replace with your actual guild ID
    await guild.commands.set([
        new SlashCommandBuilder()
            .setName('complete')
            .setDescription('Mark a verse as completed.')
            .addIntegerOption(option => option.setName('chapter').setDescription('Chapter number').setRequired(true))
            .addIntegerOption(option => option.setName('verse').setDescription('Verse number').setRequired(true)),

        new SlashCommandBuilder()
            .setName('memorized')
            .setDescription('Mark Surahs as memorized from start to end chapter.')
            .addIntegerOption(option => option.setName('start_chapter').setDescription('Start chapter number').setRequired(true))
            .addIntegerOption(option => option.setName('end_chapter').setDescription('End chapter number').setRequired(true)),

        new SlashCommandBuilder()
            .setName('progress')
            .setDescription('Shows memorization progress based on Juzz and percentage of Qur\'an.'),

        new SlashCommandBuilder()
            .setName('hifzcalc')
            .setDescription('Calculate how much time you need to memorize the remaining Qur\'an.')
            .addIntegerOption(option => option.setName('time_for_juzz').setDescription('Time it took you to memorize 1 Juzz').setRequired(true)),

        new SlashCommandBuilder()
            .setName('remind')
            .setDescription('Set reminders to memorize.')
            .addIntegerOption(option => option.setName('time').setDescription('How much time between reminders').setRequired(true))
            .addStringOption(option => option.setName('unit').setDescription('Unit of time (minutes/hours)').setRequired(true)),

        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Get a list of available commands.')
    ]);

    console.log(`${client.user.tag} is online!`);
});

client.login(process.env.token);
