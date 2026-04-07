const { SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check if the bot is alive and measure latency'),
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Show information about the current server'),
    new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Show the server rules'),
    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Show information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get info about')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send a message as the bot')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a member in the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Mute duration in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a member in the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unmute')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Send the ticket message'),
    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Create a giveaway')
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('الجائزة')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('المدة بالثواني')
                .setRequired(true)),
].map(command => command.toJSON());

module.exports = {
    commands
};
