const fs = require('fs');

function createVoiceRoomStore(voiceRoomsFilePath) {
    let roomEntries = loadRoomEntries();

    function loadRoomEntries() {
        try {
            if (!fs.existsSync(voiceRoomsFilePath)) {
                return {};
            }

            const raw = fs.readFileSync(voiceRoomsFilePath, 'utf8');
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.error('Could not load voice rooms:', error);
            return {};
        }
    }

    function save() {
        try {
            fs.writeFileSync(voiceRoomsFilePath, JSON.stringify(roomEntries, null, 2), 'utf8');
        } catch (error) {
            console.error('Could not save voice rooms:', error);
        }
    }

    function get(channelId) {
        return roomEntries[channelId] ?? null;
    }

    function set(channelId, data) {
        roomEntries[channelId] = data;
        save();
    }

    function remove(channelId) {
        if (!roomEntries[channelId]) return;

        delete roomEntries[channelId];
        save();
    }

    function entries() {
        return Object.entries(roomEntries);
    }

    return {
        get,
        set,
        remove,
        entries,
        save
    };
}

module.exports = {
    createVoiceRoomStore
};
