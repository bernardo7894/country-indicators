/**
 * Global GDP Explorer - Interactive Visualization Logic
 * Handles data parsing, state management, and visualization rendering.
 */

// Configuration & Constants
const FILES = {
    GDP_CURRENT: 'API_NY.GDP.PCAP.CD_DS2_en_csv_v2_174336.csv',
    GDP_CONSTANT: 'API_NY.GDP.PCAP.KD_DS2_en_csv_v2_141.csv',
    PPP_CURRENT: 'API_NY.GDP.PCAP.PP.CD_DS2_en_csv_v2_138.csv',
    PPP_CONSTANT: 'API_NY.GDP.PCAP.PP.KD_DS2_en_csv_v2_1423.csv',
    STATE_GDP_CURRENT: 'US_States_GDP_PC_Current.csv',
    STATE_GDP_CONSTANT: 'US_States_GDP_PC_Constant.csv',
    STATE_PPP_CURRENT: 'US_States_PPP_PC_Current.csv',
    STATE_PPP_CONSTANT: 'US_States_PPP_PC_Constant.csv'
};

const COLORS = [
    '#2563eb', '#059669', '#dc2626', '#7c3aed', '#ea580c',
    '#0891b2', '#be185d', '#4f46e5', '#65a30d', '#0d9488'
];

const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

// App State
const state = {
    gdpData: {},
    pppData: {},
    rawData: {
        gdpCurrent: {},
        gdpConstant: {},
        pppCurrent: {},
        pppConstant: {}
    },
    countries: [],
    selectedCountries: [],
    currentView: 'gdp', // 'gdp', 'ppp', 'compare', 'ratio', 'map'
    priceType: 'current', // 'current', 'constant'
    yearStart: 1990,
    yearEnd: 2024,
    mapYear: 2023,
    chart: null,
    geoData: null,
    isPlaying: false,
    playInterval: null
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await init();
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to load application data. Please ensure CSV files are present in the workspace.');
    }
});


function updateActiveData() {
    if (state.priceType === 'current') {
        state.gdpData = state.rawData.gdpCurrent;
        state.pppData = state.rawData.pppCurrent;
    } else {
        state.gdpData = state.rawData.gdpConstant;
        state.pppData = state.rawData.pppConstant;
    }
}

