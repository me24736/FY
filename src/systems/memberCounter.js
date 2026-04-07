function createMemberCounterSystem({ config }) {
    function formatCompactCount(value) {
        if (value >= 1000000) {
            return `${(value / 1000000).toFixed(2).replace(/\.?0+$/, '')}m`;
        }

        if (value >= 1000) {
            return `${(value / 1000).toFixed(2).replace(/\.?0+$/, '')}k`;
        }

        return `${value}`;
    }

    async function updateCounter(guild) {
        const channelId = config.ids.memberCounterChannel;
        if (!channelId) return;

        const channel = guild.channels.cache.get(channelId)
            ?? await guild.channels.fetch(channelId).catch(() => null);

        if (!channel) {
            console.log('Member counter channel not found:', channelId);
            return;
        }

        const nextName = `${config.memberCounter.prefix}${formatCompactCount(guild.memberCount)}`;
        if (channel.name === nextName) return;

        await channel.setName(nextName).catch(error => {
            console.error('Could not update member counter channel:', error);
        });
    }

    return {
        updateCounter
    };
}

module.exports = {
    createMemberCounterSystem
};
