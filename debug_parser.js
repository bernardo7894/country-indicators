const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'API_NY.GDP.PCAP.PP.KD_DS2_en_csv_v2_1423.csv');
const csvText = fs.readFileSync(filePath, 'utf-8');

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    console.log(`Total lines: ${lines.length}`);
    const data = {};

    // Header is on line 5 (index 4)
    const headerLine = lines[4];
    if (!headerLine) {
        console.log("Header line not found!");
        return data;
    }

    console.log(`Header line: ${headerLine.substring(0, 100)}...`);

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
    console.log(`Headers count: ${headers.length}`);

    // Find '1990' specifically as it is the start of data for many
    const year1990Idx = headers.findIndex(h => h.trim() === '1990');
    const startYearIdx = headers.findIndex(h => h.trim() === '1960');
    console.log(`Start Year (1960) Index: ${startYearIdx}`);
    console.log(`1990 Index: ${year1990Idx}`);

    for (let i = 5; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = parseLine(line);
        if (parts.length < 5) {
            console.log(`Skipping short line ${i}: ${line.substring(0, 50)}...`);
            continue;
        }

        const name = parts[0];
        const code = parts[1];

        if (code === 'IRL') {
            console.log(`Found Ireland (Line ${i})`);
            console.log(`Parts count: ${parts.length}`);
            console.log(`Name: ${name}, Code: ${code}`);

            const values = {};
            for (let j = startYearIdx; j < parts.length; j++) {
                const year = headers[j];
                if (!year || isNaN(year.trim())) continue;

                const valRaw = parts[j];
                const val = parseFloat(valRaw);
                values[year.trim()] = isNaN(val) ? null : val;

                if (year.trim() === '2020') {
                    console.log(`2020 Raw: "${valRaw}", Parsed: ${val}`);
                }
            }
            console.log(`Parsed Values for 1990-1995:`,
                JSON.stringify({
                    1990: values['1990'],
                    1991: values['1991'],
                    1995: values['1995']
                }, null, 2)
            );
            data[code] = { name, values };
        }
    }

    return data;
}

const result = parseCSV(csvText);
if (result['IRL']) {
    console.log("Ireland parsed successfully.");
} else {
    console.log("Ireland NOT found in parsed data.");
}
