// hexgrid.js with larger grid

class HexGrid {
    constructor(canvas, radius = 8) { // Increased radius from 5 to 8
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.radius = radius;
        this.hexSize = 18; // Slightly reduced individual hex size
        this.hexes = new Map();
        this.player = { q: 0, r: 0 };
        this.selectedStone = null;
        this.mode = 'move';
        this.movableHexes = [];
        this.animationManager = new AnimationManager();
        this.fireWaterAnimation = null;
        
        // Optimization properties
        this.dirtyHexes = new Set(); // Track only hexes that need redrawing
        this.hexCache = new Map(); // Cache for hex coordinates and pixel positions
        this.lastRenderTime = 0; // For frame rate throttling
        this.targetFPS = 60; // Target frame rate
        this.lastAnimationCount = 0; // Track if animations have changed
        
        // Initialize the debugger
        this.debugger = new InteractionDebugger(this);
        
        // Initialize interaction system
        this.interactionSystem = new StoneInteractionSystem(this);

        this.createGrid();
        // Listen for clicks
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        
        // Add keyboard shortcut for debug mode
        document.addEventListener('keydown', e => {
            if (e.key === 'D' || e.key === 'd') {
                this.debugger.toggleDebugMode();
            }
        });
        
        this.calculateMovableHexes();
        this.render();
    }

    // Build the hex grid
    createGrid() {
        for (let q = -this.radius; q <= this.radius; q++) {
            const r1 = Math.max(-this.radius, -q - this.radius);
            const r2 = Math.min(this.radius, -q + this.radius);
            for (let r = r1; r <= r2; r++) {
                const key = `${q},${r}`;
                this.hexes.set(key, {
                    q, r,
                    stone: null,
                    revealed: (Math.abs(q) < 4 && Math.abs(r) < 4) // Increased initial revealed area
                });
            }
        }
    }

    // The rest of the HexGrid class remains the same...
    // [Include all existing methods from the previous hexgrid.js file]
    
    // Convert axial coords to pixels with caching
    axialToPixel(q, r) {
        const cacheKey = `${q},${r}`;
        if (this.hexCache.has(cacheKey)) {
            return this.hexCache.get(cacheKey);
        }
        
        const x = this.hexSize * (1.5 * q);
        const y = this.hexSize * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
        const result = { x, y };
        
        // Cache the result
        this.hexCache.set(cacheKey, result);
        return result;
    }

    // Convert pixel coords to axial
    pixelToAxial(x, y) {
        x = x - this.canvas.width / 2;
        y = y - this.canvas.height / 2;
        const q = (2 / 3 * x) / this.hexSize;
        const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / this.hexSize;
        return this.cubeToAxial(this.roundCube(this.axialToCube(q, r)));
    }

    axialToCube(q, r) {
        return { x: q, y: -q - r, z: r };
    }

    cubeToAxial(cube) {
        return { q: cube.x, r: cube.z };
    }

    roundCube(cube) {
        let rx = Math.round(cube.x);
        let ry = Math.round(cube.y);
        let rz = Math.round(cube.z);
        const xDiff = Math.abs(rx - cube.x);
        const yDiff = Math.abs(ry - cube.y);
        const zDiff = Math.abs(rz - cube.z);
        if (xDiff > yDiff && xDiff > zDiff) {
            rx = -ry - rz;
        } else if (yDiff > zDiff) {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }
        return { x: rx, y: ry, z: rz };
    }

    getNeighbors(q, r) {
        const dirs = [
            { q: 1, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: -1, r: 0 },
            { q: -1, r: 1 },
            { q: 0, r: 1 }
        ];
        return dirs.map(dir => ({ q: q + dir.q, r: r + dir.r }));
    }

    isValidHex(q, r) {
        const hex = this.hexes.get(`${q},${r}`);
        return hex && hex.revealed;
    }

    getHex(q, r) {
        return this.hexes.get(`${q},${r}`);
    }

    // Mark a hex and its neighbors as needing redraw
    markHexDirty(q, r) {
        const key = `${q},${r}`;
        this.dirtyHexes.add(key);
        
        // Also mark neighbors as dirty (for effects that spill over)
        const neighbors = this.getNeighbors(q, r);
        for (const nb of neighbors) {
            const nbKey = `${nb.q},${nb.r}`;
            this.dirtyHexes.add(nbKey);
        }
    }
    
