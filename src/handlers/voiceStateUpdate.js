function createVoiceStateUpdateHandler({ levelsSystem, voiceRoomsSystem }) {
    return async function handleVoiceStateUpdate(oldState, newState) {
        try {
            const member = newState.member ?? oldState.member;
            if (!member || member.user.bot) return;

            await voiceRoomsSystem.handleVoiceStateUpdate(oldState, newState);

            if (newState.channelId) {
                levelsSystem.upsertVoiceSession(member.id, newState.guild.id, newState.channelId);
                return;
            }

            levelsSystem.removeVoiceSession(member.id);
        } catch (error) {
            console.error('voiceStateUpdate handler error:', error);
        }
    };
}

module.exports = {
    createVoiceStateUpdateHandler
};
