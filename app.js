// ==================== GLOBAL STATE ====================
const state = {
    // Data
    rawData: [],           // Raw parsed CSV data
    headers: [],           // Column headers
    coordinates: [],       // [{x, y}] - processed coordinates
    pointLabels: [],       // Current label for each point (edited)
    originalLabels: [],    // Original labels from metadata (never changes)
    uploadedFileName: '',  // Uploaded file name

    // Labels with properties
    labels: [],            // [{id, text, color, fontSize, visible}]
    labelPositions: {},    // {labelId: {x, y, fx, fy}}

    // Original grouping for dot coloring
    originalGroups: {},    // {groupName: color}
    pointToGroup: [],      // Array mapping each point to its original group name

    // Column mapping
    xColumn: null,
    yColumn: null,
    labelColumn: null,

    // Display settings
    plotWidth: 800,
    plotHeight: 600,
    pointSize: 3,
    pointOpacity: 0.6,
    unitPref: 'px',        // 'px', 'inch', or 'cm'

    // Scales
    xScale: null,
    yScale: null,
    xScaleInv: null,
    yScaleInv: null,
    margin: { top: 20, right: 20, bottom: 20, left: 20 },

    // UI state
    nextLabelId: 1,

    // Performance settings
    maxSVGPoints: 10000,        // Switch to canvas above this
    downsampleThreshold: 50000, // Downsample above this
    samplingRate: 1             // Current sampling rate (1 = no sampling)
};

// Default colors for groups (black for labels by default)
const DEFAULT_LABEL_COLOR = '#000000';

// Color palettes for different group sizes
const COLOR_PALETTES = {
    // Beautiful palette for ≤10 groups (distinct, vibrant colors)
    small: [
        '#e60049', '#0bb4ff', '#50e991', '#e6d800', '#9b19f5',
        '#ffa300', '#dc0ab4', '#b3d4ff', '#00bfa0', '#fd7f6f'
    ],
    // Medium palette for 11-30 groups (tableau-20 inspired)
    medium: [
        '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
        '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
        '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
        '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
    ],
    // Large palette for >30 groups (colorbrewer-inspired with more variation)
    large: null  // Will be generated dynamically using HSL
};

// Generate colors for large number of groups using HSL color space
function generateLargePalette(numGroups) {
    const colors = [];
    const goldenRatio = 0.618033988749895;
    let hue = Math.random(); // Start with random hue

    for (let i = 0; i < numGroups; i++) {
        hue += goldenRatio;
        hue %= 1;

        // Vary saturation and lightness for more distinction
        const saturation = 0.65 + (i % 3) * 0.15;  // 0.65, 0.80, 0.95
        const lightness = 0.45 + (i % 4) * 0.10;   // 0.45, 0.55, 0.65, 0.75

        const h = Math.floor(hue * 360);
        const s = Math.floor(saturation * 100);
        const l = Math.floor(lightness * 100);

        colors.push(`hsl(${h}, ${s}%, ${l}%)`);
    }
    return colors;
}

// Select appropriate palette based on number of groups
function getColorPalette(numGroups) {
    if (numGroups <= 10) {
        return COLOR_PALETTES.small;
    } else if (numGroups <= 30) {
        return COLOR_PALETTES.medium;
    } else {
        return generateLargePalette(numGroups);
    }
}

// Unit conversion constants (to pixels at 96 DPI)
const UNITS = {
    px: 1,
    inch: 96,
    cm: 96 / 2.54
};

// ==================== DOM ELEMENTS ====================
const coordsFileInput = document.getElementById('coordsFile');
const filePathDisplay = document.getElementById('filePathDisplay');
const columnSelection = document.getElementById('columnSelection');
const xColumnSelect = document.getElementById('xColumnSelect');
const yColumnSelect = document.getElementById('yColumnSelect');
const labelColumnSelect = document.getElementById('labelColumnSelect');
const applyColumnsBtn = document.getElementById('applyColumnsBtn');
const loadExampleBtn = document.getElementById('loadExampleBtn');
const downloadExampleBtn = document.getElementById('downloadExampleBtn');

const labelsList = document.getElementById('labelsList');
const addLabelBtn = document.getElementById('addLabelBtn');

const plotWidthInput = document.getElementById('plotWidth');
const plotHeightInput = document.getElementById('plotHeight');
const widthDisplay = document.getElementById('widthDisplay');
const heightDisplay = document.getElementById('heightDisplay');
const widthIncrement = document.getElementById('widthIncrement');
const widthDecrement = document.getElementById('widthDecrement');
const heightIncrement = document.getElementById('heightIncrement');
const heightDecrement = document.getElementById('heightDecrement');

const pointSizeInput = document.getElementById('pointSize');
const pointOpacityInput = document.getElementById('pointOpacity');
const pointSizeDisplay = document.getElementById('pointSizeDisplay');
const pointOpacityDisplay = document.getElementById('pointOpacityDisplay');

const dotColorSettings = document.getElementById('dotColorSettings');
const dotColorList = document.getElementById('dotColorList');

