const { EmbedBuilder } = require('discord.js');

function createLevelsSystem({ client, config, levelsStore }) {
    const voiceSessions = new Map();
    const maxLevel = 125;
    const dailyGiftCooldownMs = 24 * 60 * 60 * 1000;

    function isAfkVoiceChannel(channel) {
        if (!channel) return false;
        return channel.name === (config.afkVoice?.name ?? 'AFK');
    }

    function getRequiredXpForNextLevel(level) {
        return 100 + (level * 75);
    }

    function addXp(profile, type, amount) {
        const xpKey = type === 'text' ? 'textXp' : 'voiceXp';
        const levelKey = type === 'text' ? 'textLevel' : 'voiceLevel';

        if (profile[levelKey] >= maxLevel) {
            profile[levelKey] = maxLevel;
            profile[xpKey] = 0;
            return {
                leveledUp: false,
                level: profile[levelKey],
                currentXp: profile[xpKey],
                requiredXp: 0
            };
        }

        profile[xpKey] += amount;

        let leveledUp = false;
        while (profile[levelKey] < maxLevel && profile[xpKey] >= getRequiredXpForNextLevel(profile[levelKey])) {
            profile[xpKey] -= getRequiredXpForNextLevel(profile[levelKey]);
            profile[levelKey] += 1;
            leveledUp = true;
        }

        if (profile[levelKey] >= maxLevel) {
            profile[levelKey] = maxLevel;
            profile[xpKey] = 0;
        }

        return {
            leveledUp,
            level: profile[levelKey],
            currentXp: profile[xpKey],
            requiredXp: profile[levelKey] >= maxLevel ? 0 : getRequiredXpForNextLevel(profile[levelKey])
        };
    }

    function getRandomXp(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function countMeaningfulCharacters(content) {
        return content
            .replace(/https?:\/\/\S+/gi, ' ')
            .replace(/<a?:\w+:\d+>/g, ' ')
            .replace(/<@!?\d+>|<#\d+>|<@&\d+>/g, ' ')
            .replace(/\s+/g, '')
            .length;
    }

    function getLevelTypeEnglish(type) {
        return type === 'text' ? 'Text' : 'Voice';
    }

    function getProgressBar(current, required, size = 10) {
        const safeRequired = Math.max(required, 1);
        const filled = Math.max(0, Math.min(size, Math.round((current / safeRequired) * size)));
        return `${'#'.repeat(filled)}${'-'.repeat(size - filled)}`;
    }

    function getDailyGiftAmount(textLevel) {
        if (textLevel >= 75) return 65;
        if (textLevel >= 55) return 45;
        if (textLevel >= 30) return 25;
        return 10;
    }

    async function applyLevelRewardRoles(member, type) {
        const rewards = config.levelRewards?.[type];
        if (!member?.roles || !Array.isArray(rewards) || !rewards.length) {
            return;
        }

        const profile = levelsStore.getMemberProfile(member.guild.id, member.id);
        const currentLevel = type === 'text' ? profile.textLevel : profile.voiceLevel;

        for (const reward of rewards) {
            if (currentLevel < reward.level) continue;
            if (member.roles.cache.has(reward.roleId)) continue;

            try {
                await member.roles.add(reward.roleId, `${type} level reward reached: ${reward.level}`);
            } catch (error) {
                console.error(`Failed to assign ${type} level reward role ${reward.roleId} to ${member.id}:`, error);
            }
        }
    }

    async function sendLevelUpAnnouncement(member, type, level) {
        const levelChannel = member.guild.channels.cache.get(config.ids.levelUpChannel)
            ?? await member.guild.channels.fetch(config.ids.levelUpChannel).catch(() => null);

        if (!levelChannel?.isTextBased()) {
            console.log('Level-up channel not found or not text-based:', config.ids.levelUpChannel);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#464654')
            .setAuthor({
                name: member.guild.name,
                iconURL: member.guild.iconURL() ?? undefined
            })
            .setTitle('Level Up')
            .setDescription(`Congratulations on reaching a new ${getLevelTypeEnglish(type)} level.`)
            .addFields(
                { name: 'Member', value: `${member}`, inline: false },
                { name: 'Type', value: getLevelTypeEnglish(type), inline: true },
                { name: 'Level', value: `${level}`, inline: true }
            )
            .setFooter({ text: 'Level System | Progress Updated' })
            .setTimestamp();

        await levelChannel.send({ embeds: [embed] });
    }

    async function handleLevelXp(member, type, amount) {
        if (!member || member.user.bot) return;

        const profile = levelsStore.getMemberProfile(member.guild.id, member.id);
        const result = addXp(profile, type, amount);
        levelsStore.scheduleSave();

        if (result.leveledUp) {
            await applyLevelRewardRoles(member, type);
        }

        if (result.leveledUp) {
            await sendLevelUpAnnouncement(member, type, result.level);
        }
    }

    function getHumanMembersInVoiceChannel(channel) {
        return channel.members.filter(member => !member.user.bot);
    }

    function shouldEarnVoiceXp(member) {
        const voiceState = member.voice;
        if (!voiceState?.channelId) return false;

        if (!isAfkVoiceChannel(voiceState.channel)) {
            if (voiceState.selfMute || voiceState.serverMute) return false;
            if (voiceState.selfDeaf || voiceState.serverDeaf) return false;
        }

        const humans = getHumanMembersInVoiceChannel(voiceState.channel);
        return humans.size >= 1;
    }

    async function processVoiceXpTick() {
        for (const [memberId, session] of voiceSessions.entries()) {
            const guild = client.guilds.cache.get(session.guildId);
            if (!guild) continue;

            const member = guild.members.cache.get(memberId) ?? await guild.members.fetch(memberId).catch(() => null);
            if (!member) continue;
            if (!shouldEarnVoiceXp(member)) continue;

            const now = Date.now();
            if (now - session.lastAwardAt < config.levels.voiceIntervalMs) continue;

            session.lastAwardAt = now;
            const profile = levelsStore.getMemberProfile(member.guild.id, member.id);
            profile.stats.voiceMinutesCounted += 1;
            levelsStore.scheduleSave();
            await handleLevelXp(member, 'voice', config.levels.voiceXpPerMinute);
        }
    }

    function upsertVoiceSession(memberId, guildId, channelId) {
        const existing = voiceSessions.get(memberId);
        const now = Date.now();

        if (existing) {
            existing.guildId = guildId;
            if (existing.channelId !== channelId) {
                existing.channelId = channelId;
                existing.lastAwardAt = now;
            }
            return;
        }

        voiceSessions.set(memberId, {
            guildId,
            channelId,
            lastAwardAt: now
        });
    }

    function removeVoiceSession(memberId) {
        voiceSessions.delete(memberId);
    }

    async function initializeVoiceSessions() {
        for (const guild of client.guilds.cache.values()) {
            for (const [, voiceState] of guild.voiceStates.cache) {
                if (!voiceState.channelId) continue;

                const member = voiceState.member
                    ?? await guild.members.fetch(voiceState.id).catch(() => null);

                if (!member || member.user.bot) continue;
                upsertVoiceSession(member.id, guild.id, voiceState.channelId);
            }
        }
    }

    async function handleMessageXp(message) {
        if (!message.guild || !message.member) return;
        if (message.content.startsWith('/')) return;
        if (countMeaningfulCharacters(message.content) < config.levels.textMinChars) return;

        const profile = levelsStore.getMemberProfile(message.guild.id, message.author.id);
        const now = Date.now();

        if (now - profile.lastTextXpAt < config.levels.textCooldownMs) return;

        profile.lastTextXpAt = now;
        profile.stats.textMessagesCounted += 1;
        levelsStore.scheduleSave();
        await handleLevelXp(message.member, 'text', getRandomXp(config.levels.textXpMin, config.levels.textXpMax));
    }

    async function claimDailyGift(member) {
        if (!member || member.user.bot) {
            return { status: 'invalid' };
        }

        const profile = levelsStore.getMemberProfile(member.guild.id, member.id);
        const now = Date.now();
        const elapsed = now - profile.lastDailyGiftAt;

        if (elapsed < dailyGiftCooldownMs) {
            return {
                status: 'cooldown',
                remainingMs: dailyGiftCooldownMs - elapsed,
                amount: getDailyGiftAmount(profile.textLevel),
                level: profile.textLevel
            };
        }

        const amount = getDailyGiftAmount(profile.textLevel);
        profile.lastDailyGiftAt = now;
        levelsStore.scheduleSave();
        await handleLevelXp(member, 'text', amount);

        return {
            status: 'claimed',
            amount,
            level: levelsStore.getMemberProfile(member.guild.id, member.id).textLevel
        };
    }

    return {
        getRequiredXpForNextLevel,
        getProgressBar,
        getGuildLevels: levelsStore.getGuildLevels,
        getMemberProfile: levelsStore.getMemberProfile,
        initializeVoiceSessions,
        processVoiceXpTick,
        upsertVoiceSession,
        removeVoiceSession,
        handleMessageXp,
        claimDailyGift
    };
}

module.exports = {
    createLevelsSystem
};
