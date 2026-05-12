/**
 * Country Indicators Explorer - Interactive Visualization Logic
 * Handles data parsing, state management, and visualization rendering.
 */

// Configuration & Constants
const FILES = {
    GDP_CURRENT: 'API_NY.GDP.PCAP.CD_DS2_en_csv_v2_174336.csv',
    GDP_CONSTANT: 'API_NY.GDP.PCAP.KD_DS2_en_csv_v2_141.csv',
    PPP_CURRENT: 'API_NY.GDP.PCAP.PP.CD_DS2_en_csv_v2_138.csv',
    PPP_CONSTANT: 'API_NY.GDP.PCAP.PP.KD_DS2_en_csv_v2_1423.csv',
    LIFE_EXPECTANCY: 'life_expectancy.csv',
    PPP_CONVERSION: 'countries_ppp_conversion_factor.csv',
    STATE_GDP_CURRENT: 'US_States_GDP_PC_Current.csv',
    STATE_GDP_CONSTANT: 'US_States_GDP_PC_Constant.csv',
    STATE_PPP_CURRENT: 'US_States_PPP_PC_Current.csv',
    STATE_PPP_CONSTANT: 'US_States_PPP_PC_Constant.csv',
    STATE_LIFE_EXPECTANCY: 'US_States_Life_Expectancy.csv',
    STATE_POPULATION: 'processing_files/US_States_Population_Calculated.csv'
};

const COLORS = [
    '#b45309', '#4f46e5', '#be123c', '#2563eb', '#9333ea',
    '#c2410c', '#0891b2', '#64748b', '#ca8a04', '#7c2d12'
];

const DEFAULT_COUNTRY_CODES = ['USA', 'CHN', 'IND', 'DEU', 'BRA'];
const DEFAULT_STATE_CODES = [
    'USA_ST_CALIFORNIA',
    'USA_ST_TEXAS',
    'USA_ST_NEW_YORK',
    'USA_ST_FLORIDA',
    'USA_ST_WASHINGTON'
];

const AGGREGATE_CODES = new Set([
    'AFE', 'AFW', 'ARB', 'CEB', 'CSS', 'EAP', 'EAR', 'EAS', 'ECA', 'ECS',
    'EMU', 'EUU', 'FCS', 'HIC', 'HPC', 'IBD', 'IBT', 'IDA', 'IDB', 'IDX',
    'INX', 'LAC', 'LCN', 'LDC', 'LIC', 'LMC', 'LMY', 'LTE', 'MEA', 'MIC',
    'MNA', 'NAC', 'OED', 'OSS', 'PRE', 'PST', 'SAS', 'SSA', 'SSF', 'SST',
    'TEA', 'TEC', 'TLA', 'TMN', 'TSA', 'TSS', 'UMC', 'WLD'
]);

const ENTITY_SCOPE_LABELS = {
    countries: 'Countries',
    states: 'U.S. States',
    all: 'All entities'
};

const VIEW_LABELS = {
    gdp: 'GDP',
    ppp: 'PPP',
    compare: 'GDP vs PPP',
    ratio: 'Price Level Index',
    life_expectancy: 'Life Expectancy',
    population: 'Population',
    growth: 'GDP Growth',
    map: 'Map'
};

const MAP_COLOR_RAMPS = {
    sequential: ['#f5e6c8', '#d99a3d', '#c35d4a', '#7c5db6', '#334e7c'],
    health: ['#f7e8c9', '#e2a451', '#c15a49', '#7556a8', '#30466f'],
    population: ['#f1e2c8', '#d28b3f', '#b45a54', '#78609c', '#2f4d76'],
    diverging: ['#b42318', '#d98f45', '#f2dfb1', '#7f8dbd', '#334e7c']
};

const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
const POPULATION_API_URL = 'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000';

