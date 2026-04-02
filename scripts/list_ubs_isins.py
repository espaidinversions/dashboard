import re
from pathlib import Path

def main():
    content = Path("src/data/ubsPositions.js").read_text(encoding="utf-8")
    isins = re.findall(r'isin:\s*"([A-Z0-9]{12})"', content)
    for isin in sorted(list(set(isins))):
        print(isin)

if __name__ == "__main__":
    main()
