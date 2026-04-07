const fs = require('fs');

function createTicketStore(ticketsFilePath) {
    let ticketOwners = loadTicketOwners();

    function loadTicketOwners() {
        try {
            if (!fs.existsSync(ticketsFilePath)) {
                return {};
            }

            const raw = fs.readFileSync(ticketsFilePath, 'utf8');
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.error('Could not load ticket owners:', error);
            return {};
        }
    }

    function save() {
        try {
            fs.writeFileSync(ticketsFilePath, JSON.stringify(ticketOwners, null, 2), 'utf8');
        } catch (error) {
            console.error('Could not save ticket owners:', error);
        }
    }

    function getOwnerId(channelId) {
        return ticketOwners[channelId] ?? null;
    }

    function setOwner(channelId, userId) {
        ticketOwners[channelId] = userId;
        save();
    }

    function removeOwner(channelId) {
        if (!ticketOwners[channelId]) return;

        delete ticketOwners[channelId];
        save();
    }

    function entries() {
        return Object.entries(ticketOwners);
    }

    return {
        getOwnerId,
        setOwner,
        removeOwner,
        entries,
        save
    };
}

module.exports = {
    createTicketStore
};