// App State
const state = {
    gdpData: {},
    pppData: {},
    rawData: {
        gdpCurrent: {},
        gdpConstant: {},
        gdpCurrentTotal: {},
        gdpConstantTotal: {},
        pppCurrent: {},
        pppConstant: {},
        lifeExpectancy: {},
        population: {},
        pppConversion: {}
    },
    lifeExpectancyData: {},
    populationData: {},
    pppConversionData: {},
    countries: [],
    allEntities: [],
    countryCodes: new Set(),
    subdivisionCodes: new Set(),
    selectedCountries: [],
    entityScope: 'countries',
    currentView: 'gdp', // 'gdp', 'ppp', 'compare', 'ratio', 'map'
    priceType: 'constant', // 'current', 'constant'
    gdpMode: 'per_capita', // 'per_capita', 'total'
    yearStart: 1990,
    yearEnd: 2024,
    mapYear: 2023,
    mapMetric: 'gdp',
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
    const gdpPerCapitaData = state.priceType === 'current' ?
        state.rawData.gdpCurrent :
        state.rawData.gdpConstant;
    const gdpTotalData = state.priceType === 'current' ?
        state.rawData.gdpCurrentTotal :
        state.rawData.gdpConstantTotal;
    const useTotalGdp = state.gdpMode === 'total' && state.currentView === 'gdp';

    state.gdpData = useTotalGdp ? (gdpTotalData || gdpPerCapitaData) : gdpPerCapitaData;

    if (state.priceType === 'current') {
        state.pppData = state.rawData.pppCurrent;
    } else {
        state.pppData = state.rawData.pppConstant;
    }
    state.lifeExpectancyData = state.rawData.lifeExpectancy;
    state.populationData = state.rawData.population;
    state.pppConversionData = state.rawData.pppConversion;
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

function setGdpMode(mode) {
    state.gdpMode = mode;

    document.querySelectorAll('[data-gdp-mode]').forEach(btn => {
        if (btn.dataset.gdpMode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    updateActiveData();
    updateVisualization();
    updateDataTable();
    updateInsights();
}


async function init() {
    // 1. Fetch data
    const [
        gdpCurRaw, gdpConstRaw, pppCurRaw, pppConstRaw, pppConversionRaw, geoRaw,
        stateGdpCur, stateGdpConst, statePppCur, statePppConst, lifeExpRaw, stateLifeExpRaw,
        populationApiRaw, statePopulationRaw
    ] = await Promise.all([
        fetch(FILES.GDP_CURRENT).then(res => res.text()),
        fetch(FILES.GDP_CONSTANT).then(res => res.text()),
        fetch(FILES.PPP_CURRENT).then(res => res.text()),
        fetch(FILES.PPP_CONSTANT).then(res => res.text()),
        fetch(FILES.PPP_CONVERSION).then(res => res.text()),
        fetch(GEOJSON_URL).then(res => res.json()),
        fetch(FILES.STATE_GDP_CURRENT).then(res => res.text()),
        fetch(FILES.STATE_GDP_CONSTANT).then(res => res.text()),
        fetch(FILES.STATE_PPP_CURRENT).then(res => res.text()),
        fetch(FILES.STATE_PPP_CONSTANT).then(res => res.text()),
        fetch(FILES.LIFE_EXPECTANCY).then(res => res.text()),
        fetch(FILES.STATE_LIFE_EXPECTANCY).then(res => res.text()),
        fetch(POPULATION_API_URL).then(res => res.json()),
        fetchOptionalText(FILES.STATE_POPULATION)
    ]);

    // 2. Parse Country Data
    state.rawData.gdpCurrent = parseCSV(gdpCurRaw);
    state.rawData.gdpConstant = parseCSV(gdpConstRaw);
    state.rawData.pppCurrent = parseCSV(pppCurRaw);
    state.rawData.pppConstant = parseCSV(pppConstRaw);
    state.rawData.lifeExpectancy = parseCSV(lifeExpRaw);
    state.rawData.pppConversion = parseWorldBankWideCSV(pppConversionRaw);

    tagWorldBankEntities();
    state.countryCodes = new Set(Object.keys(state.rawData.gdpCurrent)
        .filter(code => !AGGREGATE_CODES.has(code)));

    // 3. Parse and Merge State Data
    mergeStateData(stateGdpCur, 'gdpCurrent');
    mergeStateData(stateGdpConst, 'gdpConstant');
    mergeStateData(statePppCur, 'pppCurrent');
    mergeStateData(statePppConst, 'pppConstant');
    mergeStateData(stateLifeExpRaw, 'lifeExpectancy');

    const populationData = parsePopulationApiData(populationApiRaw);
    if (statePopulationRaw) {
        mergeStatePopulationData(statePopulationRaw, populationData);
    }
    state.rawData.population = populationData;
    state.rawData.gdpCurrentTotal = buildTotalGdpData(state.rawData.gdpCurrent, populationData);
    state.rawData.gdpConstantTotal = buildTotalGdpData(state.rawData.gdpConstant, populationData);

    state.geoData = geoRaw;

    // Set initial active data
    updateActiveData();

    // 4. Extract selectable entity lists
    refreshSelectableEntities();
    state.selectedCountries = DEFAULT_COUNTRY_CODES.filter(code => state.countryCodes.has(code));

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
    setPriceType('constant'); // Trigger initial render and UI sync
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

function createStateCode(name) {
    return 'USA_ST_' + name.replace(/\s+/g, '_').toUpperCase();
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
        if (normalizeCountryName(name) === 'united states') continue;
        const values = {};

        // Generate a unique ID for state to convert mixing with Country Codes
        const code = createStateCode(name);

        for (let y = 0; y < years.length; y++) {
            const valIdx = y + 1;
            if (valIdx < parts.length) {
                const val = parts[valIdx];
                if (val && val !== '') {
                    values[years[y]] = parseFloat(val);
                }
            }
        }

        target[code] = {
            name,
            values,
            type: 'subdivision',
            scopeLabel: 'U.S. state',
            parentCode: 'USA'
        };
        state.subdivisionCodes.add(code);
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

        data[code] = { name, values, type: AGGREGATE_CODES.has(code) ? 'aggregate' : 'country' };
    }

    return data;
}

function parseWorldBankWideCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = {};
    if (lines.length < 2) return data;

    const headers = parseCSVLine(lines[0]);
    const yearColumns = headers.map((header, index) => {
        const match = header.match(/(\d{4})/);
        return match ? { year: match[1], index } : null;
    }).filter(Boolean);

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = parseCSVLine(line);
        const name = parts[2];
        const code = parts[3];
        if (!name || !code) continue;

        const values = {};
        yearColumns.forEach(({ year, index }) => {
            const raw = parts[index];
            const value = parseFloat(raw);
            values[year] = raw && raw !== '..' && !isNaN(value) ? value : null;
        });

        data[code] = {
            name,
            values,
            type: AGGREGATE_CODES.has(code) ? 'aggregate' : 'country'
        };
    }

    return data;
}

async function fetchOptionalText(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return '';
        return await response.text();
    } catch (error) {
        console.info(`Optional data file unavailable: ${url}`);
        return '';
    }
}

function tagWorldBankEntities() {
    Object.values(state.rawData).forEach(dataset => {
        Object.entries(dataset).forEach(([code, entry]) => {
            if (!entry) return;
            entry.type = AGGREGATE_CODES.has(code) ? 'aggregate' : 'country';
            entry.scopeLabel = entry.type === 'aggregate' ? 'aggregate' : 'country';
        });
    });
}

function parsePopulationApiData(apiResponse) {
    const data = {};
    const rows = Array.isArray(apiResponse) ? apiResponse[1] : null;
    if (!Array.isArray(rows)) return data;

    rows.forEach(entry => {
        const code = (entry.countryiso3code || '').trim();
        const year = (entry.date || '').toString().trim();
        if (!code || !year) return;

        if (!data[code]) {
            data[code] = {
                name: entry.country?.value || code,
                values: {},
                type: AGGREGATE_CODES.has(code) ? 'aggregate' : 'country',
                scopeLabel: AGGREGATE_CODES.has(code) ? 'aggregate' : 'country'
            };
        }

        const value = entry.value;
        data[code].values[year] = value === null || value === undefined ? null : Number(value);
    });

    return data;
}

function mergeStatePopulationData(csvText, targetPopulationData) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return;

    const header = parseCSVLine(lines[0]);
    const years = header.slice(1);

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = parseCSVLine(line);
        if (parts.length < 2) continue;

        const name = parts[0];
        if (normalizeCountryName(name) === 'united states') continue;
        const code = createStateCode(name);
        const values = {};

        for (let y = 0; y < years.length; y++) {
            const valIdx = y + 1;
            if (valIdx < parts.length) {
                const val = parseFloat(parts[valIdx]);
                values[years[y]] = isNaN(val) ? null : val;
            }
        }

        targetPopulationData[code] = {
            name,
            values,
            type: 'subdivision',
            scopeLabel: 'U.S. state',
            parentCode: 'USA'
        };
        state.subdivisionCodes.add(code);
    }
}

