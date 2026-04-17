import csv
import shutil
import unittest
from pathlib import Path
from uuid import uuid4

from scripts.fund_prices_export_js import collect_monthly_prices


class FundPricesExportTests(unittest.TestCase):
    def test_collect_monthly_prices_uses_only_price_directories(self):
        artifacts_dir = Path.cwd() / ".test-artifacts"
        artifacts_dir.mkdir(exist_ok=True)
        root = artifacts_dir / f"fund-prices-{uuid4().hex}"
        root.mkdir()
        try:
            prices_dir = root / "prices"
            prices_dir.mkdir()

            with (prices_dir / "AAA.csv").open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=["date", "close", "isin"])
                writer.writeheader()
                writer.writerow({"date": "2026-04-01", "close": "10", "isin": "AAA"})
                writer.writerow({"date": "2026-04-20", "close": "12", "isin": "AAA"})

            with (root / "portfolio_value.csv").open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=["date", "nav", "isin"])
                writer.writeheader()
                writer.writerow({"date": "2026-04-30", "nav": "999", "isin": "ZZZ"})

            prices = collect_monthly_prices([prices_dir])

            self.assertEqual(prices, {"AAA": [["2026-04", 12.0]]})
        finally:
            shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
