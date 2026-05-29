import sqlite3
import csv
import os
import re

DB_FILE = "ois.db"
OUTPUT_DIR = "csv_export"

os.makedirs(OUTPUT_DIR, exist_ok=True)

conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()

cursor.execute("""
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
""")

tables = [row[0] for row in cursor.fetchall()]

for table in tables:
    safe_filename = re.sub(r"[^a-zA-Z0-9_-]", "_", table) + ".csv"
    output_path = os.path.join(OUTPUT_DIR, safe_filename)

    escaped_table = table.replace('"', '""')
    cursor.execute(f'SELECT * FROM "{escaped_table}"')

    columns = [description[0] for description in cursor.description]
    rows = cursor.fetchall()

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows)

    print(f"Exported {table} -> {output_path}")

conn.close()
