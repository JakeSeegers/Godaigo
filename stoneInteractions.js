// stoneInteractions.js with bidirectional interactions

class StoneInteractionSystem {
    constructor(grid) {
        this.grid = grid;
        this.animationManager = grid.animationManager;
        this.processingChainReaction = false; // Flag to prevent multiple chain reactions
        
        // Define interaction rules matrix
        this.interactionRules = {
            // Format: [stoneType]: { [adjacentType]: handlerFunction }
            [STONE_TYPES.FIRE.name]: {
                [STONE_TYPES.WATER.name]: this.handleFireWaterInteraction.bind(this),
                [STONE_TYPES.EARTH.name]: this.handleFireDestructionInteraction.bind(this),
                [STONE_TYPES.WIND.name]: this.handleFireDestructionInteraction.bind(this)
            },
            [STONE_TYPES.WATER.name]: {
                [STONE_TYPES.FIRE.name]: this.handleWaterFireInteraction.bind(this),
                [STONE_TYPES.EARTH.name]: this.handleWaterMimicry.bind(this),
                [STONE_TYPES.WIND.name]: this.handleWaterMimicry.bind(this),
                [STONE_TYPES.VOID.name]: this.handleWaterMimicry.bind(this),
                [STONE_TYPES.WATER.name]: this.handleWaterChain.bind(this)
            }
            // Other stone types can be added here
        };
    }
    
    // Main processing function - with bidirectional interaction checks
    processInteraction(q, r) {
        const placedHex = this.grid.getHex(q, r);
        if (!placedHex || !placedHex.stone) return;
        
        // Log the start of interaction if debugger is enabled
        if (this.grid.debugger) {
            this.grid.debugger.logInteraction('Stone Interaction Started', {
                type: 'stoneInteraction',
                stone: placedHex.stone,
                position: { q, r }
            });
        }
        
        // Check if stone is nullified by void
        if (this.isStoneNullified(q, r)) {
            if (this.grid.debugger) {
                this.grid.debugger.logInteraction('Stone Nullified by Void', {
                    stone: placedHex.stone,
                    position: { q, r }
                });
            }
            return; // Skip processing if nullified
        }
        
        // DIRECTION 1: Placed stone affects neighbors
        this.processOutgoingInteractions(q, r);
        
        // DIRECTION 2: Neighbors affect placed stone
        this.processIncomingInteractions(q, r);
    }
    
    // Process interactions where the placed stone affects its neighbors
    processOutgoingInteractions(q, r) {
        const placedHex = this.grid.getHex(q, r);
        if (!placedHex || !placedHex.stone) return;
        
        const stoneType = placedHex.stone;
        const neighbors = this.grid.getNeighbors(q, r);
        
        // Check if we have rules for this stone type
        if (this.interactionRules[stoneType]) {
            for (const nb of neighbors) {
                const nbHex = this.grid.getHex(nb.q, nb.r);
                if (!nbHex || !nbHex.stone) continue;
                
                // Check if neighbor stone has an interaction with placed stone
                const handler = this.interactionRules[stoneType][nbHex.stone];
                if (handler) {
                    handler(q, r, nb.q, nb.r);
                }
            }
        }
    }
    
    // Process interactions where neighboring stones affect the placed stone
    processIncomingInteractions(q, r) {
        const placedHex = this.grid.getHex(q, r);
        if (!placedHex || !placedHex.stone) return;
        
        const stoneType = placedHex.stone;
        const neighbors = this.grid.getNeighbors(q, r);
        
        for (const nb of neighbors) {
            const nbHex = this.grid.getHex(nb.q, nb.r);
            if (!nbHex || !nbHex.stone) continue;
            
            // Skip if neighbor is nullified by void
            if (this.isStoneNullified(nb.q, nb.r)) continue;
            
            const neighborType = nbHex.stone;
            
            // Check if neighbor has rules that affect the placed stone
            if (this.interactionRules[neighborType] && this.interactionRules[neighborType][stoneType]) {
                const handler = this.interactionRules[neighborType][stoneType];
                // Note: Order of parameters matters - neighbor is acting on placed stone
                handler(nb.q, nb.r, q, r);
            }
        }
    }
    