const exportTableBtn = document.getElementById('exportTableBtn');
const exportGgplot2Btn = document.getElementById('exportGgplot2Btn');
const exportMatplotlibBtn = document.getElementById('exportMatplotlibBtn');
const exportPngBtn = document.getElementById('exportPngBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportSvgBtn = document.getElementById('exportSvgBtn');

const svg = document.getElementById('plot');
const plotContainer = document.getElementById('plotContainer');
const resizeHandle = document.getElementById('resizeHandle');
const statsDiv = document.getElementById('stats');
const instructionsDiv = document.getElementById('instructions');

// ==================== SECTION COLLAPSE/EXPAND ====================

function toggleSection(sectionName) {
    const section = document.querySelector(`[data-section="${sectionName}"]`);
    const wasCollapsed = section.classList.contains('collapsed');

    // Collapse all sections first
    document.querySelectorAll('.collapsible-section').forEach(s => {
        s.classList.add('collapsed');
    });

    // If the clicked section was collapsed, expand it
    if (wasCollapsed) {
        section.classList.remove('collapsed');
    }

    updateSectionSummaries();
}

function updateSectionSummaries() {
    // Update Upload summary
    const uploadSummary = document.getElementById('uploadSummary');
    if (state.uploadedFileName) {
        const fileName = state.uploadedFileName.length > 25
            ? '...' + state.uploadedFileName.slice(-22)
            : state.uploadedFileName;
        let summary = fileName;
        if (state.xColumn !== null) {
            const xCol = state.headers[state.xColumn] || `Col ${state.xColumn + 1}`;
            const yCol = state.headers[state.yColumn] || `Col ${state.yColumn + 1}`;
            summary += ` | X:${xCol}, Y:${yCol}`;
        }
        uploadSummary.textContent = summary;
    } else {
        uploadSummary.textContent = 'No file uploaded';
    }

    // Update Labels summary
    const labelsSummary = document.getElementById('labelsSummary');
    const visibleLabels = state.labels.filter(l => l.visible);
    if (visibleLabels.length > 0) {
        labelsSummary.textContent = `${visibleLabels.length} label${visibleLabels.length > 1 ? 's' : ''}`;
    } else {
        labelsSummary.textContent = 'No labels added';
    }

    // Update Plot summary
    const plotSummary = document.getElementById('plotSummary');
    const width = pxToUnit(state.plotWidth, state.unitPref);
    const height = pxToUnit(state.plotHeight, state.unitPref);
    plotSummary.textContent = `${width.toFixed(state.unitPref === 'px' ? 0 : 1)} × ${height.toFixed(state.unitPref === 'px' ? 0 : 1)} ${state.unitPref}`;
}

// ==================== EVENT LISTENERS ====================

// Unit preference change
document.querySelectorAll('input[name="unitPref"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const oldUnit = state.unitPref;
        const newUnit = e.target.value;
        state.unitPref = newUnit;

        // Update min/max FIRST (before setting value) to prevent browser clamping
        const minInUnit = pxToUnit(50, newUnit);
        const maxInUnit = pxToUnit(2000, newUnit);
        plotWidthInput.min = minInUnit.toFixed(newUnit === 'px' ? 0 : 2);
        plotWidthInput.max = maxInUnit.toFixed(newUnit === 'px' ? 0 : 2);
        plotHeightInput.min = minInUnit.toFixed(newUnit === 'px' ? 0 : 2);
        plotHeightInput.max = maxInUnit.toFixed(newUnit === 'px' ? 0 : 2);

        // Now convert current px values to new unit and update inputs with precise values
        const widthInNewUnit = pxToUnit(state.plotWidth, newUnit);
        const heightInNewUnit = pxToUnit(state.plotHeight, newUnit);

        plotWidthInput.value = widthInNewUnit.toFixed(newUnit === 'px' ? 0 : 2);
        plotHeightInput.value = heightInNewUnit.toFixed(newUnit === 'px' ? 0 : 2);

        updateDimensionDisplays();
        updateSectionSummaries();
    });
});

// File upload
coordsFileInput.addEventListener('change', handleFileUpload);
applyColumnsBtn.addEventListener('click', applyColumnSelection);
loadExampleBtn.addEventListener('click', loadExampleData);
downloadExampleBtn.addEventListener('click', downloadExampleData);

// Add label button
addLabelBtn.addEventListener('click', () => addNewLabel());

// Dimension input handlers (for manual typing)
plotWidthInput.addEventListener('input', (e) => {
    const inputValue = parseFloat(plotWidthInput.value);
    if (isNaN(inputValue)) return;
    state.plotWidth = Math.round(unitToPx(inputValue, state.unitPref));
    updateDimensionDisplays();
    updateSectionSummaries();
    renderPlot();
});

plotHeightInput.addEventListener('input', (e) => {
    const inputValue = parseFloat(plotHeightInput.value);
    if (isNaN(inputValue)) return;
    state.plotHeight = Math.round(unitToPx(inputValue, state.unitPref));
    updateDimensionDisplays();
    updateSectionSummaries();
    renderPlot();
});

// Increment/decrement button handlers
widthIncrement.addEventListener('click', () => {
    const currentValue = parseFloat(plotWidthInput.value) || 0;
    const newValue = Math.floor(currentValue) + 1;
    const maxValue = parseFloat(plotWidthInput.max);
    if (newValue <= maxValue) {
        plotWidthInput.value = newValue;
        state.plotWidth = Math.round(unitToPx(newValue, state.unitPref));
        updateDimensionDisplays();
        updateSectionSummaries();
        renderPlot();
    }
});

widthDecrement.addEventListener('click', () => {
    const currentValue = parseFloat(plotWidthInput.value) || 0;
    const newValue = Math.ceil(currentValue) - 1;
    const minValue = parseFloat(plotWidthInput.min);
    if (newValue >= minValue) {
        plotWidthInput.value = newValue;
        state.plotWidth = Math.round(unitToPx(newValue, state.unitPref));
        updateDimensionDisplays();
        updateSectionSummaries();
        renderPlot();
    }
});

heightIncrement.addEventListener('click', () => {
    const currentValue = parseFloat(plotHeightInput.value) || 0;
    const newValue = Math.floor(currentValue) + 1;
    const maxValue = parseFloat(plotHeightInput.max);
    if (newValue <= maxValue) {
        plotHeightInput.value = newValue;
        state.plotHeight = Math.round(unitToPx(newValue, state.unitPref));
        updateDimensionDisplays();
        updateSectionSummaries();
        renderPlot();
    }
});

heightDecrement.addEventListener('click', () => {
    const currentValue = parseFloat(plotHeightInput.value) || 0;
    const newValue = Math.ceil(currentValue) - 1;
    const minValue = parseFloat(plotHeightInput.min);
    if (newValue >= minValue) {
        plotHeightInput.value = newValue;
        state.plotHeight = Math.round(unitToPx(newValue, state.unitPref));
        updateDimensionDisplays();
        updateSectionSummaries();
        renderPlot();
    }
});

pointSizeInput.addEventListener('input', () => {
    state.pointSize = parseFloat(pointSizeInput.value);
    pointSizeDisplay.textContent = state.pointSize;
    renderPlot();
});

pointOpacityInput.addEventListener('input', () => {
    state.pointOpacity = parseFloat(pointOpacityInput.value);
    pointOpacityDisplay.textContent = state.pointOpacity;
    renderPlot();
});

// Export buttons
exportTableBtn.addEventListener('click', exportLabelTable);
exportGgplot2Btn.addEventListener('click', exportGgplot2Code);
exportMatplotlibBtn.addEventListener('click', exportMatplotlibCode);
exportPngBtn.addEventListener('click', exportPNG);
exportPdfBtn.addEventListener('click', exportPDF);
exportSvgBtn.addEventListener('click', exportSVG);

// Initialize dimension displays
updateDimensionDisplays();

// Drag-to-resize functionality
setupResizeHandle();

// ==================== FILE PARSING ====================

