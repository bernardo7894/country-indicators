# Country Indicators Explorer

An interactive macroeconomic data visualization tool to explore and compare GDP, PPP, price-level, life-expectancy, population, and growth indicators across countries and selected U.S. state data.

## Features

- **Multi-View Modes**:
    - **GDP (USD)**: View historical GDP per capita trends.
    - **PPP**: View historical Purchasing Power Parity adjusted GDP per capita.
    - **Compare**: Side-by-side comparison of GDP and PPP for specific countries.
    - **Ratio**: Analyze the ratio between GDP and PPP to understand currency valuation and cost of living differences.
    - **Life Expectancy**: Compare health outcomes over time.
    - **Population**: Explore population trends for countries.
    - **GDP Growth**: Compare annual GDP-per-capita growth.
    - **Map**: Interactive Equal Earth choropleth world map with switchable map metrics.
- **Interactive Controls**:
    - Multi-select entities with quick removal chips.
    - Separate scopes for countries and U.S. states so subdivisions do not mix into country rankings by default.
    - Responsive year range sliders (1960 - 2024).
    - GDP mode toggle (Per Capita vs Total GDP).
    - Map animation ("Play" mode) to visualize economic growth over time.
- **Data Insights**:
    - Automated comparative analysis between selected entities.
    - Top performers and growth trend identification.
- **Export Options**:
    - Download charts as PNG images.
    - Export filtered data as CSV files.

## How to Run

Because the application fetches local CSV data files, it must be served through a local web server to avoid browser CORS (Cross-Origin Resource Sharing) restrictions.

### Option 1: Using VS Code Live Server (Recommended)
1. Open this folder in VS Code.
2. If you have the "Live Server" extension installed, click **Go Live** in the bottom status bar.

### Option 2: Using Python (Built-in)
Run the following command in your terminal within this directory:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

### Option 3: Using Node.js (npx)
Run the following command:
```bash
npx http-server
```
Then open the provided local URL in your browser.

## Data Source
Data is sourced from the **World Bank's World Development Indicators**:
- `NY.GDP.PCAP.KD` (GDP per capita)
- `NY.GDP.PCAP.PP.KD` (GDP per capita, PPP)
- `SP.DYN.LE00.IN` (life expectancy)
- `SP.POP.TOTL` (population)
- U.S. state GDP, PPP, and life-expectancy CSV files included in the repository.
- Last Updated: December 2025
