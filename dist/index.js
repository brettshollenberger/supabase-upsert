#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const supabase_js_1 = require("@supabase/supabase-js");
const fs_1 = __importDefault(require("fs"));
const papaparse_1 = __importDefault(require("papaparse"));
const chalk_1 = __importDefault(require("chalk"));
const path_1 = __importDefault(require("path"));
async function analyzeErrors(errors, data, filePath) {
    // Parse the entire file properly first
    const fileContent = fs_1.default.readFileSync(filePath, 'utf8');
    const fullParseResult = papaparse_1.default.parse(fileContent, {
        header: false,
        skipEmptyLines: true,
        delimiter: ',',
        quoteChar: '"',
        escapeChar: '"'
    });
    // Get headers from first row
    const headers = fullParseResult.data[0];
    console.log(chalk_1.default.blue('\nCSV Structure:'));
    console.log(chalk_1.default.gray('Expected columns:', headers.length));
    console.log(chalk_1.default.gray('Total rows:', fullParseResult.data.length));
    // Validate each row
    let validRows = 0;
    let invalidRows = 0;
    const problemRows = [];
    for (let i = 1; i < fullParseResult.data.length; i++) {
        const row = fullParseResult.data[i];
        if (row.length === headers.length) {
            validRows++;
        }
        else {
            invalidRows++;
            if (problemRows.length < 3) { // Store first 3 problem rows for detailed analysis
                problemRows.push(i);
            }
        }
    }
    console.log(chalk_1.default.green(`\nValid rows: ${validRows}`));
    if (invalidRows > 0) {
        console.log(chalk_1.default.red(`Invalid rows: ${invalidRows}`));
        // Show sample of problem rows
        console.log(chalk_1.default.yellow('\nSample of problematic rows:'));
        for (const rowIndex of problemRows) {
            const row = fullParseResult.data[rowIndex];
            console.log(chalk_1.default.red(`\nRow ${rowIndex}:`));
            console.log(chalk_1.default.blue('\nDetailed column analysis:'));
            console.log(chalk_1.default.gray('Expected columns:', headers.length));
            console.log(chalk_1.default.gray('Actual columns:', row.length));
            // Show all fields
            const maxLen = Math.max(headers.length, row.length);
            for (let i = 0; i < maxLen; i++) {
                const header = headers[i] ? headers[i].replace(/^"(.*)"$/, '$1') : 'EXTRA';
                const value = row[i] ? row[i].replace(/^"(.*)"$/, '$1') : chalk_1.default.gray('(empty)');
                if (i >= headers.length) {
                    console.log(chalk_1.default.red(`${i + 1}. EXTRA COLUMN: ${value}`));
                }
                else {
                    console.log(`${i + 1}. "${header}": ${chalk_1.default.cyan(value)}`);
                }
            }
            // Show raw line
            console.log(chalk_1.default.gray('\nRaw row data:'));
            console.log(fullParseResult.data[rowIndex].join(','));
        }
    }
    // If we have no real errors, clear the errors array
    if (invalidRows === 0) {
        errors.length = 0;
    }
}
async function upsertCsv(filePath, config) {
    try {
        const supabase = (0, supabase_js_1.createClient)(config.supabaseUrl, config.supabaseKey);
        // Read and parse the CSV with proper options
        const csvFile = fs_1.default.readFileSync(filePath, 'utf8');
        const parseResult = papaparse_1.default.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            transform: (value) => value === '' ? null : value,
            delimiter: ',',
            quoteChar: '"',
            escapeChar: '"'
        });
        // Always show parsing analysis
        await analyzeErrors(parseResult.errors, parseResult.data, filePath);
        if (parseResult.errors.length > 0) {
            console.log(chalk_1.default.yellow('\nWould you like to:'));
            console.log('1. Continue with import (errors will be skipped)');
            console.log('2. Abort import to fix CSV issues');
            process.exit(1);
        }
        if (parseResult.data.length === 0) {
            console.error(chalk_1.default.red('No valid data found in CSV file'));
            return;
        }
        console.log(chalk_1.default.blue(`\nFound ${parseResult.data.length} valid records in the CSV file`));
        // Process in batches
        let successCount = 0;
        for (let i = 0; i < parseResult.data.length; i += config.batchSize) {
            const batch = parseResult.data.slice(i, i + config.batchSize);
            const currentBatch = Math.floor(i / config.batchSize) + 1;
            const totalBatches = Math.ceil(parseResult.data.length / config.batchSize);
            // Perform upsert operation
            const { error } = await supabase
                .from(config.tableName)
                .upsert(batch, {
                onConflict: config.uniqueKey
            });
            if (error) {
                console.error(chalk_1.default.red(`Error on batch ${currentBatch}:`), error);
            }
            else {
                successCount += batch.length;
                console.log(chalk_1.default.green(`Processed batch ${currentBatch}/${totalBatches}`));
            }
        }
        console.log(chalk_1.default.green(`\nSuccessfully upserted ${successCount} out of ${parseResult.data.length} records`));
    }
    catch (error) {
        console.error(chalk_1.default.red('Error processing the CSV file:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
commander_1.program
    .name('supabase-csv-upsert')
    .description('Upsert CSV data into Supabase tables')
    .version('1.0.0')
    .argument('<file>', 'CSV file to upsert')
    .requiredOption('--table <table>', 'Table name to upsert into')
    .requiredOption('--id <column>', 'Unique identifier column')
    .option('--batch <size>', 'Batch size for upsert operations', '50')
    .action(async (file, options) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error(chalk_1.default.red('Error: SUPABASE_URL and SUPABASE_KEY environment variables are required'));
        process.exit(1);
    }
    const config = {
        supabaseUrl,
        supabaseKey,
        tableName: options.table,
        uniqueKey: options.id,
        batchSize: parseInt(options.batch, 10)
    };
    const filePath = path_1.default.resolve(process.cwd(), file);
    if (!fs_1.default.existsSync(filePath)) {
        console.error(chalk_1.default.red(`Error: File not found: ${filePath}`));
        process.exit(1);
    }
    console.log(chalk_1.default.blue(`Upserting data from ${filePath} to ${config.tableName} table`));
    console.log(chalk_1.default.gray(`Using ${config.uniqueKey} as the unique identifier\n`));
    await upsertCsv(filePath, config);
});
commander_1.program.parse();
