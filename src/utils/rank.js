const { EmbedBuilder } = require('discord.js');

function createRankPresenter({ levelsSystem }) {
    async function buildRankEmbed({ guild, member, user }) {
        const profile = levelsSystem.getMemberProfile(guild.id, user.id);
        const textRequired = levelsSystem.getRequiredXpForNextLevel(profile.textLevel);
        const voiceRequired = levelsSystem.getRequiredXpForNextLevel(profile.voiceLevel);

        return new EmbedBuilder()
            .setColor('#464654')
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL()
            })
            .setTitle('Level Profile')
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                {
                    name: 'Text Level',
                    value: `Level: **${profile.textLevel}**\nXP: **${profile.textXp}/${textRequired}**\n${levelsSystem.getProgressBar(profile.textXp, textRequired)}`,
                    inline: false
                },
                {
                    name: 'Voice Level',
                    value: `Level: **${profile.voiceLevel}**\nXP: **${profile.voiceXp}/${voiceRequired}**\n${levelsSystem.getProgressBar(profile.voiceXp, voiceRequired)}`,
                    inline: false
                },
                {
                    name: 'Member',
                    value: member ? `${member}` : user.username,
                    inline: false
                }
            )
            .setFooter({ text: 'Level System' })
            .setTimestamp();
    }

    async function sendRank({ guild, channel, user }) {
        const member = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
        const embed = await buildRankEmbed({
            guild,
            member,
            user
        });

        return channel.send({ embeds: [embed] });
    }

    return {
        buildRankEmbed,
        sendRank
    };
}

module.exports = {
    createRankPresenter
};
