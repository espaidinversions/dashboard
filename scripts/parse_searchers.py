import csv, io, sys

GEO_MAP = {
    'ESP':'ES','ES':'ES','UK':'EN','EN':'EN','FRA':'FR','FR':'FR',
    'ITA':'IT','IT':'IT','DEU':'DE','GER':'DE','DACH':'DE',
    'NED':'NL','NL':'NL','POR':'PT','PT':'PT','USA':'US','US':'US',
    'CH':'CH','SWE':'SE','MEX':'MX','POL':'PL','TUR':'TR',
}

def js_escape(s):
    s = s.replace('\\', '\\\\').replace('"', '\\"')
    s = s.replace('\n', ' ').replace('\r', '').strip()
    return s

with open("C:/Users/EduardGenís/OneDrive - Espai d'Inversions/Documents/Claude/01. Dashboard/files search/260313_Raw Data Search Fund.txt", encoding='latin-1') as f:
    content = f.read()

reader = csv.reader(io.StringIO(content), delimiter='\t')
rows = list(reader)

entries = []
valid_tipus = ['Tradicional', 'Incubat', 'Self-funded']

for r in rows[1:]:
    if len(r) < 6:
        continue
    nom = r[0].strip()
    if not nom:
        continue
    tipus = r[1].strip() if len(r) > 1 else ''
    if tipus not in valid_tipus:
        continue

    raw_mod = r[2].strip() if len(r) > 2 else ''
    mod_lower = raw_mod.lower()
    if mod_lower == 'solo':
        modalitat = 'Solo'
    elif mod_lower == 'duo':
        modalitat = 'Duo'
    elif mod_lower == 'trio':
        modalitat = 'Trio'
    else:
        modalitat = raw_mod

    geo_raw = r[3].strip() if len(r) > 3 else ''
    geo = GEO_MAP.get(geo_raw, geo_raw)

    status_screening = r[5].strip() if len(r) > 5 else ''

    forma_entrada = r[10].strip() if len(r) > 10 else ''
    fe_lower = forma_entrada.lower()
    if 'equity' in fe_lower:
        forma_entrada = 'Equity Gap'
    elif 'search' in fe_lower:
        forma_entrada = 'Search Capital'

    intro_per  = r[11].strip() if len(r) > 11 else ''
    searcher1  = js_escape(r[13].strip()) if len(r) > 13 else ''
    searcher2  = js_escape(r[14].strip()) if len(r) > 14 else ''
    escola1    = js_escape(r[15].strip()) if len(r) > 15 else ''
    escola2    = js_escape(r[16].strip()) if len(r) > 16 else ''

    entries.append({
        'nom': js_escape(nom),
        'tipus': tipus,
        'modalitat': modalitat,
        'geo': geo,
        'statusScreening': js_escape(status_screening),
        'formEntrada': forma_entrada,
        'introPer': js_escape(intro_per),
        'searcher1': searcher1,
        'searcher2': searcher2,
        'escola1': escola1,
        'escola2': escola2,
    })

lines = []
lines.append(f"// {len(entries)} entries parsed from 260313_Raw Data Search Fund.txt")
lines.append("export const ALL_SEARCHERS = [")
for e in entries:
    lines.append(
        '  {nom:"' + e['nom'] + '",tipus:"' + e['tipus'] + '",modalitat:"' + e['modalitat'] +
        '",geo:"' + e['geo'] + '",statusScreening:"' + e['statusScreening'] +
        '",formEntrada:"' + e['formEntrada'] + '",introPer:"' + e['introPer'] +
        '",searcher1:"' + e['searcher1'] + '",searcher2:"' + e['searcher2'] +
        '",escola1:"' + e['escola1'] + '",escola2:"' + e['escola2'] + '"},'
    )
lines.append("];")
lines.append("")

# Stats to stderr
for s in sorted(set(e['statusScreening'] for e in entries)):
    c = sum(1 for e in entries if e['statusScreening'] == s)
    sys.stderr.write(f"  {s}: {c}\n")
sys.stderr.write(f"Total: {len(entries)}\n")

print('\n'.join(lines))