function generateExampleCSV() {
    // Generate a simple UMAP-like dataset with 3 clusters
    const data = [];
    data.push('UMAP_1,UMAP_2,cluster');

    // Cluster 1: Top-left
    for (let i = 0; i < 100; i++) {
        const x = -5 + Math.random() * 3;
        const y = 3 + Math.random() * 3;
        data.push(`${x.toFixed(4)},${y.toFixed(4)},Cluster A`);
    }

    // Cluster 2: Bottom-right
    for (let i = 0; i < 100; i++) {
        const x = 3 + Math.random() * 3;
        const y = -5 + Math.random() * 3;
        data.push(`${x.toFixed(4)},${y.toFixed(4)},Cluster B`);
    }

    // Cluster 3: Top-right
    for (let i = 0; i < 100; i++) {
        const x = 3 + Math.random() * 3;
        const y = 3 + Math.random() * 3;
        data.push(`${x.toFixed(4)},${y.toFixed(4)},Cluster C`);
    }

    return data.join('\n');
}

function loadExampleData() {
    const csvText = generateExampleCSV();
    state.uploadedFileName = 'example_data.csv';

    try {
        const rows = parseCSV(csvText);
        const hasHeader = detectHeader(rows);

        if (hasHeader) {
            state.headers = rows[0];
            state.rawData = rows.slice(1);
        } else {
            state.headers = rows[0].map((_, i) => `Column ${i + 1}`);
            state.rawData = rows;
        }

        // Show file path
        filePathDisplay.textContent = '📄 example_data.csv';
        filePathDisplay.style.display = 'block';

        // Show column selection UI so users can see the structure
        const numericColumns = state.headers.map((header, i) => ({
            index: i,
            header: header,
            isNumeric: isNumericColumn(state.rawData, i)
        })).filter(col =>
            col.isNumeric &&
            col.header.trim() !== '' &&
            col.header !== 'Unnamed: 0'
        );

        populateColumnSelects(numericColumns);
        columnSelection.style.display = 'block';

        // Pre-select the columns
        state.xColumn = 0;
        state.yColumn = 1;
        state.labelColumn = 2;
        xColumnSelect.value = 0;
        yColumnSelect.value = 1;
        labelColumnSelect.value = 2;

        instructionsDiv.innerHTML = `
            <p>✓ Loaded example data with ${state.rawData.length} points</p>
            <p>Review column selection and click "Apply Selection"</p>
        `;

        updateSectionSummaries();
    } catch (error) {
        console.error('Error loading example:', error);
        alert('Error loading example: ' + error.message);
    }
}

function downloadExampleData() {
    const csvText = generateExampleCSV();
    downloadFile(csvText, 'example_data.csv', 'text/csv');
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    return lines.map(line => {
        // Handle both CSV and TSV
        const delimiter = line.includes('\t') ? '\t' : ',';

        // Simple CSV parser that handles quoted fields
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Handle escaped quotes ("")
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                // End of field
                cells.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        // Add last field
        cells.push(current.trim());

        return cells;
    });
}

function detectHeader(rows) {
    if (rows.length === 0) return false;
    const firstRow = rows[0];
    // Check if first row contains mostly non-numeric values
    const nonNumeric = firstRow.filter(cell => isNaN(parseFloat(cell))).length;
    return nonNumeric > firstRow.length / 2;
}

function isNumericColumn(rows, colIndex) {
    // Check if at least 80% of non-empty values are pure numbers
    // Use Number() which requires the ENTIRE string to be numeric
    // This correctly rejects "14101_BR" (returns NaN) while accepting "1.2", "-1.2", "1e-2"
    const validValues = rows.filter(row => row[colIndex] && row[colIndex].trim() !== '');
    if (validValues.length === 0) return false;

    const numericCount = validValues.filter(row => {
        const val = row[colIndex].trim();
        // Number() returns NaN if ANY part of the string is non-numeric
        return !isNaN(Number(val)) && val !== '';
    }).length;

    return numericCount / validValues.length > 0.8;
}

// ==================== FILE UPLOAD HANDLING ====================

async function handleFileUpload(event) {
    console.log('handleFileUpload triggered');
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('Processing file:', file.name);
    state.uploadedFileName = file.name;

    try {
        const text = await file.text();
        console.log('File read successfully, length:', text.length);
        const rows = parseCSV(text);
        console.log('Parsed rows:', rows.length);
        const hasHeader = detectHeader(rows);
        console.log('Has header:', hasHeader);

        if (hasHeader) {
            state.headers = rows[0];
            state.rawData = rows.slice(1);
        } else {
            state.headers = rows[0].map((_, i) => `Column ${i + 1}`);
            state.rawData = rows;
        }

        console.log('Headers:', state.headers);
        console.log('Data rows:', state.rawData.length);

        // Show file path
        filePathDisplay.textContent = `📄 ${file.name}`;
        filePathDisplay.style.display = 'block';

        // Auto-detect or show column selection
        // Filter out empty/unnamed columns (common in R exports as row names)
        const numericColumns = state.headers.map((header, i) => ({
            index: i,
            header: header,
            isNumeric: isNumericColumn(state.rawData, i)
        })).filter(col =>
            col.isNumeric &&
            col.header.trim() !== '' &&  // Skip empty headers
            col.header !== 'Unnamed: 0'  // Skip pandas default row index name
        );

        console.log('Numeric columns:', numericColumns.length);

        if (state.rawData[0].length === 2 && numericColumns.length === 2) {
            // Auto-select if only 2 columns
            console.log('Auto-detecting 2-column format');
            state.xColumn = 0;
            state.yColumn = 1;
            state.labelColumn = null;
            processData();
            instructionsDiv.innerHTML = `
                <p>✓ Auto-detected ${state.coordinates.length} points</p>
                <p>Add labels from the Label Settings panel</p>
            `;
        } else {
            // Show column selection UI
            console.log('Showing column selection UI');
            populateColumnSelects(numericColumns);
            columnSelection.style.display = 'block';
            instructionsDiv.innerHTML = `
                <p>📋 Select which columns to use for X, Y, and Labels</p>
            `;
        }

        updateSectionSummaries();
        console.log('File upload completed successfully');

    } catch (error) {
        console.error('Error loading file:', error);
        alert('Error loading file: ' + error.message);
    }
}

function populateColumnSelects(numericColumns) {
    // Clear existing options
    xColumnSelect.innerHTML = '';
    yColumnSelect.innerHTML = '';
    labelColumnSelect.innerHTML = '<option value="">-- None --</option>';

    // Add numeric columns to X and Y selects
    numericColumns.forEach(col => {
        const xOption = document.createElement('option');
        xOption.value = col.index;
        xOption.textContent = col.header;
        xColumnSelect.appendChild(xOption);

        const yOption = document.createElement('option');
        yOption.value = col.index;
        yOption.textContent = col.header;
        yColumnSelect.appendChild(yOption);
    });

    // Auto-select first two numeric columns
    if (numericColumns.length >= 2) {
        xColumnSelect.value = numericColumns[0].index;
        yColumnSelect.value = numericColumns[1].index;
    }

    // Add all columns to label select (except empty/unnamed columns)
    state.headers.forEach((header, i) => {
        // Skip empty headers and pandas row index columns
        if (header.trim() === '' || header === 'Unnamed: 0') {
            return;
        }
        const option = document.createElement('option');
        option.value = i;
        option.textContent = header;
        labelColumnSelect.appendChild(option);
    });
}

