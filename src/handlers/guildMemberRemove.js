function createGuildMemberRemoveHandler({ memberCounterSystem }) {
    return async function handleGuildMemberRemove(member) {
        await memberCounterSystem.updateCounter(member.guild);
    };
}

module.exports = {
    createGuildMemberRemoveHandler
};
