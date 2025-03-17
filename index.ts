import { program } from 'commander';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import Papa from 'papaparse';
import chalk from 'chalk';
import path from 'path';

interface Config {
  supabaseUrl: string;
  supabaseKey: string;
  tableName: string;
  uniqueKey: string;
  batchSize: number;
}

async function upsertCsv(filePath: string, config: Config): Promise<void> {
  try {
    const supabase: SupabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
    
    // Read the CSV file
    const csvFile = fs.readFileSync(filePath, 'utf8');
    
    // Parse the CSV
    const { data, errors } = Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });
    
    if (errors.length > 0) {
      console.error(chalk.red('CSV parsing errors:'), errors);
      return;
    }
    
    console.log(chalk.blue(`Found ${data.length} records in the CSV file`));
    
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
        console.error(chalk.red(`Error on batch ${currentBatch}:`), error);
      } else {
        successCount += batch.length;
        console.log(chalk.green(`Processed batch ${currentBatch}/${totalBatches}`));
      }
    }
    
    console.log(chalk.green(`\nSuccessfully upserted ${successCount} out of ${data.length} records`));
  } catch (error) {
    console.error(chalk.red('Error processing the CSV file:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

program
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
      console.error(chalk.red('Error: SUPABASE_URL and SUPABASE_KEY environment variables are required'));
      process.exit(1);
    }

    const config: Config = {
      supabaseUrl,
      supabaseKey,
      tableName: options.table,
      uniqueKey: options.id,
      batchSize: parseInt(options.batch, 10)
    };

    const filePath = path.resolve(process.cwd(), file);
    
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`Error: File not found: ${filePath}`));
      process.exit(1);
    }
    
    console.log(chalk.blue(`Upserting data from ${filePath} to ${config.tableName} table`));
    console.log(chalk.gray(`Using ${config.uniqueKey} as the unique identifier\n`));
    
    await upsertCsv(filePath, config);
  });

program.parse();