function applyColumnSelection() {
    state.xColumn = parseInt(xColumnSelect.value);
    state.yColumn = parseInt(yColumnSelect.value);
    state.labelColumn = labelColumnSelect.value !== '' ? parseInt(labelColumnSelect.value) : null;

    if (isNaN(state.xColumn) || isNaN(state.yColumn)) {
        alert('Please select both X and Y columns');
        return;
    }

    processData();
    updateSectionSummaries();
}

function processData() {
    // Extract coordinates
    state.coordinates = state.rawData.map(row => ({
        x: parseFloat(row[state.xColumn]),
        y: parseFloat(row[state.yColumn])
    })).filter(point => !isNaN(point.x) && !isNaN(point.y));

    // Extract labels if column is selected
    if (state.labelColumn !== null) {
        state.originalLabels = state.rawData
            .slice(0, state.coordinates.length)
            .map(row => row[state.labelColumn] || 'Unlabeled');

        state.pointLabels = [...state.originalLabels];

        // Create labels from unique values
        createLabelsFromData();

        // Setup original groups for dot coloring
        setupOriginalGroups();

        instructionsDiv.innerHTML = `
            <p>✓ Loaded ${state.coordinates.length.toLocaleString()} points with ${state.labels.length} labels</p>
            <p>🖱️ Edit labels in Label Settings, then drag to position!</p>
        `;
    } else {
        state.originalLabels = [];
        state.pointLabels = [];
        state.labels = [];
        instructionsDiv.innerHTML = `
            <p>✓ Loaded ${state.coordinates.length.toLocaleString()} points</p>
            <p>Add labels in Label Settings panel</p>
        `;
    }

    updateStats();
    updateLabelsUI();

    // Show performance warning for large datasets
    if (state.coordinates.length > state.downsampleThreshold) {
        const samplingRate = Math.ceil(state.coordinates.length / state.maxSVGPoints);
        instructionsDiv.innerHTML += `
            <p style="color: #ed8936; margin-top: 10px;">⚠️ Large dataset: Showing ${Math.floor(state.coordinates.length/samplingRate).toLocaleString()} of ${state.coordinates.length.toLocaleString()} points for performance</p>
        `;
    }

    renderPlot();

    // Expand label settings section after data is loaded
    collapseAllSections();
    const labelsSection = document.querySelector('[data-section="labels"]');
    if (labelsSection) {
        labelsSection.classList.remove('collapsed');
    }
}

// ==================== LABEL MANAGEMENT ====================

function createLabelsFromData() {
    const uniqueTexts = [...new Set(state.pointLabels)];

    state.labels = [];
    state.labelPositions = {};

    uniqueTexts.forEach((text, idx) => {
        const labelId = state.nextLabelId++;

        // Calculate centroid for this label
        const points = state.coordinates.filter((_, i) => state.pointLabels[i] === text);
        const centroidX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centroidY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        state.labels.push({
            id: labelId,
            text: text,
            color: DEFAULT_LABEL_COLOR,
            fontSize: 10,
            visible: true
        });

        state.labelPositions[labelId] = {
            x: centroidX,
            y: centroidY
        };
    });
}

function setupOriginalGroups() {
    const uniqueGroups = [...new Set(state.originalLabels)];
    state.originalGroups = {};
    state.pointToGroup = [...state.originalLabels];

    // Select appropriate color palette based on number of groups
    const palette = getColorPalette(uniqueGroups.length);
    console.log(`Using color palette for ${uniqueGroups.length} groups`);

    uniqueGroups.forEach((group, idx) => {
        state.originalGroups[group] = palette[idx % palette.length];
    });

    // Show dot color settings
    dotColorSettings.style.display = 'block';
    updateDotColorUI();
}

function addNewLabel(text = '', color = null) {
    const labelId = state.nextLabelId++;

    // Default position at center using efficient calculation
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;

    state.coordinates.forEach(point => {
        if (point.x < xMin) xMin = point.x;
        if (point.x > xMax) xMax = point.x;
        if (point.y < yMin) yMin = point.y;
        if (point.y > yMax) yMax = point.y;
    });

    const centerX = (xMin + xMax) / 2;
    const centerY = (yMin + yMax) / 2;

    state.labels.push({
        id: labelId,
        text: text || `Label ${labelId}`,
        color: color || DEFAULT_LABEL_COLOR,
        fontSize: 10,
        visible: true
    });

    state.labelPositions[labelId] = {
        x: centerX,
        y: centerY
    };

    updateLabelsUI();
    renderPlot();

    // Focus the text input of the newly added label
    const labelRows = labelsList.querySelectorAll('.label-row');
    if (labelRows.length > 0) {
        const lastRow = labelRows[labelRows.length - 1];
        const textInput = lastRow.querySelector('input[type="text"]');
        if (textInput) {
            textInput.focus();
            textInput.select();
        }
    }

    return labelId;
}

function removeLabel(labelId) {
    const index = state.labels.findIndex(l => l.id === labelId);
    if (index !== -1) {
        state.labels.splice(index, 1);
        delete state.labelPositions[labelId];
        updateLabelsUI();
        updateSectionSummaries();
        renderPlot();
    }
}

function updateLabelProperty(labelId, property, value) {
    const label = state.labels.find(l => l.id === labelId);
    if (label) {
        label[property] = value;
        renderPlot();
        updateSectionSummaries();
    }
}

function updateLabelsUI() {
    labelsList.innerHTML = '';

    state.labels.forEach(label => {
        const row = document.createElement('div');
        row.className = 'label-row';
        row.innerHTML = `
            <input type="text" value="${label.text}"
                   oninput="updateLabelProperty(${label.id}, 'text', this.value)"
                   placeholder="Label text">
            <input type="color" value="${label.color}"
                   oninput="updateLabelProperty(${label.id}, 'color', this.value)"
                   title="Label color">
            <input type="number" value="${label.fontSize}" min="8" max="48"
                   oninput="updateLabelProperty(${label.id}, 'fontSize', parseInt(this.value))"
                   title="Font size" placeholder="Size">
            <button class="remove-btn" onclick="removeLabel(${label.id})" title="Remove label">✕</button>
        `;
        labelsList.appendChild(row);
    });

    updateSectionSummaries();
}

function updateDotColorUI() {
    dotColorList.innerHTML = '';

    Object.entries(state.originalGroups).forEach(([group, color]) => {
        const row = document.createElement('div');
        row.className = 'dot-color-row';
        row.innerHTML = `
            <label>${group}</label>
            <input type="color" value="${color}"
                   oninput="updateGroupColor('${group}', this.value)">
        `;
        dotColorList.appendChild(row);
    });
}

