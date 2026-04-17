import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { readStoredFlag } from "../utils.js";
import { Logo } from "./SharedComponents.jsx";

// ── Shared typography helpers ──────────────────────────────────────────────
function H1({ children }) {
  const { tc } = useTheme();
  return (
    <h1 style={{ fontSize: 26, fontWeight: 700, color: tc.navy, margin: "0 0 6px 0", lineHeight: 1.25 }}>
      {children}
    </h1>
  );
}
function H2({ id, children }) {
  const { tc } = useTheme();
  return (
    <h2 id={id} style={{ fontSize: 18, fontWeight: 700, color: tc.navy, margin: "36px 0 10px 0", paddingTop: 8, borderBottom: `2px solid ${tc.border}`, paddingBottom: 8 }}>
      {children}
    </h2>
  );
}
function H3({ children }) {
  const { tc } = useTheme();
  return (
    <h3 style={{ fontSize: 14, fontWeight: 700, color: tc.navy, margin: "22px 0 8px 0" }}>
      {children}
    </h3>
  );
}
function P({ children }) {
  const { tc } = useTheme();
  return <p style={{ margin: "0 0 10px 0", color: tc.text, lineHeight: 1.6 }}>{children}</p>;
}
function UL({ children }) {
  const { tc } = useTheme();
  return <ul style={{ margin: "0 0 12px 0", paddingLeft: 20, color: tc.text, lineHeight: 1.7 }}>{children}</ul>;
}
function LI({ children }) {
  return <li style={{ marginBottom: 3 }}>{children}</li>;
}
function Code({ children }) {
  const { tc } = useTheme();
  return (
    <code style={{ background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 4, padding: "1px 5px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: tc.navy }}>
      {children}
    </code>
  );
}
function Note({ children }) {
  const { tc } = useTheme();
  return (
    <div style={{ background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "10px 14px", margin: "10px 0 14px 0", fontSize: 13, color: tc.textMid, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}
function Badge({ label, color = "#1B4F72", bg = "#E8F0F7" }) {
  return (
    <span style={{ display: "inline-block", background: bg, color, borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 700, marginLeft: 4, verticalAlign: "middle" }}>
      {label}
    </span>
  );
}
function AdminOnly() {
  return <Badge label="Només admins" color="#7c3c00" bg="#fff0e0" />;
}

function Table({ head, rows }) {
  const { tc } = useTheme();
  return (
    <div style={{ overflowX: "auto", margin: "0 0 16px 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: tc.bgAlt }}>
            {head.map((h, i) => (
              <th key={i} style={{ padding: "8px 12px", textAlign: "left", color: tc.navy, fontWeight: 600, borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${tc.border}` }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "7px 12px", color: tc.text, verticalAlign: "top" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sidebar TOC ────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "s1", label: "Navegació general" },
  { id: "s2", label: "Mercats Privats" },
  { id: "s2-1", label: "   Capital Calls", sub: true },
  { id: "s2-2", label: "   Searchers", sub: true },
  { id: "s2-3", label: "   Participades", sub: true },
  { id: "s2-4", label: "   Pipeline FY26", sub: true },
  { id: "s3", label: "Mercats Públics" },
  { id: "s3-1", label: "   Posicions & Resum", sub: true },
  { id: "s3-2", label: "   Transaccions", sub: true },
  { id: "s3-3", label: "   Overrides & Metadades", sub: true },
  { id: "s4", label: "Panell d'Administració" },
  { id: "s5", label: "Rols i Permisos" },
  { id: "s6", label: "Persistència de Dades" },
];

function Sidebar({ active }) {
  const { tc } = useTheme();
  return (
    <div style={{ width: 210, flexShrink: 0, position: "sticky", top: 24, alignSelf: "flex-start" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: tc.textLight, marginBottom: 10 }}>
        Continguts
      </div>
      {SECTIONS.map(s => (
        <a
          key={s.id}
          href={`#${s.id}`}
          style={{
            display: "block",
            padding: s.sub ? "3px 0 3px 14px" : "5px 0",
            fontSize: s.sub ? 12 : 13,
            color: active === s.id ? tc.navy : tc.textMid,
            fontWeight: active === s.id ? 600 : 400,
            textDecoration: "none",
            borderLeft: s.sub ? `2px solid ${tc.border}` : "none",
            transition: "color 0.15s",
          }}
        >
          {s.label.trim()}
        </a>
      ))}
    </div>
  );
}

// ── Content sections ───────────────────────────────────────────────────────
function S1() {
  return (
    <>
      <H2 id="s1">1. Navegació General</H2>
      <P>El tauler té tres seccions principals accessibles des de la barra superior blau marí:</P>
      <Table
        head={["Secció", "Contingut"]}
        rows={[
          ["Alternatives", "Mercats privats: fons, searchers, participades, pipeline"],
          ["Mercats Públics", "Renda variable, renda fixa i transaccions"],
          ["Real Estate", "Properament"],
        ]}
      />
      <H3>Controls de la capçalera</H3>
      <Table
        head={["Control", "Acció"]}
        rows={[
          ["Caixa de cerca", "Filtra les dades de la secció activa"],
          ["↓ Excel", "Exporta la vista actual a un fitxer Excel"],
          ["☀️ / 🌙", "Alterna el tema clar/fosc (es desa entre sessions)"],
          ["Admin", "Accedeix al panell d'administració (només admins)"],
          ["Guia", "Aquesta pàgina"],
          ["Sortir", "Tanca la sessió"],
        ]}
      />
      <H3>Tecles ràpides</H3>
      <UL>
        <LI><Code>← →</Code> — Canvia entre les pestanyes de la secció activa</LI>
        <LI><Code>Ctrl+P</Code> — Activa la vista d'impressió (s'amaguen els controls de la UI)</LI>
      </UL>
      <H3>Sessió i accés</H3>
      <P>La sessió expira als <strong>30 minuts d'inactivitat</strong>. La pàgina et demanarà tornar a iniciar sessió.</P>
      <P>L'accés està restringit als dominis de correu aprovats. Contacta un administrador per afegir un domini nou.</P>
    </>
  );
}

function S2() {
  return (
    <>
      <H2 id="s2">2. Mercats Privats (Alternatives)</H2>
      <P>La secció Alternatives té una barra de navegació secundària (blava) amb quatre àrees: <strong>Fons</strong>, <strong>Searchers</strong>, <strong>Participades</strong> i <strong>Detall per Inversió</strong>.</P>

      <H2 id="s2-1">2.1 Capital Calls (Per Fons)</H2>
      <P>La pestanya <strong>Per Fons</strong> és el registre principal de moviments de capital. Llista cada capital call, distribució i retorn agrupat per fons.</P>
      <H3>Veure i filtrar</H3>
      <UL>
        <LI>Utilitza el selector d'any fiscal (FY 2019–2027) per delimitar la vista</LI>
        <LI>Filtra per tipus (PE / VC / RE), estructura del fons o categoria</LI>
        <LI>Cerca per nom de fons amb el camp de text</LI>
        <LI>Fes clic a elements del gràfic per filtrar la taula per aquell segment</LI>
      </UL>
      <H3>Afegir un moviment <AdminOnly /></H3>
      <UL>
        <LI>Fes clic a <strong>+ Afegeix moviment</strong> al peu de la secció del fons</LI>
        <LI>Omple el modal: fons, categoria, data, import EUR, divisa original, VC/PE/RE, estructura</LI>
        <LI>Fes clic a <strong>Desa</strong>. Els camps <Code>mes</Code>, <Code>any</Code> i <Code>FY</Code> es deriven automàticament de la data</LI>
      </UL>
      <H3>Editar un moviment <AdminOnly /></H3>
      <P>Fes clic a la icona del llapis de la fila per obrir el modal d'edició. Modifica els camps i fes clic a <strong>Desa</strong>.</P>
      <H3>Eliminar un moviment <AdminOnly /></H3>
      <P>Fes clic a la icona de la paperera de la fila. La fila s'elimina immediatament i els totals s'actualitzen.</P>
      <H3>Excloure un fons de l'anàlisi</H3>
      <P>Fes clic al nom del fons al Selector de Fons (part superior) per incloure'l o excloure'l de les agregacions. Els fons exclosos apareixen en gris. Aquesta preferència és local i no afecta les dades.</P>

      <H2 id="s2-2">2.2 Searchers</H2>
      <P>Mostra tots els search capital i equity gap partners rastrejats al llarg del cicle d'inversió.</P>
      <H3>Afegir un searcher <AdminOnly /></H3>
      <UL>
        <LI>Fes clic a <strong>+ Afegeix searcher</strong></LI>
        <LI>Omple: nom, estat, forma d'entrada, geografia, ticket, data d'inici, modalitat (Solo / Duo / Trio / Partnership)</LI>
        <LI>Fes clic a <strong>Desa</strong></LI>
      </UL>
      <H3>Editar un searcher <AdminOnly /></H3>
      <P>Fes clic a qualsevol cel·la de la taula per editar-la inline. La cel·la s'activa amb una vora blava. Prem <Code>Enter</Code> per desar o <Code>Escape</Code> per cancel·lar.</P>
      <P>Camps editables: estat, modalitat, forma d'entrada, geografia, ticket, data d'inici.</P>
      <H3>Eliminar un searcher <AdminOnly /></H3>
      <P>Fes clic a la icona de la paperera al final de la fila.</P>

      <H2 id="s2-3">2.3 Participades (Portfolio Companies)</H2>
      <P>Llista completa de les empreses participades amb mètriques operatives i financeres.</P>
      <H3>Afegir una empresa <AdminOnly /></H3>
      <UL>
        <LI>Fes clic a <strong>+ Afegeix participada</strong></LI>
        <LI>Camp obligatori: <strong>Nom</strong></LI>
        <LI>Opcionals: tipus (SF / PE), segment, emprenedors, origen, geografia, ticket, TVPI, ingressos, EBITDA, data de compromís, mesos en operació</LI>
        <LI>Fes clic a <strong>Desa</strong></LI>
      </UL>
      <H3>Editar una empresa <AdminOnly /></H3>
      <P>Fes clic a qualsevol cel·la per editar-la inline: tipus, segment, emprenedors, origen, geografia, ticket, TVPI, ingressos, EBITDA, data de compromís, mesos en operació.</P>
      <H3>Eliminar una empresa <AdminOnly /></H3>
      <P>Fes clic a la icona de la paperera de la fila.</P>
      <H3>Càrrega massiva via JSON <AdminOnly /></H3>
      <P>Fes clic a <strong>Carregar JSON</strong> per pujar un fitxer JSON amb un array d'objectes empresa. El fitxer es valida abans de desar. Les empreses existents s'actualitzen per coincidència de nom; les noves s'afegeixen.</P>
      <H3>Refrescar des de la base de dades</H3>
      <P>Fes clic a <strong>Refrescar</strong> per recarregar les dades des de Supabase, descartant qualsevol estat local en caché.</P>

      <H2 id="s2-4">2.4 Pipeline FY26</H2>
      <P>El pipeline de deals per a l'exercici fiscal actual.</P>
      <H3>Afegir un deal <AdminOnly /></H3>
      <UL>
        <LI>Fes clic a <strong>+ Afegeix deal</strong></LI>
        <LI>Omple: nom, import, divisa (EUR / USD), geografia, estratègia, sector, estat, canal, data estimada de tancament</LI>
        <LI>Fes clic a <strong>Desa</strong></LI>
      </UL>
      <H3>Editar un deal <AdminOnly /></H3>
      <P>Fes clic a qualsevol cel·la de la fila per editar-la inline.</P>
      <H3>Activar / Desactivar un deal <AdminOnly /></H3>
      <P>Fes clic al toggle <strong>Actiu</strong> de la fila. Els deals inactius s'oculten dels gràfics de resum però es mantenen a la base de dades.</P>
      <H3>Eliminar un deal <AdminOnly /></H3>
      <P>Fes clic a la icona de la paperera de la fila.</P>
    </>
  );
}

function S3() {
  return (
    <>
      <H2 id="s3">3. Mercats Públics</H2>
      <P>La secció de mercats públics mostra les posicions en renda variable i renda fixa. Sub-pestanyes (barra verda): <strong>Resum</strong>, <strong>Renda Variable</strong>, <strong>Renda Fixa</strong>, <strong>Posicions</strong>, <strong>Transaccions</strong>.</P>

      <H2 id="s3-1">3.1 Posicions i Resum</H2>
      <P>Les quatre primeres pestanyes són vistes computades de només lectura. Les dades provenen del model PM (agregat a partir de preus de fons, metadades de posicions i historial de transaccions).</P>
      <Table
        head={["Pestanya", "Contingut"]}
        rows={[
          ["Resum", "KPIs de cartera, gràfics de composició i fluxos mensuals"],
          ["Renda Variable", "Taula de posicions de renda variable filtrable per custodi, sector i geografia"],
          ["Renda Fixa", "Taula de posicions de renda fixa filtrable per custodi i ràting"],
          ["Posicions", "Llista completa de posicions actives i tancades (toggle Tancades)"],
        ]}
      />

      <H2 id="s3-2">3.2 Transaccions</H2>
      <H3>Afegir una transacció <AdminOnly /></H3>
      <UL>
        <LI>Fes clic a <strong>+ Afegeix transacció</strong></LI>
        <LI>Omple: acció (Buy / Sell / Income), data, ISIN, nom de l'actiu, tipus (RV / RF), custodi, unitats, NAV, valor en EUR</LI>
        <LI>Fes clic a <strong>Desa</strong></LI>
      </UL>
      <H3>Editar una transacció <AdminOnly /></H3>
      <P>Fes clic a qualsevol cel·la per editar-la inline. Prem <Code>Enter</Code> per desar o <Code>Escape</Code> per cancel·lar.</P>
      <H3>Eliminar una transacció <AdminOnly /></H3>
      <P>Fes clic a la icona de la paperera. Les vistes de posicions i resum es recalculen en la propera càrrega.</P>

      <H2 id="s3-3">3.3 Overrides i Metadades <AdminOnly /></H2>
      <P>Aquestes eines estan a <strong>Admin → PM Operacions</strong>. Permeten corregir o complementar dades del model PM sense modificar el model en si. Les cel·les sobreescrites mostren una insígnia <strong style={{ color: "#E65100" }}>OV</strong> taronja a la taula de Holdings.</P>
      <Table
        head={["Eina", "Controla"]}
        rows={[
          ["TER", "Total Expense Ratio per fons. Estableix quan el TER del model és incorrecte o inexistent."],
          ["Overrides", "Correccions manuals per posició: valorMercat, rendInici, rend2026, rend2025, costAnual."],
          ["Metadades", "Etiquetes personalitzades de nom, gestora i custodi per posició."],
        ]}
      />
      <Note>Per afegir un override: ves a la sub-pestanya corresponent, fes clic a <strong>+ Afegeix</strong>, omple l'ISIN i el valor, afegeix opcionalment una <strong>Nota</strong> explicativa i desa. Per eliminar-lo, fes clic a la paperera — la taula de Holdings revertirà al valor del model en la propera càrrega.</Note>
    </>
  );
}

function S4() {
  return (
    <>
      <H2 id="s4">4. Panell d'Administració</H2>
      <P>Accessible a <Code>/admin</Code> per a usuaris amb rol <strong>admin</strong> o <strong>superuser</strong>.</P>

      <H3>Usuaris</H3>
      <UL>
        <LI>Llista tots els usuaris registrats (actius + pendents d'aprovació)</LI>
        <LI><strong>Canviar rol:</strong> Selecciona un nou rol al desplegable de l'usuari (usuari / admin / superuser)</LI>
        <LI><strong>Eliminar usuari:</strong> Fes clic a la icona de la paperera</LI>
        <LI><strong>Aprovar usuari pendent:</strong> Apareix a la pestanya Pendents. Fes clic a <strong>Aprovar</strong></LI>
        <LI><strong>Convidar usuari:</strong> Introdueix un correu i selecciona un rol, després fes clic a <strong>Invitar</strong></LI>
      </UL>

      <H3>Activitat</H3>
      <P>Registre d'auditoria de tots els canvis de dades al sistema: timestamp, usuari, taula, acció (INSERT / UPDATE / DELETE) i valors anteriors i posteriors. Filtrable per usuari, taula i tipus d'acció. Només lectura.</P>

      <H3>Dades</H3>
      <UL>
        <LI><strong>Importar dades:</strong> Redirigeix al DataLoader del tauler principal. Accepta CSV, Excel i JSON per a capital calls, participades, searchers i pipeline</LI>
        <LI><strong>Exportar:</strong> Activa l'exportació Excel del conjunt de dades complet</LI>
        <LI><strong>Esborrar taula:</strong> Elimina de forma permanent totes les files d'una taula seleccionada. Cal escriure el nom de la taula per confirmar. <strong>No es pot desfer.</strong></LI>
      </UL>

      <H3>Entitats</H3>
      <P>Registre de totes les entitats privades (empreses i vehicles d'inversió) per a la desambiguació. El camp <strong>match_type</strong> indica la qualitat de la correspondència:</P>
      <UL>
        <LI><Code>manual</Code> — Coincidència manual (la més fiable)</LI>
        <LI><Code>normalized</Code> — Coincidència per normalització del nom</LI>
        <LI><Code>workbook_id</Code> — Coincidència per ID de workbook</LI>
        <LI><Code>fallback</Code> (vermell) — Cap coincidència fiable; requereix revisió</LI>
      </UL>
      <P>Per canviar el nom canònic d'una entitat, fes clic a la cel·la del nom i edita-la inline.</P>

      <H3>PM Operacions</H3>
      <P>Quatre sub-pestanyes per gestionar les dades operatives dels mercats públics: Transaccions (CRUD complet), Metadades, TER i Overrides. Veure secció 3.3 per als detalls.</P>

      <H3>Configuració</H3>
      <P><strong>Dominis permesos:</strong> Llista dels dominis de correu autoritzats per registrar-se. Afegeix un domini (p.ex. <Code>espaidinversions.com</Code>) i fes clic a <strong>Desa</strong>. Fes clic a la × d'una etiqueta per eliminar-la. Si la llista és buida, qualsevol domini de correu pot registrar-se.</P>
    </>
  );
}

function S5() {
  return (
    <>
      <H2 id="s5">5. Rols i Permisos</H2>
      <Table
        head={["Acció", "usuari", "admin", "superuser"]}
        rows={[
          ["Veure totes les dades", "✓", "✓", "✓"],
          ["Exportar a Excel", "✓", "✓", "✓"],
          ["Alternar tema", "✓", "✓", "✓"],
          ["Afegir / editar / eliminar capital calls", "—", "✓", "✓"],
          ["Afegir / editar / eliminar searchers", "—", "✓", "✓"],
          ["Afegir / editar / eliminar participades", "—", "✓", "✓"],
          ["Afegir / editar / eliminar deals de pipeline", "—", "✓", "✓"],
          ["Afegir / editar / eliminar transaccions PM", "—", "✓", "✓"],
          ["Gestionar overrides, TER, metadades PM", "—", "✓", "✓"],
          ["Accedir al panell d'administració", "—", "✓", "✓"],
          ["Gestionar usuaris (convidar, aprovar, eliminar)", "—", "✓", "✓"],
          ["Canviar rols d'usuari", "—", "—", "✓"],
          ["Esborrar taules senceres", "—", "✓", "✓"],
          ["Configurar dominis permesos", "—", "✓", "✓"],
        ]}
      />
    </>
  );
}

function S6() {
  return (
    <>
      <H2 id="s6">6. Persistència de Dades</H2>
      <P>Entendre on viuen les dades ajuda a evitar sorpreses.</P>

      <H3>Dades en viu (Supabase)</H3>
      <P>Totes les operacions CRUD persisteixen a Supabase immediatament. Les taules principals:</P>
      <Table
        head={["Taula", "Contingut"]}
        rows={[
          ["capital_calls", "Tots els moviments de fons (calls, distribucions, retorns)"],
          ["portfolio_companies", "Registres d'empreses i KPIs trimestrals"],
          ["searchers", "Seguiment de searchers"],
          ["pipeline", "Pipeline de deals"],
          ["pm_transactions", "Esdeveniments de compra/venda/ingressos de mercats públics"],
          ["pm_ter_overrides", "Correccions de TER per fons"],
          ["pm_position_meta", "Etiquetes personalitzades per ISIN"],
          ["pm_position_overrides", "Correccions manuals de valors per ISIN"],
          ["private_entities", "Registre d'entitats"],
          ["audit_logs", "Registre de canvis immutable (s'omple automàticament)"],
          ["allowed_domains", "Llista blanca de registre"],
        ]}
      />

      <H3>Caché del client (localStorage)</H3>
      <P>El tauler emmagatzema les dades de Supabase al navegador per a càrregues ràpides. Si veus dades obsoletes després d'una edició feta des d'un altre dispositiu, fes clic a <strong>Refrescar</strong> (on estigui disponible) o fes una recàrrega forçada (<Code>Ctrl+Shift+R</Code>) per obtenir dades fresques.</P>

      <H3>Dades generades / estàtiques</H3>
      <P>Algunes dades es pre-generen amb scripts Python i s'empaqueten com a fitxers JavaScript a <Code>src/generated/</Code>. Això inclou l'historial de preus de fons i el model PM. Aquests fitxers no es poden editar des de la UI — s'actualitzen executant l'script corresponent i desplegant. Qualsevol transacció PM afegida via UI es desa a Supabase i es superposa al model estàtic en temps d'execució.</P>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
function UserGuideInner() {
  const { tc, dark, toggle: toggleDark } = useTheme();

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div className="no-print" style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 0 rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.05)" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Logo />
        </Link>
        <div style={{ flex: 1 }} />
        <Link to="/" style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 12, color: tc.textMid, fontFamily: "inherit", fontWeight: 600, textDecoration: "none" }}>
          ← Tauler
        </Link>
        <button onClick={toggleDark}
          style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 16, color: tc.textMid, fontFamily: "inherit" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px", display: "flex", gap: 48, alignItems: "flex-start" }}>
        {/* Sidebar */}
        <div className="no-print">
          <Sidebar />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <H1>Guia d'Ús</H1>
          <p style={{ color: tc.textLight, fontSize: 13, margin: "0 0 8px 0" }}>
            Turtle Capital Dashboard · Darrera actualització: abril 2026
          </p>
          <Note>
            Les accions marcades amb <AdminOnly /> requereixen rol <strong>admin</strong> o <strong>superuser</strong>. Els usuaris estàndard poden veure totes les dades però no modificar-les.
          </Note>
          <S1 />
          <S2 />
          <S3 />
          <S4 />
          <S5 />
          <S6 />
        </div>
      </div>
    </div>
  );
}

export default function UserGuide() {
  const [dark, setDark] = useState(() => readStoredFlag("tc_dark"));
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <UserGuideInner />
    </ThemeContext.Provider>
  );
}
