const { REST, Routes } = require('discord.js');

function createReadyHandler({ client, commands, levelsSystem, config, voiceRoomsSystem, memberCounterSystem }) {
    return async function handleReady() {
        console.log('Bot is running');
        console.log(`done : ${client.user.tag}`);

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

        try {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log('Slash commands registered.');
        } catch (error) {
            console.error('Error registering slash commands:', error);
        }

        await levelsSystem.initializeVoiceSessions();
        await voiceRoomsSystem.initialize();

        for (const guild of client.guilds.cache.values()) {
            await memberCounterSystem.updateCounter(guild);
        }

        setInterval(() => {
            levelsSystem.processVoiceXpTick().catch(error => console.error('Voice XP tick error:', error));
        }, config.levels.voiceTickMs);
    };
}

module.exports = {
    createReadyHandler
};