function updateGroupColor(group, color) {
    state.originalGroups[group] = color;
    renderPlot();
}

// ==================== UNIT CONVERSION ====================

function pxToUnit(px, unit) {
    return px / UNITS[unit];
}

function unitToPx(value, unit) {
    return value * UNITS[unit];
}

function updateDimensionDisplays() {
    widthDisplay.textContent = state.unitPref;
    heightDisplay.textContent = state.unitPref;
}

// ==================== PLOT RENDERING ====================

function createScales() {
    // Use reduce for large arrays to avoid stack overflow
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;

    state.coordinates.forEach(point => {
        if (point.x < xMin) xMin = point.x;
        if (point.x > xMax) xMax = point.x;
        if (point.y < yMin) yMin = point.y;
        if (point.y > yMax) yMax = point.y;
    });

    const plotWidth = state.plotWidth - state.margin.left - state.margin.right;
    const plotHeight = state.plotHeight - state.margin.top - state.margin.bottom;

    state.xScale = (x) => state.margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
    state.yScale = (y) => state.margin.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;

    // Inverse scales for exporting
    state.xScaleInv = (px) => xMin + ((px - state.margin.left) / plotWidth) * (xMax - xMin);
    state.yScaleInv = (py) => yMax - ((py - state.margin.top) / plotHeight) * (yMax - yMin);
}

function renderPlot() {
    if (state.coordinates.length === 0) return;

    // Update plot dimensions
    svg.setAttribute('width', state.plotWidth);
    svg.setAttribute('height', state.plotHeight);

    // Show resize handle when plot exists
    resizeHandle.style.display = 'block';

    // Clear previous content
    svg.innerHTML = '';

    // Create scales
    createScales();

    // Determine sampling rate for large datasets
    const totalPoints = state.coordinates.length;
    let samplingRate = 1;

    if (totalPoints > state.downsampleThreshold) {
        samplingRate = Math.ceil(totalPoints / state.maxSVGPoints);
        console.log(`Downsampling: showing 1 out of every ${samplingRate} points (${Math.floor(totalPoints/samplingRate)} total)`);
    }
    state.samplingRate = samplingRate;

    // Draw points with downsampling for large datasets
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < state.coordinates.length; i += samplingRate) {
        const point = state.coordinates[i];
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', state.xScale(point.x));
        circle.setAttribute('cy', state.yScale(point.y));
        circle.setAttribute('r', state.pointSize);

        // Color by original group if available
        if (state.pointToGroup[i] && state.originalGroups[state.pointToGroup[i]]) {
            circle.setAttribute('fill', state.originalGroups[state.pointToGroup[i]]);
        } else {
            circle.setAttribute('fill', '#667eea');
        }

        circle.setAttribute('opacity', state.pointOpacity);
        circle.classList.add('point');
        fragment.appendChild(circle);
    }

    svg.appendChild(fragment);

    // Draw labels if they exist
    const visibleLabels = state.labels.filter(l => l.visible);
    if (visibleLabels.length > 0) {
        drawLabels();
    }

    // Hide instructions when plot is shown
    if (state.coordinates.length > 0) {
        instructionsDiv.style.display = 'none';
    }

    updateStats();
}

function drawLabels() {
    state.labels.filter(l => l.visible).forEach(label => {
        const pos = state.labelPositions[label.id];
        if (!pos) return;

        // Always use data coordinates and apply current scale
        // This ensures labels move correctly when plot is resized
        const x = state.xScale(pos.x);
        const y = state.yScale(pos.y);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('font-size', label.fontSize);
        text.setAttribute('fill', label.color);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.classList.add('label-text');
        text.textContent = label.text;
        text.dataset.labelId = label.id;

        makeDraggable(text);
        svg.appendChild(text);
    });
}

function makeDraggable(element) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
        isDragging = true;
        element.classList.add('dragging');

        const svgRect = svg.getBoundingClientRect();
        startX = e.clientX - svgRect.left - parseFloat(element.getAttribute('x'));
        startY = e.clientY - svgRect.top - parseFloat(element.getAttribute('y'));
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const svgRect = svg.getBoundingClientRect();
        const newX = e.clientX - svgRect.left - startX;
        const newY = e.clientY - svgRect.top - startY;

        element.setAttribute('x', newX);
        element.setAttribute('y', newY);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            element.classList.remove('dragging');

            // Convert pixel coordinates back to data coordinates
            // This ensures labels maintain their position when plot is resized
            const labelId = parseInt(element.dataset.labelId);
            if (state.labelPositions[labelId]) {
                const pixelX = parseFloat(element.getAttribute('x'));
                const pixelY = parseFloat(element.getAttribute('y'));

                // Use inverse scales to convert pixels back to data coordinates
                state.labelPositions[labelId].x = state.xScaleInv(pixelX);
                state.labelPositions[labelId].y = state.yScaleInv(pixelY);
            }

            isDragging = false;
        }
    });
}


// ==================== DRAG-TO-RESIZE ====================

function setupResizeHandle() {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = state.plotWidth;
        startHeight = state.plotHeight;
        e.preventDefault();
        document.body.style.cursor = 'nwse-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        state.plotWidth = Math.max(50, Math.min(2000, startWidth + deltaX));
        state.plotHeight = Math.max(50, Math.min(2000, startHeight + deltaY));

        // Update input values in current unit
        plotWidthInput.value = pxToUnit(state.plotWidth, state.unitPref).toFixed(state.unitPref === 'px' ? 0 : 2);
        plotHeightInput.value = pxToUnit(state.plotHeight, state.unitPref).toFixed(state.unitPref === 'px' ? 0 : 2);

        updateDimensionDisplays();
        updateSectionSummaries();
        renderPlot();
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
        }
    });
}

// ==================== STATS & UI UPDATES ====================

function updateStats() {
    if (state.coordinates.length > 0) {
        const visibleLabels = state.labels.filter(l => l.visible);
        const labelText = visibleLabels.length > 0
            ? ` | ${visibleLabels.length} labels`
            : '';

        let pointText = state.coordinates.length.toLocaleString();
        if (state.samplingRate > 1) {
            const shown = Math.floor(state.coordinates.length / state.samplingRate);
            pointText = `${shown.toLocaleString()} of ${state.coordinates.length.toLocaleString()}`;
        }

        statsDiv.textContent = `📊 ${pointText} points${labelText}`;
        statsDiv.style.display = 'block';
    } else {
        statsDiv.style.display = 'none';
    }
}

// ==================== EXPORT FUNCTIONS ====================

