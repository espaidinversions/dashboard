import unittest

import pandas as pd

from scripts.portfolio_build_values import latest_total_mismatch


class PortfolioBuildValuesTests(unittest.TestCase):
    def test_latest_total_mismatch_returns_none_within_tolerance(self):
        df = pd.DataFrame([
            {"date": "2026-04-01", "value_eur": 100.0},
            {"date": "2026-04-01", "value_eur": 100.0},
        ])

        mismatch = latest_total_mismatch(df, 200.5, tolerance=0.01)
        self.assertIsNone(mismatch)

    def test_latest_total_mismatch_reports_large_gap(self):
        df = pd.DataFrame([
            {"date": "2026-04-01", "value_eur": 60.0},
            {"date": "2026-04-01", "value_eur": 40.0},
        ])

        mismatch = latest_total_mismatch(df, 150.0, tolerance=0.01)
        self.assertIsNotNone(mismatch)
        self.assertEqual(mismatch["latest_total"], 100.0)
        self.assertEqual(mismatch["workbook_total"], 150.0)


if __name__ == "__main__":
    unittest.main()
