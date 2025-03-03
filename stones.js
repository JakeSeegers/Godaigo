// stones.js

// Stone definitions
const STONE_TYPES = {
    EARTH: { name: 'earth', color: '#69d83a', symbol: '▲', rank: 5 },
    WATER: { name: 'water', color: '#5894f4', symbol: '◯', rank: 4 },
    FIRE: { name: 'fire', color: '#ed1b43', symbol: '♦', rank: 3 },
    WIND: { name: 'wind', color: '#ffce00', symbol: '≋', rank: 2 },
    VOID: { name: 'void', color: '#9458f4', symbol: '✺', rank: 1 }
};

// Track how many stones the player has
const stoneCounts = {
    [STONE_TYPES.EARTH.name]: 5,
    [STONE_TYPES.WATER.name]: 5,
    [STONE_TYPES.FIRE.name]: 5,
    [STONE_TYPES.WIND.name]: 5,
    [STONE_TYPES.VOID.name]: 5
};

const stoneCapacity = {
    [STONE_TYPES.EARTH.name]: 5,
    [STONE_TYPES.WATER.name]: 5,
    [STONE_TYPES.FIRE.name]: 5,
    [STONE_TYPES.WIND.name]: 5,
    [STONE_TYPES.VOID.name]: 5
};

// Update the on-screen count for stones
function updateStoneCount(type) {
    document.getElementById(`${type}-count`).textContent =
        `${stoneCounts[type]}/${stoneCapacity[type]}`;
}

// Decrement the stone count for a specific type
function decrementStoneCount(type) {
    if (stoneCounts[type] > 0) {
        stoneCounts[type]--;
        updateStoneCount(type);
        return true;
    }
    return false;
}
