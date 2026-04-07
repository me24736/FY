const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');

function createInteractionHandler({ client, config, commands, discordUtils, levelsSystem, ticketsSystem, voiceRoomsSystem }) {
    return async function handleInteractionCreate(interaction) {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_select') {
                await ticketsSystem.handleTicketSelect(interaction);
            }
            return;
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('ticket_modal:')) {
                await ticketsSystem.handleTicketModal(interaction);
                return;
            }

            if (interaction.customId.startsWith('voice_modal:')) {
                await voiceRoomsSystem.handleModal(interaction);
                return;
            }
            return;
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('voice_')) {
                await voiceRoomsSystem.handleButton(interaction);
                return;
            }

            if (interaction.customId === 'close_ticket') {
                await ticketsSystem.handleCloseTicket(interaction);
            }

            if (interaction.customId === 'confirm_close') {
                await ticketsSystem.handleConfirmClose(interaction);
            }

            if (interaction.customId === 'cancel_close') {
                await ticketsSystem.handleCancelClose(interaction);
            }

            return;
        }

        if (!interaction.isChatInputCommand()) return;

        if (config.restrictedCommands.has(interaction.commandName) && !discordUtils.hasAllowedRole(interaction.member)) {
            await interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (interaction.commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('📋 Available Commands')
                .setColor('#464654')
                .addFields(
                    { name: '/help', value: 'Show all available commands' },
                    { name: '/ping', value: 'Check if the bot is alive and measure latency' },
                    { name: '/serverinfo', value: 'Show information about the current server' },
                    { name: '/userinfo', value: 'Show information about a user' },
                    { name: '/send', value: 'Send a message as the bot' },
                    { name: '/kick', value: 'Kick a member from the server' },
                    { name: '/mute', value: 'Mute a member in the server' },
                    { name: '/unmute', value: 'Unmute a member in the server' },
                    { name: '/rules', value: 'Show the server rules' },
                    { name: '/ticket', value: 'Send the ticket message' },
                    { name: '/giveaway', value: 'Create a giveaway' }
                );
            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (interaction.commandName === 'rules') {
            const file = new AttachmentBuilder(config.paths.images.rules);
            const embed = new EmbedBuilder()
                .setTitle('📜 قوانين السيرفر • Server Rules')
                .setColor('#464654')
                .setDescription(`**1.**
🇸🇦 لازم تحترم كل الأعضاء، وممنوع الإهانات أو التنمر.
🇬🇧 Respect all members. No insults or bullying.

**2.**
🇸🇦 ممنوع نشر أي محتوى غير لائق أو +18.
🇬🇧 No inappropriate or NSFW content allowed.

**3.**
🇸🇦 يمنع السبام أو تكرار الرسائل.
🇬🇧 No spamming or repeated messages.

**4.**
🇸🇦 الالتزام بقوانين Discord الرسمية.
🇬🇧 Follow official Discord guidelines.

**5.**
🇸🇦 استخدم كل قناة في الغرض المخصص لها.
🇬🇧 Use each channel for its intended purpose.

**6.**
🇸🇦 ممنوع نشر روابط ضارة أو مشبوهة.
🇬🇧 Do not share harmful or suspicious links.

**7.**
🇸🇦 لا تشارك معلوماتك الشخصية أو معلومات الآخرين.
🇬🇧 Do not share personal information.

**8.**
🇸🇦 احترام الإدارة وقراراتها واجب.
🇬🇧 Respect the staff and their decisions.

**9.**
🇸🇦 ممنوع إثارة المشاكل أو الفتن داخل السيرفر.
🇬🇧 Do not start drama or conflicts.

**10.**
🇸🇦 تجنب النقاشات السياسية أو الدينية الحادة.
🇬🇧 Avoid heated political or religious debates.

**11.**
🇸🇦 لا تنتحل شخصية أي شخص أو إدارة.
🇬🇧 Do not impersonate anyone or staff.

**12.**
🇸🇦 ممنوع الإعلانات بدون إذن الإدارة.
🇬🇧 No advertising without permission.

**13.**
🇸🇦 التزم بالألفاظ اللائقة داخل الشات.
🇬🇧 Use appropriate language in chat.

**14.**
🇸🇦 في حال وجود مشكلة، تواصل مع الإدارة.
🇬🇧 Contact staff if you face any issue.

**15.**
🇸🇦 مخالفة القوانين تعرضك للتحذير أو الكتم أو الحظر.
🇬🇧 Breaking rules may result in warning, mute, or ban.`)
                .setImage('attachment://rules.gif')
                .setFooter({ text: '𝑭 / 𝒀.' });

            await interaction.reply({ embeds: [embed], files: [file] });
            return;
        }

        if (interaction.commandName === 'ping') {
            const latency = Date.now() - interaction.createdTimestamp;
            await interaction.reply(`🏓 Pong! Latency: **${latency}ms** | API: **${client.ws.ping}ms**`);
            return;
        }

        if (interaction.commandName === 'serverinfo') {
            const guild = interaction.guild;
            const embed = new EmbedBuilder()
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL())
                .setColor(0x5865F2)
                .addFields(
                    { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true }
                );
            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (interaction.commandName === 'userinfo') {
            const target = interaction.options.getUser('user') || interaction.user;
            const member = interaction.guild.members.cache.get(target.id);
            const embed = new EmbedBuilder()
                .setTitle(target.username)
                .setThumbnail(target.displayAvatarURL())
                .setColor(0x5865F2)
                .addFields(
                    { name: '🆔 ID', value: target.id, inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
                    { name: '📥 Joined Server', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'N/A', inline: true }
                );
            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (interaction.commandName === 'send') {
            const message = interaction.options.getString('message');
            await interaction.reply({ content: 'Sent ✓', flags: MessageFlags.Ephemeral });
            await interaction.channel.send(message);
            return;
        }

        if (interaction.commandName === 'kick') {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = interaction.guild.members.cache.get(target.id);

            if (!member) {
                await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (!member.kickable) {
                await interaction.reply({ content: 'I cannot kick this user. They may have a higher role than me.', flags: MessageFlags.Ephemeral });
                return;
            }

            await member.kick(reason);
            await interaction.reply({ content: `**${target.username}** has been kicked. Reason: ${reason}` });
            return;
        }

        if (interaction.commandName === 'mute') {
            const target = interaction.options.getUser('user');
            const duration = interaction.options.getInteger('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = interaction.guild.members.cache.get(target.id);

            if (!member) {
                await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (!member.moderatable) {
                await interaction.reply({ content: 'I cannot mute this user. They may have a higher role than me.', flags: MessageFlags.Ephemeral });
                return;
            }

            await member.timeout(duration * 60 * 1000, reason);
            await interaction.reply({ content: `**${target.username}** has been muted for ${duration} minute(s). Reason: ${reason}` });
            return;
        }

        if (interaction.commandName === 'unmute') {
            const target = interaction.options.getUser('user');
            const member = interaction.guild.members.cache.get(target.id);

            if (!member) {
                await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
                return;
            }

            await member.timeout(null);
            await interaction.reply({ content: `**${target.username}** has been unmuted.` });
            return;
        }

        if (interaction.commandName === 'ticket') {
            await ticketsSystem.sendTicketPanel(interaction);
            return;
        }

        if (interaction.commandName === 'giveaway') {
            const prize = interaction.options.getString('prize');
            const duration = interaction.options.getInteger('duration');
            const endTime = Math.floor(Date.now() / 1000) + duration;
            const participants = new Set();

            const embed = new EmbedBuilder()
                .setTitle(' 🎀 The Giveaway 🎈                         ')
                .setColor('#464654')
                .setDescription(`**Prize:** ${prize}\n\n **To participate, click the button below**`)
                .addFields(
                    {
                        name: '⏳ Ends',
                        value: `<t:${endTime}:R>`,
                        inline: true
                    },
                    {
                        name: '👑 Hosted by',
                        value: `<@${interaction.user.id}>`,
                        inline: true
                    }
                )
                .setFooter({ text: 'Number of participants: 0' });

            const button = new ButtonBuilder()
                .setCustomId('join_giveaway')
                .setLabel('Join')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);
            const message = await interaction.reply({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            const collector = message.createMessageComponentCollector({
                time: duration * 1000
            });

            collector.on('collect', async componentInteraction => {
                if (componentInteraction.customId !== 'join_giveaway') return;

                if (participants.has(componentInteraction.user.id)) {
                    await componentInteraction.reply({
                        content: 'أنت مشارك بالفعل!',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                participants.add(componentInteraction.user.id);

                embed.setFooter({
                    text: `Number of participants: ${participants.size}`
                });

                await message.edit({ embeds: [embed] });
                await componentInteraction.reply({
                    content: 'تم تسجيلك في القيف أواي',
                    flags: MessageFlags.Ephemeral
                });
            });

            collector.on('end', async () => {
                const winner = participants.size > 0
                    ? [...participants][Math.floor(Math.random() * participants.size)]
                    : null;

                embed.setTitle(' 🎀 The Giveaway 🎈                         ');
                embed.setDescription(
                    winner
                        ? `winner: <@${winner}>\nPrize: **${prize}**`
                        : 'No participants, no winner!'
                );

                if (embed.data.fields && embed.data.fields.length > 0) {
                    embed.spliceFields(0, embed.data.fields.length);
                }

                embed.addFields(
                    {
                        name: '👑 Hosted by',
                        value: `<@${interaction.user.id}>`,
                        inline: true
                    },
                    {
                        name: '⏱ Ended',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: true
                    }
                );

                embed.setColor('#464654');
                await message.edit({
                    embeds: [embed],
                    components: []
                });
            });
        }
    };
}

module.exports = {
    createInteractionHandler
};