function setPriceType(type) {
    state.priceType = type;

    // Update UI buttons
    document.querySelectorAll('[data-price]').forEach(btn => {
        if (btn.dataset.price === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    updateActiveData();
    updateVisualization();
    updateDataTable(); // Ensure table refreshes
    updateInsights();
}


async function init() {
    // 1. Fetch data
    const [
        gdpCurRaw, gdpConstRaw, pppCurRaw, pppConstRaw, geoRaw,
        stateGdpCur, stateGdpConst, statePppCur, statePppConst
    ] = await Promise.all([
        fetch(FILES.GDP_CURRENT).then(res => res.text()),
        fetch(FILES.GDP_CONSTANT).then(res => res.text()),
        fetch(FILES.PPP_CURRENT).then(res => res.text()),
        fetch(FILES.PPP_CONSTANT).then(res => res.text()),
        fetch(GEOJSON_URL).then(res => res.json()),
        fetch(FILES.STATE_GDP_CURRENT).then(res => res.text()),
        fetch(FILES.STATE_GDP_CONSTANT).then(res => res.text()),
        fetch(FILES.STATE_PPP_CURRENT).then(res => res.text()),
        fetch(FILES.STATE_PPP_CONSTANT).then(res => res.text())
    ]);

    // 2. Parse Country Data
    state.rawData.gdpCurrent = parseCSV(gdpCurRaw);
    state.rawData.gdpConstant = parseCSV(gdpConstRaw);
    state.rawData.pppCurrent = parseCSV(pppCurRaw);
    state.rawData.pppConstant = parseCSV(pppConstRaw);

    // 3. Parse and Merge State Data
    mergeStateData(stateGdpCur, 'gdpCurrent');
    mergeStateData(stateGdpConst, 'gdpConstant');
    mergeStateData(statePppCur, 'pppCurrent');
    mergeStateData(statePppConst, 'pppConstant');

    state.geoData = geoRaw;

    // Set initial active data
    updateActiveData();

    // 4. Extract country list (use current GDP as base)
    state.countries = Object.keys(state.rawData.gdpCurrent).map(code => ({
        code,
        name: state.rawData.gdpCurrent[code].name
    })).sort((a, b) => a.name.localeCompare(b.name));

    // 5. Setup UI
    setupEventListeners();
    loadSettings(); // Load saved preferences
    populateCountrySelector();
    setupCountrySearch();
    updateCountryChips();

    // 6. Initial Render
    // 6. Initial Render
    // 6. Initial Render
    hideLoading();
    setPriceType('current'); // Trigger initial render and UI sync
}

function loadSettings() {
    const savedStart = localStorage.getItem('gdp_explorer_year_start');
    const savedEnd = localStorage.getItem('gdp_explorer_year_end');

    if (savedStart) {
        let start = parseInt(savedStart);
        if (!isNaN(start) && start >= 1960 && start <= 2024) {
            state.yearStart = start;
        }
    }

    if (savedEnd) {
        let end = parseInt(savedEnd);
        if (!isNaN(end) && end >= 1960 && end <= 2024) {
            state.yearEnd = end;
        }
    }

    // Validate range
    if (state.yearStart >= state.yearEnd) {
        state.yearStart = 1990;
        state.yearEnd = 2024;
    }

    // Update UI elements
    const yearStartInput = document.getElementById('yearStart');
    const yearEndInput = document.getElementById('yearEnd');

    if (yearStartInput) {
        yearStartInput.value = state.yearStart;
        document.getElementById('yearStartDisplay').textContent = state.yearStart;
    }

    if (yearEndInput) {
        yearEndInput.value = state.yearEnd;
        document.getElementById('yearEndDisplay').textContent = state.yearEnd;
    }
}

function saveSettings() {
    localStorage.setItem('gdp_explorer_year_start', state.yearStart);
    localStorage.setItem('gdp_explorer_year_end', state.yearEnd);
}

function mergeStateData(csvText, targetKey) {
    const lines = csvText.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    const years = header.slice(1);

    const target = state.rawData[targetKey];

    for (let i = 1; i < lines.length; i++) {
        // Handle "State Name",Val1,Val2... format
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = parseCSVLine(line);

        if (parts.length < 2) continue;

        const name = parts[0];
        const values = {};

        // Generate a unique ID for state to convert mixing with Country Codes
        const code = 'USA_ST_' + name.replace(/\s+/g, '_').toUpperCase();

        for (let y = 0; y < years.length; y++) {
            const valIdx = y + 1;
            if (valIdx < parts.length) {
                const val = parts[valIdx];
                if (val && val !== '') {
                    values[years[y]] = parseFloat(val);
                }
            }
        }

        target[code] = { name, values };
    }
}


// ============================================
// Data Parsing
// ============================================

// Robust CSV Line Parser (handles quotes and commas correctly)
function parseCSVLine(line) {
    const parts = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    parts.push(current.trim());
    return parts.map(p => p.replace(/^"|"$/g, '').trim()); // Strip outer quotes
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = {};

    // Header is on line 5 (index 4)
    const headerLine = lines[4];
    if (!headerLine) return data;

    const headers = parseCSVLine(headerLine);
    const startYearIdx = headers.findIndex(h => h.trim() === '1960');

    if (startYearIdx === -1) return data;

    for (let i = 5; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = parseCSVLine(line);
        if (parts.length < 5) continue;

        const name = parts[0];
        const code = parts[1];
        const values = {};

        for (let j = startYearIdx; j < parts.length; j++) {
            const year = headers[j];
            if (!year || isNaN(year.trim())) continue;

            const val = parseFloat(parts[j]);
            values[year.trim()] = isNaN(val) ? null : val;
        }

        data[code] = { name, values };
    }

    return data;
}

// ============================================
// UI Controllers
// ============================================

function populateCountrySelector() {
    const selector = document.getElementById('countrySelect');
    state.countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        selector.appendChild(option);
    });
}

function setupCountrySearch() {
    const searchInput = document.getElementById('countrySearch');
    const dropdown = document.getElementById('countrySearchDropdown');

    if (!searchInput || !dropdown) return;

    let selectedIndex = -1;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        dropdown.innerHTML = '';
        selectedIndex = -1;

        if (query.length < 1) {
            dropdown.classList.remove('visible');
            return;
        }

        const matches = state.countries.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.code.toLowerCase().includes(query)
        ).slice(0, 10); // Limit to 10 results

        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="search-no-results">No countries found</div>';
            dropdown.classList.add('visible');
            return;
        }

        matches.forEach((country, idx) => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.dataset.code = country.code;
            item.dataset.index = idx;

            const isSelected = state.selectedCountries.includes(country.code);
            item.innerHTML = `
                <span class="search-result-name">${highlightMatch(country.name, query)}</span>
                <span class="search-result-code">${country.code}</span>
                ${isSelected ? '<span class="search-result-added">✓</span>' : ''}
            `;

            item.addEventListener('click', () => {
                addCountryFromSearch(country.code);
                searchInput.value = '';
                dropdown.classList.remove('visible');
            });

            dropdown.appendChild(item);
        });

        dropdown.classList.add('visible');
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.search-result-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelectedItem(items, selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelectedItem(items, selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && items[selectedIndex]) {
                const code = items[selectedIndex].dataset.code;
                addCountryFromSearch(code);
                searchInput.value = '';
                dropdown.classList.remove('visible');
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('visible');
            searchInput.blur();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('visible');
        }
    });
}

function updateSelectedItem(items, selectedIndex) {
    items.forEach((item, idx) => {
        item.classList.toggle('selected', idx === selectedIndex);
    });
}

function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function addCountryFromSearch(code) {
    if (!state.selectedCountries.includes(code)) {
        state.selectedCountries.push(code);
        updateCountryChips();
        updateVisualization();
        updateInsights();
    }
}

function updateCountryChips() {
    const container = document.getElementById('selectedCountries');
    container.innerHTML = '';

    state.selectedCountries.forEach(code => {
        const country = state.countries.find(c => c.code === code);
        if (!country) return;

        const chip = document.createElement('div');
        chip.className = 'country-chip';
        chip.innerHTML = `
            <span>${country.name}</span>
            <button data-code="${code}">✕</button>
        `;

        chip.querySelector('button').addEventListener('click', () => {
            removeCountry(code);
        });

        container.appendChild(chip);
    });
}

