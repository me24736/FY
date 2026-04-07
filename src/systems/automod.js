const { AttachmentBuilder, AutoModerationActionType, EmbedBuilder } = require('discord.js');

function createAutoModSystem({ config, discordUtils }) {
    const warnings = new Map();
    const recentAutoModEvents = new Map();

    function isLinkAutoModMatch(autoModerationActionExecution) {
        const combinedText = [
            autoModerationActionExecution.content,
            autoModerationActionExecution.matchedContent,
            autoModerationActionExecution.matchedKeyword
        ]
            .filter(Boolean)
            .join(' ');

        return /(https?:\/\/|www\.|discord\.gg\/|discordapp\.com\/invite\/)/i.test(combinedText);
    }

    async function getAutoModRuleName(autoModerationActionExecution) {
        const cachedRuleName = autoModerationActionExecution.autoModerationRule?.name?.toLowerCase();
        if (cachedRuleName) {
            return cachedRuleName;
        }

        try {
            const rule = await autoModerationActionExecution.guild.autoModerationRules.fetch({
                autoModerationRule: autoModerationActionExecution.ruleId,
                force: true
            });

            return rule?.name?.toLowerCase() ?? '';
        } catch (error) {
            console.log('Could not fetch AutoMod rule:', error);
            return '';
        }
    }

    function inferViolationFromRuleName(ruleName) {
        const isRepeatedRule = /(repeated messages|repeated|repeat|duplicate|flood|تكرار|مكرر)/i.test(ruleName);
        const isBadWordsRule = /(bad words|badwords|swear|curse|profan|toxic|شت|الفاظ|ألفاظ|كلمات سيئة)/i.test(ruleName);
        const isSpamRule = /(spam messages|spam|mention spam|سبام|ازعاج|إزعاج)/i.test(ruleName);

        if (isRepeatedRule) {
            return {
                key: 'repeated_messages',
                reason: 'تكرار إرسال رسائل متشابهة داخل السيرفر',
                durationMs: 10 * 60 * 1000,
                durationText: '10 minutes'
            };
        }

        if (isSpamRule) {
            return {
                key: 'spam_messages',
                reason: 'تكرار إرسال رسائل سبام داخل السيرفر',
                durationMs: 120 * 60 * 1000,
                durationText: '2 hours'
            };
        }

        if (isBadWordsRule) {
            return {
                key: 'bad_words',
                reason: 'تكرار إرسال ألفاظ أو كلمات ممنوعة داخل السيرفر',
                durationMs: 120 * 60 * 1000,
                durationText: '2 hours'
            };
        }

        return null;
    }

    async function getViolationInfo(autoModerationActionExecution) {
        const ruleName = await getAutoModRuleName(autoModerationActionExecution);

        if (isLinkAutoModMatch(autoModerationActionExecution)) {
            return {
                key: 'links',
                reason: 'تكرار إرسال روابط ممنوعة داخل السيرفر',
                durationMs: 60 * 60 * 1000,
                durationText: '1 hour'
            };
        }

        return inferViolationFromRuleName(ruleName);
    }

    async function handleAutoModeration(autoModerationActionExecution) {
        try {
            const ruleName = await getAutoModRuleName(autoModerationActionExecution);

            if (autoModerationActionExecution.action.type !== AutoModerationActionType.BlockMessage) return;
            if (!config.targetChannels.includes(autoModerationActionExecution.channelId)) return;

            let violationInfo = await getViolationInfo(autoModerationActionExecution);
            if (!violationInfo && ruleName) {
                violationInfo = inferViolationFromRuleName(ruleName);
            }
            if (!violationInfo) return;

            const member = autoModerationActionExecution.member
                ?? await autoModerationActionExecution.guild.members.fetch(autoModerationActionExecution.userId);

            if (!member || discordUtils.hasAllowedRole(member)) return;
            if (member.isCommunicationDisabled()) return;

            const eventKey = [
                member.id,
                autoModerationActionExecution.ruleId,
                autoModerationActionExecution.channelId ?? 'no-channel',
                autoModerationActionExecution.matchedKeyword ?? 'no-keyword',
                autoModerationActionExecution.matchedContent ?? 'no-match',
                autoModerationActionExecution.content ?? 'no-content'
            ].join(':');
            const now = Date.now();
            const lastSeen = recentAutoModEvents.get(eventKey);

            if (lastSeen && now - lastSeen < config.automod.duplicateWindowMs) {
                return;
            }

            recentAutoModEvents.set(eventKey, now);

            const userId = member.id;
            const warningKey = `${userId}:${violationInfo.key}`;
            const currentWarnings = warnings.get(warningKey) || 0;
            const newWarnings = currentWarnings + 1;
            warnings.set(warningKey, newWarnings);

            if (newWarnings < config.automod.warningLimit) {
                return;
            }

            await member.timeout(violationInfo.durationMs, violationInfo.reason);
            warnings.set(warningKey, 0);

            const timeoutEmbed = new EmbedBuilder()
                .setColor('#464654')
                .setAuthor({
                    name: autoModerationActionExecution.guild.name,
                    iconURL: autoModerationActionExecution.guild.iconURL() ?? undefined
                })
                .setTitle('تم تقييدك مؤقتًا')
                .addFields(
                    { name: 'السبب', value: violationInfo.reason, inline: false },
                    { name: 'المدة', value: violationInfo.durationText, inline: false },
                    { name: 'عدد المخالفات', value: `${config.automod.warningLimit}`, inline: false }
                )
                .setFooter({ text: 'AutoMod Punishment' })
                .setTimestamp();

            const logImage = new AttachmentBuilder(config.paths.images.automodRecord, { name: 'record.gif' });
            const logEmbed = new EmbedBuilder()
                .setColor('#FFFFFF')
                .setAuthor({
                    name: `${autoModerationActionExecution.guild.name} | سجل العقوبات`,
                    iconURL: autoModerationActionExecution.guild.iconURL() ?? undefined
                })
                .setTitle('تم تنفيذ العقوبة')
                .setDescription('تم تطبيق تايم أوت تلقائي بعد تكرار المخالفة.')
                .addFields(
                    { name: 'العضو', value: `<@${userId}>`, inline: false },
                    { name: 'نوع المخالفة', value: violationInfo.reason, inline: false },
                    { name: 'المدة', value: violationInfo.durationText, inline: true },
                    { name: 'عدد المخالفات', value: `${config.automod.warningLimit}`, inline: true },
                    { name: 'الروم', value: autoModerationActionExecution.channelId ? `<#${autoModerationActionExecution.channelId}>` : 'غير معروف', inline: false }
                )
                .setImage('attachment://record.gif')
                .setFooter({ text: 'AutoMod Log' })
                .setTimestamp();

            try {
                await member.send({ embeds: [timeoutEmbed] });
            } catch (dmError) {
                console.log('Could not send timeout DM:', dmError);
            }

            const logChannel = autoModerationActionExecution.guild.channels.cache.get(config.ids.automodLogChannel)
                ?? await autoModerationActionExecution.guild.channels.fetch(config.ids.automodLogChannel).catch(() => null);
            if (logChannel?.isTextBased()) {
                await logChannel.send({
                    content: `<@${userId}>`,
                    embeds: [logEmbed],
                    files: [logImage]
                });
            }
        } catch (error) {
            console.log('Auto moderation handling error:', error);
        }
    }

    return {
        handleAutoModeration
    };
}

module.exports = {
    createAutoModSystem
};
