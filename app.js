/**
 * Global GDP Explorer - Interactive Visualization Logic
 * Handles data parsing, state management, and visualization rendering.
 */

// Configuration & Constants
const FILES = {
    GDP: 'API_NY.GDP.PCAP.KD_DS2_en_csv_v2_141.csv',
    PPP: 'API_NY.GDP.PCAP.PP.KD_DS2_en_csv_v2_1423.csv'
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
    countries: [],
    selectedCountries: ['USA', 'CHN', 'BRA', 'FRA', 'IND'],
    currentView: 'gdp', // 'gdp', 'ppp', 'compare', 'ratio', 'map'
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

async function init() {
    // 1. Fetch data
    const [gdpRaw, pppRaw, geoRaw] = await Promise.all([
        fetch(FILES.GDP).then(res => res.text()),
        fetch(FILES.PPP).then(res => res.text()),
        fetch(GEOJSON_URL).then(res => res.json())
    ]);

    // 2. Parse data
    state.gdpData = parseCSV(gdpRaw);
    state.pppData = parseCSV(pppRaw);
    state.geoData = geoRaw;

    // 3. Extract country list
    state.countries = Object.keys(state.gdpData).map(code => ({
        code,
        name: state.gdpData[code].name
    })).sort((a, b) => a.name.localeCompare(b.name));

    // 4. Setup UI
    setupEventListeners();
    populateCountrySelector();
    updateCountryChips();

    // 5. Initial Render
    hideLoading();
    updateVisualization();
    updateStats();
    updateInsights();
}

// ============================================
// Data Parsing
// ============================================

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = {};

    // Header is on line 5 (index 4)
    const headerLine = lines[4];
    if (!headerLine) return data;

    // Improved CSV parsing for "Value1","Value2" format
    const parseLine = (line) => {
        // Remove trailing comma if exists
        const cleanedLine = line.trim().replace(/,$/, '');
        // Remove first and last quote
        const content = cleanedLine.startsWith('"') && cleanedLine.endsWith('"')
            ? cleanedLine.slice(1, -1)
            : cleanedLine;
        return content.split('","');
    };

    const headers = parseLine(headerLine);
    const startYearIdx = headers.findIndex(h => h.trim() === '1960');

    for (let i = 5; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = parseLine(line);
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
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentView = btn.dataset.view;

            // Toggle containers
            if (state.currentView === 'map') {
                document.getElementById('chartContainer').style.display = 'none';
                document.getElementById('mapContainer').style.display = 'block';
                document.getElementById('mapYearControl').style.display = 'block';
                renderMap();
            } else {
                document.getElementById('chartContainer').style.display = 'block';
                document.getElementById('mapContainer').style.display = 'none';
                document.getElementById('mapYearControl').style.display = 'none';
                updateVisualization();
            }
            // Update insights to reflect current view's data source
            updateInsights();
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
        updateVisualization();
    });

    yearEnd.addEventListener('input', (e) => {
        state.yearEnd = parseInt(e.target.value);
        if (state.yearEnd <= state.yearStart) {
            state.yearStart = Math.max(1960, state.yearEnd - 1);
            yearStart.value = state.yearStart;
            document.getElementById('yearStartDisplay').textContent = state.yearStart;
        }
        document.getElementById('yearEndDisplay').textContent = state.yearEnd;
        updateVisualization();
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
            title = 'GDP per Capita (Constant 2015 US$)';
            yAxisLabel = 'USD';
            datasets = createDatasets(state.gdpData, years);
            break;
        case 'ppp':
            title = 'GDP per Capita, PPP (Constant 2021 International $)';
            yAxisLabel = 'International $';
            datasets = createDatasets(state.pppData, years);
            break;
        case 'ratio':
            title = 'GDP to PPP Ratio';
            yAxisLabel = 'Ratio';
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

        return {
            label: country.name,
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
        const gdp = state.gdpData[code];
        const ppp = state.pppData[code];
        if (!gdp || !ppp) return null;

        return {
            label: gdp.name,
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
    // Only show first 3 selected countries to avoid clutter in comparison mode
    state.selectedCountries.slice(0, 3).forEach((code, i) => {
        const gdp = state.gdpData[code];
        const ppp = state.pppData[code];
        if (!gdp || !ppp) return;

        datasets.push({
            label: `${gdp.name} (GDP)`,
            data: years.map(y => gdp.values[y]),
            borderColor: COLORS[i % COLORS.length],
            borderWidth: 3,
            borderDash: [5, 5],
            tension: 0.3
        });

        datasets.push({
            label: `${gdp.name} (PPP)`,
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

    // Simple projection logic: mercator-ish
    const width = 1000;
    const height = 500;

    // Find min/max for scale
    let min = Infinity, max = -Infinity;
    Object.values(state.gdpData).forEach(c => {
        const val = c.values[year];
        if (val !== null) {
            if (val < min) min = val;
            if (val > max) max = val;
        }
    });

    // Use logarithmic scale for sequential blue palette
    const noDataColor = getComputedStyle(document.documentElement).getPropertyValue('--map-no-data').trim() || '#f3f4f6';
    const colorScale = (val) => {
        if (val === null) return noDataColor;
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
        const code = feature.properties.ISO_A3;
        const countryData = state.gdpData[code];
        const val = countryData ? countryData.values[year] : null;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', generatePathData(feature.geometry, width, height));
        path.setAttribute('fill', colorScale(val));
        path.setAttribute('data-code', code);

        path.addEventListener('mouseenter', (e) => {
            path.style.stroke = "#fff";
            tooltip.classList.add('visible');
            tooltip.innerHTML = `
                <strong>${feature.properties.ADMIN}</strong><br>
                GDP (2015 USD): ${val ? '$' + Math.round(val).toLocaleString() : 'N/A'}
            `;
        });

        path.addEventListener('mousemove', (e) => {
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY + 10) + 'px';
        });

        path.addEventListener('mouseleave', () => {
            path.style.stroke = "#e5e7eb";
            tooltip.classList.remove('visible');
        });

        path.addEventListener('click', () => {
            if (!state.selectedCountries.includes(code)) {
                state.selectedCountries.push(code);
                updateCountryChips();
                updateInsights();
            }
        });

        svg.appendChild(path);
    });
}

// Simple Robinson/Mercator projection mock for the demo
function generatePathData(geometry, width, height) {
    if (!geometry) return "";

    const project = (coords) => {
        const x = (coords[0] + 180) * (width / 360);
        const y = (90 - coords[1]) * (height / 180);
        return `${x},${y}`;
    };

    if (geometry.type === "Polygon") {
        return "M" + geometry.coordinates[0].map(project).join("L") + "Z";
    } else if (geometry.type === "MultiPolygon") {
        return geometry.coordinates.map(poly =>
            "M" + poly[0].map(project).join("L") + "Z"
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

    // Determine primary data source based on view
    const usePPP = state.currentView === 'ppp';

    state.selectedCountries.forEach(code => {
        const gdp = state.gdpData[code];
        const ppp = state.pppData[code];
        if (!gdp && !ppp) return;

        const latestYear = 2023;
        const prevYear = latestYear - 5;

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

        const countryName = (usePPP && ppp) ? ppp.name : (gdp ? gdp.name : 'Unknown');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${countryName}</td>
            <td>${gVal ? '$' + Math.round(gVal).toLocaleString() : 'N/A'}</td>
            <td>${pVal ? '$' + Math.round(pVal).toLocaleString() : 'N/A'}</td>
            <td>${(gVal && pVal) ? (gVal / pVal).toFixed(3) : 'N/A'}</td>
            <td class="${growth !== null ? (growth >= 0 ? 'positive' : 'negative') : ''}">
                ${growth !== null ? (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%' : 'N/A'}
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
    const useGDP = state.currentView === 'gdp' || state.currentView === 'compare' || state.currentView === 'ratio' || state.currentView === 'map';
    const usePPP = state.currentView === 'ppp';
    const dataSource = usePPP ? state.pppData : state.gdpData;
    const dataLabel = usePPP ? 'PPP' : 'GDP';
    const currencyLabel = usePPP ? 'Int\'l $' : 'USD';

    const latestYear = 2023;
    const prevYear1 = 2022;
    const prevYear5 = 2018;
    const prevYear10 = 2013;

    // Calculate values for selected countries
    const countryStats = state.selectedCountries
        .filter(code => dataSource[code])
        .map(code => {
            const country = dataSource[code];
            const latest = country.values[latestYear];
            const prev1 = country.values[prevYear1];
            const prev5 = country.values[prevYear5];
            const prev10 = country.values[prevYear10];

            // Calculate growth rates
            const growth1yr = (latest && prev1) ? ((latest - prev1) / prev1 * 100) : null;
            const growth5yr = (latest && prev5) ? ((latest - prev5) / prev5 * 100) : null;
            const growth10yr = (latest && prev10) ? ((latest - prev10) / prev10 * 100) : null;

            // Calculate CAGR (Compound Annual Growth Rate) over 5 years
            const cagr5 = (latest && prev5) ? ((Math.pow(latest / prev5, 1 / 5) - 1) * 100) : null;

            return {
                code,
                name: country.name,
                latest,
                growth1yr,
                growth5yr,
                growth10yr,
                cagr5
            };
        })
        .filter(c => c.latest)
        .sort((a, b) => b.latest - a.latest);

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
        <span class="insight-highlight">$${Math.round(leader.latest).toLocaleString()}</span> (${currencyLabel}).</p>
    `;

    if (countryStats.length >= 2) {
        const runnerUp = countryStats[1];
        const diff = ((leader.latest - runnerUp.latest) / runnerUp.latest * 100).toFixed(1);
        insightHTML += `<p>That's <span class="insight-highlight">${diff}%</span> higher than ${runnerUp.name}.</p>`;
    }

    // Add growth summary for single country view
    if (countryStats.length === 1 && leader.growth5yr !== null) {
        const growthDir = leader.growth5yr >= 0 ? 'grew' : 'declined';
        insightHTML += `<p>${dataLabel} per capita ${growthDir} by <span class="insight-highlight">${Math.abs(leader.growth5yr).toFixed(1)}%</span> over 5 years.</p>`;
        if (leader.cagr5 !== null) {
            insightHTML += `<p>Avg. annual growth (CAGR): <span class="insight-highlight">${leader.cagr5.toFixed(2)}%</span></p>`;
        }
    }

    content.innerHTML = insightHTML;

    // Top Performers (by value)
    topContainer.innerHTML = countryStats.slice(0, 3).map((item, i) => `
        <div class="performer-item">
            <span class="performer-rank">${i + 1}</span>
            <span class="performer-name">${item.name}</span>
            <span class="performer-value">$${Math.round(item.latest / 1000)}k</span>
        </div>
    `).join('');

    // Growth Trends (sorted by 5-year growth)
    const growthSorted = [...countryStats]
        .filter(c => c.growth5yr !== null)
        .sort((a, b) => b.growth5yr - a.growth5yr);

    if (growthSorted.length > 0) {
        trendContainer.innerHTML = growthSorted.slice(0, 3).map(item => {
            const isPositive = item.growth5yr >= 0;
            return `
                <div class="trend-item">
                    <span class="trend-name">${item.name}</span>
                    <span class="trend-value ${isPositive ? '' : 'negative'}">${isPositive ? '+' : ''}${item.growth5yr.toFixed(1)}%</span>
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