function exportLabelTable() {
    const visibleLabels = state.labels.filter(l => l.visible);
    if (visibleLabels.length === 0) {
        alert('No labels to export!');
        return;
    }

    let csv = 'label,x,y,font_size,color\n';

    visibleLabels.forEach(label => {
        const pos = state.labelPositions[label.id];
        // Position is now always in data coordinates
        const x = pos.x;
        const y = pos.y;

        csv += `${label.text},${x.toFixed(4)},${y.toFixed(4)},${label.fontSize},${label.color}\n`;
    });

    downloadFile(csv, 'label_positions.csv', 'text/csv');
}

function exportGgplot2Code() {
    const visibleLabels = state.labels.filter(l => l.visible);
    if (visibleLabels.length === 0) {
        alert('No labels to export!');
        return;
    }

    const widthInch = pxToUnit(state.plotWidth, 'inch');
    const heightInch = pxToUnit(state.plotHeight, 'inch');

    // Get column names
    const xColName = state.headers[state.xColumn] || 'x';
    const yColName = state.headers[state.yColumn] || 'y';
    const labelColName = state.labelColumn !== null ? state.headers[state.labelColumn] : null;

    // Build color mapping if original groups exist
    const hasGroups = Object.keys(state.originalGroups).length > 0;
    let colorMapping = '';
    if (hasGroups) {
        const groupColors = Object.entries(state.originalGroups)
            .map(([group, color]) => `  "${group}" = "${color}"`)
            .join(',\n');
        colorMapping = `# Color mapping for original groups
group_colors <- c(
${groupColors}
)

`;
    }

    let code = `# ============================================================================
# Generated by UMAP Label Positioner
# ============================================================================
#
# IMPORTANT: UPDATE FILE PATHS BELOW!
# The APP does not obtain your absolute file path for security reasons. You must either:
#   1. Place this script in the same directory as your data file, OR
#   2. Replace "${state.uploadedFileName}" with the full absolute path
#
# Optional package required:
# This script uses the 'shadowtext' package for text labels with white outlines.
# Install it with: install.packages("shadowtext")
# If shadowtext is not available, the script will fall back to plain text labels.
#
# ============================================================================
# LOAD YOUR DATA HERE
# ============================================================================
# Uncomment and edit the line below with the correct path to your CSV file:
#
# data <- read.csv("${state.uploadedFileName}")   # <- UPDATE THIS PATH!
#
# Your data should have these columns:
#   X: ${xColName}
#   Y: ${yColName}${labelColName ? `\n#   Group/Label: ${labelColName}` : ''}

library(ggplot2)
library(grid)

# ============================================================================
# ERROR CHECKING: Did you update the file path?
# ============================================================================
if (!"data" %in% ls()) {
  stop(
    "\\n\\n",
    "█████████████████████████████\\n",
    "█  ERROR: Data not loaded!  █\\n",
    "█████████████████████████████\\n",
    "\\n",
    "This script needs you to load your data first.\\n",
    "\\n",
    "INSTRUCTIONS:\\n",
    "1. Open this file in a text editor\\n",
    "2. Find the 'LOAD YOUR DATA HERE' section at top\\n",
    "3. Uncomment and edit the read.csv() line with your file path\\n",
    "4. Run the script again\\n",
    "\\n",
    "Example:\\n",
    "  data <- read.csv('/path/to/your/${state.uploadedFileName}')\\n",
    "\\n"
  )
}

# Helper function to calculate save dimensions for exact plot panel size
# This compensates for margins, axes, legends, etc.
calculate_save_dims <- function(plot, target_width_inch, target_height_inch) {
  # Build the plot as a grob
  gt <- ggplotGrob(plot)

  # Find the panel grob (the actual plotting area)
  panel_pos <- grep("panel", gt$layout$name)
  panel_row <- unique(gt$layout$t[panel_pos])
  panel_col <- unique(gt$layout$l[panel_pos])

  # Get heights and widths
  heights <- gt$heights
  widths <- gt$widths

  # Convert panel dimensions to inches
  panel_height <- convertUnit(heights[panel_row], "inches", valueOnly = TRUE)
  panel_width <- convertUnit(widths[panel_col], "inches", valueOnly = TRUE)

  # Convert all other dimensions to inches
  total_height <- sum(convertUnit(heights, "inches", valueOnly = TRUE))
  total_width <- sum(convertUnit(widths, "inches", valueOnly = TRUE))

  # Calculate margins (difference between total and panel)
  margin_height <- total_height - panel_height
  margin_width <- total_width - panel_width

  # Adjusted dimensions to achieve target panel size
  adj_width <- target_width_inch + margin_width
  adj_height <- target_height_inch + margin_height

  return(list(width = adj_width, height = adj_height))
}

${colorMapping}# Label positions
label_positions <- data.frame(
  label = c(${visibleLabels.map(l => `"${l.text}"`).join(', ')}),
  x = c(${visibleLabels.map(l => {
        const pos = state.labelPositions[l.id];
        return pos.x.toFixed(4);
    }).join(', ')}),
  y = c(${visibleLabels.map(l => {
        const pos = state.labelPositions[l.id];
        return pos.y.toFixed(4);
    }).join(', ')}),
  size = c(${visibleLabels.map(l => (l.fontSize / 2.83465).toFixed(1)).join(', ')}),
  color = c(${visibleLabels.map(l => `"${l.color}"`).join(', ')})
)

# Create plot
p <- ggplot(data, aes(x = ${xColName}, y = ${yColName}${hasGroups && labelColName ? `, color = ${labelColName}` : ''})) +
  geom_point(alpha = ${state.pointOpacity}, size = ${(state.pointSize * 0.7).toFixed(2)}, stroke = 0${!hasGroups ? ', color = "#667eea"' : ''}) +${hasGroups ? `\n  scale_color_manual(values = group_colors) +` : ''}
  theme_minimal() +
  theme(panel.grid = element_blank(),
        legend.position = 'none',
        axis.text = element_blank(),
        axis.title = element_blank())

# Add text labels with white outline (using shadowtext if available)
if (requireNamespace("shadowtext", quietly = TRUE)) {
  for (i in 1:nrow(label_positions)) {
    p <- p + shadowtext::geom_shadowtext(
      data = label_positions[i, , drop = FALSE],
      mapping = aes(x = x, y = y, label = label),
      size = label_positions$size[i],
      color = label_positions$color[i],
      bg.color = "white",
      bg.r = 0.15,
      inherit.aes = FALSE
    )
  }
} else {
  # Shadowtext package not found - using plain text labels
  warning(
    "\\n",
    "═══════════════════════════════════════════════════════════════\\n",
    "  NOTE: 'shadowtext' package not installed                    \\n",
    "═══════════════════════════════════════════════════════════════\\n",
    "\\n",
    "Labels will be rendered as plain text without white outlines.\\n",
    "\\n",
    "For better-looking labels with white outlines, install with the following command in R console:\\n",
    "  install.packages('shadowtext')\\n",
    "Or in terminal with:\\n",
    "  R -e \\\"install.packages('shadowtext')\\\"\\n",
    "\\n",
    "Then re-run this script.\\n",
    "\\n"
  )
  for (i in 1:nrow(label_positions)) {
    p <- p + annotate("text",
                      x = label_positions$x[i],
                      y = label_positions$y[i],
                      label = label_positions$label[i],
                      size = label_positions$size[i],
                      color = label_positions$color[i])
  }
}

# Save plot with exact panel dimensions
# Target panel size (from app): ${widthInch.toFixed(2)}" × ${heightInch.toFixed(2)}"
dims <- calculate_save_dims(p, ${widthInch.toFixed(2)}, ${heightInch.toFixed(2)})
ggsave("umap_plot.png", p, width = dims$width, height = dims$height, dpi = 300)

# Alternative: Save as PDF (vector format, infinite resolution)
# ggsave("umap_plot.pdf", p, width = dims$width, height = dims$height)

# Alternative: Simple save (panel will be smaller due to margins/axes)
# ggsave("umap_plot.png", p, width = ${widthInch.toFixed(2)}, height = ${heightInch.toFixed(2)}, dpi = 300)
`;

    downloadFile(code, 'plot_code.R', 'text/plain');
}

function exportMatplotlibCode() {
    const visibleLabels = state.labels.filter(l => l.visible);
    if (visibleLabels.length === 0) {
        alert('No labels to export!');
        return;
    }

    const widthInch = pxToUnit(state.plotWidth, 'inch');
    const heightInch = pxToUnit(state.plotHeight, 'inch');

    // Get column names
    const xColName = state.headers[state.xColumn] || 'x';
    const yColName = state.headers[state.yColumn] || 'y';
    const labelColName = state.labelColumn !== null ? state.headers[state.labelColumn] : null;

    // Build color mapping if original groups exist
    const hasGroups = Object.keys(state.originalGroups).length > 0;
    let colorMapping = '';
    let plotPointsCode = '';

    if (hasGroups && labelColName) {
        const groupColors = Object.entries(state.originalGroups)
            .map(([group, color]) => `    '${group}': '${color}'`)
            .join(',\n');
        colorMapping = `\n# Color mapping for original groups\ngroup_colors = {\n${groupColors}\n}\n\n`;
        plotPointsCode = `# Plot points with group colors
for group, color in group_colors.items():
    mask = groups == group
    ax.scatter(x_coords[mask], y_coords[mask], s=${(Math.PI * state.pointSize * state.pointSize).toFixed(1)}, alpha=${state.pointOpacity}, c=color, edgecolors='none')`;
    } else {
        plotPointsCode = `# Plot points
ax.scatter(x_coords, y_coords, s=${(Math.PI * state.pointSize * state.pointSize).toFixed(1)}, alpha=${state.pointOpacity}, c='#667eea', edgecolors='none')`;
    }

    let code = `# ============================================================================
# Generated by UMAP Label Positioner
# ============================================================================
#
# IMPORTANT: UPDATE FILE PATHS BELOW!
# The APP does not obtain your absolute file path for security reasons. You must either:
#   1. Place this script in the same directory as your data file, OR
#   2. Replace "${state.uploadedFileName}" with the full absolute path to your data file
#
# ============================================================================
# LOAD YOUR DATA HERE
# ============================================================================
# Uncomment and edit the lines below to load your data:
#
# import pandas as pd
# data = pd.read_csv('${state.uploadedFileName}')   # <- UPDATE THIS PATH!
# x_coords = data['${xColName}'].values
# y_coords = data['${yColName}'].values${hasGroups && labelColName ? `\n# groups = data['${labelColName}'].values` : ''}
#

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import patheffects
import sys

