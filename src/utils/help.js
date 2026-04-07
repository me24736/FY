const { EmbedBuilder } = require('discord.js');

function createHelpPresenter() {
    async function sendHelp({ channel, guild, requestedBy }) {
        const embed = new EmbedBuilder()
            .setColor('#6d5bd0')
            .setAuthor({
                name: 'Available Commands',
                iconURL: guild.iconURL() ?? requestedBy.displayAvatarURL()
            })
            .setTitle('Command Guide')
            .setDescription('استخدم هذه الحروف السريعة داخل هذه الروم.')
            .setThumbnail(requestedBy.displayAvatarURL())
            .addFields(
                {
                    name: '`h` Help',
                    value: 'عرض لوحة الأوامر.',
                    inline: false
                },
                {
                    name: '`r` Rank',
                    value: 'عرض تقدم لفل الكتابة والفويس الحالي.',
                    inline: false
                },
                {
                    name: '`l` Leaderboard',
                    value: 'عرض ترتيب أعلى الأعضاء في الكتابة والفويس داخل السيرفر.',
                    inline: false
                },
                {
                    name: '`g` Daily Gift',
                    value: 'استلام هديتك اليومية من نقاط الكتابة مرة كل 24 ساعة.',
                    inline: false
                }
            )
            .setFooter({ text: `${guild.name} | Requested by ${requestedBy.username}` })
            .setTimestamp();

        return channel.send({ embeds: [embed] });
    }

    return {
        sendHelp
    };
}

module.exports = {
    createHelpPresenter
};
