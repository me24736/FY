const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionsBitField,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

function createTicketsSystem({ client, config, ticketStore, levelsSystem }) {
    function getTicketSupportRoleIds(channel) {
        if (!channel?.permissionOverwrites?.cache) {
            return [config.ids.ticketSupportRole];
        }

        const roleIds = channel.permissionOverwrites.cache
            .filter(overwrite =>
                overwrite.type === 0
                && overwrite.id !== channel.guild.id
                && overwrite.id !== client.user.id
                && overwrite.allow.has(PermissionsBitField.Flags.ViewChannel)
            )
            .map(overwrite => overwrite.id);

        return roleIds.length ? roleIds : [config.ids.ticketSupportRole];
    }

    async function interactionHasSupportRole(interaction) {
        const allowedRoleIds = getTicketSupportRoleIds(interaction.channel);
        const interactionMember = interaction.member;

        if (interactionMember?.roles?.cache) {
            return allowedRoleIds.some(roleId => interactionMember.roles.cache.has(roleId));
        }

        if (Array.isArray(interactionMember?.roles)) {
            return allowedRoleIds.some(roleId => interactionMember.roles.includes(roleId));
        }

        const fetchedMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        return allowedRoleIds.some(roleId => fetchedMember?.roles?.cache?.has(roleId));
    }

    function buildTicketSelectRow() {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('اختر نوع التكت...')
            .addOptions([
                { label: 'فتح تكت', description: 'للمشاكل العامة والاستفسارات', value: 'فتح تكت', emoji: '🪻' },
                { label: 'اعتراض', description: 'للاعتراض عن حكم', value: 'اعتراض', emoji: '🎮' },
                { label: 'طلب ترقيه', description: 'لطلب الترقية في السيرفر', value: 'طلب ترقيه', emoji: '🛹' }
            ]);

        return new ActionRowBuilder().addComponents(selectMenu);
    }

    function getTicketOwnerIdFromChannel(channel) {
        if (!channel?.id) return null;

        const mappedOwnerId = ticketStore.getOwnerId(channel.id);
        if (mappedOwnerId) {
            return mappedOwnerId;
        }

        const topic = channel.topic ?? '';
        const match = topic.match(/^ticket-owner:(\d+)$/);

        if (match?.[1]) {
            ticketStore.setOwner(channel.id, match[1]);
            return match[1];
        }

        return null;
    }

    function getExistingTicketChannelForUser(guild, userId) {
        for (const [channelId, ownerId] of ticketStore.entries()) {
            if (ownerId !== userId) continue;

            const channel = guild.channels.cache.get(channelId);
            if (channel) {
                return channel;
            }

            ticketStore.removeOwner(channelId);
        }

        const legacyChannel = guild.channels.cache.find(channel => {
            const topic = channel.topic ?? '';
            return topic === `ticket-owner:${userId}`;
        }) ?? null;

        if (legacyChannel) {
            ticketStore.setOwner(legacyChannel.id, userId);
        }

        return legacyChannel;
    }

    async function createTicketChannelWithDetails(interaction, ticketType, issueDetails) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const safeUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9-_]/gi, '').slice(0, 20) || interaction.user.id;
        const channelName = `ticket-${safeUsername}`;
        const existingChannel = getExistingTicketChannelForUser(interaction.guild, interaction.user.id);
        const ticketCategory = interaction.guild.channels.cache.get(config.ids.ticketCategory)
            ?? await interaction.guild.channels.fetch(config.ids.ticketCategory).catch(() => null);

        if (existingChannel) {
            await interaction.editReply({ content: `لديك تكت مفتوح بالفعل: ${existingChannel}` });
            return;
        }

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: 0,
            parent: ticketCategory?.id ?? null,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: config.ids.ticketSupportRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });
        ticketStore.setOwner(ticketChannel.id, interaction.user.id);

        const ticketGif = new AttachmentBuilder(config.paths.images.ticket);
        const embed = new EmbedBuilder()
            .setTitle('تم فتح التكت')
            .setDescription(`أهلًا ${interaction.user}، تم استلام طلبك بنجاح.\nيرجى انتظار فريق الدعم، وسيتم متابعة التكت في أقرب وقت ممكن.`)
            .addFields(
                { name: 'نوع التكت', value: ticketType, inline: false },
                { name: 'تفاصيل الطلب', value: issueDetails, inline: false }
            )
            .setColor('#464654')
            .setImage('attachment://ticket.gif');

        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const row = new ActionRowBuilder().addComponents(closeButton);

        await ticketChannel.send({
            content: `${interaction.user} <@&${config.ids.ticketSupportRole}>`,
            embeds: [embed],
            files: [ticketGif],
            components: [row]
        });

        await interaction.editReply({ content: `تم فتح تكتك: ${ticketChannel}` });
    }

    function createTicketModal(ticketType) {
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal:${ticketType}`)
            .setTitle('فتح تكت جديد');

        const issueInput = new TextInputBuilder()
            .setCustomId('ticket_issue')
            .setLabel('ما هي مشكلتك؟')
            .setPlaceholder('اكتب مشكلتك بالتفاصيل هنا. إذا كان لديك برهان أو لقطات، أرسلها بعد فتح التكت.')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(issueInput));
        return modal;
    }

    async function handleTicketSelect(interaction) {
        const ticketType = interaction.values[0];

        await interaction.message.edit({
            components: [buildTicketSelectRow()]
        }).catch(() => null);

        await interaction.showModal(createTicketModal(ticketType));
    }

    async function handleTicketModal(interaction) {
        const ticketType = interaction.customId.split(':')[1];
        const issueDetails = interaction.fields.getTextInputValue('ticket_issue');
        await createTicketChannelWithDetails(interaction, ticketType, issueDetails);
    }

    async function handleCloseTicket(interaction) {
        const hasSupportRole = await interactionHasSupportRole(interaction);

        if (!hasSupportRole) {
            await interaction.reply({
                content: 'You do not have permission to close this ticket.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply();

        const confirmEmbed = new EmbedBuilder()
            .setTitle('Confirm Ticket Closure')
            .setDescription('Are you sure you want to close this ticket? It will be deleted permanently.')
            .setColor('#464654');

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_close')
            .setLabel('Yes, Close Ticket')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_close')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        await interaction.followUp({
            embeds: [confirmEmbed],
            components: [new ActionRowBuilder().addComponents(confirmButton, cancelButton)],
            flags: MessageFlags.Ephemeral
        });
    }

    async function handleConfirmClose(interaction) {
        await interaction.deferUpdate();

        try {
            ticketStore.removeOwner(interaction.channel.id);
            await interaction.channel.delete();
        } catch (error) {
            console.error('Error deleting channel:', error);
            await interaction.followUp({
                content: 'An error occurred while closing the ticket.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async function handleCancelClose(interaction) {
        await interaction.update({ content: 'Cancelled ticket closure.', embeds: [], components: [] });
    }

    async function sendTicketPanel(interaction) {
        await interaction.deferReply();

        const ticketGif = new AttachmentBuilder(config.paths.images.ticketsPanel);
        const embed = new EmbedBuilder()
            .setTitle('  🎫 دعم السيرفر • Server Support')
            .setDescription('لطلب الدعم الخاص الرجاء اختيار نوع التكت من القائمة أدناه:')
            .setColor('#464654')
            .setImage('attachment://tickets.gif');

        await interaction.editReply({
            embeds: [embed],
            components: [buildTicketSelectRow()],
            files: [ticketGif]
        });
    }

    return {
        buildTicketSelectRow,
        getTicketOwnerIdFromChannel,
        handleTicketSelect,
        handleTicketModal,
        handleCloseTicket,
        handleConfirmClose,
        handleCancelClose,
        sendTicketPanel
    };
}

module.exports = {
    createTicketsSystem
};
