/**
 * Pattern Loader Module
 * Handles loading, parsing, and managing cross-stitch patterns
 */

class PatternLoader {
    constructor() {
        this.currentPattern = null;
        this.originalPattern = null;
        this.changes = [];
        this.changeCounter = 0;
        this.availablePatterns = [
            'json/cubs.json',
            'json/liverpool.json',
            'json/japan.json',
            'json/amsterdam.json',
            'json/northern.json'
            /* 'json/cuphead.json',
            'json/dino.json',
            'json/amsterdam.json',
            'json/african.json',
            'json/messi.json' */
        ];
        this.currentIndex = 0;
    }

    /**
     * Load a pattern from a JSON file
     * @param {string} patternPath - Path to the JSON file
     * @returns {Promise<Object>} Processed pattern data
     */
    async loadPattern(patternPath) {
        try {
            const response = await fetch(patternPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawData = await response.json();
            return this.loadJSON(rawData);
        } catch (error) {
            console.error('Failed to load pattern:', error);
            throw new Error(`Pattern loading failed: ${error.message}`);
        }
    }

    /**
     * Load the next pattern in the available patterns list
     * @returns {Promise<Object>} Processed pattern data
     */
    async loadNextPattern() {
        this.currentIndex = (this.currentIndex + 1) % this.availablePatterns.length;
        return this.loadPattern(this.availablePatterns[this.currentIndex]);
    }

    /**
     * Load pattern from a File object (user uploaded file)
     * @param {File} file - The uploaded file
     * @returns {Promise<Object>} Processed pattern data
     */
    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    const processedData = this.loadJSON(data);
                    resolve(processedData);
                } catch (error) {
                    reject(new Error('Invalid pattern file format'));
                }
            };
            reader.onerror = () => reject(new Error('File reading failed'));
            reader.readAsText(file);
        });
    }

    /**
     * Process raw JSON data into usable pattern format
     * @param {Object} data - Raw JSON data
     * @returns {Object} Processed pattern data
     */
    loadJSON(data) {
        // Validate data structure
        if (!this.validatePattern(data)) {
            throw new Error('Invalid pattern data structure');
        }

        // Convert stitches to array format
        data = this.convertFileToStitches(data);

        // Store original and current state
        this.originalPattern = JSON.parse(JSON.stringify(data));
        this.currentPattern = data;

        // Reset changes
        this.changes = [];
        this.changeCounter = 0;

        return data;
    }

    /**
     * Convert compressed stitch string to array format
     * @param {Object} data - Pattern data with compressed stitches
     * @returns {Object} Pattern data with stitch array
     */
    convertFileToStitches(data) {
        const newStitches = [];

        // New format:
        //   - Rows separated by ":"
        //   - Stitches in a row show how many consecutive stitches of the same color there are followed by the color ID
        const rows = data.stitches.split(":");
        let stitchIndex = 0;
        for (const row of rows) {
            const stitches = row.split(",");
            for (const stitch of stitches) {
                if(stitch.trim() === "") continue;
                const [countStr, dmcID] = stitch.split("-");
                const count = parseInt(countStr);
                for (let i = 0; i < count; i++) {
                    const x = stitchIndex % data.properties.width;
                    const y = Math.floor(stitchIndex / data.properties.width);
                    newStitches.push({
                        "X": x,
                        "Y": y,
                        "dmcCode": this.getCodeFromId(data, dmcID)
                    });
                    stitchIndex++;
                }
            }
        } 

        return {
            stitches: newStitches,
            properties: data.properties,
            colors: data.colors
        };
    }

    /**
     * Convert stitch array back to compressed string format
     * @param {Object} data - Pattern data with stitch array
     * @returns {Object} Pattern data with compressed stitches
     */
    convertStitchesToFile(data) {
        let newStitches = "";
        let currentCode = "";
        let startId = 0;

        // New format: 
        //   - Rows separated by ":"
        //   - Stitches in a row show how many consecutive stitches of the same color there are followed by the color ID
        for (let y = 0; y < data.properties.height; y++) {
            if (y > 0) newStitches += ":";
            let count = 0;
            let lastCode = null;
            for (let x = 0; x < data.properties.width; x++) {
                const stitch = data.stitches[y * data.properties.width + x];
                const code = stitch.dmcCode;
                if (code === lastCode) {
                    count++;
                } else {
                    if (lastCode !== null) {
                        if (newStitches) newStitches += ",";
                        newStitches += `${count}-${this.getIDFromCode(data, lastCode)}`;
                    }
                    lastCode = code;
                    count = 1;
                }
            }
            // Write remaining stitches in the row
            if (lastCode !== null) {
                if (newStitches) newStitches += ",";
                newStitches += `${count}-${this.getIDFromCode(data, lastCode)}`;
            }
        }

        return {
            stitches: newStitches,
            properties: data.properties,
            colors: data.colors
        };
    }

    /**
     * Record a change to the pattern
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} dmcCode - New DMC code
     * @param {string} originalCode - Original DMC code
     */
    recordChange(x, y, dmcCode, originalCode) {
        this.changes.push({
            X: x,
            Y: y,
            dmcCode: dmcCode,
            originalCode: originalCode,
            timestamp: new Date(),
            id: this.changeCounter
        });
    }

    /**
     * Merge recorded changes into the current pattern
     * @returns {Object} Updated pattern with changes applied
     */
    mergeChanges() {
        if (!this.originalPattern) return null;

        const merged = JSON.parse(JSON.stringify(this.originalPattern));

        // Apply all changes
        for (const change of this.changes) {
            const stitchIndex = merged.stitches.findIndex(
                s => s.X === change.X && s.Y === change.Y
            );
            if (stitchIndex !== -1) {
                merged.stitches[stitchIndex].dmcCode = change.dmcCode;
            }
        }

        this.currentPattern = merged;
        return merged;
    }

    /**
     * Undo the last change
     * @returns {Object} Updated pattern after undo
     */
    undoLastChange() {
        if (this.changes.length > 0) {
            this.changes.pop();
            this.changeCounter--;
            return this.mergeChanges();
        }
        return this.currentPattern;
    }

    /**
     * Get the current pattern with all changes applied
     * @returns {Object} Current pattern state
     */
    getCurrentPattern() {
        return this.currentPattern || this.mergeChanges();
    }

    /**
     * Get cols
     */
    getCols() {
        return this.currentPattern ? this.currentPattern.properties.width : 0;
    }

    /**
     * Get rows
     */
    getRows() {
        return this.currentPattern ? this.currentPattern.properties.height : 0;
    }   
    
    /**
     * Get pattern statistics
     * @returns {Object} Pattern information
     */
    getPatternInfo() {
        if (!this.currentPattern) return null;

        const { properties, stitches } = this.currentPattern;
        const totalStitches = stitches.length;
        const stitchedStitches = stitches.filter(s => s.dmcCode !== 'empty').length;
        const uniqueColors = new Set(stitches.map(s => s.dmcCode)).size;

        return {
            dimensions: `${properties.width}x${properties.height}`,
            totalStitches,
            stitchedStitches,
            uniqueColors,
            completionPercentage: ((stitchedStitches / totalStitches) * 100).toFixed(1),
            changesCount: this.changes.length
        };
    }

    /**
     * Validate pattern data structure
     * @param {Object} data - Pattern data to validate
     * @returns {boolean} True if valid
     */
    validatePattern(data) {
        return (
            data &&
            data.properties &&
            typeof data.properties.width === 'number' &&
            typeof data.properties.height === 'number' &&
            data.stitches &&
            Array.isArray(data.colors)
        );
    }

    /**
     * Export current pattern to JSON file
     * @returns {Object} Exportable pattern data
     */
    exportPattern() {
        if (!this.currentPattern) return null;

        const exportData = this.convertStitchesToFile(this.currentPattern);
        exportData.metadata = {
            exportedAt: new Date().toISOString(),
            changesApplied: this.changes.length,
            completion: this.getPatternInfo().completionPercentage
        };

        return exportData;
    }

    /**
     * Reset pattern to original state
     */
    resetPattern() {
        this.changes = [];
        this.changeCounter = 0;
        this.currentPattern = JSON.parse(JSON.stringify(this.originalPattern));
    }

    getCodeFromId(data, id) {
        for (const color of data.colors) {
            if (color.id === id) {
                return color.dmcCode;
            }
        }
        return null;
    }

    getIDFromCode(data, dmcCode) {
        for (const color of data.colors) {
            if (color.dmcCode === dmcCode) {
                return color.id;
            }
        }
        return null;
    }
}

// Export for use in other modules
export default PatternLoader;