    // Check if a stone's abilities are nullified by an adjacent void stone
    isStoneNullified(q, r) {
        const neighbors = this.grid.getNeighbors(q, r);
        for (const nb of neighbors) {
            const nbHex = this.grid.getHex(nb.q, nb.r);
            if (nbHex && nbHex.stone === STONE_TYPES.VOID.name) {
                return true;
            }
        }
        return false;
    }
    
    // Handler implementations
    handleFireWaterInteraction(fireQ, fireR, waterQ, waterR) {
        // Log interaction if debugger is enabled
        if (this.grid.debugger) {
            this.grid.debugger.logInteraction('Fire-Water Interaction', {
                type: 'fireWater',
                fire: { q: fireQ, r: fireR },
                water: { q: waterQ, r: waterR }
            });
        }
        
        // Check if we're already processing a chain reaction
        if (this.processingChainReaction) return;
        
        this.triggerWaterFireChainReaction(waterQ, waterR);
    }
    
    handleFireDestructionInteraction(fireQ, fireR, targetQ, targetR) {
        const targetHex = this.grid.getHex(targetQ, targetR);
        if (!targetHex) return;
        
        // Don't destroy void or other fire stones
        if (targetHex.stone === STONE_TYPES.VOID.name || 
            targetHex.stone === STONE_TYPES.FIRE.name) {
            return;
        }
        
        // Special handling for water stones (handled in handleFireWaterInteraction)
        if (targetHex.stone === STONE_TYPES.WATER.name) {
            return;
        }
        
        const destroyedType = targetHex.stone;
        const firePos = { q: fireQ, r: fireR };
        const targetPos = { q: targetQ, r: targetR };
        
        // Log interaction if debugger is enabled
        if (this.grid.debugger) {
            this.grid.debugger.logInteraction('Fire Destroying Stone', {
                type: 'fireDestruction',
                fire: firePos,
                target: targetPos,
                targetType: destroyedType
            });
        }
        
        // For earth stones specifically, log additional debugging
        if (destroyedType === STONE_TYPES.EARTH.name) {
            console.log(`Fire at (${fireQ},${fireR}) is destroying Earth at (${targetQ},${targetR})`);
        }
        
        // Add animation
        this.animationManager.addAnimation(
            new FireStoneAnimation(this.grid, firePos, targetPos, destroyedType)
        );
        
        // Destroy the stone immediately for more reliable behavior
        targetHex.stone = null;
        this.grid.updateStatus(`${destroyedType} stone was destroyed by adjacent fire stone!`);
        this.grid.markHexDirty(targetQ, targetR);
        
        // Render update after a short delay to allow animation to play
        setTimeout(() => {
            this.grid.renderOptimized();
        }, 400);
    }
    
    handleWaterFireInteraction(waterQ, waterR, fireQ, fireR) {
        // Check if fire is nullified
        if (this.isStoneNullified(fireQ, fireR)) return;
        
        // Check if we're already processing a chain reaction
        if (this.processingChainReaction) return;
        
        // Trigger chain reaction starting with this water
        this.triggerWaterFireChainReaction(waterQ, waterR);
    }
    
    handleWaterMimicry(waterQ, waterR, adjacentQ, adjacentR) {
        // This is purely for visual/cost calculation effects
        // No actual state changes needed here
        // Mark the water hex as dirty to ensure proper rendering
        this.grid.markHexDirty(waterQ, waterR);
    }
    
    handleWaterChain(waterQ, waterR, adjacentQ, adjacentR) {
        // Simply mark both water hexes as part of a chain
        // for visual connectivity rendering
        this.grid.markHexDirty(waterQ, waterR);
        this.grid.markHexDirty(adjacentQ, adjacentR);
    }
    
