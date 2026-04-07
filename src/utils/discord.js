function createDiscordUtils({ allowedRoles }) {
    function hasAllowedRole(member) {
        if (!member?.roles) return false;

        if (member.roles.cache) {
            return member.roles.cache.some(role => allowedRoles.includes(role.id));
        }

        if (Array.isArray(member.roles)) {
            return member.roles.some(roleId => allowedRoles.includes(roleId));
        }

        return false;
    }

    async function safeReply(message, content) {
        try {
            return await message.reply({
                content,
                failIfNotExists: false
            });
        } catch (error) {
            const isUnknownReference = error?.code === 50035
                && error?.rawError?.errors?.message_reference?._errors?.some(
                    detail => detail.code === 'MESSAGE_REFERENCE_UNKNOWN_MESSAGE'
                );

            if (isUnknownReference) {
                return await message.channel.send({ content });
            }

            throw error;
        }
    }

    return {
        hasAllowedRole,
        safeReply
    };
}

module.exports = {
    createDiscordUtils
};