if 'x_coords' not in dir() or 'y_coords' not in dir():
    print("\\n")
    print("█" * 47)
    print("█  ERROR: Data not loaded!" + " " * 20 + "█")
    print("█" * 47)
    print("\\n")
    print("This script needs you to load your data first.\\n")
    print("INSTRUCTIONS:")
    print("1. Open this file in a text editor")
    print("2. Find the 'LOAD YOUR DATA HERE' section at top")
    print("3. Uncomment and edit the data loading code")
    print("4. Run the script again\\n")
    print("Example:")
    print("  import pandas as pd")
    print("  data = pd.read_csv('/path/to/your/${state.uploadedFileName}')")
    print("  x_coords = data['${xColName}'].values")
    print("  y_coords = data['${yColName}'].values${hasGroups && labelColName ? `\\n  groups = data['${labelColName}'].values` : ''}\\n")
    sys.exit(1)

${colorMapping}
# Label positions
labels = [${visibleLabels.map(l => `"${l.text}"`).join(', ')}]
label_x = [${visibleLabels.map(l => {
        const pos = state.labelPositions[l.id];
        return pos.x.toFixed(4);
    }).join(', ')}]
label_y = [${visibleLabels.map(l => {
        const pos = state.labelPositions[l.id];
        return pos.y.toFixed(4);
    }).join(', ')}]
label_sizes = [${visibleLabels.map(l => (l.fontSize * 0.75).toFixed(1)).join(', ')}]
label_colors = [${visibleLabels.map(l => `"${l.color}"`).join(', ')}]

# Create plot
fig, ax = plt.subplots(figsize=(${widthInch.toFixed(2)}, ${heightInch.toFixed(2)}))

${plotPointsCode}

# Add labels with white outline (similar to shadowtext in R)
for label, x, y, size, color in zip(labels, label_x, label_y, label_sizes, label_colors):
    txt = ax.text(x, y, label, fontsize=size, fontweight='bold',
                  ha='center', va='center', color=color)
    txt.set_path_effects([
        patheffects.Stroke(linewidth=3, foreground='white'),
        patheffects.Normal()
    ])

# Style adjustments - hide all axes elements
ax.set_xlabel('')
ax.set_ylabel('')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['bottom'].set_visible(False)
ax.spines['left'].set_visible(False)
ax.set_xticks([])
ax.set_yticks([])

plt.tight_layout()

# Save as PNG with 300 dpi (default)
plt.savefig('umap_plot.png', dpi=300, bbox_inches='tight')

