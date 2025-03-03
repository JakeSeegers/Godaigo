// debugTools.js - Debugging tools for stone interactions

class InteractionDebugger {
    constructor(grid) {
        this.grid = grid;
        this.isDebugMode = false;
        this.logHistory = [];
        this.visualMarkers = [];
        this.stepByStepMode = false;
        this.currentStep = 0;
        this.pendingSteps = [];
    }
    
    // Toggle debug mode
    toggleDebugMode() {
        this.isDebugMode = !this.isDebugMode;
        console.log(`Debug mode ${this.isDebugMode ? 'enabled' : 'disabled'}`);
        this.updateDebugUI();
        return this.isDebugMode;
    }
    
    // Log interaction events with timestamping
    logInteraction(event, details) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            event,
            details,
            gridState: this.captureGridState()
        };
        
        this.logHistory.push(logEntry);
        
        if (this.isDebugMode) {
            console.group(`%c${event}`, 'color: #58a4f4; font-weight: bold');
            console.log(`Time: ${timestamp}`);
            console.log('Details:', details);
            console.groupEnd();
            
            // Update visual markers on the grid
            this.updateVisualMarkers(details);
        }
        
        return logEntry;
    }
    
    // Capture the current state of stones on the grid for replay
    captureGridState() {
        const state = {};
        for (const [key, hex] of this.grid.hexes) {
            if (hex.stone) {
                state[key] = {
                    q: hex.q,
                    r: hex.r,
                    stone: hex.stone
                };
            }
        }
        return state;
    }
    
    // Update visual markers on the grid based on debugging info
    updateVisualMarkers(details) {
        this.visualMarkers = [];
        
        // Add markers based on what's being debugged
        if (details.type === 'waterChain') {
            // Mark all hexes in a water chain
            details.waterHexes.forEach(hex => {
                this.visualMarkers.push({
                    q: hex.q,
                    r: hex.r,
                    color: 'rgba(88, 148, 244, 0.4)',
                    label: 'W'
                });
            });
        } else if (details.type === 'fireDestruction') {
            // Mark fire and its target
            this.visualMarkers.push({
                q: details.fire.q,
                r: details.fire.r,
                color: 'rgba(237, 27, 67, 0.4)',
                label: 'F'
            });
            this.visualMarkers.push({
                q: details.target.q,
                r: details.target.r,
                color: 'rgba(255, 255, 0, 0.4)',
                label: 'T'
            });
        } else if (details.type === 'fireWater') {
            // Mark fire and water involved in interaction
            this.visualMarkers.push({
                q: details.fire.q,
                r: details.fire.r,
                color: 'rgba(237, 27, 67, 0.4)',
                label: 'F'
            });
            this.visualMarkers.push({
                q: details.water.q,
                r: details.water.r,
                color: 'rgba(88, 148, 244, 0.4)',
                label: 'W'
            });
        }
        
        // Force a render to show the markers
        this.grid.render();
    }
    
    // Draw debug markers during render
    drawDebugMarkers(ctx, centerX, centerY) {
        if (!this.isDebugMode) return;
        
        for (const marker of this.visualMarkers) {
            const pix = this.grid.axialToPixel(marker.q, marker.r);
            const x = centerX + pix.x;
            const y = centerY + pix.y;
            
            // Draw a semi-transparent circle
            ctx.fillStyle = marker.color;
            ctx.beginPath();
            ctx.arc(x, y, this.grid.hexSize * 0.7, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(marker.label, x, y);
        }
    }
    
    // Enable step-by-step execution of interactions
    enableStepByStep(steps) {
        this.stepByStepMode = true;
        this.currentStep = 0;
        this.pendingSteps = steps;
        this.updateDebugUI();
        return this;
    }
    
    // Execute next step in the interaction sequence
    executeNextStep() {
        if (!this.stepByStepMode || this.currentStep >= this.pendingSteps.length) {
            return false;
        }
        
        const step = this.pendingSteps[this.currentStep];
        this.logInteraction('Step execution', { 
            step: this.currentStep + 1, 
            total: this.pendingSteps.length,
            action: step.action,
            details: step.details
        });
        
        // Execute the actual step
        step.execute();
        
        // Move to next step
        this.currentStep++;
        this.updateDebugUI();
        
        return this.currentStep < this.pendingSteps.length;
    }
    
    // Create a simple debug UI overlay
    updateDebugUI() {
        // Remove existing UI if any
        const existingUI = document.getElementById('debug-panel');
        if (existingUI) {
            existingUI.remove();
        }
        
        if (!this.isDebugMode) return;
        
        // Create debug panel
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.position = 'absolute';
        panel.style.top = '10px';
        panel.style.right = '10px';
        panel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        panel.style.padding = '10px';
        panel.style.borderRadius = '5px';
        panel.style.color = '#fff';
        panel.style.zIndex = 1000;
        
        // Add title
        const title = document.createElement('h3');
        title.textContent = 'Debug Panel';
        title.style.margin = '0 0 10px 0';
        panel.appendChild(title);
        
        // Add controls
        if (this.stepByStepMode) {
            const stepInfo = document.createElement('div');
            stepInfo.textContent = `Step ${this.currentStep} of ${this.pendingSteps.length}`;
            panel.appendChild(stepInfo);
            
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next Step';
            nextBtn.onclick = () => this.executeNextStep();
            panel.appendChild(nextBtn);
        }
        
        // Add test buttons
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Run Tests';
        testBtn.onclick = () => window.runInteractionTests();
        panel.appendChild(testBtn);
        
        // Add clear button
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear Markers';
        clearBtn.onclick = () => {
            this.visualMarkers = [];
            this.grid.render();
        };
        panel.appendChild(clearBtn);
        
        // Add export button
        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export Logs';
        exportBtn.onclick = () => this.exportLogs();
        panel.appendChild(exportBtn);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close Debug';
        closeBtn.onclick = () => this.toggleDebugMode();
        panel.appendChild(closeBtn);
        
        document.body.appendChild(panel);
    }
    
    // Export debug logs as JSON
    exportLogs() {
        const dataStr = JSON.stringify(this.logHistory, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'godaigo-interaction-logs.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }
}