function buildTotalGdpData(gdpPerCapitaData, populationData) {
    const totalData = {};

    Object.keys(gdpPerCapitaData).forEach(code => {
        const gdpCountry = gdpPerCapitaData[code];
        const popCountry = populationData[code];
        const values = {};

        Object.keys(gdpCountry.values).forEach(year => {
            const gdpVal = gdpCountry.values[year];
            const popVal = popCountry?.values?.[year];
            values[year] = (gdpVal !== null && gdpVal !== undefined && popVal !== null && popVal !== undefined) ?
                (gdpVal * popVal) :
                null;
        });

        totalData[code] = {
            name: gdpCountry.name,
            values,
            type: gdpCountry.type,
            scopeLabel: gdpCountry.scopeLabel,
            parentCode: gdpCountry.parentCode
        };
    });

    return totalData;
}

function isCountryCode(code) {
    return state.countryCodes.has(code);
}

function isSubdivisionCode(code) {
    return state.subdivisionCodes.has(code);
}

function getEntityMeta(code) {
    const source =
        state.rawData.gdpCurrent[code] ||
        state.rawData.pppCurrent[code] ||
        state.rawData.lifeExpectancy[code] ||
        state.rawData.population[code] ||
        state.rawData.pppConversion[code];

    if (!source) {
        return { code, name: code, type: 'unknown', scopeLabel: 'data' };
    }

    const type = isSubdivisionCode(code) ? 'subdivision' : (AGGREGATE_CODES.has(code) ? 'aggregate' : 'country');
    return {
        code,
        name: source.name || code,
        type,
        scopeLabel: type === 'subdivision' ? 'U.S. state' : (type === 'aggregate' ? 'aggregate' : 'country')
    };
}

function getSelectableCodesForScope(scope = state.entityScope) {
    const countries = [...state.countryCodes].filter(code => state.rawData.gdpCurrent[code]);
    const subdivisions = [...state.subdivisionCodes].filter(code => state.rawData.gdpCurrent[code]);

    if (scope === 'states') return subdivisions;
    if (scope === 'all') return [...countries, ...subdivisions];
    return countries;
}

