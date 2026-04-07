const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionsBitField,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

function createVoiceRoomsSystem({ client, config, voiceRoomStore }) {
    const pendingCleanup = new Set();
    const afkMutedMembers = new Set();
    const afkChannelIdsByGuild = new Map();

    function isConfigured() {
        return Boolean(config.ids.voiceCreateChannel);
    }

    function getAfkConfig() {
        return {
            name: config.afkVoice?.name ?? '🎿〢AFK',
            userLimit: config.afkVoice?.userLimit ?? 5
        };
    }

    async function getPreferredVoiceCategory(guild) {
        if (!config.ids.voiceCategory) return null;

        const configuredCategory = guild.channels.cache.get(config.ids.voiceCategory)
            ?? await guild.channels.fetch(config.ids.voiceCategory).catch(() => null);

        return configuredCategory?.type === ChannelType.GuildCategory ? configuredCategory : null;
    }

    async function findAfkChannel(guild) {
        const afkConfig = getAfkConfig();
        const preferredCategory = await getPreferredVoiceCategory(guild);

        return guild.channels.cache.find(channel => channel.type === ChannelType.GuildVoice
            && channel.name === afkConfig.name
            && (!preferredCategory || channel.parentId === preferredCategory.id))
            ?? guild.channels.cache.find(channel => channel.type === ChannelType.GuildVoice && channel.name === afkConfig.name)
            ?? null;
    }

    function buildAfkPermissionOverwrites(guild) {
        const deniedPermissions = [
            PermissionsBitField.Flags.CreateInstantInvite,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.SendMessagesInThreads,
            PermissionsBitField.Flags.SendTTSMessages,
            PermissionsBitField.Flags.CreatePublicThreads,
            PermissionsBitField.Flags.CreatePrivateThreads,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks,
            PermissionsBitField.Flags.AddReactions,
            PermissionsBitField.Flags.UseEmbeddedActivities,
            PermissionsBitField.Flags.UseSoundboard,
            PermissionsBitField.Flags.SendVoiceMessages,
            PermissionsBitField.Flags.Speak,
            PermissionsBitField.Flags.Stream,
            PermissionsBitField.Flags.UseVAD
        ];

        return [
            {
                id: guild.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.Connect
                ],
                deny: deniedPermissions
            },
            ...guild.roles.cache
                .filter(role => role.id !== guild.id)
                .map(role => ({
                    id: role.id,
                    deny: deniedPermissions
                }))
        ];
    }

    async function ensureAfkRoom(guild) {
        const afkConfig = getAfkConfig();
        const preferredCategory = await getPreferredVoiceCategory(guild);
        const existingChannel = await findAfkChannel(guild);

        if (existingChannel) {
            const updates = {};

            if (existingChannel.userLimit !== afkConfig.userLimit) {
                updates.userLimit = afkConfig.userLimit;
            }

            if (existingChannel.name !== afkConfig.name) {
                updates.name = afkConfig.name;
            }

            if ((preferredCategory?.id ?? null) !== existingChannel.parentId) {
                updates.parent = preferredCategory?.id ?? null;
            }

            if (Object.keys(updates).length > 0) {
                await existingChannel.edit(updates).catch(error => {
                    console.error('Could not update AFK voice room settings:', error);
                });
            }

            await existingChannel.permissionOverwrites.set(buildAfkPermissionOverwrites(guild)).catch(error => {
                console.error('Could not update AFK voice room permissions:', error);
            });

            afkChannelIdsByGuild.set(guild.id, existingChannel.id);
            return existingChannel;
        }

        try {
            const channel = await guild.channels.create({
                name: afkConfig.name,
                type: ChannelType.GuildVoice,
                parent: preferredCategory?.id ?? null,
                userLimit: afkConfig.userLimit,
                permissionOverwrites: buildAfkPermissionOverwrites(guild)
            });

            afkChannelIdsByGuild.set(guild.id, channel.id);
            return channel;
        } catch (error) {
            console.error('Could not create AFK voice room:', error);
            return null;
        }
    }

    function isAfkChannelId(guildId, channelId) {
        return Boolean(channelId) && afkChannelIdsByGuild.get(guildId) === channelId;
    }

    function getAfkMuteKey(guildId, memberId) {
        return `${guildId}:${memberId}`;
    }

    async function applyAfkMute(member) {
        const muteKey = getAfkMuteKey(member.guild.id, member.id);

        if (!member.voice.serverMute) {
            await member.voice.setMute(true, 'AFK room requires microphone to stay disabled').catch(error => {
                console.error('Could not server mute member in AFK voice room:', error);
            });
        }

        afkMutedMembers.add(muteKey);
    }

    async function clearAfkMute(member) {
        const muteKey = getAfkMuteKey(member.guild.id, member.id);
        if (!afkMutedMembers.has(muteKey)) return;

        afkMutedMembers.delete(muteKey);

        if (!member.voice.channelId || !member.voice.serverMute) return;

        await member.voice.setMute(false, 'Member left AFK room').catch(error => {
            console.error('Could not remove AFK server mute from member:', error);
        });
    }

    async function enforceAfkRoomRules(member, afkChannel, newState) {
        if (!afkChannel) return;

        if (newState.channelId === afkChannel.id) {
            await applyAfkMute(member);
        } else {
            await clearAfkMute(member);
            return;
        }

        if (newState.streaming || newState.selfVideo) {
            await member.voice.disconnect('AFK room does not allow camera or streaming').catch(error => {
                console.error('Could not disconnect member from AFK voice room:', error);
            });
        }
    }

    function getRoomEntry(channelId) {
        return voiceRoomStore.get(channelId);
    }

    function getRoomByPanelMessage(message) {
        for (const [channelId, entry] of voiceRoomStore.entries()) {
            if (entry.controlMessageId === message.id && entry.controlChannelId === message.channelId) {
                return { channelId, entry };
            }
        }

        return null;
    }

    function getRoomByOwnerId(ownerId) {
        for (const [channelId, entry] of voiceRoomStore.entries()) {
            if (entry.ownerId === ownerId) {
                return { channelId, entry };
            }
        }

        return null;
    }

    function sanitizeChannelName(value, fallback) {
        const sanitized = value
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s._-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 90);

        return sanitized || fallback;
    }

    function isRoomLocked(channel) {
        const permissions = channel.permissionOverwrites.cache.get(channel.guild.id);
        return permissions?.deny?.has(PermissionsBitField.Flags.Connect) ?? false;
    }

    function isRoomHidden(channel) {
        const permissions = channel.permissionOverwrites.cache.get(channel.guild.id);
        return permissions?.deny?.has(PermissionsBitField.Flags.ViewChannel) ?? false;
    }

    function buildControlRows(channel) {
        const locked = isRoomLocked(channel);
        const hidden = isRoomHidden(channel);

        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('voice_toggle_lock')
                    .setLabel(locked ? 'Unlock' : 'Lock')
                    .setEmoji(locked ? '🔓' : '🔒')
                    .setStyle(locked ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('voice_hide')
                    .setLabel(hidden ? 'Hidden' : 'Hide')
                    .setEmoji('🙈')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('voice_show')
                    .setLabel(hidden ? 'Show' : 'Shown')
                    .setEmoji('👁️')
                    .setStyle(ButtonStyle.Primary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('voice_rename')
                    .setLabel('Rename')
                    .setEmoji('✏️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('voice_limit')
                    .setLabel('Set Limit')
                    .setEmoji('👥')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('voice_kick')
                    .setLabel('Kick')
                    .setEmoji('🥾')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('voice_delete')
                    .setLabel('Delete')
                    .setEmoji('🗑️')
                    .setStyle(ButtonStyle.Danger)
            )
        ];
    }

    function buildControlEmbed(owner, voiceChannel) {
        return new EmbedBuilder()
            .setColor('#2f3136')
            .setAuthor({
                name: `${owner.user.tag}`,
                iconURL: owner.displayAvatarURL()
            })
            .setTitle(`Voice Controls for ${voiceChannel.name}`)
            .setDescription(`Owner: ${owner}\nChannel: ${voiceChannel}\nMembers: **${voiceChannel.members.size}/${voiceChannel.userLimit || '∞'}**`)
            .addFields(
                { name: 'Status', value: 'Use the buttons below to manage your room.', inline: false },
                { name: 'To play songs', value: '!play <song_name>.', inline: false }
            )
            .setFooter({ text: 'Temporary Voice Room' })
            .setTimestamp();
    }

    async function postControlPanel({ owner, voiceChannel }) {
        try {
            if (voiceChannel?.isTextBased()) {
                const message = await voiceChannel.send({
                    content: `${owner}`,
                    embeds: [buildControlEmbed(owner, voiceChannel)],
                    components: buildControlRows(voiceChannel)
                });

                return message;
            }
        } catch (error) {
            console.error('Could not send voice control panel:', error);
        }

        console.log('Voice channel chat is unavailable, so no control panel message was sent.');
        return null;
    }

    async function createRoomForMember(member) {
        if (!isConfigured()) return null;

        const existingRoom = getRoomByOwnerId(member.id);
        if (existingRoom) {
            const existingChannel = member.guild.channels.cache.get(existingRoom.channelId)
                ?? await member.guild.channels.fetch(existingRoom.channelId).catch(() => null);

            if (existingChannel) {
                console.log(`Reusing existing temporary room for ${member.user.tag}: ${existingChannel.name}`);
                await member.voice.setChannel(existingChannel).catch(error => {
                    console.error('Could not move member to existing temporary room:', error);
                });
                return existingChannel;
            }

            voiceRoomStore.remove(existingRoom.channelId);
        }

        let categoryId = member.voice.channel?.parentId || null;
        if (config.ids.voiceCategory) {
            const configuredCategory = member.guild.channels.cache.get(config.ids.voiceCategory)
                ?? await member.guild.channels.fetch(config.ids.voiceCategory).catch(() => null);

            if (configuredCategory?.type === ChannelType.GuildCategory) {
                categoryId = configuredCategory.id;
            } else {
                console.log('Configured voice category is invalid, falling back to the create channel category:', config.ids.voiceCategory);
            }
        }

        const channelName = sanitizeChannelName(member.user.username, `room-${member.user.id.slice(-4)}`);

        try {
            const voiceChannel = await member.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: categoryId,
                userLimit: 0,
                permissionOverwrites: [
                    {
                        id: member.guild.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect
                        ]
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.MoveMembers
                        ]
                    }
                ]
            });

            const controlMessage = await postControlPanel({
                owner: member,
                voiceChannel
            });

            voiceRoomStore.set(voiceChannel.id, {
                guildId: member.guild.id,
                ownerId: member.id,
                controlChannelId: controlMessage?.channelId ?? null,
                controlMessageId: controlMessage?.id ?? null
            });

            await member.voice.setChannel(voiceChannel).catch(error => {
                console.error('Could not move member to temporary room:', error);
            });

            return voiceChannel;
        } catch (error) {
            console.error('Could not create temporary voice room:', error);
            return null;
        }
    }

    async function deleteRoom(channel, entry) {
        if (!channel) return;
        if (pendingCleanup.has(channel.id)) return;

        pendingCleanup.add(channel.id);

        try {
            if (entry?.controlChannelId && entry?.controlMessageId) {
                const controlChannel = channel.guild.channels.cache.get(entry.controlChannelId)
                    ?? await channel.guild.channels.fetch(entry.controlChannelId).catch(() => null);

                if (controlChannel?.isTextBased()) {
                    const controlMessage = await controlChannel.messages.fetch(entry.controlMessageId).catch(() => null);
                    if (controlMessage) {
                        await controlMessage.delete().catch(() => null);
                    }
                }
            }

            voiceRoomStore.remove(channel.id);

            if (channel.deletable) {
                await channel.delete('Temporary voice room cleanup').catch(error => {
                    console.error('Could not delete temporary voice room:', error);
                });
            }
        } finally {
            pendingCleanup.delete(channel.id);
        }
    }

    async function cleanupRoomIfEmpty(channelId, guild) {
        const entry = getRoomEntry(channelId);
        if (!entry) return;

        const channel = guild.channels.cache.get(channelId)
            ?? await guild.channels.fetch(channelId).catch(() => null);

        if (!channel) {
            voiceRoomStore.remove(channelId);
            return;
        }

        if (channel.members.size === 0) {
            await deleteRoom(channel, entry);
        }
    }

    async function handleVoiceStateUpdate(oldState, newState) {
        const member = newState.member ?? oldState.member;
        if (!member || member.user.bot) return;

        const guild = newState.guild ?? oldState.guild;
        const afkChannel = guild ? await ensureAfkRoom(guild) : null;

        if (afkChannel) {
            await enforceAfkRoomRules(member, afkChannel, newState);
        }

        if (isConfigured() && newState.channelId === config.ids.voiceCreateChannel) {
            await createRoomForMember(member);
        }

        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            await cleanupRoomIfEmpty(oldState.channelId, oldState.guild);
        }
    }

    async function initialize() {
        for (const guild of client.guilds.cache.values()) {
            await ensureAfkRoom(guild);
        }

        if (!isConfigured()) return;

        for (const [channelId, entry] of voiceRoomStore.entries()) {
            const guild = client.guilds.cache.get(entry.guildId);
            if (!guild) {
                voiceRoomStore.remove(channelId);
                continue;
            }

            await cleanupRoomIfEmpty(channelId, guild);
        }
    }

    async function cleanupAfkRooms() {
        const afkChannelRefs = [...afkChannelIdsByGuild.entries()];

        for (const [guildId, channelId] of afkChannelRefs) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                afkChannelIdsByGuild.delete(guildId);
                continue;
            }

            const channel = guild.channels.cache.get(channelId)
                ?? await guild.channels.fetch(channelId).catch(() => null);

            if (!channel) {
                afkChannelIdsByGuild.delete(guildId);
                continue;
            }

            await channel.delete('Bot shutdown AFK cleanup').catch(error => {
                console.error('Could not delete AFK voice room during shutdown:', error);
            });

            afkChannelIdsByGuild.delete(guildId);
        }
    }

    async function getOwnedRoom(interaction, channelId) {
        const roomEntry = voiceRoomStore.get(channelId);

        if (!roomEntry) {
            await interaction.reply({
                content: 'That temporary room no longer exists.',
                flags: MessageFlags.Ephemeral
            });
            return null;
        }

        const channel = interaction.guild.channels.cache.get(channelId)
            ?? await interaction.guild.channels.fetch(channelId).catch(() => null);

        if (!channel) {
            voiceRoomStore.remove(channelId);
            await interaction.reply({
                content: 'Your temporary room no longer exists.',
                flags: MessageFlags.Ephemeral
            });
            return null;
        }

        if (roomEntry.ownerId !== interaction.user.id) {
            await interaction.reply({
                content: 'Only the room owner can use these controls.',
                flags: MessageFlags.Ephemeral
            });
            return null;
        }

        return { channel, entry: roomEntry };
    }

    async function syncPanel(channel, entry) {
        if (!entry?.controlChannelId || !entry?.controlMessageId) return;

        const owner = channel.guild.members.cache.get(entry.ownerId)
            ?? await channel.guild.members.fetch(entry.ownerId).catch(() => null);

        if (!owner) return;

        const controlChannel = channel.guild.channels.cache.get(entry.controlChannelId)
            ?? await channel.guild.channels.fetch(entry.controlChannelId).catch(() => null);

        if (!controlChannel?.isTextBased()) return;

        const controlMessage = await controlChannel.messages.fetch(entry.controlMessageId).catch(() => null);
        if (!controlMessage) return;

        await controlMessage.edit({
            embeds: [buildControlEmbed(owner, channel)],
            components: buildControlRows(channel)
        }).catch(() => null);
    }

    async function setRoomAccess(interaction, channelId, permissionName, value, successMessage) {
        const ownedRoom = await getOwnedRoom(interaction, channelId);
        if (!ownedRoom) return;

        await ownedRoom.channel.permissionOverwrites.edit(interaction.guild.id, {
            [permissionName]: value
        });

        await interaction.reply({
            content: successMessage,
            flags: MessageFlags.Ephemeral
        });

        await syncPanel(ownedRoom.channel, ownedRoom.entry);
    }

    async function handleButton(interaction) {
        if (!interaction.customId.startsWith('voice_')) return false;

        if (!isConfigured()) {
            await interaction.reply({
                content: 'Voice room system is not configured yet.',
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        const roomReference = getRoomByPanelMessage(interaction.message);
        if (!roomReference) {
            await interaction.reply({
                content: 'This control panel is no longer linked to an active room.',
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        if (interaction.customId === 'voice_toggle_lock') {
            const ownedRoom = await getOwnedRoom(interaction, roomReference.channelId);
            if (!ownedRoom) return true;

            const locked = isRoomLocked(ownedRoom.channel);
            await ownedRoom.channel.permissionOverwrites.edit(interaction.guild.id, {
                Connect: locked
            });

            await interaction.reply({
                content: locked ? 'Your room is now unlocked.' : 'Your room is now locked.',
                flags: MessageFlags.Ephemeral
            });

            await syncPanel(ownedRoom.channel, ownedRoom.entry);
            return true;
        }

        if (interaction.customId === 'voice_hide') {
            await setRoomAccess(interaction, roomReference.channelId, 'ViewChannel', false, 'Your room is now hidden.');
            return true;
        }

        if (interaction.customId === 'voice_show') {
            await setRoomAccess(interaction, roomReference.channelId, 'ViewChannel', true, 'Your room is now visible.');
            return true;
        }

        if (interaction.customId === 'voice_delete') {
            const ownedRoom = await getOwnedRoom(interaction, roomReference.channelId);
            if (!ownedRoom) return true;

            await interaction.reply({
                content: 'Deleting your temporary room.',
                flags: MessageFlags.Ephemeral
            });
            await deleteRoom(ownedRoom.channel, ownedRoom.entry);
            return true;
        }

        if (interaction.customId === 'voice_rename') {
            const modal = new ModalBuilder()
                .setCustomId(`voice_modal:rename:${roomReference.channelId}`)
                .setTitle('Rename Voice Room');

            const input = new TextInputBuilder()
                .setCustomId('name')
                .setLabel('New room name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(90);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
            return true;
        }

        if (interaction.customId === 'voice_limit') {
            const modal = new ModalBuilder()
                .setCustomId(`voice_modal:limit:${roomReference.channelId}`)
                .setTitle('Set Voice Limit');

            const input = new TextInputBuilder()
                .setCustomId('limit')
                .setLabel('Member limit (0-99)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('0');

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
            return true;
        }

        if (interaction.customId === 'voice_kick') {
            const modal = new ModalBuilder()
                .setCustomId(`voice_modal:kick:${roomReference.channelId}`)
                .setTitle('Kick Member');

            const input = new TextInputBuilder()
                .setCustomId('member')
                .setLabel('Mention or user ID')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
            return true;
        }

        return true;
    }

    async function handleModal(interaction) {
        if (!interaction.customId.startsWith('voice_modal:')) return false;

        const [, action, channelId] = interaction.customId.split(':');
        const ownedRoom = await getOwnedRoom(interaction, channelId);
        if (!ownedRoom) return true;

        if (action === 'rename') {
            const rawName = interaction.fields.getTextInputValue('name');
            const nextName = sanitizeChannelName(rawName, ownedRoom.channel.name);

            await ownedRoom.channel.setName(nextName);
            await interaction.reply({
                content: `Room renamed to **${nextName}**.`,
                flags: MessageFlags.Ephemeral
            });
            await syncPanel(ownedRoom.channel, ownedRoom.entry);
            return true;
        }

        if (action === 'limit') {
            const rawLimit = interaction.fields.getTextInputValue('limit').trim();
            const limit = Number(rawLimit);

            if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
                await interaction.reply({
                    content: 'Please enter a valid limit between 0 and 99.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            await ownedRoom.channel.setUserLimit(limit);
            await interaction.reply({
                content: `Room limit updated to **${limit || '∞'}**.`,
                flags: MessageFlags.Ephemeral
            });
            await syncPanel(ownedRoom.channel, ownedRoom.entry);
            return true;
        }

        if (action === 'kick') {
            const rawMember = interaction.fields.getTextInputValue('member').trim();
            const memberId = rawMember.replace(/[<@!>]/g, '');
            const target = ownedRoom.channel.members.get(memberId)
                ?? await interaction.guild.members.fetch(memberId).catch(() => null);

            if (!target || !ownedRoom.channel.members.has(target.id)) {
                await interaction.reply({
                    content: 'That member is not inside your room.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            if (target.id === interaction.user.id) {
                await interaction.reply({
                    content: 'You cannot kick yourself from your own room.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            await target.voice.disconnect('Kicked from temporary voice room').catch(async () => {
                await target.voice.setChannel(null).catch(() => null);
            });

            await interaction.reply({
                content: `${target} has been removed from your room.`,
                flags: MessageFlags.Ephemeral
            });
            await syncPanel(ownedRoom.channel, ownedRoom.entry);
            return true;
        }

        return true;
    }

    return {
        initialize,
        cleanupAfkRooms,
        handleVoiceStateUpdate,
        isAfkChannelId,
        handleButton,
        handleModal
    };
}

module.exports = {
    createVoiceRoomsSystem
};