    // Mark all hexes in potential water chain as dirty
    markWaterChainAreaDirty(startQ, startR) {
        // Simple BFS to find all connected water stones and their neighbors
        let queue = [{ q: startQ, r: startR }];
        let visited = new Set();
        
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.q},${current.r}`;
            if (visited.has(key)) continue;
            visited.add(key);
            
            const hex = this.getHex(current.q, current.r);
            if (!hex) continue;
            
            // Mark this hex as dirty
            this.markHexDirty(current.q, current.r);
            
            // If this is a water stone, check its neighbors
            if (hex.stone === STONE_TYPES.WATER.name) {
                for (const nb of this.getNeighbors(current.q, current.r)) {
                    const nbHex = this.getHex(nb.q, nb.r);
                    if (nbHex && nbHex.stone === STONE_TYPES.WATER.name && !visited.has(`${nb.q},${nb.r}`)) {
                        queue.push(nb);
                    }
                }
            }
        }
    }

    setStone(q, r, stoneType) {
        const hex = this.getHex(q, r);
        if (hex) {
            const oldStone = hex.stone;
            hex.stone = stoneType;
            
            // Mark this hex and its extended neighborhood as dirty
            this.markHexDirty(q, r);
            
            // Mark potential chain reaction area as dirty for water stones
            if (stoneType === STONE_TYPES.WATER.name || oldStone === STONE_TYPES.WATER.name) {
                this.markWaterChainAreaDirty(q, r);
            }
            
            this.processStoneInteractions(q, r);
            this.renderOptimized();
            return true;
        }
        return false;
    }

    // Use the interaction system to process stone interactions
    processStoneInteractions(q, r) {
        this.interactionSystem.processInteraction(q, r);
    }

    triggerWaterFireChainReaction(startQ, startR) {
        this.interactionSystem.triggerWaterFireChainReaction(startQ, startR);
    }

    drawHex(x, y, size, color, strokeColor = '#444', lineWidth = 1) {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (2 * Math.PI / 6) * i;
            const xPos = x + size * Math.cos(angle);
            const yPos = y + size * Math.sin(angle);
            if (i === 0) {
                this.ctx.moveTo(xPos, yPos);
            } else {
                this.ctx.lineTo(xPos, yPos);
            }
        }
        this.ctx.closePath();
        if (color) {
            this.ctx.fillStyle = color;
            this.ctx.fill();
        }
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
    }

    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const axial = this.pixelToAxial(x, y);
        const q = Math.round(axial.q);
        const r = Math.round(axial.r);
        if (!this.isValidHex(q, r)) return;
        if (this.mode === 'place' && this.selectedStone) {
            this.handleStonePlacement(q, r);
        } else if (this.mode === 'move') {
            this.handlePlayerMovement(q, r);
        }
    }

    handleStonePlacement(q, r) {
        const neighbors = this.getNeighbors(this.player.q, this.player.r);
        const isAdjacent = neighbors.some(n => n.q === q && n.r === r);
        if (isAdjacent) {
            const target = this.getHex(q, r);
            if (!target.stone) {
                if (this.setStone(q, r, this.selectedStone.name)) {
                    decrementStoneCount(this.selectedStone.name);
                    this.updateStatus(`Placed ${this.selectedStone.name} stone at (${q},${r})`);
                    this.calculateMovableHexes();
                    this.renderOptimized();
                }
            } else {
                this.updateStatus(`Cannot place stone on an occupied hex.`);
            }
        } else {
            this.updateStatus(`Cannot place stone on a hex that is not adjacent to you.`);
        }
    }

    // --- Wind movement cost functions ---

    // Helper: Checks if a water stone (or chain of water stones) is connected to a stone of the given type.
    isWaterChainMimicking(type, q, r) {
        const startHex = this.getHex(q, r);
        if (!startHex || startHex.stone !== STONE_TYPES.WATER.name) return false;
        let visited = new Set();
        let queue = [{ q, r }];
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.q},${current.r}`;
            if (visited.has(key)) continue;
            visited.add(key);
            const currHex = this.getHex(current.q, current.r);
            if (!currHex || !currHex.revealed) continue;
            const neighbors = this.getNeighbors(current.q, current.r);
            for (const nb of neighbors) {
                const nbHex = this.getHex(nb.q, nb.r);
                if (!nbHex || !nbHex.revealed) continue;
                // If an adjacent hex is of the desired type...
                if (nbHex.stone === type) {
                    // For wind, ensure it's active.
                    if (type === STONE_TYPES.WIND.name) {
                        if (this.isWindActive(nbHex)) return true;
                    } else {
                        return true;
                    }
                }
                // Continue searching through connected water stones.
                if (nbHex.stone === STONE_TYPES.WATER.name && !visited.has(`${nb.q},${nb.r}`)) {
                    queue.push(nb);
                }
            }
        }
        return false;
    }

    // Returns true if the hex is in a wind zone (active wind or water mimicking wind)
    isWindZone(q, r) {
        const hex = this.getHex(q, r);
        if (hex) {
            if (hex.stone === STONE_TYPES.WIND.name && this.isWindActive(hex)) {
                return true;
            }
            if (hex.stone === STONE_TYPES.WATER.name && this.isWaterChainMimicking(STONE_TYPES.WIND.name, q, r)) {
                return true;
            }
        }
        const neighbors = this.getNeighbors(q, r);
        for (const nb of neighbors) {
            const nbHex = this.getHex(nb.q, nb.r);
            if (nbHex) {
                if (nbHex.stone === STONE_TYPES.WIND.name && this.isWindActive(nbHex)) {
                    return true;
                }
                if (nbHex.stone === STONE_TYPES.WATER.name && this.isWaterChainMimicking(STONE_TYPES.WIND.name, nb.q, nb.r)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Checks if a wind stone is active (not interfered with by an adjacent void stone)
    isWindActive(hex) {
        const neighbors = this.getNeighbors(hex.q, hex.r);
        for (const nb of neighbors) {
            const nbHex = this.getHex(nb.q, nb.r);
            if (nbHex && nbHex.stone === STONE_TYPES.VOID.name) {
                return false;
            }
        }
        return true;
    }

    // Returns the normal movement cost without wind zone transitions.
    getNormalMovementCost(q, r) {
        const hex = this.getHex(q, r);
        if (!hex || !hex.revealed) return Infinity;
        if (!hex.stone) return 1;
        
        // Special case for water stones
        if (hex.stone === STONE_TYPES.WATER.name) {
            // Check for each adjacent stone type by priority (void > wind > fire > earth)
            
            // If adjacent to void, use void cost
            if (this.hasAdjacentStoneType(q, r, STONE_TYPES.VOID.name)) {
                return 1; // Void cost
            }
            
            // If adjacent to wind and wind is active, use wind cost
            const adjacentToWind = this.hasAdjacentStoneType(q, r, STONE_TYPES.WIND.name);
            if (adjacentToWind) {
                // Find an adjacent wind stone
                for (const nb of this.getNeighbors(q, r)) {
                    const nbHex = this.getHex(nb.q, nb.r);
                    if (nbHex && nbHex.stone === STONE_TYPES.WIND.name && this.isWindActive(nbHex)) {
                        return 0; // Wind cost
                    }
                }
            }
            
            // If adjacent to fire, use fire cost
            if (this.hasAdjacentStoneType(q, r, STONE_TYPES.FIRE.name)) {
                return Infinity; // Fire cost
            }
            
            // If adjacent to earth, use earth cost (impassable)
            if (this.hasAdjacentStoneType(q, r, STONE_TYPES.EARTH.name)) {
                return Infinity; // Earth cost - impassable
            }
            
            // Default water cost if not mimicking anything
            return 2;
        }
        
        // Standard costs for other stone types
        const costs = {
            [STONE_TYPES.EARTH.name]: Infinity,
            [STONE_TYPES.WATER.name]: 2,
            [STONE_TYPES.FIRE.name]: Infinity,
            [STONE_TYPES.WIND.name]: 0,
            [STONE_TYPES.VOID.name]: 1
        };
        return costs[hex.stone];
    }

    // Calculates movement cost from the current hex to a destination hex,
    // considering wind zone transitions.
    getMovementCostFrom(fromQ, fromR, toQ, toR) {
        const fromInWind = this.isWindZone(fromQ, fromR);
        const toInWind = this.isWindZone(toQ, toR);
        if (fromInWind && toInWind) return 0;
        if ((!fromInWind && toInWind) || (fromInWind && !toInWind)) return 1;
        return this.getNormalMovementCost(toQ, toR);
    }

    // Movement handler using movement cost calculation
    handlePlayerMovement(q, r) {
        const isMovable = this.movableHexes.some(h => h.q === q && h.r === r);
        if (isMovable) {
            const cost = this.getMovementCostFrom(this.player.q, this.player.r, q, r);
            if (cost !== Infinity) {
                let currentAP = parseInt(document.getElementById('ap-count').textContent);
                const voidCount = stoneCounts[STONE_TYPES.VOID.name];
                const effectiveAP = currentAP + voidCount;
                if (effectiveAP >= cost) {
                    let costRemaining = cost;
                    if (currentAP >= costRemaining) {
                        currentAP -= costRemaining;
                        costRemaining = 0;
                    } else {
                        costRemaining -= currentAP;
                        currentAP = 0;
                    }
                    if (costRemaining > 0) {
                        stoneCounts[STONE_TYPES.VOID.name] -= costRemaining;
                        updateStoneCount(STONE_TYPES.VOID.name);
                    }
                    document.getElementById('ap-count').textContent = currentAP;
                    
                    // Mark old and new positions as dirty
                    this.markHexDirty(this.player.q, this.player.r);
                    this.markHexDirty(q, r);
                    
                    this.player.q = q;
                    this.player.r = r;
                    this.revealAdjacentHexes(q, r);
                    this.updateStatus(`Moved to (${q},${r}), cost: ${cost} (AP + Void).`);
                    this.calculateMovableHexes();
                    this.renderOptimized();
                } else {
                    this.updateStatus(`Not enough AP (need ${cost}, have ${effectiveAP}).`);
                }
            } else {
                this.updateStatus(`Hex is impassable.`);
            }
        } else {
            this.updateStatus(`Cannot move there.`);
        }
    }

    // Calculate movable hexes based on movement costs
    calculateMovableHexes() {
        this.movableHexes = [];
        const neighbors = this.getNeighbors(this.player.q, this.player.r);
        const currentAP = parseInt(document.getElementById('ap-count').textContent);
        const voidCount = stoneCounts[STONE_TYPES.VOID.name];
        const effectiveAP = currentAP + voidCount;
        
        for (const nb of neighbors) {
            if (!this.isValidHex(nb.q, nb.r)) continue;
            
            const cost = this.getMovementCostFrom(this.player.q, this.player.r, nb.q, nb.r);
            if (cost !== Infinity && cost <= effectiveAP) {
                this.movableHexes.push({ q: nb.q, r: nb.r, cost: cost });
                // Mark as dirty to ensure visual update
                this.markHexDirty(nb.q, nb.r);
            }
        }
    }

    revealAdjacentHexes(q, r) {
        const neighbors = this.getNeighbors(q, r);
        for (const nb of neighbors) {
            const hex = this.getHex(nb.q, nb.r);
            if (hex && !hex.revealed) {
                hex.revealed = true;
                this.markHexDirty(nb.q, nb.r);
            }
        }
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }

    // Find and draw water stone connections
    findWaterConnections() {
        const connections = [];
        const visited = new Set();
        
        // Look through all hexes to find water stones
        for (const [key, hex] of this.hexes) {
            if (!hex.revealed || hex.stone !== STONE_TYPES.WATER.name || visited.has(key)) continue;
            
            // For each unvisited water stone, find its water neighbors
            for (const nb of this.getNeighbors(hex.q, hex.r)) {
                const nbHex = this.getHex(nb.q, nb.r);
                const nbKey = `${nb.q},${nb.r}`;
                
                if (nbHex && nbHex.revealed && nbHex.stone === STONE_TYPES.WATER.name && !visited.has(nbKey)) {
                    // Add a connection between these two water stones
                    connections.push({
                        from: { q: hex.q, r: hex.r },
                        to: { q: nb.q, r: nb.r },
                        mimicType: this.getWaterMimicType(hex.q, hex.r)
                    });
                }
            }
            
            visited.add(key);
        }
        
        return connections;
    }

    // Helper to find the type being mimicked by a water stone
    getWaterMimicType(q, r) {
        // Check adjacent stones in priority order
        const priority = [
            STONE_TYPES.VOID.name,
            STONE_TYPES.WIND.name,
            STONE_TYPES.FIRE.name,
            STONE_TYPES.EARTH.name
        ];
        
        for (const type of priority) {
            if (this.hasAdjacentStoneType(q, r, type)) {
                return type;
            }
        }
        
        // Check for mimicry through connected water
        for (const type of priority) {
            if (this.isWaterChainMimicking(type, q, r)) {
                return type;
            }
        }
        
        return null;
    }

    // Draw water connections
    drawWaterConnections() {
        const connections = this.findWaterConnections();
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.ctx.save(); // Save current context state
        
        // Use a wider line to make connections more visible
        this.ctx.lineWidth = 3;
        
        for (const conn of connections) {
            const fromPix = this.axialToPixel(conn.from.q, conn.from.r);
            const toPix = this.axialToPixel(conn.to.q, conn.to.r);
            
            const x1 = centerX + fromPix.x;
            const y1 = centerY + fromPix.y;
            const x2 = centerX + toPix.x;
            const y2 = centerY + toPix.y;
            
            // Draw connection line
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            
            // Set line style based on mimic type
            if (conn.mimicType) {
                const stoneInfo = Object.values(STONE_TYPES).find(s => s.name === conn.mimicType);
                if (stoneInfo) {
                    this.ctx.strokeStyle = stoneInfo.color;
                    this.ctx.setLineDash([5, 3]); // Dashed line for mimicry
                } else {
                    this.ctx.strokeStyle = STONE_TYPES.WATER.color;
                    this.ctx.setLineDash([]); // Solid line for no mimicry
                }
            } else {
                this.ctx.strokeStyle = STONE_TYPES.WATER.color;
                this.ctx.setLineDash([]); // Solid line for no mimicry
            }
            
            this.ctx.globalAlpha = 0.7; // Make connections slightly more visible
            this.ctx.stroke();
        }
        
        this.ctx.restore(); // Restore context to previous state
    }
    
    // Original render method for full renders
    render() {
        // Mark all hexes as dirty to force a full redraw
        for (const [key, hex] of this.hexes) {
            if (hex.revealed) {
                this.dirtyHexes.add(key);
            }
        }
        this.renderOptimized();
    }
    
    // Optimized render method
    renderOptimized() {
        const now = performance.now();
        const elapsed = now - this.lastRenderTime;
        const frameTime = 1000 / this.targetFPS;
        
        // Skip render if too soon and no urgent changes
        if (elapsed < frameTime && 
            this.animationManager.animations.length === this.lastAnimationCount && 
            this.dirtyHexes.size < 5) {
            return;
        }
        
        this.lastRenderTime = now;
        this.lastAnimationCount = this.animationManager.animations.length;
        
        // Clear previous canvas to prevent artifacts
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw all revealed hexes - more reliable than partial updates for this game
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        for (const [key, hex] of this.hexes) {
            if (hex.revealed) {
                const pix = this.axialToPixel(hex.q, hex.r);
                const x = centerX + pix.x;
                const y = centerY + pix.y;
                this.renderSingleHex(hex, x, y);
            }
        }
        
        // Draw water connections
        this.drawWaterConnections();
        
        // Draw debug markers if debug mode is active
        this.debugger.drawDebugMarkers(this.ctx, centerX, centerY);
        
        this.dirtyHexes.clear();
    }
    
    // Helper to render a single hex
    renderSingleHex(hex, x, y) {
        // First draw the hex background
        let fillColor = '#2a2a2a';
        const isMovable = (this.mode === 'move' && this.movableHexes.some(h => h.q === hex.q && h.r === hex.r));
        if (isMovable) {
            const moveCost = this.getMovementCostFrom(this.player.q, this.player.r, hex.q, hex.r);
            fillColor = (moveCost === 0) ? '#1a3a2a' : '#1a2a3a';
        } else if (this.mode === 'place' &&
                   this.getNeighbors(this.player.q, this.player.r).some(n => n.q === hex.q && n.r === hex.r) &&
                   !hex.stone) {
            fillColor = '#3a2a3a';
        }
        const hasWindNeighbor = this.hasAdjacentStoneType(hex.q, hex.r, STONE_TYPES.WIND.name);
        if (hasWindNeighbor) {
            fillColor = this.blendColors(fillColor, STONE_TYPES.WIND.color, 0.2);
        }
        
        // Draw the base hex with filled background
        this.drawHex(x, y, this.hexSize, fillColor);
        
        // Draw movable hex outline and cost ONLY if it's really movable
        if (isMovable) {
            const moveCost = this.getMovementCostFrom(this.player.q, this.player.r, hex.q, hex.r);
            const outlineColor = (moveCost === 0) ? STONE_TYPES.WIND.color : '#58a4f4';
            
            // Draw the outline with a thicker stroke
            this.drawHex(x, y, this.hexSize, null, outlineColor, 2);
            
            // Draw the movement cost with better positioning
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Position the cost at the bottom of the hex for better visibility
            this.ctx.fillText(moveCost.toString(), x, y + this.hexSize * 0.6);
        }
        
        // Draw stone if exists
        if (hex.stone) {
            const stoneInfo = Object.values(STONE_TYPES).find(s => s.name === hex.stone);
            if (stoneInfo) {
                let fillStyle = stoneInfo.color;
                
                // Handle fire-water chain animation
                if (this.fireWaterAnimation &&
                    hex.stone === STONE_TYPES.WATER.name &&
                    this.fireWaterAnimation.hexes.includes(`${hex.q},${hex.r}`)) {
                    if (this.fireWaterAnimation.flickerState) {
                        // Use the intensity parameter for a more dramatic effect
                        fillStyle = this.blendColors(STONE_TYPES.WATER.color, STONE_TYPES.FIRE.color, this.fireWaterAnimation.intensity || 0.7);
                    }
                }
                
                // Handle fire destruction animation
                if (this.fireAnimation) {
                    // If this hex is the target being destroyed
                    if (`${hex.q},${hex.r}` === this.fireAnimation.targetPos) {
                        // Flickering effect
                        if (this.fireAnimation.flickerState) {
                            fillStyle = this.blendColors(fillStyle, STONE_TYPES.FIRE.color, this.fireAnimation.intensity || 0.7);
                            
                            // Add glowing outline for dramatic effect
                            this.drawHex(x, y, this.hexSize * 0.8, null, STONE_TYPES.FIRE.color, 2);
                        }
                        
                        // Add burning particles
                        if (Math.random() > 0.5) {
                            this.drawParticles(x, y, STONE_TYPES.FIRE.color, 3);
                        }
                    }
                    
                    // If this hex is the fire causing the destruction
                    if (`${hex.q},${hex.r}` === this.fireAnimation.firePos) {
                        // Pulsating effect
                        const pulseSize = 1 + 0.2 * Math.sin(Date.now() / 50);
                        this.drawHex(x, y, this.hexSize * 0.8 * pulseSize, null, STONE_TYPES.FIRE.color, 2);
                    }
                }
                
                // Draw the stone symbol
                this.ctx.fillStyle = fillStyle;
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(stoneInfo.symbol, x, y);
                
                // Draw water mimicry indicator
                if (hex.stone === STONE_TYPES.WATER.name) {
                    this.drawWaterMimicryIndicator(hex, x, y);
                }
                
                // Draw wind outline
                if (hex.stone === STONE_TYPES.WIND.name) {
                    this.drawHex(x, y, this.hexSize * 0.8, null, STONE_TYPES.WIND.color, 1);
                }
            }
        }
        
        // Draw player if on this hex
        if (hex.q === this.player.q && hex.r === this.player.r) {
            this.ctx.fillStyle = 'white';
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.hexSize / 2, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }
    
    // Helper method to draw particle effects
    drawParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.hexSize * 0.8;
            const size = 1 + Math.random() * 2;
            
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance;
            
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(px, py, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawWaterMimicryIndicator(hex, x, y) {
        let mimicked = null;
        // Priority: Earth > Fire > Wind > Void.
        const priority = [
            STONE_TYPES.EARTH.name,
            STONE_TYPES.FIRE.name,
            STONE_TYPES.WIND.name,
            STONE_TYPES.VOID.name
        ];
        for (const type of priority) {
            if (this.hasAdjacentStoneType(hex.q, hex.r, type) || this.isWaterChainMimicking(type, hex.q, hex.r)) {
                mimicked = type;
                break;
            }
        }
        if (mimicked) {
            const stoneInfo = Object.values(STONE_TYPES).find(s => s.name === mimicked);
            this.ctx.globalAlpha = 0.5;
            this.drawHex(x, y, this.hexSize / 3, stoneInfo.color);
            this.ctx.globalAlpha = 1.0;
            this.ctx.font = '10px Arial';
            this.ctx.fillStyle = stoneInfo.color;
            this.ctx.fillText(stoneInfo.symbol, x, y);
        }
    }

    hasAdjacentStoneType(q, r, stoneType) {
        for (const nb of this.getNeighbors(q, r)) {
            const hex = this.getHex(nb.q, nb.r);
            if (hex && hex.stone === stoneType) {
                return true;
            }
        }
        return false;
    }

    blendColors(color1, color2, weight) {
        const parseColor = (color) => {
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return [r, g, b];
            } else {
                const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (match) {
                    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
                }
                return [0, 0, 0];
            }
        };
        const [r1, g1, b1] = parseColor(color1);
        const [r2, g2, b2] = parseColor(color2);
        const r = Math.round(r1 * (1 - weight) + r2 * weight);
        const g = Math.round(g1 * (1 - weight) + g2 * weight);
        const b = Math.round(b1 * (1 - weight) + b2 * weight);
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Testing function for water/fire interactions
    runInteractionTests() {
        this.updateStatus("Running stone interaction tests...");
        
        // Clear part of the grid for testing
        for (let q = -2; q <= 2; q++) {
            for (let r = -2; r <= 2; r++) {
                const hex = this.getHex(q, r);
                if (hex) hex.stone = null;
            }
        }
        
        // Test 1: Fire + Fire - Both should remain
        this.setStone(0, 0, STONE_TYPES.FIRE.name);
        this.setStone(1, 0, STONE_TYPES.FIRE.name);
        
        // Check if both fire stones still exist after interaction
        setTimeout(() => {
            const fire1 = this.getHex(0, 0).stone === STONE_TYPES.FIRE.name;
            const fire2 = this.getHex(1, 0).stone === STONE_TYPES.FIRE.name;
            
            if (fire1 && fire2) {
                this.updateStatus("Test 1 passed: Fire stones do not destroy each other");
            } else {
                this.updateStatus("Test 1 failed: Fire stones should not destroy each other");
            }
            
            // Trigger next test after a delay
            setTimeout(() => this.runTest2(), 1500);
        }, 500);
    }
    
    runTest2() {
        // Clear test area
        for (let q = -2; q <= 2; q++) {
            for (let r = -2; r <= 2; r++) {
                const hex = this.getHex(q, r);
                if (hex) hex.stone = null;
            }
        }
        
        // Test 2: Fire + Water Chain
        this.setStone(0, 0, STONE_TYPES.WATER.name);
        this.setStone(0, 1, STONE_TYPES.WATER.name);
        this.setStone(1, 0, STONE_TYPES.WATER.name);
        
        // Place fire next to one water
        this.setStone(-1, 0, STONE_TYPES.FIRE.name);
        
        // Check if all water stones are consumed
        setTimeout(() => {
            const water1 = this.getHex(0, 0).stone;
            const water2 = this.getHex(0, 1).stone;
            const water3 = this.getHex(1, 0).stone;
            
            if (!water1 && !water2 && !water3) {
                this.updateStatus("Test 2 passed: All water stones in chain are consumed");
            } else {
                this.updateStatus(`Test 2 failed: Not all water stones consumed (${water1}, ${water2}, ${water3})`);
            }
            
            // Run test 3 after a delay
            setTimeout(() => this.runTest3(), 1500);
        }, 1500);
    }
    
    runTest3() {
        // Clear test area
        for (let q = -2; q <= 2; q++) {
            for (let r = -2; r <= 2; r++) {
                const hex = this.getHex(q, r);
                if (hex) hex.stone = null;
            }
        }
        
        // Test 3: Placing water next to existing fire
        this.updateStatus("Test 3: Placing water next to existing fire");
        
        // Place fire first
        this.setStone(-1, 0, STONE_TYPES.FIRE.name);
        
        // Then place water next to it
        this.setStone(0, 0, STONE_TYPES.WATER.name);
        
        // Check if water is consumed
        setTimeout(() => {
            const fire = this.getHex(-1, 0).stone === STONE_TYPES.FIRE.name;
            const water = this.getHex(0, 0).stone;
            
            if (fire && !water) {
                this.updateStatus("Test 3 passed: Water placed next to fire is consumed");
            } else {
                this.updateStatus(`Test 3 failed: Water should be consumed when placed next to fire`);
            }
            
            // Run test 4 - water chain when placing next to fire
            setTimeout(() => this.runTest4(), 1500);
        }, 1500);
    }
    
    runTest4() {
        // Clear test area
        for (let q = -2; q <= 2; q++) {
            for (let r = -2; r <= 2; r++) {
                const hex = this.getHex(q, r);
                if (hex) hex.stone = null;
            }
        }
        
        // Test 4: Water chain when placing next to fire
        this.updateStatus("Test 4: Water chain when placing water next to fire");
        
        // Place fire first
        this.setStone(-1, 0, STONE_TYPES.FIRE.name);
        
        // Add water chain
        this.setStone(1, 0, STONE_TYPES.WATER.name);
        this.setStone(1, 1, STONE_TYPES.WATER.name);
        
        // Place water next to fire but connected to chain
        this.setStone(0, 0, STONE_TYPES.WATER.name);
        
        // Check if all water stones are consumed
        setTimeout(() => {
            const fire = this.getHex(-1, 0).stone === STONE_TYPES.FIRE.name;
            const water1 = this.getHex(0, 0).stone;
            const water2 = this.getHex(1, 0).stone;
            const water3 = this.getHex(1, 1).stone;
            
            if (fire && !water1 && !water2 && !water3) {
                this.updateStatus("Test 4 passed: All water stones in chain are consumed");
            } else {
                this.updateStatus("Test 4 failed: Not all water stones were consumed");
            }
            
            // Run test 5 - earth stone destroyed by fire
            setTimeout(() => this.runTest5(), 1500);
        }, 1500);
    }
    
    runTest5() {
        // Clear test area
        for (let q = -2; q <= 2; q++) {
            for (let r = -2; r <= 2; r++) {
                const hex = this.getHex(q, r);
                if (hex) hex.stone = null;
            }
        }
        
        // Test 5: Earth stone placed next to fire
        this.updateStatus("Test 5: Earth stone placed next to fire");
        
        // Place fire first
        this.setStone(-1, 0, STONE_TYPES.FIRE.name);
        
        // Place earth next to fire
        this.setStone(0, 0, STONE_TYPES.EARTH.name);
        
        // Check if earth is destroyed
        setTimeout(() => {
            const fire = this.getHex(-1, 0).stone === STONE_TYPES.FIRE.name;
            const earth = this.getHex(0, 0).stone;
            
            if (fire && !earth) {
                this.updateStatus("Test 5 passed: Earth stone was destroyed by fire");
            } else {
                this.updateStatus("Test 5 failed: Earth stone should be destroyed by fire");
            }
            
            // Run test 6 - void nullifies fire's destruction
            setTimeout(() => this.runTest6(), 1500);
        }, 500);
    }
    
    runTest6() {
        // Clear test area
        for (let q = -2; q <= 2; q++) {
            for (let r = -2; r <= 2; r++) {
                const hex = this.getHex(q, r);
                if (hex) hex.stone = null;
            }
        }
        
        // Test 6: Void nullifies fire's destruction
        this.updateStatus("Test 6: Void nullifies fire's destruction ability");
        
        // Place fire and void stones
        this.setStone(-1, 0, STONE_TYPES.FIRE.name);
        this.setStone(-2, 0, STONE_TYPES.VOID.name); // Void adjacent to fire
        
        // Place earth next to fire
        this.setStone(0, 0, STONE_TYPES.EARTH.name);
        
        // Check if earth survives due to void nullifying fire
        setTimeout(() => {
            const fire = this.getHex(-1, 0).stone === STONE_TYPES.FIRE.name;
            const void1 = this.getHex(-2, 0).stone === STONE_TYPES.VOID.name;
            const earth = this.getHex(0, 0).stone === STONE_TYPES.EARTH.name;
            
            if (fire && void1 && earth) {
                this.updateStatus("Test 6 passed: Void stone nullified fire's destruction ability");
            } else {
                this.updateStatus("Test 6 failed: Earth should survive when void nullifies fire");
            }
            
            // Test 7: Water Chain Mimicry
            setTimeout(() => this.runTest7(), 1500);
        }, 500);
    }
    
    runTest7() {
        // Clear test area
        for (let q = -2; q <= 2; q++) {
            for (let r = -2; r <= 2; r++) {
                const hex = this.getHex(q, r);
                if (hex) hex.stone = null;
            }
        }
        
        // Test 7: Water chain mimicking wind
        this.updateStatus("Test 7: Water chain mimicking wind");
        
        // Create a water chain
        this.setStone(0, 0, STONE_TYPES.WATER.name);
        this.setStone(1, 0, STONE_TYPES.WATER.name);
        this.setStone(1, 1, STONE_TYPES.WATER.name);
        
        // Place wind next to one water
        this.setStone(2, 1, STONE_TYPES.WIND.name);
        
        // Check mimicry
        setTimeout(() => {
            // Move player near the water chain
            this.player.q = -1;
            this.player.r = 0;
            this.calculateMovableHexes();
            
            // Check if movement cost to the first water is 0 (wind mimicry)
            const moveCost = this.getMovementCostFrom(this.player.q, this.player.r, 0, 0);
            
            if (moveCost === 0) {
                this.updateStatus("Test 7 passed: Water chain mimicking wind for movement");
            } else {
                this.updateStatus(`Test 7 failed: Water should mimic wind (cost: ${moveCost})`);
            }
            
            this.render();
        }, 500);
    }
}