function refreshSelectableEntities() {
    const allCodes = [...new Set([...state.countryCodes, ...state.subdivisionCodes])];
    state.allEntities = allCodes
        .map(getEntityMeta)
        .sort((a, b) => a.name.localeCompare(b.name));

    state.countries = getSelectableCodesForScope()
        .map(getEntityMeta)
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'country' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getScopeEmptyLabel() {
    return state.entityScope === 'states' ? 'U.S. State Overview' :
        state.entityScope === 'all' ? 'Country and State Overview' :
            'Country Overview';
}

function getDefaultCodesForScope(scope) {
    if (scope === 'states') return DEFAULT_STATE_CODES;
    if (scope === 'all') return [...DEFAULT_COUNTRY_CODES, ...DEFAULT_STATE_CODES.slice(0, 2)];
    return DEFAULT_COUNTRY_CODES;
}

function updateHeaderStats() {
    document.getElementById('countryCount').textContent = state.countryCodes.size;
    const subdivisionCount = document.getElementById('subdivisionCount');
    if (subdivisionCount) subdivisionCount.textContent = state.subdivisionCodes.size;
}

// ============================================
// UI Controllers
// ============================================

function populateCountrySelector() {
    const selector = document.getElementById('countrySelect');
    selector.innerHTML = '';
    state.countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.type === 'subdivision' ? `${country.name} (${country.scopeLabel})` : country.name;
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
            dropdown.innerHTML = `<div class="search-no-results">No ${ENTITY_SCOPE_LABELS[state.entityScope].toLowerCase()} found</div>`;
            dropdown.classList.add('visible');
            return;
        }

        matches.forEach((country, idx) => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.dataset.code = country.code;
            item.dataset.index = idx;

            const isSelected = state.selectedCountries.includes(country.code);
            const typeLabel = country.type === 'subdivision' ? country.scopeLabel : country.code;
            item.innerHTML = `
                <span class="search-result-name">${highlightMatch(country.name, query)}</span>
                <span class="search-result-code">${country.code}</span>
                <span class="search-result-type">${escapeHTML(typeLabel)}</span>
                ${isSelected ? '<span class="search-result-added">Added</span>' : ''}
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
    const safeText = escapeHTML(text);
    const safeQuery = escapeRegExp(escapeHTML(query));
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    return safeText.replace(regex, '<mark>$1</mark>');
}

function addCountryFromSearch(code) {
    if (!state.selectedCountries.includes(code)) {
        state.selectedCountries.push(code);
        updateCountryChips();
        updateVisualization();
        updateInsights();
    }
}

function setControlVisibility(element, isVisible) {
    if (!element) return;
    element.classList.toggle('control-hidden', !isVisible);
    element.querySelectorAll('button, input, select').forEach(control => {
        control.disabled = !isVisible;
    });
}

function setControlEnabled(element, isEnabled) {
    if (!element) return;
    element.classList.toggle('control-muted', !isEnabled);
    element.querySelectorAll('button, input, select').forEach(control => {
        control.disabled = !isEnabled;
    });
}

function setEntityScope(scope) {
    state.entityScope = scope;
    document.querySelectorAll('[data-scope]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.scope === scope);
    });

    refreshSelectableEntities();
    populateCountrySelector();

    if (scope !== 'all') {
        const allowedCodes = new Set(getSelectableCodesForScope(scope));
        const selectedInScope = state.selectedCountries.filter(code => allowedCodes.has(code));
        state.selectedCountries = selectedInScope.length ?
            selectedInScope :
            getDefaultCodesForScope(scope).filter(code => allowedCodes.has(code));
        updateCountryChips();
    }

    const searchInput = document.getElementById('countrySearch');
    if (searchInput) {
        searchInput.placeholder = scope === 'states' ?
            'Type to search U.S. states...' :
            scope === 'all' ?
                'Type to search countries or states...' :
                'Type to search countries...';
        searchInput.value = '';
    }

    const dropdown = document.getElementById('countrySearchDropdown');
    if (dropdown) dropdown.classList.remove('visible');

    updateDataTable();
}

function ensureCountrySelectionForMap() {
    if (state.entityScope === 'states') {
        state.entityScope = 'countries';
        document.querySelectorAll('[data-scope]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scope === 'countries');
        });
        refreshSelectableEntities();
        populateCountrySelector();

        const searchInput = document.getElementById('countrySearch');
        if (searchInput) {
            searchInput.placeholder = 'Type to search countries...';
            searchInput.value = '';
        }
    }

    const selectedCountriesOnly = state.selectedCountries.filter(code => isCountryCode(code));
    if (selectedCountriesOnly.length !== state.selectedCountries.length) {
        state.selectedCountries = selectedCountriesOnly.length ?
            selectedCountriesOnly :
            getDefaultCodesForScope('countries').filter(code => isCountryCode(code));
        updateCountryChips();
    }
}

function updateCountryChips() {
    const container = document.getElementById('selectedCountries');
    container.innerHTML = '';

    state.selectedCountries.forEach(code => {
        const country = getEntityMeta(code);
        if (!country) return;

        const chip = document.createElement('div');
        chip.className = 'country-chip';
        chip.innerHTML = `
            <span>${escapeHTML(country.name)}</span>
            <small>${escapeHTML(country.scopeLabel)}</small>
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
    const viewBtns = document.querySelectorAll('.view-btn[data-view]');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentView = btn.dataset.view;

            if (state.currentView === 'map') {
                ensureCountrySelectionForMap();
            }

            // Toggle containers
            if (state.currentView === 'map') {
                document.getElementById('chartContainer').style.display = 'none';
                document.getElementById('mapContainer').style.display = 'block';
                document.getElementById('dataTableContainer').style.display = 'none';
                document.getElementById('globalRankingsContainer').style.display = 'block';
            } else {
                document.getElementById('chartContainer').style.display = 'block';
                document.getElementById('mapContainer').style.display = 'none';
                document.getElementById('dataTableContainer').style.display = 'block';
                document.getElementById('globalRankingsContainer').style.display = 'none';
            }

            setControlVisibility(document.getElementById('mapYearControl'), state.currentView === 'map');
            setControlEnabled(document.getElementById('gdpModeControl'), state.currentView === 'gdp');

            // Handle Price Type Restrictions
            const priceBtns = document.querySelectorAll('[data-price]');
            if (['ratio', 'life_expectancy', 'population'].includes(state.currentView)) {
                // These indicators don't use price types.
                if (state.currentView === 'ratio') setPriceType('current');
                priceBtns.forEach(b => b.classList.add('disabled'));
                priceBtns.forEach(b => b.disabled = true);
            } else {
                priceBtns.forEach(b => b.classList.remove('disabled'));
                priceBtns.forEach(b => b.disabled = false);
            }

            updateVisualization();
            // Update insights to reflect current view's data source
            updateInsights();
        });
    });

    document.querySelectorAll('[data-scope]').forEach(btn => {
        btn.addEventListener('click', () => {
            setEntityScope(btn.dataset.scope);
            updateVisualization();
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

    // GDP Mode Buttons
    document.querySelectorAll('[data-gdp-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.gdpMode;
            setGdpMode(mode);
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
    updateHeaderStats();

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
        btn.innerHTML = '<svg class="btn-icon"><use href="#icon-play"></use></svg><span>Play</span>';
        state.isPlaying = false;
    } else {
        btn.innerHTML = '<svg class="btn-icon"><use href="#icon-pause"></use></svg><span>Pause</span>';
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
    updateActiveData();

    if (state.currentView === 'map') {
        renderMap();
        return;
    }

    renderChart();
    updateDataTable();
}

function getSeriesForView(view = state.currentView) {
    switch (view) {
        case 'ppp':
            return state.pppData;
        case 'life_expectancy':
            return state.lifeExpectancyData;
        case 'population':
            return state.populationData;
        case 'ratio':
        case 'compare':
        case 'growth':
        case 'gdp':
        default:
            return state.gdpData;
    }
}

function getMetricLabel(metric = state.currentView) {
    switch (metric) {
        case 'gdp':
            return state.gdpMode === 'total' ?
                (state.priceType === 'current' ? 'GDP (Current US$)' : 'GDP (Constant 2015 US$)') :
                (state.priceType === 'current' ? 'GDP per Capita (Current US$)' : 'GDP per Capita (Constant 2015 US$)');
        case 'ppp':
            return state.priceType === 'current' ?
                'GDP per Capita, PPP (Current International $)' :
                'GDP per Capita, PPP (Constant 2021 International $)';
        case 'ratio':
            return 'Price Level Index (GDP / PPP)';
        case 'life_expectancy':
            return 'Life Expectancy at Birth';
        case 'population':
            return 'Population';
        case 'growth':
            return 'GDP per Capita Annual Growth';
        default:
            return VIEW_LABELS[metric] || 'Indicator';
    }
}

function getYAxisLabel(metric = state.currentView) {
    switch (metric) {
        case 'ppp':
            return 'International $';
        case 'ratio':
            return 'Index';
        case 'life_expectancy':
            return 'Years';
        case 'population':
            return 'People';
        case 'growth':
            return '% change';
        default:
            return 'USD';
    }
}

function formatMetricValue(value, metric = state.currentView, options = {}) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    const compact = options.compact || false;

    if (metric === 'ratio') return value.toFixed(3);
    if (metric === 'life_expectancy') return `${value.toFixed(1)} yrs`;
    if (metric === 'population') {
        return new Intl.NumberFormat('en-US', {
            notation: compact ? 'compact' : 'standard',
            maximumFractionDigits: compact ? 1 : 0
        }).format(value);
    }
    if (metric === 'growth') return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 0
    }).format(value);
}

function getMetricValue(code, year, metric = state.currentView) {
    if (metric === 'ppp') return state.pppData[code]?.values?.[year] ?? null;
    if (metric === 'life_expectancy') return state.lifeExpectancyData[code]?.values?.[year] ?? null;
    if (metric === 'population') return state.populationData[code]?.values?.[year] ?? null;
    if (metric === 'ratio') {
        const gVal = state.rawData.gdpCurrent[code]?.values?.[year];
        const pVal = state.rawData.pppCurrent[code]?.values?.[year];
        return (gVal && pVal) ? gVal / pVal : null;
    }
    if (metric === 'growth') {
        const current = state.gdpData[code]?.values?.[year];
        const previous = state.gdpData[code]?.values?.[year - 1];
        return (current && previous) ? ((current - previous) / previous * 100) : null;
    }
    return state.gdpData[code]?.values?.[year] ?? null;
}

function getMetricPeriodChange(code, startYear, endYear, metric = state.currentView) {
    if (metric === 'growth') return getMetricValue(code, endYear, metric);
    const startValue = getMetricValue(code, startYear, metric);
    const endValue = getMetricValue(code, endYear, metric);
    return (startValue && endValue) ? ((endValue - startValue) / startValue * 100) : null;
}

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    const years = [];
    for (let i = state.yearStart; i <= state.yearEnd; i++) years.push(i);

    let datasets = [];
    let title = getMetricLabel();
    let yAxisLabel = getYAxisLabel();

    switch (state.currentView) {
        case 'gdp':
            datasets = createDatasets(state.gdpData, years);
            break;
        case 'ppp':
            datasets = createDatasets(state.pppData, years);
            break;
        case 'ratio':
            datasets = createRatioDatasets(years);
            break;
        case 'compare':
            title = 'GDP vs PPP Comparison';
            yAxisLabel = 'USD / International $';
            datasets = createComparisonDatasets(years);
            break;
        case 'life_expectancy':
            datasets = createDatasets(state.lifeExpectancyData, years);
            break;
        case 'population':
            datasets = createDatasets(state.populationData, years);
            break;
        case 'growth':
            datasets = createGrowthDatasets(years);
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
                                label += formatMetricValue(context.parsed.y, state.currentView);
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
                    min: state.currentView === 'growth' ? undefined : 0,
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

function createGrowthDatasets(years) {
    return state.selectedCountries.map((code, i) => {
        const country = state.gdpData[code];
        if (!country) return null;

        const data = years.map(year => getMetricValue(code, year, 'growth'));
        const latestGrowth = data[data.length - 1];
        const growthLabel = latestGrowth !== null && latestGrowth !== undefined ?
            ` (${latestGrowth >= 0 ? '+' : ''}${latestGrowth.toFixed(1)}%)` :
            '';

        return {
            label: country.name + growthLabel,
            data,
            borderColor: COLORS[i % COLORS.length],
            backgroundColor: COLORS[i % COLORS.length] + '20',
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.28,
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

function normalizeCountryName(name) {
    return (name || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function resolveFeatureCountryCode(feature, countryCodeByName) {
    const rawCode = (feature?.properties?.['ISO3166-1-Alpha-3'] || '').trim();
    if (rawCode && rawCode !== '-99' && state.countryCodes.has(rawCode)) return rawCode;

    const countryName = feature?.properties?.name || feature?.properties?.ADMIN || '';
    return countryCodeByName.get(normalizeCountryName(countryName)) || null;
}

function renderMap() {
    const svg = document.getElementById('worldMap');
    const tooltip = document.getElementById('mapTooltip');
    const year = state.mapYear;
    const metric = state.mapMetric || 'gdp';
    document.getElementById('mapTitle').textContent = `${getMetricLabel(metric)} Map (${year})`;

    // Clear and prepare
    svg.innerHTML = '';

    const width = 1000;
    const height = 560;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const features = state.geoData.features.filter(isRenderableMapFeature);
    const project = createEqualEarthProjector(features, width, height);
    renderMapBackdrop(svg, width, height, project);

    const countryCodeByName = new Map(
        [...state.countryCodes]
            .map(code => [code, state.gdpData[code]])
            .filter(([, country]) => country?.name)
            .map(([code, country]) => [normalizeCountryName(country.name), code])
    );

    const countryStats = buildMapCountryStats(year, metric);
    const statsByCode = new Map(countryStats.map(stat => [stat.code, stat]));

    countryStats.sort((a, b) => b.value - a.value);
    const rankMap = {};
    countryStats.forEach((c, i) => rankMap[c.code] = i + 1);

    const values = countryStats.map(c => c.value).filter(value => value !== null && value !== undefined && !isNaN(value));
    const colorScale = createMapColorScale(values, metric);
    updateMapLegend(values, metric);

    // Process GeoJSON features
    features.forEach(feature => {
        const countryName = feature.properties.name || feature.properties.ADMIN || 'Unknown';

        // GeoJSON uses -99 for some sovereigns (e.g., France/Norway), so fallback by name.
        const code = resolveFeatureCountryCode(feature, countryCodeByName);
        const stat = statsByCode.get(code);
        const gdpVal = stat?.gdp ?? null;
        const pppVal = stat?.ppp ?? null;
        const population = stat?.population ?? null;
        const metricValue = stat?.value ?? null;
        const rank = rankMap[code];
        const growth = stat?.growth ?? null;
        const ratio = stat?.ratio ?? null;
        const lifeExpectancy = stat?.lifeExpectancy ?? null;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', generatePathData(feature.geometry, project));
        path.setAttribute('fill', colorScale(metricValue));
        path.setAttribute('data-code', code || '');
        path.setAttribute('fill-rule', 'evenodd');
        path.classList.add('map-country');
        path.style.cursor = code ? 'pointer' : 'default';

        applyMapPathStyle(path, code);

        path.addEventListener('mouseenter', (e) => {
            applyMapPathStyle(path, code, true);
            tooltip.classList.add('visible');

            const isSelected = code ? state.selectedCountries.includes(code) : false;
            const displayName = code ? getEntityMeta(code).name : countryName;
            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <strong>${escapeHTML(displayName)}</strong>
                    ${rank ? `<span class="tooltip-rank">#${rank}</span>` : ''}
                </div>
                <div class="tooltip-grid">
                    <span class="tooltip-label">${escapeHTML(getMetricLabel(metric))}:</span>
                    <span class="tooltip-value">${formatMetricValue(metricValue, metric)}</span>
                    <span class="tooltip-label">GDP pc:</span>
                    <span class="tooltip-value">${formatMetricValue(gdpVal, 'gdp')}</span>
                    <span class="tooltip-label">PPP pc:</span>
                    <span class="tooltip-value">${formatMetricValue(pppVal, 'ppp')}</span>
                    <span class="tooltip-label">PLI:</span>
                    <span class="tooltip-value">${ratio ? ratio.toFixed(3) : 'N/A'}</span>
                    <span class="tooltip-label">Life:</span>
                    <span class="tooltip-value">${formatMetricValue(lifeExpectancy, 'life_expectancy')}</span>
                    <span class="tooltip-label">Population:</span>
                    <span class="tooltip-value">${formatMetricValue(population, 'population', { compact: true })}</span>
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
            applyMapPathStyle(path, code);
            tooltip.classList.remove('visible');
        });

        // Single click to toggle country selection (mobile-friendly)
        path.addEventListener('click', (e) => {
            e.preventDefault();
            if (!code) return;

            if (state.selectedCountries.includes(code)) {
                removeCountry(code);
            } else {
                state.selectedCountries.push(code);
                updateCountryChips();
                updateInsights();
                updateDataTable();
                renderMap();
            }
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

function buildMapCountryStats(year, metric) {
    return [...state.countryCodes].map(code => {
        const meta = getEntityMeta(code);
        const gdp = state.gdpData[code]?.values?.[year] ?? null;
        const ppp = state.pppData[code]?.values?.[year] ?? null;
        const population = state.populationData[code]?.values?.[year] ?? null;
        const lifeExpectancy = state.lifeExpectancyData[code]?.values?.[year] ?? null;
        const ratio = getMetricValue(code, year, 'ratio');
        const growth = getFiveYearGrowth(code, year);
        const value = getMapMetricValue(code, year, metric, { gdp, ppp, population, lifeExpectancy, ratio, growth });

        if (value === null || value === undefined || isNaN(value)) return null;

        return {
            code,
            name: meta.name,
            value,
            gdp,
            ppp,
            population,
            lifeExpectancy,
            ratio,
            growth
        };
    }).filter(Boolean);
}

function getFiveYearGrowth(code, year) {
    const current = state.gdpData[code]?.values?.[year];
    const previous = state.gdpData[code]?.values?.[year - 5];
    return (current && previous) ? ((current - previous) / previous * 100) : null;
}

function getMapMetricValue(code, year, metric, cached = {}) {
    switch (metric) {
        case 'ppp':
            return cached.ppp ?? getMetricValue(code, year, 'ppp');
        case 'ratio':
            return cached.ratio ?? getMetricValue(code, year, 'ratio');
        case 'life_expectancy':
            return cached.lifeExpectancy ?? getMetricValue(code, year, 'life_expectancy');
        case 'population':
            return cached.population ?? getMetricValue(code, year, 'population');
        case 'growth':
            return cached.growth ?? getFiveYearGrowth(code, year);
        case 'gdp':
        default:
            return cached.gdp ?? getMetricValue(code, year, 'gdp');
    }
}

function createMapColorScale(values, metric) {
    const noDataColor = getComputedStyle(document.documentElement).getPropertyValue('--map-no-data').trim() || '#e4e5eb';
    if (!values.length) return () => noDataColor;

    const ramp = metric === 'growth' ? MAP_COLOR_RAMPS.diverging :
        metric === 'life_expectancy' ? MAP_COLOR_RAMPS.health :
            metric === 'population' ? MAP_COLOR_RAMPS.population :
                MAP_COLOR_RAMPS.sequential;

    if (metric === 'growth') {
        const maxAbs = Math.max(...values.map(value => Math.abs(value))) || 1;
        return value => {
            if (value === null || value === undefined || isNaN(value)) return noDataColor;
            const normalized = Math.max(0, Math.min(1, (value + maxAbs) / (maxAbs * 2)));
            return interpolateRamp(ramp, normalized);
        };
    }

    const positiveValues = values.filter(value => value > 0);
    const min = Math.min(...positiveValues);
    const max = Math.max(...positiveValues);
    const useLog = ['gdp', 'ppp', 'population'].includes(metric);

    return value => {
        if (value === null || value === undefined || isNaN(value)) return noDataColor;
        let normalized;
        if (useLog) {
            if (value <= 0 || min <= 0 || max <= min) normalized = 0;
            else normalized = (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min));
        } else {
            normalized = max === min ? 0.5 : (value - min) / (max - min);
        }
        return interpolateRamp(ramp, Math.max(0, Math.min(1, normalized)));
    };
}

function updateMapLegend(values, metric) {
    const minEl = document.getElementById('minValue');
    const maxEl = document.getElementById('maxValue');
    const gradient = document.querySelector('.gradient-bar');
    if (!minEl || !maxEl || !gradient) return;

    const ramp = metric === 'growth' ? MAP_COLOR_RAMPS.diverging :
        metric === 'life_expectancy' ? MAP_COLOR_RAMPS.health :
            metric === 'population' ? MAP_COLOR_RAMPS.population :
                MAP_COLOR_RAMPS.sequential;
    gradient.style.background = `linear-gradient(to right, ${ramp.join(', ')})`;

    if (!values.length) {
        minEl.textContent = 'No data';
        maxEl.textContent = '';
        return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    minEl.textContent = formatMetricValue(min, metric, { compact: true });
    maxEl.textContent = formatMetricValue(max, metric, { compact: true });
}

function interpolateRamp(colors, t) {
    const scaled = t * (colors.length - 1);
    const index = Math.floor(scaled);
    const nextIndex = Math.min(index + 1, colors.length - 1);
    const localT = scaled - index;
    return interpolateColor(colors[index], colors[nextIndex], localT);
}

function interpolateColor(start, end, t) {
    const a = hexToRgb(start);
    const b = hexToRgb(end);
    const mix = a.map((channel, index) => Math.round(channel + (b[index] - channel) * t));
    return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const value = parseInt(clean.length === 3 ? clean.split('').map(char => char + char).join('') : clean, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function applyMapPathStyle(path, code, isHovered = false) {
    const selected = code ? state.selectedCountries.includes(code) : false;
    const styles = getComputedStyle(document.documentElement);
    const selectedColor = styles.getPropertyValue('--map-selected').trim() || '#c05621';
    const defaultStroke = styles.getPropertyValue('--map-stroke').trim() || '#dde3da';

    path.style.stroke = selected ? selectedColor : (isHovered ? '#ffffff' : defaultStroke);
    path.style.strokeWidth = selected ? (isHovered ? '3' : '2') : (isHovered ? '1.5' : '0.55');
}

function isRenderableMapFeature(feature) {
    const countryName = feature.properties.name || feature.properties.ADMIN || 'Unknown';
    const isoCode = (feature.properties['ISO3166-1-Alpha-3'] || '').trim();
    return isoCode !== 'ATA' && normalizeCountryName(countryName) !== 'antarctica';
}

function createEqualEarthProjector(features, width, height) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    features.forEach(feature => {
        visitCoordinates(feature.geometry, coords => {
            const [x, y] = equalEarthRaw(coords[0], coords[1]);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        });
    });

    const padding = 28;
    const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
    const mapWidth = (maxX - minX) * scale;
    const mapHeight = (maxY - minY) * scale;
    const offsetX = (width - mapWidth) / 2;
    const offsetY = (height - mapHeight) / 2;

    return coords => {
        const [x, y] = equalEarthRaw(coords[0], coords[1]);
        return [
            offsetX + (x - minX) * scale,
            offsetY + (maxY - y) * scale
        ];
    };
}

function equalEarthRaw(lon, lat) {
    const A1 = 1.340264;
    const A2 = -0.081106;
    const A3 = 0.000893;
    const A4 = 0.003796;
    const M = Math.sqrt(3) / 2;
    const lambda = lon * Math.PI / 180;
    const phi = Math.max(-89.999, Math.min(89.999, lat)) * Math.PI / 180;
    const theta = Math.asin(M * Math.sin(phi));
    const theta2 = theta * theta;
    const theta6 = theta2 * theta2 * theta2;

    return [
        lambda * Math.cos(theta) / (M * (A1 + 3 * A2 * theta2 + theta6 * (7 * A3 + 9 * A4 * theta2))),
        theta * (A1 + A2 * theta2 + theta6 * (A3 + A4 * theta2))
    ];
}

function visitCoordinates(geometry, visitor) {
    if (!geometry) return "";
    if (geometry.type === 'Polygon') {
        geometry.coordinates.forEach(ring => ring.forEach(visitor));
    } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach(polygon => {
            polygon.forEach(ring => ring.forEach(visitor));
        });
    }
}

function renderMapBackdrop(svg, width, height, project) {
    const boundary = [];
    for (let lon = -180; lon <= 180; lon += 5) boundary.push([lon, 84]);
    for (let lat = 84; lat >= -58; lat -= 5) boundary.push([180, lat]);
    for (let lon = 180; lon >= -180; lon -= 5) boundary.push([lon, -58]);
    for (let lat = -58; lat <= 84; lat += 5) boundary.push([-180, lat]);

    const ocean = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ocean.setAttribute('d', lineToPath(boundary, project, true));
    ocean.classList.add('map-ocean-shape');
    svg.appendChild(ocean);

    for (let lon = -150; lon <= 180; lon += 30) {
        const line = [];
        for (let lat = -60; lat <= 80; lat += 4) line.push([lon, lat]);
        appendGraticule(svg, lineToPath(line, project, false));
    }

    for (let lat = -60; lat <= 60; lat += 30) {
        const line = [];
        for (let lon = -180; lon <= 180; lon += 4) line.push([lon, lat]);
        appendGraticule(svg, lineToPath(line, project, false));
    }
}

function appendGraticule(svg, d) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.classList.add('map-graticule');
    svg.appendChild(path);
}

function lineToPath(points, project, closePath = false) {
    if (!points.length) return '';
    const projected = points.map(coords => {
        const [x, y] = project(coords);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `M${projected.join('L')}${closePath ? 'Z' : ''}`;
}

function generatePathData(geometry, project) {
    if (!geometry) return "";

    const processRing = ring => lineToPath(ring, project, true);

    if (geometry.type === "Polygon") {
        return geometry.coordinates.map(processRing).join(" ");
    } else if (geometry.type === "MultiPolygon") {
        return geometry.coordinates.map(polygon => polygon.map(processRing).join(" ")).join(" ");
    }
    return "";
}

// ============================================
// Data Table & Insights
// ============================================

function updateDataTable() {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    const latestYear = state.yearEnd;
    const prevYear = state.yearStart;
    const metric = state.currentView === 'compare' ? 'gdp' : state.currentView;

    const gdpHeader = document.getElementById('headerGdp');
    const pppHeader = document.getElementById('headerPpp');
    const valueHeader = document.getElementById('headerValue');
    if (gdpHeader && pppHeader && valueHeader) {
        const typeLabel = state.priceType === 'current' ? 'Current' : 'Constant 2015';
        const pppTypeLabel = state.priceType === 'current' ? 'Current' : 'Constant 2021';
        valueHeader.innerHTML = `${getMetricLabel(metric)} <span class="header-subtitle" style="font-size:0.8em; opacity:0.7">(${latestYear})</span> <span class="sort-icon">↕</span>`;
        const gdpLabel = state.gdpMode === 'total' && state.currentView === 'gdp' ? 'GDP' : 'GDP per Capita';
        gdpHeader.innerHTML = `${gdpLabel} <span class="header-subtitle" style="font-size:0.8em; opacity:0.7">(${typeLabel}, ${state.yearEnd})</span> <span class="sort-icon">↕</span>`;
        pppHeader.innerHTML = `PPP per Capita <span class="header-subtitle" style="font-size:0.8em; opacity:0.7">(${pppTypeLabel}, ${state.yearEnd})</span> <span class="sort-icon">↕</span>`;

        const growthHeader = document.querySelector('th[data-sort="growth"]');
        if (growthHeader) {
            growthHeader.innerHTML = `Change <span class="header-subtitle" style="font-size:0.8em; opacity:0.7">(${state.yearStart}-${state.yearEnd})</span> <span class="sort-icon">↕</span>`;
        }
    }

    const isSelectionEmpty = state.selectedCountries.length === 0;
    const codesToShow = isSelectionEmpty ? getSelectableCodesForScope() : state.selectedCountries;

    const headerTitle = document.getElementById('tableHeaderTitle');
    if (headerTitle) {
        headerTitle.textContent = isSelectionEmpty ?
            `${getScopeEmptyLabel()} (${latestYear})` :
            `Selected Comparison (${latestYear})`;
    }

    const tableData = codesToShow.map(code => {
        const meta = getEntityMeta(code);
        const gdp = state.gdpData[code]?.values?.[latestYear] ?? null;
        const ppp = state.pppData[code]?.values?.[latestYear] ?? null;
        const ratio = getMetricValue(code, latestYear, 'ratio');
        const value = getMetricValue(code, latestYear, metric);
        const growth = getMetricPeriodChange(code, prevYear, latestYear, metric);

        if (value === null && gdp === null && ppp === null) return null;

        return {
            code,
            name: meta.name,
            scopeLabel: meta.scopeLabel,
            value,
            metric,
            gdp,
            ppp,
            ratio,
            growth
        };
    }).filter(d => d !== null);

    tableData.sort((a, b) => {
        let aVal, bVal;
        switch (dataSortField) {
            case 'name':
                aVal = a.name;
                bVal = b.name;
                return dataSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'value':
                aVal = a.value ?? -Infinity;
                bVal = b.value ?? -Infinity;
                break;
            case 'gdp':
                aVal = a.gdp ?? -Infinity;
                bVal = b.gdp ?? -Infinity;
                break;
            case 'ppp':
                aVal = a.ppp ?? -Infinity;
                bVal = b.ppp ?? -Infinity;
                break;
            case 'ratio':
                aVal = a.ratio ?? -Infinity;
                bVal = b.ratio ?? -Infinity;
                break;
            case 'growth':
                aVal = a.growth ?? -Infinity;
                bVal = b.growth ?? -Infinity;
                break;
            default:
                aVal = a.value ?? -Infinity;
                bVal = b.value ?? -Infinity;
        }
        return dataSortAsc ? aVal - bVal : bVal - aVal;
    });

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
            <td>
                <span class="entity-cell">
                    <span class="entity-name">${escapeHTML(d.name)}</span>
                    <span class="entity-meta">${escapeHTML(d.scopeLabel)}</span>
                </span>
            </td>
            <td>${formatMetricValue(d.value, d.metric, { compact: true })}</td>
            <td>${formatMetricValue(d.gdp, 'gdp', { compact: true })}</td>
            <td>${formatMetricValue(d.ppp, 'ppp', { compact: true })}</td>
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
        content.innerHTML = '<p>Select countries or states to see comparative insights and growth statistics.</p>';
        topContainer.innerHTML = '';
        trendContainer.innerHTML = '';
        return;
    }

    const metric = state.currentView === 'compare' ? 'gdp' :
        state.currentView === 'map' ? state.mapMetric :
            state.currentView;
    const dataLabel = getMetricLabel(metric);
    const startYear = state.yearStart;
    const endYear = state.yearEnd;
    const yearSpan = endYear - startYear;

    const countryStats = state.selectedCountries
        .map(code => {
            const meta = getEntityMeta(code);
            const endVal = getMetricValue(code, endYear, metric);
            const startVal = getMetricValue(code, startYear, metric);
            const growthPeriod = getMetricPeriodChange(code, startYear, endYear, metric);
            const cagr = (endVal && startVal && yearSpan > 0) ?
                ((Math.pow(endVal / startVal, 1 / yearSpan) - 1) * 100) : null;

            return {
                code,
                name: meta.name,
                startVal,
                endVal,
                growthPeriod,
                cagr
            };
        })
        .filter(c => c.endVal !== null && c.endVal !== undefined)
        .sort((a, b) => b.endVal - a.endVal);

    if (countryStats.length === 0) {
        content.innerHTML = '<p>No data available for the selected entities and indicator.</p>';
        topContainer.innerHTML = '';
        trendContainer.innerHTML = '';
        return;
    }

    const leader = countryStats[0];
    let insightHTML = `
        <p><span class="insight-highlight">${escapeHTML(leader.name)}</span> leads on ${escapeHTML(dataLabel)} with
        <span class="insight-highlight">${formatMetricValue(leader.endVal, metric)}</span> in ${endYear}.</p>
    `;

    if (countryStats.length >= 2) {
        const runnerUp = countryStats[1];
        const diff = ((leader.endVal - runnerUp.endVal) / runnerUp.endVal * 100).toFixed(1);
        insightHTML += `<p>That's <span class="insight-highlight">${diff}%</span> higher than ${escapeHTML(runnerUp.name)}.</p>`;
    }

    if (leader.growthPeriod !== null && leader.startVal) {
        if (metric === 'growth') {
            insightHTML += `<p>Latest annual growth: <span class="insight-highlight">${leader.growthPeriod >= 0 ? '+' : ''}${leader.growthPeriod.toFixed(1)}%</span> in ${endYear}.</p>`;
        } else {
            const growthDir = leader.growthPeriod >= 0 ? 'grew' : 'declined';
            insightHTML += `<p>${escapeHTML(dataLabel)} ${growthDir} by <span class="insight-highlight">${Math.abs(leader.growthPeriod).toFixed(1)}%</span> from ${startYear} to ${endYear}.</p>`;
        }
        if (leader.cagr !== null && yearSpan > 1 && metric !== 'growth') {
            insightHTML += `<p>Avg. annual growth (CAGR): <span class="insight-highlight">${leader.cagr >= 0 ? '+' : ''}${leader.cagr.toFixed(2)}%</span></p>`;
        }
    }

    content.innerHTML = insightHTML;

    topContainer.innerHTML = countryStats.slice(0, 3).map((item, i) => `
        <div class="performer-item">
            <span class="performer-rank">${i + 1}</span>
            <span class="performer-name">${escapeHTML(item.name)}</span>
            <span class="performer-value">${formatMetricValue(item.endVal, metric, { compact: true })}</span>
        </div>
    `).join('');

    const growthSorted = [...countryStats]
        .filter(c => c.growthPeriod !== null)
        .sort((a, b) => b.growthPeriod - a.growthPeriod);

    if (growthSorted.length > 0) {
        trendContainer.innerHTML = growthSorted.slice(0, 3).map(item => {
            const isPositive = item.growthPeriod >= 0;
            return `
                <div class="trend-item">
                    <span class="trend-name">${escapeHTML(item.name)}</span>
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
            case 'value':
                aVal = a.value || 0;
                bVal = b.value || 0;
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
            case 'ratio':
                aVal = a.ratio || 0;
                bVal = b.ratio || 0;
                break;
            case 'life_expectancy':
                aVal = a.lifeExpectancy || 0;
                bVal = b.lifeExpectancy || 0;
                break;
            case 'population':
                aVal = a.population || 0;
                bVal = b.population || 0;
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
                <td>${formatMetricValue(c.value, state.mapMetric, { compact: true })}</td>
                <td>${formatMetricValue(c.gdp, 'gdp', { compact: true })}</td>
                <td>${formatMetricValue(c.ppp, 'ppp', { compact: true })}</td>
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
            state.mapMetric = e.target.value;
            rankingsSortField = 'value';
            rankingsSortAsc = false;
            if (state.currentView === 'map') {
                renderMap();
                updateInsights();
            } else {
                renderGlobalRankings();
            }
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

let dataSortField = 'value';
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
