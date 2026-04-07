function createGuildMemberAddHandler({ config, memberCounterSystem }) {
    return async function handleGuildMemberAdd(member) {
        const channel = member.guild.channels.cache.get(config.ids.welcomeChannel);

        if (channel) {
            const rulesChannel = member.guild.channels.cache.get(config.ids.rulesChannel);
            const rulesChannelText = rulesChannel ? `${rulesChannel}` : 'روم القوانين';

            const message = `
منور/ه يا ${member}

أهلا بك في سيرفر **${member.guild.name}**

لا تنس أن تذهب إلى ${rulesChannelText} لقراءة القوانين
وبعدها يمكنك بدء التفاعل
    `;

            channel.send(message);
            channel.send({ files: [config.paths.images.welcome] });
        }

        try {
            if (member.user.bot) {
                await member.roles.add(config.ids.botRole);
            } else {
                await member.roles.add(config.ids.userRole);
            }
        } catch (error) {
            console.log(error);
        }

        await memberCounterSystem.updateCounter(member.guild);
    };
}

module.exports = {
    createGuildMemberAddHandler
};