# Alternative: Save as PDF (vector format, infinite resolution)
# plt.savefig('umap_plot.pdf', bbox_inches='tight')
`;

    downloadFile(code, 'plot_code.py', 'text/plain');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==================== DIRECT FIGURE EXPORT ====================

// Create a full SVG with all data points for export (not downsampled)
function createFullExportSVG() {
    // Log info about export
    if (state.samplingRate > 1) {
        console.log(`Export: Rendering all ${state.coordinates.length.toLocaleString()} points (display shows ${Math.floor(state.coordinates.length / state.samplingRate).toLocaleString()})`);
    }

    const exportSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    exportSVG.setAttribute('width', state.plotWidth);
    exportSVG.setAttribute('height', state.plotHeight);
    exportSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Add all points (no downsampling)
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < state.coordinates.length; i++) {
        const point = state.coordinates[i];
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', state.xScale(point.x));
        circle.setAttribute('cy', state.yScale(point.y));
        circle.setAttribute('r', state.pointSize);

        // Color by original group if available
        if (state.pointToGroup[i] && state.originalGroups[state.pointToGroup[i]]) {
            circle.setAttribute('fill', state.originalGroups[state.pointToGroup[i]]);
        } else {
            circle.setAttribute('fill', '#667eea');
        }

        circle.setAttribute('opacity', state.pointOpacity);
        circle.classList.add('point');
        fragment.appendChild(circle);
    }

    exportSVG.appendChild(fragment);

    // Add labels with white outline
    state.labels.filter(l => l.visible).forEach(label => {
        const pos = state.labelPositions[label.id];
        if (!pos) return;

        const x = state.xScale(pos.x);
        const y = state.yScale(pos.y);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('font-size', label.fontSize);
        text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif');
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', label.color);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('paint-order', 'stroke fill');
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', '3');
        text.setAttribute('stroke-linecap', 'round');
        text.setAttribute('stroke-linejoin', 'round');
        text.textContent = label.text;

        exportSVG.appendChild(text);
    });

    return exportSVG;
}

function exportSVG() {
    if (state.coordinates.length === 0) {
        alert('No plot to export! Please upload data first.');
        return;
    }

    // Show spinner
    const spinner = document.getElementById('exportSpinner');
    spinner.style.display = 'inline';

    // Use setTimeout to let UI update
    setTimeout(() => {
        // Create full SVG with all data points
        const exportSvg = createFullExportSVG();

        // Serialize SVG to string
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(exportSvg);

        // Download
        downloadFile(svgString, 'umap_plot.svg', 'image/svg+xml');

        // Hide spinner
        spinner.style.display = 'none';
    }, 10);
}

function exportPNG() {
    if (state.coordinates.length === 0) {
        alert('No plot to export! Please upload data first.');
        return;
    }

    // Show spinner
    const spinner = document.getElementById('exportSpinner');
    spinner.style.display = 'inline';

    // Use setTimeout to let UI update
    setTimeout(() => {
        // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size with 2x scale for better quality
    const scale = 2;
    canvas.width = state.plotWidth * scale;
    canvas.height = state.plotHeight * scale;

    // Create full SVG with all data points
    const exportSvg = createFullExportSVG();

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(exportSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Load SVG into image
    const img = new Image();
    img.onload = function() {
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image scaled
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

            // Convert to PNG and download
            canvas.toBlob(function(blob) {
                const pngUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = pngUrl;
                link.download = 'umap_plot.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(pngUrl);
                URL.revokeObjectURL(url);

                // Hide spinner
                spinner.style.display = 'none';
            }, 'image/png');
        };

        img.onerror = function() {
            alert('Failed to export PNG. Please try again.');
            URL.revokeObjectURL(url);
            spinner.style.display = 'none';
        };

        img.src = url;
    }, 10);
}

function exportPDF() {
    if (state.coordinates.length === 0) {
        alert('No plot to export! Please upload data first.');
        return;
    }

    // Show spinner
    const spinner = document.getElementById('exportSpinner');
    spinner.style.display = 'inline';

    // Use setTimeout to let UI update
    setTimeout(() => {
        // Check if jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            alert('PDF export library not loaded. Please refresh the page and try again.');
            spinner.style.display = 'none';
            return;
        }

        const { jsPDF } = window.jspdf;

        // Calculate dimensions in mm (jsPDF uses mm by default)
        const widthInch = pxToUnit(state.plotWidth, 'inch');
        const heightInch = pxToUnit(state.plotHeight, 'inch');
        const widthMM = widthInch * 25.4;
        const heightMM = heightInch * 25.4;

        // Create PDF with exact dimensions
        const pdf = new jsPDF({
            orientation: widthMM > heightMM ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [widthMM, heightMM]
        });

        // Create full SVG with all data points
        const exportSvg = createFullExportSVG();

        // Use svg2pdf if available, otherwise fallback to PNG-in-PDF
        if (typeof svg2pdf !== 'undefined') {
            svg2pdf(exportSvg, pdf, {
                x: 0,
                y: 0,
                width: widthMM,
                height: heightMM
            }).then(() => {
                pdf.save('umap_plot.pdf');
                spinner.style.display = 'none';
            }).catch(err => {
                console.error('PDF export error:', err);
                // Fallback to PNG in PDF
                exportPDFViaPNG(pdf, widthMM, heightMM, spinner);
            });
        } else {
            // Fallback to PNG in PDF
            exportPDFViaPNG(pdf, widthMM, heightMM, spinner);
        }
    }, 10);
}

function exportPDFViaPNG(pdf, widthMM, heightMM, spinner) {
    // Create canvas and convert to PNG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 3; // Higher resolution for PDF
    canvas.width = state.plotWidth * scale;
    canvas.height = state.plotHeight * scale;

    // Create full SVG with all data points
    const exportSvg = createFullExportSVG();

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(exportSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, widthMM, heightMM);
        pdf.save('umap_plot.pdf');
        URL.revokeObjectURL(url);
        if (spinner) spinner.style.display = 'none';
    };

    img.onerror = function() {
        alert('Failed to export PDF. Please try again.');
        URL.revokeObjectURL(url);
        if (spinner) spinner.style.display = 'none';
    };

    img.src = url;
}

// ==================== SIDEBAR RESIZE ====================

function setupSidebarResize() {
    const sidebar = document.querySelector('.sidebar');
    const handle = document.createElement('div');
    handle.className = 'sidebar-resize-handle';
    sidebar.appendChild(handle);

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = sidebar.offsetWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const delta = e.clientX - startX;
        const newWidth = Math.max(50, Math.min(600, startWidth + delta));
        sidebar.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

function collapseAllSections() {
    document.querySelectorAll('.collapsible-section').forEach(section => {
        section.classList.add('collapsed');
    });
}

// ==================== INITIALIZATION ====================

// Initialize with only upload section expanded
collapseAllSections();
const uploadSection = document.querySelector('[data-section="upload"]');
if (uploadSection) {
    uploadSection.classList.remove('collapsed');
}

setupSidebarResize();
updateStats();
updateDimensionDisplays();
