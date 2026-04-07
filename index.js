require('dotenv').config();

const { Client } = require('discord.js');

const config = require('./src/config');
const { commands } = require('./src/commands');
const { createDiscordUtils } = require('./src/utils/discord');
const { createLevelsStore } = require('./src/storage/levelsStore');
const { createTicketStore } = require('./src/storage/ticketStore');
const { createVoiceRoomStore } = require('./src/storage/voiceRoomStore');
const { createLevelsSystem } = require('./src/systems/levels');
const { createTicketsSystem } = require('./src/systems/tickets');
const { createAutoModSystem } = require('./src/systems/automod');
const { createVoiceRoomsSystem } = require('./src/systems/voiceRooms');
const { createMemberCounterSystem } = require('./src/systems/memberCounter');
const { createReadyHandler } = require('./src/handlers/ready');
const { createGuildMemberAddHandler } = require('./src/handlers/guildMemberAdd');
const { createGuildMemberRemoveHandler } = require('./src/handlers/guildMemberRemove');
const { createInteractionHandler } = require('./src/handlers/interactionCreate');
const { createMessageCreateHandler } = require('./src/handlers/messageCreate');
const { createVoiceStateUpdateHandler } = require('./src/handlers/voiceStateUpdate');
const { createLeaderboardPresenter } = require('./src/utils/leaderboard');
const { createRankPresenter } = require('./src/utils/rank');
const { createHelpPresenter } = require('./src/utils/help');

const client = new Client(config.clientOptions);

const levelsStore = createLevelsStore(config.paths.levelsFile);
const ticketStore = createTicketStore(config.paths.ticketsFile);
const voiceRoomStore = createVoiceRoomStore(config.paths.voiceRoomsFile);
const discordUtils = createDiscordUtils({ allowedRoles: config.allowedRoles });

const levelsSystem = createLevelsSystem({
    client,
    config,
    levelsStore
});

const ticketsSystem = createTicketsSystem({
    client,
    config,
    ticketStore,
    levelsSystem
});

const voiceRoomsSystem = createVoiceRoomsSystem({
    client,
    config,
    voiceRoomStore
});

const memberCounterSystem = createMemberCounterSystem({
    config
});

const leaderboardPresenter = createLeaderboardPresenter({
    client,
    levelsSystem
});

const rankPresenter = createRankPresenter({
    levelsSystem
});

const helpPresenter = createHelpPresenter();

const autoModSystem = createAutoModSystem({
    config,
    discordUtils
});

let isShuttingDown = false;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`Shutting down bot (${signal})...`);

    try {
        await voiceRoomsSystem.cleanupAfkRooms();
    } catch (error) {
        console.error('AFK cleanup during shutdown failed:', error);
    }

    try {
        client.destroy();
    } catch (error) {
        console.error('Discord client shutdown failed:', error);
    }

    process.exit(0);
}

client.once('clientReady', createReadyHandler({
    client,
    commands,
    levelsSystem,
    config,
    voiceRoomsSystem,
    memberCounterSystem
}));

client.on('guildMemberAdd', createGuildMemberAddHandler({
    config,
    memberCounterSystem
}));

client.on('guildMemberRemove', createGuildMemberRemoveHandler({
    memberCounterSystem
}));

client.on('interactionCreate', createInteractionHandler({
    client,
    config,
    commands,
    discordUtils,
    levelsSystem,
    ticketsSystem,
    voiceRoomsSystem
}));

client.on('messageCreate', createMessageCreateHandler({
    config,
    discordUtils,
    levelsSystem,
    leaderboardPresenter,
    rankPresenter,
    helpPresenter
}));

client.on('voiceStateUpdate', createVoiceStateUpdateHandler({
    levelsSystem,
    voiceRoomsSystem
}));

client.on('autoModerationActionExecution', autoModSystem.handleAutoModeration);

client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.once('SIGINT', () => {
    shutdown('SIGINT').catch(error => {
        console.error('Shutdown error:', error);
        process.exit(1);
    });
});

process.once('SIGTERM', () => {
    shutdown('SIGTERM').catch(error => {
        console.error('Shutdown error:', error);
        process.exit(1);
    });
});

client.login(process.env.TOKEN);
