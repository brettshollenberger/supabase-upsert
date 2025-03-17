# Supabase CSV Upsert

A command-line tool for upserting CSV data into Supabase tables. This tool makes it easy to bulk import or update data in your Supabase tables using CSV files.

## Features

- CSV file processing with automatic type detection
- Configurable batch processing to handle large datasets
- Upsert operations using a specified unique identifier
- Progress tracking with colored output
- Environment variable configuration for Supabase credentials

## Installation

Install locally:

```bash
# Clone the repository (or download the code)
git clone <repository-url>
cd supabase-upsert

# Install dependencies and build
npm install

# Install globally from local directory
npm install -g .
```

## Configuration

Set your Supabase credentials as environment variables:

```bash
export SUPABASE_URL=your_supabase_url
export SUPABASE_KEY=your_supabase_key
```

## Usage

```bash
supabase-csv-upsert <csv-file> --table <table-name> --id <unique-column> [--batch <batch-size>]
```

### Arguments

- `<csv-file>`: Path to your CSV file
- `--table`: Name of the target Supabase table
- `--id`: Column name to use as the unique identifier for upsert operations
- `--batch`: (Optional) Number of records to process in each batch (default: 50)

### Example

```bash
supabase-csv-upsert leads.csv --table contacts --id email --batch 100
```

This command will:

1. Read `leads.csv`
2. Upsert the data into the `contacts` table
3. Use the `email` column as the unique identifier
4. Process records in batches of 100

## CSV File Format

Your CSV file should have headers that match your Supabase table column names. For example:

```csv
email,first_name,last_name,company
john@example.com,John,Doe,Acme Inc
jane@example.com,Jane,Smith,Tech Corp
```

## Error Handling

The tool will:

- Validate the CSV file format
- Check for required environment variables
- Report any errors during the upsert process
- Show progress for each batch
- Display a summary of successful and failed operations

## Development

To contribute or modify the tool:

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Build: `npm run build`
5. Test locally: `npm run dev`

## License

MIT