function setupEventListeners() {
    // View Mode Buttons
    // View Mode Buttons
    const viewBtns = document.querySelectorAll('.view-btn[data-view]');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentView = btn.dataset.view;

            // Toggle containers
            if (state.currentView === 'map') {
                document.getElementById('chartContainer').style.display = 'none';
                document.getElementById('mapContainer').style.display = 'block';
                document.getElementById('mapYearControl').style.display = 'block';
                document.getElementById('dataTableContainer').style.display = 'none';
                document.getElementById('globalRankingsContainer').style.display = 'block';
                renderMap();
            } else {
                document.getElementById('chartContainer').style.display = 'block';
                document.getElementById('mapContainer').style.display = 'none';
                document.getElementById('mapYearControl').style.display = 'none';
                document.getElementById('dataTableContainer').style.display = 'block';
                document.getElementById('globalRankingsContainer').style.display = 'none';
                updateVisualization();
            }

            // Handle PLI Price Type Restrictions
            const priceBtns = document.querySelectorAll('[data-price]');
            if (state.currentView === 'ratio') {
                // PLI must be calculated using Current prices
                setPriceType('current');
                priceBtns.forEach(b => b.classList.add('disabled'));
                priceBtns.forEach(b => b.disabled = true);
            } else {
                priceBtns.forEach(b => b.classList.remove('disabled'));
                priceBtns.forEach(b => b.disabled = false);
            }

            // Update insights to reflect current view's data source
            updateInsights();
        });
    });

    // Price Type Buttons
    document.querySelectorAll('[data-price]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (state.currentView === 'ratio') return; // Prevent change in PLI mode
            const type = btn.dataset.price;
            setPriceType(type);
        });
    });

    // Country Selector
    document.getElementById('countrySelect').addEventListener('change', (e) => {
        const options = e.target.selectedOptions;
        Array.from(options).forEach(opt => {
            if (!state.selectedCountries.includes(opt.value)) {
                state.selectedCountries.push(opt.value);
            }
        });
        updateCountryChips();
        updateVisualization();
        updateInsights();
    });

    // Year Sliders
    const yearStart = document.getElementById('yearStart');
    const yearEnd = document.getElementById('yearEnd');

    yearStart.addEventListener('input', (e) => {
        state.yearStart = parseInt(e.target.value);
        if (state.yearStart >= state.yearEnd) {
            state.yearEnd = Math.min(2024, state.yearStart + 1);
            yearEnd.value = state.yearEnd;
            document.getElementById('yearEndDisplay').textContent = state.yearEnd;
        }
        document.getElementById('yearStartDisplay').textContent = state.yearStart;
        saveSettings();
        updateVisualization();
        updateInsights();
    });

    yearEnd.addEventListener('input', (e) => {
        state.yearEnd = parseInt(e.target.value);
        if (state.yearEnd <= state.yearStart) {
            state.yearStart = Math.max(1960, state.yearEnd - 1);
            yearStart.value = state.yearStart;
            document.getElementById('yearStartDisplay').textContent = state.yearStart;
        }
        document.getElementById('yearEndDisplay').textContent = state.yearEnd;
        saveSettings();
        updateVisualization();
        updateInsights();
    });

    // Map Controls
    document.getElementById('mapYear').addEventListener('input', (e) => {
        state.mapYear = parseInt(e.target.value);
        document.getElementById('mapYearDisplay').textContent = state.mapYear;
        if (state.currentView === 'map') renderMap();
    });

    document.getElementById('playBtn').addEventListener('click', togglePlay);

    // Header Stats
    document.getElementById('countryCount').textContent = state.countries.length;

    // Download/Action Buttons
    document.getElementById('downloadChart').addEventListener('click', downloadChart);
    document.getElementById('resetZoom').addEventListener('click', () => state.chart && state.chart.resetZoom());
    document.getElementById('exportData').addEventListener('click', exportToCSV);

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        const root = document.documentElement;
        const isDark = root.classList.contains('dark-mode');
        const isLight = root.classList.contains('light-mode');

        if (isDark) {
            root.classList.remove('dark-mode');
            root.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
        } else if (isLight) {
            root.classList.remove('light-mode');
            root.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            // System preference - toggle to opposite
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                root.classList.add('light-mode');
                localStorage.setItem('theme', 'light');
            } else {
                root.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            }
        }
        // Re-render chart with new colors
        if (state.currentView !== 'map') {
            renderChart();
        } else {
            renderMap();
        }
    });

    // Restore saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
    } else if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
    }
}

function removeCountry(code) {
    state.selectedCountries = state.selectedCountries.filter(c => c !== code);
    updateCountryChips();
    updateVisualization();
    updateInsights();
}

function togglePlay() {
    const btn = document.getElementById('playBtn');
    if (state.isPlaying) {
        clearInterval(state.playInterval);
        btn.textContent = '▶️ Play';
        state.isPlaying = false;
    } else {
        btn.textContent = '⏸️ Pause';
        state.isPlaying = true;
        state.playInterval = setInterval(() => {
            state.mapYear++;
            if (state.mapYear > 2024) state.mapYear = 1960;
            document.getElementById('mapYear').value = state.mapYear;
            document.getElementById('mapYearDisplay').textContent = state.mapYear;
            renderMap();
        }, 800);
    }
}

// ============================================
// Visualization Rendering
// ============================================

