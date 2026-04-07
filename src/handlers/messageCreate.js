function createMessageCreateHandler({ config, discordUtils, levelsSystem, leaderboardPresenter, rankPresenter, helpPresenter }) {
    const quickCommandTriggers = new Set(['l', 'r', 'g', 'h']);

    function formatDuration(ms) {
        const totalSeconds = Math.ceil(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (hours <= 0) {
            return `${minutes}m`;
        }

        if (minutes === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${minutes}m`;
    }

    return async function handleMessageCreate(message) {
        if (message.author.bot) return;

        const normalizedContent = message.content.trim().toLowerCase();
        const isQuickCommandsChannel = Boolean(
            message.guild
            && config.ids.leaderboardTriggerChannel
            && message.channel.id === config.ids.leaderboardTriggerChannel
        );

        if (isQuickCommandsChannel && !quickCommandTriggers.has(normalizedContent)) {
            await message.delete().catch(() => null);
            return;
        }

        if (config.salamChannels.includes(message.channel.id) && message.content.includes('Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…')) {
            await discordUtils.safeReply(message, 'ÙˆØ¹Ù„ÙŠÙƒÙ… Ø§Ù„Ø³Ù„Ø§Ù…');
        }

        if (config.salamChannels.includes(message.channel.id) && message.content.includes('Ù‡Ù„Ø§')) {
            await discordUtils.safeReply(message, 'Ù†Ø§Ù‡');
        }

        if (isQuickCommandsChannel && normalizedContent === 'h') {
            await helpPresenter.sendHelp({
                channel: message.channel,
                guild: message.guild,
                requestedBy: message.author
            });
            return;
        }

        if (isQuickCommandsChannel && normalizedContent === 'l') {
            await leaderboardPresenter.sendLeaderboard({
                channel: message.channel,
                requestedBy: message.author
            });
            return;
        }

        if (isQuickCommandsChannel && normalizedContent === 'r') {
            await rankPresenter.sendRank({
                guild: message.guild,
                channel: message.channel,
                user: message.author
            });
            return;
        }

        if (isQuickCommandsChannel && normalizedContent === 'g') {
            const result = await levelsSystem.claimDailyGift(message.member);

            if (result.status === 'claimed') {
                await discordUtils.safeReply(
                    message,
                    `Daily gift claimed: +${result.amount} Text XP. Your text level is now ${result.level}.`
                );
                return;
            }

            if (result.status === 'cooldown') {
                await discordUtils.safeReply(
                    message,
                    `You already claimed your daily gift. Try again in ${formatDuration(result.remainingMs)}.`
                );
                return;
            }
        }

        await levelsSystem.handleMessageXp(message);
    };
}

module.exports = {
    createMessageCreateHandler
};
