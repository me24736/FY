const fs = require('fs');

function createLevelsStore(levelsFilePath) {
    let levelsData = loadLevelsData();
    let saveLevelsTimeout = null;

    function loadLevelsData() {
        try {
            if (!fs.existsSync(levelsFilePath)) {
                return {};
            }

            const raw = fs.readFileSync(levelsFilePath, 'utf8');
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.error('Could not load levels data:', error);
            return {};
        }
    }

    function scheduleSave() {
        if (saveLevelsTimeout) return;

        saveLevelsTimeout = setTimeout(() => {
            try {
                fs.writeFileSync(levelsFilePath, JSON.stringify(levelsData, null, 2), 'utf8');
            } catch (error) {
                console.error('Could not save levels data:', error);
            } finally {
                saveLevelsTimeout = null;
            }
        }, 1000);
    }

    function getGuildLevels(guildId) {
        if (!levelsData[guildId]) {
            levelsData[guildId] = {};
        }

        return levelsData[guildId];
    }

    function createEmptyProfile() {
        return {
            textXp: 0,
            textLevel: 0,
            voiceXp: 0,
            voiceLevel: 0,
            lastTextXpAt: 0,
            lastDailyGiftAt: 0,
            stats: {
                textMessagesCounted: 0,
                voiceMinutesCounted: 0
            }
        };
    }

    function getMemberProfile(guildId, userId) {
        const guildLevels = getGuildLevels(guildId);

        if (!guildLevels[userId]) {
            guildLevels[userId] = createEmptyProfile();
        }

        if (!guildLevels[userId].stats) {
            guildLevels[userId].stats = {
                textMessagesCounted: 0,
                voiceMinutesCounted: 0
            };
        }

        if (typeof guildLevels[userId].lastDailyGiftAt !== 'number') {
            guildLevels[userId].lastDailyGiftAt = 0;
        }

        return guildLevels[userId];
    }

    return {
        getGuildLevels,
        getMemberProfile,
        scheduleSave
    };
}

module.exports = {
    createLevelsStore
};
