// animations.js

// Base animation class
class Animation {
    constructor(duration) {
        this.startTime = Date.now();
        this.duration = duration;
        this.completed = false;
    }

    update(now) {
        const elapsed = now - this.startTime;
        const progress = Math.min(1, elapsed / this.duration);
        if (progress >= 1) {
            this.completed = true;
        }
        return progress;
    }
}

// Fire-water chain reaction animation with faster flicker rate
class FireWaterChainAnimation extends Animation {
    constructor(grid, waterHexes, duration = 800) { // Reduced from 1500ms
        super(duration);
        this.grid = grid;
        this.waterHexes = waterHexes.map(hex => `${hex.q},${hex.r}`);
        this.flickerRate = 70; // ms between flickers - faster for more urgent feel
        this.lastFlicker = this.startTime;
        this.flickerState = true;
        this.intensity = 0;
    }

    update(now) {
        const progress = super.update(now);
        
        // Faster flicker effect as animation progresses
        if (now - this.lastFlicker > this.flickerRate) {
            this.flickerState = !this.flickerState;
            this.lastFlicker = now;
            
            // Gradually increase intensity (more red in the water) as animation progresses
            this.intensity = Math.min(0.9, progress * 1.5);
        }
        
        // Store animation state for renderer to use
        this.grid.fireWaterAnimation = {
            hexes: this.waterHexes,
            flickerState: this.flickerState,
            progress: progress,
            intensity: this.intensity
        };
        
        // Mark affected hexes as dirty
        for (const hexKey of this.waterHexes) {
            const parts = hexKey.split(',');
            const q = parseInt(parts[0]);
            const r = parseInt(parts[1]);
            this.grid.markHexDirty(q, r);
        }
        
        // Re-render
        this.grid.renderOptimized();
        
        // When done, remove the animation state
        if (this.completed) {
            this.grid.fireWaterAnimation = null;
        }
    }
}

// FireStoneAnimation for fire destroying other stones
class FireStoneAnimation extends Animation {
    constructor(grid, firePosition, targetPosition, targetStoneType, duration = 500) {
        super(duration);
        this.grid = grid;
        this.firePosition = firePosition; // Fire stone position {q, r}
        this.targetPosition = targetPosition; // Stone being destroyed position {q, r}
        this.targetStoneType = targetStoneType; // Type of stone being destroyed
        this.flickerRate = 50; // ms between flickers - fast for destruction
        this.lastFlicker = this.startTime;
        this.flickerState = true;
        this.intensity = 0;
    }

    update(now) {
        const progress = super.update(now);
        
        // Fast flicker effect for destruction
        if (now - this.lastFlicker > this.flickerRate) {
            this.flickerState = !this.flickerState;
            this.lastFlicker = now;
            
            // Intensity increases as the stone is destroyed
            this.intensity = Math.min(1.0, progress * 2);
        }
        
        // Store animation state for renderer to use
        this.grid.fireAnimation = {
            firePos: `${this.firePosition.q},${this.firePosition.r}`,
            targetPos: `${this.targetPosition.q},${this.targetPosition.r}`,
            stoneType: this.targetStoneType,
            flickerState: this.flickerState,
            progress: progress,
            intensity: this.intensity
        };
        
        // Mark affected hexes as dirty
        this.grid.markHexDirty(this.firePosition.q, this.firePosition.r);
        this.grid.markHexDirty(this.targetPosition.q, this.targetPosition.r);
        
        // Re-render
        this.grid.renderOptimized();
        
        // When done, remove the animation state
        if (this.completed) {
            this.grid.fireAnimation = null;
        }
    }
}

// Controls running animations
class AnimationManager {
    constructor() {
        this.animations = [];
        this.requestId = null;
    }

    addAnimation(animation) {
        this.animations.push(animation);
        // Start the loop if not running
        if (!this.requestId) {
            this.animate();
        }
    }

    clearCompletedAnimations() {
        this.animations = this.animations.filter(anim => !anim.completed);
        // Stop if no animations left
        if (this.animations.length === 0 && this.requestId) {
            cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
    }

    animate() {
        this.requestId = requestAnimationFrame(() => {
            const now = Date.now();
            // Update each animation
            this.animations.forEach(anim => anim.update(now));
            this.clearCompletedAnimations();
            // If there are still animations, keep going
            if (this.animations.length > 0) {
                this.animate();
            }
        });
    }
}
