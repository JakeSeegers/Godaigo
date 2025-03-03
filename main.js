// main.js

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('hexCanvas');
    const grid = new HexGrid(canvas);

    // Movement mode
    document.getElementById('move-mode').addEventListener('click', function() {
        grid.mode = 'move';
        grid.selectedStone = null;
        document.getElementById('stone-selector').style.display = 'none';
        document.getElementById('move-mode').classList.add('active');
        document.getElementById('place-mode').classList.remove('active');
        document.querySelectorAll('.stone-button').forEach(b => {
            b.classList.remove('selected');
        });
        grid.calculateMovableHexes();
        grid.updateStatus('Movement mode active. Click a highlighted hex to move.');
        grid.render();
    });

    // Placement mode
    document.getElementById('place-mode').addEventListener('click', function() {
        grid.mode = 'place';
        document.getElementById('stone-selector').style.display = 'flex';
        document.getElementById('move-mode').classList.remove('active');
        document.getElementById('place-mode').classList.add('active');
        grid.updateStatus('Stone placement mode active. Select a stone and click an adjacent hex.');
        grid.render();
    });

    // Stone selection
    document.querySelectorAll('.stone-button').forEach(button => {
        button.addEventListener('click', function() {
            // Clear selections
            document.querySelectorAll('.stone-button').forEach(b => {
                b.classList.remove('selected');
            });
            const stoneType = this.id.split('-')[1];
            if (stoneCounts[stoneType] > 0) {
                grid.selectedStone = STONE_TYPES[stoneType.toUpperCase()];
                grid.updateStatus(`Selected ${stoneType} stone for placement.`);
                this.classList.add('selected');
            } else {
                grid.selectedStone = null;
                grid.updateStatus(`No ${stoneType} stones left in your pool.`);
            }
        });
    });

    // End turn
    document.getElementById('end-turn').addEventListener('click', function() {
        document.getElementById('ap-count').textContent = '5';
        grid.calculateMovableHexes();
        grid.render();
        grid.updateStatus('Turn ended. Action Points restored.');
    });
    
    // Debug button
    const debugBtn = document.createElement('button');
    debugBtn.id = 'debug-button';
    debugBtn.textContent = 'Debug Mode';
    debugBtn.style.marginLeft = '10px';
    
    // Add debug button to the controls
    document.querySelector('.player-info').appendChild(debugBtn);
    
    // Debug mode toggle
    debugBtn.addEventListener('click', function() {
        grid.debugger.toggleDebugMode();
    });

    // Initialize stone counts
    Object.keys(stoneCounts).forEach(updateStoneCount);
    
    // Add testing function to global scope for debugging
    window.runInteractionTests = function() {
        grid.runInteractionTests();
    };
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Press 'T' to run tests
        if (event.key === 't' || event.key === 'T') {
            window.runInteractionTests();
        }
        
        // Press 'R' to reset stone counts
        if (event.key === 'r' || event.key === 'R') {
            Object.keys(stoneCounts).forEach(type => {
                stoneCounts[type] = stoneCapacity[type];
                updateStoneCount(type);
            });
            grid.updateStatus('Stone counts reset.');
        }
        
        // Press 'D' to toggle debug mode
        if (event.key === 'd' || event.key === 'D') {
            grid.debugger.toggleDebugMode();
        }
    });
    
    // Add keyboard shortcut info to the UI
    const shortcutsDiv = document.createElement('div');
    shortcutsDiv.className = 'shortcuts-info';
    shortcutsDiv.innerHTML = `
        <h4>Keyboard Shortcuts</h4>
        <ul>
            <li><strong>T</strong> - Run interaction tests</li>
            <li><strong>R</strong> - Reset stone counts</li>
            <li><strong>D</strong> - Toggle debug mode</li>
        </ul>
    `;
    document.querySelector('.legend').appendChild(shortcutsDiv);
});
