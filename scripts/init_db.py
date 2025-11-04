from sqlalchemy import create_engine, text
import pandas as pd
import os

DB_URL = os.environ.get("DB_URL","sqlite:///data/kisan_netra.db")
engine = create_engine(DB_URL, future=True)

with engine.begin() as conn:
    conn.execute(text('''
    CREATE TABLE IF NOT EXISTS prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        district TEXT,
        dealer TEXT,
        product_name TEXT,
        brand TEXT,
        crop TEXT,
        disease TEXT,
        unit_price_inr REAL,
        unit TEXT,
        expected_yield_gain_pct REAL,
        notes TEXT
    )
    '''))

with engine.begin() as conn:
    count = conn.execute(text("SELECT COUNT(*) FROM prices")).scalar()
    if count == 0:
        df = pd.read_csv("data/sample_prices.csv")
        df.to_sql("prices", conn, if_exists="append", index=False)

print("Database initialized and sample data loaded.")
