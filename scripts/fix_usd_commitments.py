import re, json

# Read source TXT
with open("C:/Users/EduardGenís/OneDrive - Espai d'Inversions/Documents/Claude/01. Dashboard/raw-data/260312_CapitalCalls_Log.txt", encoding='utf-8') as f:
    lines = f.readlines()

def parse_num(s):
    s = s.strip().replace(',', '')
    try: return float(s)
    except: return 0.0

def parse_date(s):
    s = s.strip()
    if not s or '/' not in s: return ''
    try:
        d, m, y = s.split('/')
        return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    except: return ''

def js_escape(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')

def csv_escape(s):
    s = str(s)
    if ',' in s or '"' in s or '\n' in s:
        return '"' + s.replace('"', '""') + '"'
    return s

CAT_MAP = {
    'Compromís': 'Compromís',
    'Aportació': 'Capital Call',
    'Distribució': 'Distribució',
    'Retorn Capital': 'Retorn Capital',
    'Devol. Capital': 'Retorn Capital',
    'Close Interest': 'Capital Call',
}

# Parse all rows
rows = []
for line in lines[1:]:  # skip header
    cols = line.rstrip('\n').split('\t')
    if len(cols) < 14: continue
    fons = cols[0].strip()
    tipus = cols[1].strip()
    data_raw = cols[3].strip()
    import_raw = cols[4].strip()
    divisa = cols[5].strip()
    fx_raw = cols[6].strip()
    mes_raw = cols[8].strip()
    any_raw = cols[9].strip()
    fy_raw = cols[10].strip()
    vcpe_raw = cols[11].strip()
    eur_raw = cols[13].strip()
    est_raw = cols[14].strip().rstrip('\n') if len(cols) > 14 else ''

    cat = CAT_MAP.get(tipus, '')
    if not cat or not fons: continue

    any_val = int(any_raw) if any_raw.lstrip('-').isdigit() else 0
    if any_val == 0 or any_val == 1900: continue

    eur = parse_num(eur_raw)
    usd_amt = parse_num(import_raw)
    fx = parse_num(fx_raw)

    # Categorize vcpe
    vcpe = vcpe_raw
    if 'Tectum' in fons or 'Meridia Real Estate' in fons:
        vcpe = 'RE'

    rows.append({
        'fons': fons,
        'tipus': tipus,
        'cat': cat,
        'data': parse_date(data_raw),
        'mes': int(mes_raw.strip()) if mes_raw.strip().isdigit() else 0,
        'any': any_val,
        'fy': fy_raw.strip(),
        'vcpe': vcpe,
        'est': est_raw.strip(),
        'divisa': divisa,
        'usd_amt': usd_amt,
        'fx': fx,
        'eur': eur,
    })

# Build FX lookup: for each USD fund, get the first capital call FX rate
fund_fx = {}
for r in rows:
    if r['divisa'] == 'USD' and r['fx'] > 0 and r['cat'] == 'Capital Call':
        if r['fons'] not in fund_fx:
            fund_fx[r['fons']] = r['fx']

# Fallback: average FX from all USD capital calls
all_fx = [r['fx'] for r in rows if r['divisa'] == 'USD' and r['fx'] > 0 and r['cat'] == 'Capital Call']
avg_fx = sum(all_fx) / len(all_fx) if all_fx else 1.10

# Fix Compromís entries with eur=0
fixed = 0
for r in rows:
    if r['cat'] == 'Compromís' and r['eur'] == 0 and r['divisa'] == 'USD' and r['usd_amt'] > 0:
        fx = fund_fx.get(r['fons'], avg_fx)
        r['eur'] = round(r['usd_amt'] / fx, 2)
        fixed += 1
        print(f"  Fixed: {r['fons']} | USD {r['usd_amt']:,.0f} / {fx:.3f} = EUR {r['eur']:,.0f}")

print(f"\nFixed {fixed} Compromis entries")
print(f"Total rows: {len(rows)}")

# Write JS
out_lines = ['// AUTO-GENERATED — source: 260312_CapitalCalls_Log.txt\n', '\n', 'export const RAW_CC = [\n']
for r in rows:
    out_lines.append(
        '  {"fons":"' + js_escape(r['fons']) + '","tipus":"' + js_escape(r['tipus']) +
        '","cat":"' + r['cat'] + '","data":"' + r['data'] +
        '","mes":' + str(r['mes']) + ',"any":' + str(r['any']) +
        ',"fy":"' + r['fy'] + '","vcpe":"' + r['vcpe'] + '","est":"' + r['est'] +
        '","eur":' + str(r['eur']) + '},\n'
    )
out_lines.append('];\n')

with open("C:/Users/EduardGenís/OneDrive - Espai d'Inversions/Documents/Claude/01. Dashboard/src/data/capital-calls.js", 'w', encoding='utf-8') as f:
    f.writelines(out_lines)
print("Written capital-calls.js")

# Write CSV
csv_lines = ['fons,tipus,cat,data,mes,any,fy,vcpe,est,divisa,eur\n']
for r in rows:
    csv_lines.append(
        csv_escape(r['fons']) + ',' + csv_escape(r['tipus']) + ',' + csv_escape(r['cat']) + ',' +
        r['data'] + ',' + str(r['mes']) + ',' + str(r['any']) + ',' +
        csv_escape(r['fy']) + ',' + r['vcpe'] + ',' + csv_escape(r['est']) + ',' +
        r['divisa'] + ',' + str(r['eur']) + '\n'
    )

with open("C:/Users/EduardGenís/OneDrive - Espai d'Inversions/Documents/Claude/01. Dashboard/raw-data/capital-calls.csv", 'w', encoding='utf-8') as f:
    f.writelines(csv_lines)
print("Written capital-calls.csv")
