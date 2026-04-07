const path = require('path');
const { GatewayIntentBits, Partials } = require('discord.js');

const allowedRoles = [
    '1489300687186690109',
    '1131764627190063125',
    '1488613721298174193',
    '1326161220620914708',
    '1133396109558034442',
    '1133275308473200800',
    '1326162390441791507'
];

const TARGET_CHANNELS = [
    '1131650645464731739',
    '1136105071042642000'
];

const restrictedCommands = new Set([
    'help',
    'rules',
    'send',
    'kick',
    'mute',
    'unmute',
    'ticket',
    'giveaway',
    'ping',
    'serverinfo',
    'userinfo'
]);

module.exports = {
    clientOptions: {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.AutoModerationExecution,
            GatewayIntentBits.AutoModerationConfiguration
        ],
        partials: [Partials.Channel]
    },
    allowedRoles,
    restrictedCommands,
    ids: {
        userRole: '1133275505236381816',
        botRole: '1489306783972589700',
        rulesChannel: '1131646199846420581',
        ticketSupportRole: '1490024972775591976',
        ticketCategory: '1136113581226733579',
        levelUpChannel: '1326010654351691806',
        automodLogChannel: '1489324922982633717',
        welcomeChannel: '1131761343486247054',
        leaderboardTriggerChannel: process.env.LEADERBOARD_TRIGGER_CHANNEL_ID ?? '',
        voiceCreateChannel: process.env.VOICE_CREATE_CHANNEL_ID ?? '',
        voiceCategory: process.env.VOICE_CATEGORY_ID ?? '',
        memberCounterChannel: process.env.MEMBER_COUNTER_CHANNEL_ID ?? ''
    },
    targetChannels: TARGET_CHANNELS,
    paths: {
        levelsFile: path.join(__dirname, '..', 'levels.json'),
        ticketsFile: path.join(__dirname, '..', 'tickets.json'),
        voiceRoomsFile: path.join(__dirname, '..', 'voiceRooms.json'),
        images: {
            rules: './images/rules.gif',
            ticket: './images/ticket.gif',
            ticketsPanel: './images/tickets.gif',
            welcome: './images/welcome.png',
            automodRecord: './images/record.gif'
        }
    },
    levels: {
        textCooldownMs: 10 * 1000,
        textXpMin: 5,
        textXpMax: 5,
        textMinChars: 3,
        voiceXpPerMinute: 3,
        voiceTickMs: 10 * 1000,
        voiceIntervalMs: 60 * 1000
    },
    levelRewards: {
        text: [
            { level: 5, roleId: '1491031454916804678' },
            { level: 15, roleId: '1491031701193883679' },
            { level: 35, roleId: '1491031766163525803' },
            { level: 55, roleId: '1491032009366044952' }
        ],
        voice: [
            { level: 5, roleId: '1491032110918664234' },
            { level: 15, roleId: '1491032156405764207' },
            { level: 35, roleId: '1491032192430641333' },
            { level: 55, roleId: '1491032230166921417' }
        ]
    },
    automod: {
        warningLimit: 3,
        duplicateWindowMs: 750
    },
    memberCounter: {
        prefix: process.env.MEMBER_COUNTER_PREFIX ?? '🔒 🐪 | Members: '
    },
    afkVoice: {
        name: '🎿〢AFK',
        userLimit: 5
    },
    salamChannels: ['1136105071042642000', '1131650645464731739', '1490340993302528120']
};