function updateVisualization() {
    if (state.currentView === 'map') {
        renderMap();
        return;
    }

    renderChart();
    updateDataTable();
}

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    const years = [];
    for (let i = state.yearStart; i <= state.yearEnd; i++) years.push(i);

    let datasets = [];
    let title = '';
    let yAxisLabel = '';

    switch (state.currentView) {
        case 'gdp':
            title = state.priceType === 'current' ?
                'GDP per Capita (Current US$)' :
                'GDP per Capita (Constant 2015 US$)';
            yAxisLabel = 'USD';
            datasets = createDatasets(state.gdpData, years);
            break;
        case 'ppp':
            title = state.priceType === 'current' ?
                'GDP per Capita, PPP (Current International $)' :
                'GDP per Capita, PPP (Constant 2021 International $)';
            yAxisLabel = 'International $';
            datasets = createDatasets(state.pppData, years);
            break;
        case 'ratio':
            title = 'Price Level Index (PLI)';
            yAxisLabel = 'Price Level Index';
            datasets = createRatioDatasets(years);
            break;
        case 'compare':
            title = 'GDP vs PPP Comparison';
            yAxisLabel = 'USD / International $';
            datasets = createComparisonDatasets(years);
            break;
    }

    document.getElementById('chartTitle').textContent = title;

    if (state.chart) state.chart.destroy();

    state.chart = new Chart(ctx, {
        type: 'line',
        data: { labels: years, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#6b7280',
                        font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 12 },
                        usePointStyle: true,
                        padding: 16
                    }
                },
                tooltip: {
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-tooltip-bg').trim() || '#1f2937',
                    titleColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-tooltip-text').trim() || '#ffffff',
                    bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-tooltip-text').trim() || '#e5e7eb',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-border').trim() || '#374151',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 6,
                    callbacks: {
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += state.currentView === 'ratio' ?
                                    context.parsed.y.toFixed(3) :
                                    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'xy',
                    },
                    pan: { enabled: true, mode: 'xy' }
                }
            },
            scales: {
                x: {
                    grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#f3f4f6' },
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#6b7280', font: { size: 11 } },
                    border: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-border').trim() || '#e5e7eb' }
                },
                y: {
                    min: 0, // GDP cannot be negative
                    grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#f3f4f6' },
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#6b7280', font: { size: 11 } },
                    border: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-border').trim() || '#e5e7eb' },
                    title: { display: true, text: yAxisLabel, color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#6b7280', font: { size: 12, weight: '500' } }
                }
            },
            animations: {
                y: { duration: 300 }
            }
        }
    });
}

function createDatasets(sourceData, years) {
    return state.selectedCountries.map((code, i) => {
        const country = sourceData[code];
        if (!country) return null;

        // Calculate growth for the selected period
        const startYear = years[0];
        const endYear = years[years.length - 1];
        const startVal = country.values[startYear];
        const endVal = country.values[endYear];
        let growthLabel = '';
        if (startVal && endVal) {
            const growth = ((endVal - startVal) / startVal * 100);
            growthLabel = ` (${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%)`;
        }

        return {
            label: country.name + growthLabel,
            data: years.map(y => country.values[y]),
            borderColor: COLORS[i % COLORS.length],
            backgroundColor: COLORS[i % COLORS.length] + '20',
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: false
        };
    }).filter(d => d !== null);
}

function createRatioDatasets(years) {
    return state.selectedCountries.map((code, i) => {
        // PLI is always calculated using current prices: Nominal GDP / PPP
        const gdp = state.rawData.gdpCurrent[code];
        const ppp = state.rawData.pppCurrent[code];
        if (!gdp || !ppp) return null;

        // Calculate ratio growth for the selected period
        const startYear = years[0];
        const endYear = years[years.length - 1];
        const gStart = gdp.values[startYear];
        const pStart = ppp.values[startYear];
        const gEnd = gdp.values[endYear];
        const pEnd = ppp.values[endYear];
        let growthLabel = '';
        if (gStart && pStart && gEnd && pEnd) {
            const startRatio = gStart / pStart;
            const endRatio = gEnd / pEnd;
            const growth = ((endRatio - startRatio) / startRatio * 100);
            growthLabel = ` (${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%)`;
        }

        return {
            label: gdp.name + growthLabel,
            data: years.map(y => {
                const gVal = gdp.values[y];
                const pVal = ppp.values[y];
                return (gVal && pVal) ? (gVal / pVal) : null;
            }),
            borderColor: COLORS[i % COLORS.length],
            borderWidth: 3,
            tension: 0.3,
            fill: false
        };
    }).filter(d => d !== null);
}

function createComparisonDatasets(years) {
    const datasets = [];
    const startYear = years[0];
    const endYear = years[years.length - 1];

    // Only show first 3 selected countries to avoid clutter in comparison mode
    state.selectedCountries.slice(0, 3).forEach((code, i) => {
        const gdp = state.gdpData[code];
        const ppp = state.pppData[code];
        if (!gdp || !ppp) return;

        // Calculate GDP growth
        const gdpStart = gdp.values[startYear];
        const gdpEnd = gdp.values[endYear];
        let gdpGrowthLabel = '';
        if (gdpStart && gdpEnd) {
            const growth = ((gdpEnd - gdpStart) / gdpStart * 100);
            gdpGrowthLabel = ` ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
        }

        // Calculate PPP growth
        const pppStart = ppp.values[startYear];
        const pppEnd = ppp.values[endYear];
        let pppGrowthLabel = '';
        if (pppStart && pppEnd) {
            const growth = ((pppEnd - pppStart) / pppStart * 100);
            pppGrowthLabel = ` ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
        }

        datasets.push({
            label: `${gdp.name} (GDP${gdpGrowthLabel})`,
            data: years.map(y => gdp.values[y]),
            borderColor: COLORS[i % COLORS.length],
            borderWidth: 3,
            borderDash: [5, 5],
            tension: 0.3
        });

        datasets.push({
            label: `${gdp.name} (PPP${pppGrowthLabel})`,
            data: years.map(y => ppp.values[y]),
            borderColor: COLORS[i % COLORS.length],
            borderWidth: 3,
            tension: 0.3
        });
    });
    return datasets;
}

// ============================================
// Map Logic
// ============================================

