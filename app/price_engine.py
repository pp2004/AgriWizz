from dataclasses import dataclass
from typing import Optional
from sqlalchemy import create_engine, text
import os

@dataclass
class Recommendation:
    best_product: str
    brand: str
    dealer: str
    unit_price_inr: float
    expected_yield_gain_pct: float
    expected_profit_inr: float
    rationale: str

class PriceEngine:
    def __init__(self, db_url: Optional[str]=None):
        self.db_url = db_url or os.environ.get("DB_URL","sqlite:///data/kisan_netra.db")
        self.engine = create_engine(self.db_url, future=True)

    def suggest(self, district: str, crop: str, disease: str, baseline_price_per_kg: float=20.0, acreage: float=1.0) -> Optional[Recommendation]:
        q = text("""
            SELECT dealer, product_name, brand, unit_price_inr, expected_yield_gain_pct, notes
            FROM prices
            WHERE lower(district)=lower(:district) AND lower(crop)=lower(:crop) AND lower(disease)=lower(:disease)
            ORDER BY unit_price_inr ASC
        """)
        with self.engine.begin() as conn:
            rows = conn.execute(q, {"district":district,"crop":crop,"disease":disease}).mappings().all()

        if not rows:
            return None

        baseline_revenue = 1000 * baseline_price_per_kg * acreage
        best = None
        for r in rows:
            gain = (float(r["expected_yield_gain_pct"])/100.0) * baseline_revenue
            cost = float(r["unit_price_inr"])
            profit = gain - cost
            rec = Recommendation(
                best_product=r["product_name"],
                brand=r["brand"],
                dealer=r["dealer"],
                unit_price_inr=cost,
                expected_yield_gain_pct=float(r["expected_yield_gain_pct"]),
                expected_profit_inr=profit,
                rationale=f"Estimated gain {gain:.0f} - cost {cost:.0f} = profit {profit:.0f} INR"
            )
            if best is None or rec.expected_profit_inr > best.expected_profit_inr:
                best = rec
        return best
