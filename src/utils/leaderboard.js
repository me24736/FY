const { EmbedBuilder } = require('discord.js');

function createLeaderboardPresenter({ client, levelsSystem }) {
    function sortProfiles(entries, type) {
        const levelKey = type === 'text' ? 'textLevel' : 'voiceLevel';
        const xpKey = type === 'text' ? 'textXp' : 'voiceXp';

        return [...entries].sort(([, a], [, b]) => {
            if (b[levelKey] !== a[levelKey]) {
                return b[levelKey] - a[levelKey];
            }

            return b[xpKey] - a[xpKey];
        });
    }

    async function resolveMemberLabel(guild, userId) {
        const member = guild.members.cache.get(userId)
            ?? await guild.members.fetch(userId).catch(() => null);

        if (member) {
            return member.displayName;
        }

        const user = await client.users.fetch(userId).catch(() => null);
        return user ? user.username : `User ${userId}`;
    }

    function getRankBadge(rank) {
        if (rank === 1) return 'TOP 1';
        if (rank === 2) return 'TOP 2';
        if (rank === 3) return 'TOP 3';
        return `#${rank}`;
    }

    async function formatTopList(guild, sortedProfiles, type, limit = 8) {
        const levelKey = type === 'text' ? 'textLevel' : 'voiceLevel';
        const xpKey = type === 'text' ? 'textXp' : 'voiceXp';
        const topEntries = sortedProfiles.slice(0, limit);

        if (!topEntries.length) {
            return 'No data yet.';
        }

        const lines = await Promise.all(topEntries.map(async ([userId, profile], index) => {
            const label = await resolveMemberLabel(guild, userId);
            return `${getRankBadge(index + 1)} **${label}**\nLv.${profile[levelKey]} | ${profile[xpKey]} XP`;
        }));

        return lines.join('\n\n');
    }

    async function formatMemberStanding(guild, sortedProfiles, userId, type) {
        const levelKey = type === 'text' ? 'textLevel' : 'voiceLevel';
        const xpKey = type === 'text' ? 'textXp' : 'voiceXp';
        const rankIndex = sortedProfiles.findIndex(([memberId]) => memberId === userId);

        if (rankIndex === -1) {
            return 'Unranked';
        }

        const [, profile] = sortedProfiles[rankIndex];
        const label = await resolveMemberLabel(guild, userId);
        return `#${rankIndex + 1} ${label} | Lv.${profile[levelKey]} | ${profile[xpKey]} XP`;
    }

    async function buildLeaderboardEmbed({ guild, requestedBy }) {
        const guildLevels = Object.entries(levelsSystem.getGuildLevels(guild.id));
        const textSorted = sortProfiles(guildLevels, 'text');
        const voiceSorted = sortProfiles(guildLevels, 'voice');

        const [textBoard, voiceBoard, textStanding, voiceStanding] = await Promise.all([
            formatTopList(guild, textSorted, 'text'),
            formatTopList(guild, voiceSorted, 'voice'),
            formatMemberStanding(guild, textSorted, requestedBy.id, 'text'),
            formatMemberStanding(guild, voiceSorted, requestedBy.id, 'voice')
        ]);

        return new EmbedBuilder()
            .setColor('#1f6f78')
            .setAuthor({
                name: `${guild.name} Rankings`,
                iconURL: guild.iconURL() ?? undefined
            })
            .setTitle('Level Arena')
            .setDescription('A fresh snapshot of the community grind.')
            .addFields(
                {
                    name: 'Text XP',
                    value: textBoard,
                    inline: true
                },
                {
                    name: 'Voice XP',
                    value: voiceBoard,
                    inline: true
                },
                {
                    name: 'Your Standing',
                    value: `Text: ${textStanding}\nVoice: ${voiceStanding}`,
                    inline: false
                }
            )
            .setFooter({ text: `Requested by ${requestedBy.username}` })
            .setTimestamp();
    }

    async function sendLeaderboard({ channel, requestedBy }) {
        const embed = await buildLeaderboardEmbed({
            guild: channel.guild,
            requestedBy
        });

        return channel.send({ embeds: [embed] });
    }

    return {
        buildLeaderboardEmbed,
        sendLeaderboard
    };
}

module.exports = {
    createLeaderboardPresenter
};
