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
async function upsertCsv(filePath, config) {
    try {
        const supabase = (0, supabase_js_1.createClient)(config.supabaseUrl, config.supabaseKey);
        // Read the CSV file
        const csvFile = fs_1.default.readFileSync(filePath, 'utf8');
        // Parse the CSV
        const { data, errors } = papaparse_1.default.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });
        if (errors.length > 0) {
            console.error(chalk_1.default.red('CSV parsing errors:'), errors);
            return;
        }
        console.log(chalk_1.default.blue(`Found ${data.length} records in the CSV file`));
        // Process in batches
        let successCount = 0;
        for (let i = 0; i < data.length; i += config.batchSize) {
            const batch = data.slice(i, i + config.batchSize);
            const currentBatch = Math.floor(i / config.batchSize) + 1;
            const totalBatches = Math.ceil(data.length / config.batchSize);
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
        console.log(chalk_1.default.green(`\nSuccessfully upserted ${successCount} out of ${data.length} records`));
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