function renderMap() {
    const svg = document.getElementById('worldMap');
    const tooltip = document.getElementById('mapTooltip');
    const year = state.mapYear;

    // Clear and prepare
    svg.innerHTML = '';

    // Use 1000x600 for better aspect ratio (matches viewBox)
    const width = 1000;
    const height = 600;

    // Calculate rankings and stats for all countries
    const countryStats = [];
    Object.keys(state.gdpData).forEach(code => {
        const gdpCountry = state.gdpData[code];
        const pppCountry = state.pppData[code];
        const gdpVal = gdpCountry?.values[year];
        const pppVal = pppCountry?.values[year];

        // Calculate growth (5 year)
        const prevYear = year - 5;
        const gdpPrev = gdpCountry?.values[prevYear];
        const growth = (gdpVal && gdpPrev) ? ((gdpVal - gdpPrev) / gdpPrev * 100) : null;

        if (gdpVal !== null && gdpVal !== undefined) {
            countryStats.push({
                code,
                name: gdpCountry.name,
                gdp: gdpVal,
                ppp: pppVal,
                growth,
                ratio: (gdpVal && pppVal) ? (gdpVal / pppVal) : null
            });
        }
    });

    // Sort by GDP for rankings
    countryStats.sort((a, b) => b.gdp - a.gdp);
    const rankMap = {};
    countryStats.forEach((c, i) => rankMap[c.code] = i + 1);

    // Find min/max for scale
    let min = Infinity, max = -Infinity;
    countryStats.forEach(c => {
        if (c.gdp < min) min = c.gdp;
        if (c.gdp > max) max = c.gdp;
    });

    // Use logarithmic scale for sequential blue palette
    const noDataColor = getComputedStyle(document.documentElement).getPropertyValue('--map-no-data').trim() || '#f3f4f6';
    const colorScale = (val) => {
        if (val === null || val === undefined) return noDataColor;
        const normalized = Math.log(val) / Math.log(max);
        // Sequential blue scale
        const colors = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];
        const idx = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
        return colors[idx];
    };

    document.getElementById('minValue').textContent = `$${Math.round(min).toLocaleString()}`;
    document.getElementById('maxValue').textContent = `$${Math.round(max).toLocaleString()}+`;

    // Process GeoJSON features
    state.geoData.features.forEach(feature => {
        // Use ISO3166-1-Alpha-3 as the country code (GeoJSON property name)
        const code = feature.properties['ISO3166-1-Alpha-3'];
        const countryName = feature.properties.name || feature.properties.ADMIN || 'Unknown';
        const gdpCountry = state.gdpData[code];
        const pppCountry = state.pppData[code];
        const gdpVal = gdpCountry ? gdpCountry.values[year] : null;
        const pppVal = pppCountry ? pppCountry.values[year] : null;
        const rank = rankMap[code];

        // Calculate growth
        const prevYear = year - 5;
        const gdpPrev = gdpCountry?.values[prevYear];
        const growth = (gdpVal && gdpPrev) ? ((gdpVal - gdpPrev) / gdpPrev * 100) : null;
        const ratio = (gdpVal && pppVal) ? (gdpVal / pppVal) : null;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', generatePathData(feature.geometry, width, height));
        path.setAttribute('fill', colorScale(gdpVal));
        path.setAttribute('data-code', code);

        // Highlight selected countries
        const isSelected = state.selectedCountries.includes(code);
        if (isSelected) {
            path.style.stroke = '#f59e0b';
            path.style.strokeWidth = '2';
        }

        path.addEventListener('mouseenter', (e) => {
            path.style.stroke = isSelected ? '#f59e0b' : '#fff';
            path.style.strokeWidth = isSelected ? '3' : '2';
            tooltip.classList.add('visible');

            // Enhanced tooltip with more info
            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <strong>${countryName}</strong>
                    ${rank ? `<span class="tooltip-rank">#${rank}</span>` : ''}
                </div>
                <div class="tooltip-grid">
                    <span class="tooltip-label">GDP (${year}):</span>
                    <span class="tooltip-value">${gdpVal ? '$' + Math.round(gdpVal).toLocaleString() : 'N/A'}</span>
                    <span class="tooltip-label">PPP:</span>
                    <span class="tooltip-value">${pppVal ? '$' + Math.round(pppVal).toLocaleString() : 'N/A'}</span>
                    <span class="tooltip-label">PLI:</span>
                    <span class="tooltip-value">${ratio ? ratio.toFixed(3) : 'N/A'}</span>
                    <span class="tooltip-label">5yr Growth:</span>
                    <span class="tooltip-value ${growth !== null ? (growth >= 0 ? 'positive' : 'negative') : ''}">${growth !== null ? (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%' : 'N/A'}</span>
                </div>
                <div class="tooltip-hint">
                    ${isSelected ? 'Click to remove from comparison' : 'Click to add to comparison'}
                </div>
            `;
        });

        path.addEventListener('mousemove', (e) => {
            // Use clientX/clientY for fixed positioning (doesn't include scroll offset)
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        });

        path.addEventListener('mouseleave', () => {
            path.style.stroke = isSelected ? '#f59e0b' : '#e5e7eb';
            path.style.strokeWidth = isSelected ? '2' : '0.5';
            tooltip.classList.remove('visible');
        });

        // Single click to toggle country selection (mobile-friendly)
        path.addEventListener('click', (e) => {
            e.preventDefault();
            if (!code) return;

            if (state.selectedCountries.includes(code)) {
                // Remove country
                removeCountry(code);
                // Update just this path's style instead of re-rendering
                path.style.stroke = '#e5e7eb';
                path.style.strokeWidth = '0.5';
            } else {
                // Add country
                state.selectedCountries.push(code);
                updateCountryChips();
                updateInsights();
                updateDataTable();
                // Update just this path's style instead of re-rendering
                path.style.stroke = '#f59e0b';
                path.style.strokeWidth = '2';
            }
            // Update the global rankings table to reflect selection state
            renderGlobalRankings();
        });

        // Prevent context menu on right-click
        path.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        svg.appendChild(path);
    });

    // Update global rankings table
    updateGlobalRankings(countryStats);
}

// Mercator projection for the world map
function generatePathData(geometry, width, height) {
    if (!geometry) return "";

    // Web Mercator projection with proper scaling
    const maxLat = 85; // Clamp latitude to avoid infinite values

    // Pre-calculate the Y bounds for the max latitude
    const latRadMax = maxLat * Math.PI / 180;
    const mercMax = Math.log(Math.tan(Math.PI / 4 + latRadMax / 2));

    const project = (coords) => {
        const lon = coords[0];
        let lat = Math.max(-maxLat, Math.min(maxLat, coords[1]));

        // X: linear mapping from -180..180 to 0..width
        const x = (lon + 180) * (width / 360);

        // Y: Mercator projection, scaled to fit within height
        const latRad = lat * Math.PI / 180;
        const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
        // Map mercY from [-mercMax, mercMax] to [height, 0]
        const y = (height / 2) - (mercY / mercMax) * (height / 2);

        return `${x.toFixed(2)},${y.toFixed(2)}`;
    };

    const processRing = (ring) => {
        if (!ring || ring.length === 0) return "";
        return "M" + ring.map(project).join("L") + "Z";
    };

    if (geometry.type === "Polygon") {
        return processRing(geometry.coordinates[0]);
    } else if (geometry.type === "MultiPolygon") {
        return geometry.coordinates.map(polygon =>
            processRing(polygon[0])
        ).join(" ");
    }
    return "";
}

// ============================================
// Data Table & Insights
// ============================================

function updateDataTable() {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    // Update Headers
    const gdpHeader = document.getElementById('headerGdp');
    const pppHeader = document.getElementById('headerPpp');
    if (gdpHeader && pppHeader) {
        const typeLabel = state.priceType === 'current' ? 'Current' : 'Constant 2015'; // 2015/2021 simplification
        const pppTypeLabel = state.priceType === 'current' ? 'Current' : 'Constant 2021';
        gdpHeader.innerHTML = `GDP per Capita <span class="header-subtitle" style="font-size:0.8em; opacity:0.7">(${typeLabel})</span> <span class="sort-icon">↕</span>`;
        pppHeader.innerHTML = `PPP per Capita <span class="header-subtitle" style="font-size:0.8em; opacity:0.7">(${pppTypeLabel})</span> <span class="sort-icon">↕</span>`;
    }

    // Determine primary data source based on view
    const usePPP = state.currentView === 'ppp';
    const latestYear = state.yearEnd;
    const prevYear = state.yearStart;

    const isSelectionEmpty = state.selectedCountries.length === 0;
    const codesToShow = isSelectionEmpty ? state.countries.map(c => c.code) : state.selectedCountries;

    // Update Header
    const headerTitle = document.getElementById('tableHeaderTitle');
    if (headerTitle) {
        headerTitle.textContent = isSelectionEmpty ? 'Global Data Overview' : 'Selected Countries Comparison';
    }

    // Build data array for sorting
    const tableData = codesToShow.map(code => {
        const gdp = state.gdpData[code];
        const ppp = state.pppData[code];
        if (!gdp && !ppp) return null;

        const gVal = gdp ? gdp.values[latestYear] : null;
        const pVal = ppp ? ppp.values[latestYear] : null;

        // Calculate growth based on current view
        let growth = null;
        if (usePPP && ppp) {
            const oldPVal = ppp.values[prevYear];
            growth = (pVal && oldPVal) ? ((pVal - oldPVal) / oldPVal * 100) : null;
        } else if (gdp) {
            const oldGVal = gdp.values[prevYear];
            growth = (gVal && oldGVal) ? ((gVal - oldGVal) / oldGVal * 100) : null;
        }

        // For PLI, always use CURRENT prices
        const gdpCur = state.rawData.gdpCurrent[code];
        const pppCur = state.rawData.pppCurrent[code];
        const gValCur = gdpCur ? gdpCur.values[latestYear] : null;
        const pValCur = pppCur ? pppCur.values[latestYear] : null;

        const ratio = (gValCur && pValCur) ? (gValCur / pValCur) : null;
        const name = (usePPP && ppp) ? ppp.name : (gdp ? gdp.name : 'Unknown');

        return { code, name, gdp: gVal, ppp: pVal, ratio, growth };
    }).filter(d => d !== null);

    // Sort based on current sort field
    tableData.sort((a, b) => {
        let aVal, bVal;
        switch (dataSortField) {
            case 'name':
                aVal = a.name;
                bVal = b.name;
                return dataSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'gdp':
                aVal = a.gdp || 0;
                bVal = b.gdp || 0;
                break;
            case 'ppp':
                aVal = a.ppp || 0;
                bVal = b.ppp || 0;
                break;
            case 'ratio':
                aVal = a.ratio || 0;
                bVal = b.ratio || 0;
                break;
            case 'growth':
                aVal = a.growth || -Infinity;
                bVal = b.growth || -Infinity;
                break;
            default:
                aVal = a.gdp || 0;
                bVal = b.gdp || 0;
        }
        return dataSortAsc ? aVal - bVal : bVal - aVal;
    });

    // Render sorted rows
    tableData.forEach(d => {
        const tr = document.createElement('tr');
        tr.dataset.code = d.code;

        let actionBtn;
        if (isSelectionEmpty) {
            actionBtn = `<button class="compare-btn add" onclick="addCountryFromSearch('${d.code}')" title="Add to comparison">+</button>`;
        } else {
            actionBtn = `<button class="remove-btn" onclick="removeCountry('${d.code}')" title="Remove from comparison">✕</button>`;
        }

        tr.innerHTML = `
            <td>${d.name}</td>
            <td>${d.gdp ? '$' + Math.round(d.gdp).toLocaleString() : 'N/A'}</td>
            <td>${d.ppp ? '$' + Math.round(d.ppp).toLocaleString() : 'N/A'}</td>
            <td>${d.ratio ? d.ratio.toFixed(3) : 'N/A'}</td>
            <td class="${d.growth !== null ? (d.growth >= 0 ? 'positive' : 'negative') : ''}">
                ${d.growth !== null ? (d.growth >= 0 ? '+' : '') + d.growth.toFixed(1) + '%' : 'N/A'}
            </td>
            <td>
                ${actionBtn}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateInsights() {
    const content = document.getElementById('insightsContent');
    const topContainer = document.getElementById('topPerformers');
    const trendContainer = document.getElementById('growthTrends');

    if (state.selectedCountries.length < 1) {
        content.innerHTML = '<p>Select countries to see insights and growth statistics.</p>';
        topContainer.innerHTML = '';
        trendContainer.innerHTML = '';
        return;
    }

    // Determine which data source to use based on current view
    const usePPP = state.currentView === 'ppp';
    const dataSource = usePPP ? state.pppData : state.gdpData;
    const dataLabel = usePPP ? 'PPP' : 'GDP';
    const currencyLabel = usePPP ? 'Int\'l $' : 'USD';

    // Use the user's selected year range
    const startYear = state.yearStart;
    const endYear = state.yearEnd;
    const yearSpan = endYear - startYear;

    // Calculate values for selected countries
    const countryStats = state.selectedCountries
        .filter(code => dataSource[code])
        .map(code => {
            const country = dataSource[code];
            const endVal = country.values[endYear];
            const startVal = country.values[startYear];

            // Calculate growth over selected period
            const growthPeriod = (endVal && startVal) ? ((endVal - startVal) / startVal * 100) : null;

            // Calculate CAGR over selected period
            const cagr = (endVal && startVal && yearSpan > 0) ?
                ((Math.pow(endVal / startVal, 1 / yearSpan) - 1) * 100) : null;

            return {
                code,
                name: country.name,
                startVal,
                endVal,
                growthPeriod,
                cagr
            };
        })
        .filter(c => c.endVal)
        .sort((a, b) => b.endVal - a.endVal);

    if (countryStats.length === 0) {
        content.innerHTML = '<p>No data available for selected countries.</p>';
        topContainer.innerHTML = '';
        trendContainer.innerHTML = '';
        return;
    }

    // Key Insights content
    const leader = countryStats[0];
    let insightHTML = `
        <p><span class="insight-highlight">${leader.name}</span> leads with ${dataLabel} per capita of 
        <span class="insight-highlight">$${Math.round(leader.endVal).toLocaleString()}</span> (${currencyLabel}) in ${endYear}.</p>
    `;

    if (countryStats.length >= 2) {
        const runnerUp = countryStats[1];
        const diff = ((leader.endVal - runnerUp.endVal) / runnerUp.endVal * 100).toFixed(1);
        insightHTML += `<p>That's <span class="insight-highlight">${diff}%</span> higher than ${runnerUp.name}.</p>`;
    }

    // Add growth summary based on selected period
    if (leader.growthPeriod !== null && leader.startVal) {
        const growthDir = leader.growthPeriod >= 0 ? 'grew' : 'declined';
        insightHTML += `<p>${dataLabel} per capita ${growthDir} by <span class="insight-highlight">${Math.abs(leader.growthPeriod).toFixed(1)}%</span> from ${startYear} to ${endYear}.</p>`;
        if (leader.cagr !== null && yearSpan > 1) {
            insightHTML += `<p>Avg. annual growth (CAGR): <span class="insight-highlight">${leader.cagr >= 0 ? '+' : ''}${leader.cagr.toFixed(2)}%</span></p>`;
        }
    }

    content.innerHTML = insightHTML;

    // Top Performers (by end year value)
    topContainer.innerHTML = countryStats.slice(0, 3).map((item, i) => `
        <div class="performer-item">
            <span class="performer-rank">${i + 1}</span>
            <span class="performer-name">${item.name}</span>
            <span class="performer-value">$${Math.round(item.endVal / 1000)}k</span>
        </div>
    `).join('');

    // Growth Trends (sorted by period growth)
    const growthSorted = [...countryStats]
        .filter(c => c.growthPeriod !== null)
        .sort((a, b) => b.growthPeriod - a.growthPeriod);

    if (growthSorted.length > 0) {
        trendContainer.innerHTML = growthSorted.slice(0, 3).map(item => {
            const isPositive = item.growthPeriod >= 0;
            return `
                <div class="trend-item">
                    <span class="trend-name">${item.name}</span>
                    <span class="trend-value ${isPositive ? '' : 'negative'}">${isPositive ? '+' : ''}${item.growthPeriod.toFixed(1)}%</span>
                </div>
            `;
        }).join('');
    } else {
        trendContainer.innerHTML = '<div class="trend-item"><span class="trend-name">No growth data available</span></div>';
    }
}

function updateStats() {
    // Current range handled in listener
}

// ============================================
// Utilities
// ============================================

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function downloadChart() {
    const link = document.createElement('a');
    link.download = `gdp-explorer-${state.currentView}.png`;
    link.href = document.getElementById('mainChart').toDataURL('image/png');
    link.click();
}

function exportToCSV() {
    let csv = 'Country,Year,GDP_USD,PPP_Intl,Ratio\n';
    state.selectedCountries.forEach(code => {
        for (let y = state.yearStart; y <= state.yearEnd; y++) {
            const g = state.gdpData[code].values[y] || '';
            const p = state.pppData[code]?.values[y] || '';
            const r = (g && p) ? (g / p).toFixed(4) : '';
            csv += `"${state.gdpData[code].name}",${y},${g},${p},${r}\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'gdp_data_export.csv');
    a.click();
}

// ============================================
// Global Rankings Table
// ============================================

let globalRankingsData = [];
let rankingsSortField = 'rank';
let rankingsSortAsc = true;
let rankingsSearchQuery = '';

function updateGlobalRankings(countryStats) {
    globalRankingsData = countryStats;
    document.getElementById('rankingYear').textContent = state.mapYear;
    renderGlobalRankings();
}

function renderGlobalRankings() {
    const tbody = document.getElementById('globalRankingsBody');
    if (!tbody) return;

    // Filter by search
    let filtered = globalRankingsData;
    if (rankingsSearchQuery) {
        const query = rankingsSearchQuery.toLowerCase();
        filtered = globalRankingsData.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.code.toLowerCase().includes(query)
        );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
        let aVal, bVal;
        switch (rankingsSortField) {
            case 'rank':
                aVal = globalRankingsData.indexOf(a);
                bVal = globalRankingsData.indexOf(b);
                break;
            case 'name':
                aVal = a.name;
                bVal = b.name;
                return rankingsSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'gdp':
                aVal = a.gdp || 0;
                bVal = b.gdp || 0;
                break;
            case 'ppp':
                aVal = a.ppp || 0;
                bVal = b.ppp || 0;
                break;
            case 'growth':
                aVal = a.growth || -Infinity;
                bVal = b.growth || -Infinity;
                break;
            default:
                aVal = a.gdp || 0;
                bVal = b.gdp || 0;
        }
        return rankingsSortAsc ? aVal - bVal : bVal - aVal;
    });

    tbody.innerHTML = sorted.map((c, i) => {
        const originalRank = globalRankingsData.indexOf(c) + 1;
        const isSelected = state.selectedCountries.includes(c.code);
        return `
            <tr class="${isSelected ? 'row-selected' : ''}" data-code="${c.code}">
                <td class="rank-cell">${originalRank}</td>
                <td>${c.name}</td>
                <td>$${Math.round(c.gdp).toLocaleString()}</td>
                <td>${c.ppp ? '$' + Math.round(c.ppp).toLocaleString() : 'N/A'}</td>
                <td class="${c.growth !== null ? (c.growth >= 0 ? 'positive' : 'negative') : ''}">
                    ${c.growth !== null ? (c.growth >= 0 ? '+' : '') + c.growth.toFixed(1) + '%' : 'N/A'}
                </td>
                <td>
                    <button class="compare-btn ${isSelected ? 'remove' : 'add'}" 
                            onclick="toggleCountryFromRankings('${c.code}')">
                        ${isSelected ? '✕' : '+'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function toggleCountryFromRankings(code) {
    if (state.selectedCountries.includes(code)) {
        removeCountry(code);
    } else {
        state.selectedCountries.push(code);
        updateCountryChips();
        updateInsights();
        updateDataTable();
    }
    renderGlobalRankings();
    if (state.currentView === 'map') renderMap();
}

function setupGlobalRankingsListeners() {
    // Search input
    const searchInput = document.getElementById('rankingSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            rankingsSearchQuery = e.target.value;
            renderGlobalRankings();
        });
    }

    // Metric selector
    const metricSelect = document.getElementById('rankingMetric');
    if (metricSelect) {
        metricSelect.addEventListener('change', (e) => {
            rankingsSortField = e.target.value;
            rankingsSortAsc = false; // Default to descending for metrics
            renderGlobalRankings();
        });
    }

    // Sortable headers
    const headers = document.querySelectorAll('#globalRankingsTable th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (rankingsSortField === field) {
                rankingsSortAsc = !rankingsSortAsc;
            } else {
                rankingsSortField = field;
                rankingsSortAsc = field === 'name' || field === 'rank';
            }

            // Update sort icons
            headers.forEach(h => {
                h.classList.remove('sorted-asc', 'sorted-desc');
                h.querySelector('.sort-icon').textContent = '↕';
            });
            th.classList.add(rankingsSortAsc ? 'sorted-asc' : 'sorted-desc');
            th.querySelector('.sort-icon').textContent = rankingsSortAsc ? '↑' : '↓';

            renderGlobalRankings();
        });
    });
}

// ============================================
// Sortable Data Table (Selected Countries)
// ============================================

let dataSortField = 'gdp';
let dataSortAsc = false;

function setupDataTableSorting() {
    const headers = document.querySelectorAll('#dataTable th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (dataSortField === field) {
                dataSortAsc = !dataSortAsc;
            } else {
                dataSortField = field;
                dataSortAsc = field === 'name';
            }

            // Update sort icons
            headers.forEach(h => {
                h.classList.remove('sorted-asc', 'sorted-desc');
                h.querySelector('.sort-icon').textContent = '↕';
            });
            th.classList.add(dataSortAsc ? 'sorted-asc' : 'sorted-desc');
            th.querySelector('.sort-icon').textContent = dataSortAsc ? '↑' : '↓';

            updateDataTable();
        });
    });
}

// Initialize additional listeners after DOM load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupGlobalRankingsListeners();
        setupDataTableSorting();
    }, 100);
});