    // Implement water-fire chain reaction logic
    triggerWaterFireChainReaction(startQ, startR) {
        // Set the flag to prevent multiple chain reactions
        if (this.processingChainReaction) return;
        this.processingChainReaction = true;
        
        this.grid.updateStatus("Chain reaction started: water stones mimicking fire's destructive ability!");
        
        // Collection of connected water stones
        const waterHexes = this.findConnectedWaterStones(startQ, startR);
        
        // If no water stones found, exit early
        if (waterHexes.length === 0) {
            this.processingChainReaction = false;
            return;
        }
        
        // Log water chain reaction if debugger is enabled
        if (this.grid.debugger) {
            this.grid.debugger.logInteraction('Water Chain Reaction', {
                type: 'waterChain',
                start: { q: startQ, r: startR },
                waterHexes: waterHexes
            });
        }
        
        // Start animation
        this.animationManager.addAnimation(
            new FireWaterChainAnimation(this.grid, waterHexes)
        );
        
        // Reduce delay for more immediate feedback
        const animationDelay = 800; // Reduced from 1500ms
        
        // Process destruction effects
        setTimeout(() => {
            // First pass: Identify all stones to be destroyed (but don't destroy yet)
            // This avoids issues with simultaneously destroying stones
            const stonesToDestroy = [];
            
            // Find non-water stones to destroy
            for (const waterHex of waterHexes) {
                for (const nb of this.grid.getNeighbors(waterHex.q, waterHex.r)) {
                    const nbHex = this.grid.getHex(nb.q, nb.r);
                    if (nbHex && nbHex.stone && 
                        nbHex.stone !== STONE_TYPES.WATER.name && 
                        nbHex.stone !== STONE_TYPES.VOID.name &&
                        nbHex.stone !== STONE_TYPES.FIRE.name) { // Don't destroy fire or void stones
                        stonesToDestroy.push({ q: nb.q, r: nb.r, type: nbHex.stone });
                    }
                }
            }
            
            // Destroy identified stones
            for (const stoneInfo of stonesToDestroy) {
                const hex = this.grid.getHex(stoneInfo.q, stoneInfo.r);
                if (hex && hex.stone === stoneInfo.type) { // Double-check it hasn't been destroyed
                    this.grid.updateStatus(`Chain reaction: Water stone destroyed adjacent ${stoneInfo.type} stone!`);
                    hex.stone = null;
                    this.grid.markHexDirty(stoneInfo.q, stoneInfo.r);
                }
            }
            
            // Lastly, consume the water stones
            for (const waterHex of waterHexes) {
                const hex = this.grid.getHex(waterHex.q, waterHex.r);
                if (hex && hex.stone === STONE_TYPES.WATER.name) {
                    hex.stone = null; // Actually remove the water stone
                    this.grid.updateStatus(`Water stone at (${waterHex.q},${waterHex.r}) was consumed in the chain reaction!`);
                    this.grid.markHexDirty(waterHex.q, waterHex.r);
                }
            }
            
            // Reset processing flag and render
            this.processingChainReaction = false;
            this.grid.renderOptimized();
        }, animationDelay);
    }
    
    findConnectedWaterStones(startQ, startR) {
        // Find all connected water stones (BFS algorithm)
        const waterHexes = [];
        let queue = [{ q: startQ, r: startR }];
        let visited = new Set();
        
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.q},${current.r}`;
            if (visited.has(key)) continue;
            visited.add(key);
            
            const hex = this.grid.getHex(current.q, current.r);
            if (hex && hex.stone === STONE_TYPES.WATER.name) {
                waterHexes.push({ q: current.q, r: current.r });
                
                // Add adjacent water stones to queue
                for (const nb of this.grid.getNeighbors(current.q, current.r)) {
                    const nbHex = this.grid.getHex(nb.q, nb.r);
                    if (nbHex && nbHex.stone === STONE_TYPES.WATER.name && !visited.has(`${nb.q},${nb.r}`)) {
                        queue.push(nb);
                    }
                }
            }
        }
        
        return waterHexes;
    }
}
