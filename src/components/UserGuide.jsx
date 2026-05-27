import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ThemeProvider, useTheme } from "../theme.js";
import { Badge, Logo } from "./SharedComponents.jsx";

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
    <div style={{ background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "10px 14px", margin: "10px 0 14px 0", fontSize: 13, color: tc.textMid, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}
function AdminOnly() {
  return <Badge label="Admin o superuser" cfg={{ color: "#7c3c00", bg: "#fff0e0" }} />;
}
function AdminStrictOnly() {
  return <Badge label="Només admin" cfg={{ color: "#6A1B9A", bg: "#F3E5F5" }} />;
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
  { id: "s2-1", label: "   Fons i Transaccions", sub: true },
  { id: "s2-2", label: "   Searchers", sub: true },
  { id: "s2-3", label: "   Participades", sub: true },
  { id: "s2-4", label: "   Pipeline", sub: true },
  { id: "s2-5", label: "   Detall per Inversió", sub: true },
  { id: "s3", label: "Mercats Públics" },
  { id: "s3-1", label: "   Resum i Posicions", sub: true },
  { id: "s3-2", label: "   Transaccions", sub: true },
  { id: "s3-3", label: "   Overrides & Metadades", sub: true },
  { id: "s4", label: "Panell d'Administració" },
  { id: "s5", label: "Rols i Permisos" },
  { id: "s6", label: "On es Guarden les Dades" },
  { id: "s7", label: "Com Funciona el Tauler" },
  { id: "s8", label: "Preguntes Freqüents (FAQ)" },
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
      <P>El tauler utilitza una <strong>barra lateral fixa</strong> a l'esquerra i una <strong>barra superior estreta</strong> amb les eines globals. La navegació principal ja no es fa amb les tres barres horitzontals antigues.</P>
      <Table
        head={["Bloc", "Contingut"]}
        rows={[
          ["Portfoli", "Alternatius, Real Estate i Mercats Públics"],
          ["Transaccions", "Alternatives agregades i Mercats Públics"],
          ["Guia / Admin", "Accessos persistents al final de la barra lateral"],
        ]}
      />
      <H3>Com està organitzada la barra lateral</H3>
      <UL>
        <LI><strong>Portfoli</strong> agrupa <strong>Alternatius</strong>, <strong>Real Estate</strong> i <strong>Mercats Públics</strong></LI>
        <LI><strong>Transaccions</strong> té dues vistes: <strong>Alternatives</strong> i <strong>Mercats Públics</strong></LI>
        <LI><strong>Guia</strong> sempre és visible</LI>
        <LI><strong>Admin</strong> només apareix per a rols elevats</LI>
        <LI>La barra lateral es pot col·lapsar a mode icones amb el botó superior</LI>
      </UL>
      <H3>Controls de la capçalera</H3>
      <Table
        head={["Control", "Acció"]}
        rows={[
          ["Caixa de cerca", "Filtra les dades de la secció activa"],
          ["↑ Carregar dades", "Obre el carregador massiu de dades del dashboard"],
          ["↓ Excel", "Exporta la vista actual a un fitxer Excel"],
          ["↓ PDF / ↓ PNG", "Exporta la vista actual en format visual"],
          ["☀️ / 🌙", "Alterna el tema clar/fosc (es desa entre sessions)"],
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
      <P>Alternatius es divideix en <strong>Fons</strong>, <strong>Searchers</strong>, <strong>Participades</strong> i <strong>Totes les Posicions</strong>. A més, hi ha una vista separada de <strong>Transaccions › Alternatives</strong> que agrega tots els moviments privats.</P>

      <H2 id="s2-1">2.1 Fons i Transaccions</H2>
      <P>La secció <strong>Fons</strong> té subpestanyes: <strong>Pipeline</strong>, <strong>Resum</strong>, <strong>Mensual</strong>, <strong>Per Fons</strong> i <strong>Transaccions</strong>.</P>
      <P>La pestanya <strong>Transaccions</strong> mostra els moviments de <strong>PE + VC</strong> amb KPIs, gràfic mensual i taula paginada. La vista <strong>Transaccions › Alternatives</strong> agrega també Searchers, Participades i Real Estate.</P>
      <H3>Afegir un moviment <AdminOnly /></H3>
      <UL>
        <LI>Fes clic a <strong>＋ Afegeix moviment</strong> des de qualsevol vista de transaccions privades</LI>
        <LI>Omple el modal: fons/vehicle, data, import EUR, divisa, tipus i estructura</LI>
        <LI>Fes clic a <strong>Desa</strong>. El mes, any i exercici fiscal es deriven automàticament de la data</LI>
      </UL>
      <H3>Veure i filtrar</H3>
      <UL>
        <LI>Utilitza els filtres d'any fiscal, tipus i estratègia a la zona Fons</LI>
        <LI>La cerca global de la barra superior filtra la vista activa</LI>
        <LI>Les taules de transaccions estan paginades</LI>
        <LI>Els KPIs i el gràfic mensual sempre reflecteixen el conjunt filtrat, no només la pàgina visible</LI>
      </UL>
      <H3>Editar un moviment <AdminOnly /></H3>
      <P>Fes clic a la icona del llapis de la fila per obrir el modal d'edició. Modifica els camps i fes clic a <strong>Desa</strong>.</P>
      <H3>Eliminar un moviment <AdminOnly /></H3>
      <P>Fes clic a la icona de la paperera de la fila. La fila s'elimina immediatament i els totals s'actualitzen.</P>
      <H3>Excloure un fons de l'anàlisi</H3>
      <P>Fes clic al nom del fons al Selector de Fons (part superior) per incloure'l o excloure'l de les agregacions. Els fons exclosos apareixen en gris. Aquesta preferència és local i no afecta les dades.</P>

      <H2 id="s2-2">2.2 Searchers</H2>
      <P>Mostra els searchers actius i l'històric complet. La subpestanya <strong>Transaccions</strong> mostra els moviments de Searchers. Quan no existeixen capital calls explícits, el sistema mostra una transacció sintètica d'entrada basada en el <strong>ticket</strong> i la <strong>data de compromís</strong>.</P>
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
      <P>Llista completa de les empreses participades amb mètriques operatives i financeres. La subpestanya <strong>Transaccions</strong> mostra els moviments de participades; si no existeixen files específiques a capital calls, es genera una entrada sintètica a partir del <strong>ticket</strong> i la <strong>data de compromís</strong>.</P>
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

      <H2 id="s2-4">2.4 Pipeline</H2>
      <P>El pipeline de deals en curs. És la primera subpestanya dins de <strong>Fons</strong>.</P>
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

      <H2 id="s2-5">2.5 Detall per Inversió</H2>
      <P>Vista de detall d'una inversió concreta: fons, empresa participada o searcher. Mostra les mètriques clau i l'historial de moviments associats.</P>
      <Table
        head={["Camp", "Descripció"]}
        rows={[
          ["Data de compromís", "Data en què es va formalitzar la inversió. Punt de referència per calcular mesos en operació i rendibilitats temporals."],
          ["Ticket", "Import total compromès en la inversió"],
          ["TVPI", "Total Value to Paid-In — ràtio de valor total retornat sobre capital invertit"],
          ["Mesos en operació", "Calculat automàticament des de la data de compromís fins avui"],
        ]}
      />
      <Note>La data de compromís es pot editar des de la pestanya <strong>Participades</strong> fent clic a la cel·la corresponent de la taula.</Note>
    </>
  );
}

function S3() {
  return (
    <>
      <H2 id="s3">3. Mercats Públics</H2>
      <P>Mercats Públics té sis vistes: <strong>Resum</strong>, <strong>Renda Variable</strong>, <strong>Renda Fixa</strong>, <strong>Posicions</strong>, <strong>Transaccions</strong> i <strong>Traçabilitat</strong>.</P>

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
      <P>Les transaccions de mercats públics es mostren <strong>agrupades per mes i plegades per defecte</strong>. Pots obrir un mes concret o utilitzar <strong>Expandir tots</strong> / <strong>Plegar tots</strong>.</P>
      <H3>Afegir una transacció <AdminOnly /></H3>
      <UL>
        <LI>Fes clic a <strong>+ Afegeix transacció</strong></LI>
        <LI>Omple: acció (Buy / Sell / Income), data, codi del fons (ISIN), nom de l'actiu, tipus (RV / RF), custodi, unitats, NAV, valor en EUR</LI>
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
          ["TER", "Cost anual del fons (%). Permet corregir-lo quan el valor automàtic és incorrecte o no existeix."],
          ["Overrides", "Correccions manuals per posició: valor de mercat, rendibilitat des de l'inici, rendibilitat 2026/2025 i cost anual."],
          ["Metadades", "Etiquetes personalitzades de nom, gestora i custodi per a cada posició."],
        ]}
      />
      <Note>Per afegir una correcció: ves a la sub-pestanya corresponent, fes clic a <strong>+ Afegeix</strong>, introdueix el codi del fons i el valor corregit, afegeix opcionalment una <strong>Nota</strong> explicativa i desa. Per eliminar-la, fes clic a la paperera — la taula de Holdings tornarà al valor original.</Note>
    </>
  );
}

function S4() {
  return (
    <>
      <H2 id="s4">4. Panell d'Administració</H2>
      <P>Accessible a <Code>/admin</Code> per a rols elevats. Els <strong>superusers</strong> hi tenen accés operatiu; els <strong>admins</strong> tenen, a més, les funcions destructives o de sistema.</P>

      <H3>Usuaris</H3>
      <UL>
        <LI>Llista tots els usuaris registrats (actius + pendents d'aprovació)</LI>
        <LI><strong>Canviar rol <AdminStrictOnly />:</strong> Selecciona un nou rol al desplegable de l'usuari (usuari / superuser / admin)</LI>
        <LI><strong>Eliminar usuari <AdminOnly />:</strong> Fes clic a la icona de la paperera</LI>
        <LI><strong>Aprovar usuari pendent <AdminOnly />:</strong> Apareix a la pestanya Pendents. Fes clic a <strong>Aprovar</strong></LI>
        <LI><strong>Convidar usuari <AdminOnly />:</strong> Introdueix un correu i fes clic a <strong>Invitar</strong>. Assignar un rol elevat és una acció <strong>només admin</strong></LI>
      </UL>

      <H3>Activitat</H3>
      <P>Registre d'auditoria de tots els canvis de dades al sistema: timestamp, usuari, taula, acció (INSERT / UPDATE / DELETE) i valors anteriors i posteriors. Filtrable per usuari, taula i tipus d'acció. Només lectura.</P>

      <H3>Dades <AdminStrictOnly /></H3>
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

      <H3>Configuració <AdminStrictOnly /></H3>
      <P>Llista dels dominis de correu autoritzats per registrar-se. Afegeix un domini (p.ex. <Code>espaidinversions.com</Code>) i fes clic a <strong>Desa</strong>. Fes clic a la × d'una etiqueta per eliminar-la. Si la llista és buida, qualsevol domini de correu pot registrar-se.</P>

      <H3>Sistema <AdminStrictOnly /></H3>
      <UL>
        <LI>Mostra mètriques internes del sistema: recompte d'usuaris per rol, usuaris pendents i volum de files per taula</LI>
        <LI><strong>Purgar registre d'auditoria:</strong> elimina entrades antigues del log a partir d'un llindar de dies. És una acció irreversible</LI>
      </UL>
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
          ["Canviar rols d'usuari", "—", "✓", "—"],
          ["Esborrar taules senceres", "—", "✓", "—"],
          ["Configurar dominis permesos", "—", "✓", "—"],
          ["Accedir a la pestanya Sistema", "—", "✓", "—"],
          ["Purgar el registre d'auditoria", "—", "✓", "—"],
        ]}
      />
      <Note>
        En resum: <strong>superuser</strong> és un rol operatiu amb accés a l'àrea admin i a l'edició de dades; <strong>admin</strong> és el rol complet amb permisos de sistema, configuració i accions destructives.
      </Note>
    </>
  );
}

function S6() {
  return (
    <>
      <H2 id="s6">6. On es Guarden les Dades</H2>
      <P>El tauler treballa amb dos tipus de dades. Saber-ho ajuda a entendre per què de vegades cal esperar o recarregar.</P>

      <H3>Dades en viu</H3>
      <P>Tot el que afegeixes, edites o elimines des del tauler (capital calls, participades, searchers, transaccions de mercats públics…) es desa immediatament al núvol. Els canvis es reflecteixen en tots els dispositius a la propera càrrega.</P>
      <Note>Si veus dades antigues després d'un canvi fet des d'un altre dispositiu, fes clic a <strong>Refrescar</strong> (on estigui disponible) o recarrega la pàgina per obtenir les dades més recents.</Note>

      <H3>Dades de preus i historial</H3>
      <P>L'historial de preus dels fons i el model de mercats públics s'actualitzen periòdicament per l'administrador del sistema. Aquests valors no es poden modificar des de la interfície — si detectes un preu incorrecte, utilitza les eines d'<strong>Overrides</strong> a <strong>Admin → PM Operacions</strong> per corregir-lo manualment.</P>

      <H3>Registre de canvis</H3>
      <P>Tota modificació de dades queda registrada automàticament amb la data, l'hora i l'usuari que l'ha fet. Pots consultar aquest historial a <strong>Admin → Activitat</strong>.</P>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
// ── Data flow diagram ──────────────────────────────────────────────────────
function FlowBox({ label, sub, color = "#1B4F72", bg, width = 140, mono = false }) {
  const { tc } = useTheme();
  const boxBg = bg ?? tc.card;
  return (
    <div style={{ width, textAlign: "center", border: `2px solid ${color}`, borderRadius: 10, padding: "10px 8px", background: boxBg, flexShrink: 0 }}>
      <div style={{ fontSize: mono ? 11 : 12, fontWeight: 700, color, fontFamily: mono ? "'DM Mono',monospace" : "inherit", lineHeight: 1.3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#888", marginTop: 3, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

function Arrow({ dir = "down", label }) {
  const { tc } = useTheme();
  const isH = dir === "right" || dir === "left";
  return (
    <div style={{ display: "flex", flexDirection: isH ? "row" : "column", alignItems: "center", justifyContent: "center", gap: 2, flexShrink: 0 }}>
      {label && <span style={{ fontSize: 10, color: tc.textLight, whiteSpace: "nowrap" }}>{label}</span>}
      <span style={{ fontSize: 18, color: tc.textLight, lineHeight: 1 }}>
        {dir === "down" ? "↓" : dir === "up" ? "↑" : dir === "right" ? "→" : "←"}
      </span>
    </div>
  );
}

function DataFlowDiagram() {
  const { tc, dark } = useTheme();
  const scriptBg  = dark ? "#0d2010" : "#F1F8E9";
  const fileBg    = dark ? "#0d1a2e" : "#E8F0F7";
  const apiBg     = dark ? "#1a0d2e" : "#F3E5F5";
  const dbBg      = dark ? "#2e1a0d" : "#FFF8E1";
  const browserBg = dark ? "#0d2020" : "#E0F7FA";
  const lsBg      = dark ? "#1a1a0d" : "#FFFDE7";

  return (
    <div style={{ overflowX: "auto", margin: "20px 0" }}>
      <div style={{ minWidth: 680, fontFamily: "'Outfit',system-ui,sans-serif" }}>

        {/* Row 1: Scripts → Generated files → Build */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <FlowBox label="Scripts Python" sub="etf_fetch_prices.py fund_fetch_prices.py portfolio_build.py" color="#2E7D32" bg={scriptBg} width={150} />
          <Arrow dir="right" label="generen" />
          <FlowBox label="src/generated/" sub="fundPrices.js pmTransactions.js portfolioValues.js" color="#1565C0" bg={fileBg} width={160} mono />
          <Arrow dir="right" label="empaquetat per" />
          <FlowBox label="Vite Build" sub="npm run build → dist/" color="#6A1B9A" bg={apiBg} width={130} />
          <Arrow dir="right" label="desplegat a" />
          <FlowBox label="Vercel CDN" sub="vercel --prod" color="#E65100" bg={dbBg} width={120} />
        </div>

        {/* Vertical arrow down from Vercel CDN */}
        <div style={{ display: "flex", paddingLeft: 570 }}>
          <Arrow dir="down" />
        </div>

        {/* Row 2: Browser ↔ API ↔ Supabase */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 150, flexShrink: 0 }} />
          <div style={{ width: 10 }} />
          <div style={{ width: 160, flexShrink: 0 }} />
          <div style={{ width: 10 }} />
          <div style={{ width: 130, flexShrink: 0 }} />
          <div style={{ width: 10 }} />
          <FlowBox label="Navegador" sub="React + localStorage" color="#00838F" bg={browserBg} width={120} />
        </div>

        {/* Row: Browser ↔ API */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, paddingLeft: 570 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 10, color: tc.textLight }}>crida API</span>
            <span style={{ fontSize: 18, color: tc.textLight }}>↕</span>
          </div>
        </div>

        {/* Row 3: API routes ↔ Supabase */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
          <FlowBox label="Supabase DB" sub="capital_calls portfolio_companies pm_transactions ..." color="#B45309" bg={dbBg} width={150} />
          <Arrow dir="right" label="" />
          <FlowBox label="Vercel API" sub="/api/admin/* /api/eur-usd /api/data-version" color="#6A1B9A" bg={apiBg} width={150} />
        </div>

        {/* Legend */}
        <div style={{ marginTop: 24, padding: "12px 16px", background: tc.bgAlt, borderRadius: 10, border: `1px solid ${tc.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: tc.navy, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Llegenda</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { color: "#2E7D32", label: "Scripts Python (execució manual o programada)" },
              { color: "#1565C0", label: "Fitxers JS generats (part del bundle)" },
              { color: "#6A1B9A", label: "Vercel (build + API serverless)" },
              { color: "#B45309", label: "Supabase (base de dades en viu)" },
              { color: "#00838F", label: "Navegador (React + localStorage)" },
              { color: "#E65100", label: "CDN / Desplegament" },
            ].map(({ color, label }) => (
              <div key={color} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: tc.textMid }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: color, flexShrink: 0, display: "inline-block" }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Paths explanation */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { path: "Scripts → Generated → Vite → Vercel CDN", desc: "Dades estàtiques (historial de preus, model PM). S'actualitzen executant scripts i tornant a desplegar." },
            { path: "Navegador ↔ Vercel API ↔ Supabase", desc: "Dades en viu (capital calls, participades, transaccions PM, usuaris). Totes les operacions CRUD passen per aquí." },
            { path: "Navegador → localStorage", desc: "Caché local. Es carrega des de Supabase a l'inici de sessió i s'actualitza amb cada mutació. Ctrl+Shift+R força una recàrrega neta." },
          ].map(({ path, desc }) => (
            <div key={path} style={{ display: "flex", gap: 10, fontSize: 12 }}>
              <code style={{ background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.navy, whiteSpace: "nowrap", alignSelf: "flex-start", flexShrink: 0 }}>{path}</code>
              <span style={{ color: tc.textMid, lineHeight: 1.5 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function S7() {
  return (
    <>
      <H2 id="s7">7. Com Funciona el Tauler</H2>
      <P>Quan obres el tauler, les dades es carreguen des del núvol i es mostren al navegador. Qualsevol canvi que facis (afegir, editar o eliminar) s'envia directament al servidor i queda desat de forma permanent. Els preus dels fons s'actualitzen periòdicament per l'administrador i es publiquen automàticament.</P>
      <P>Si en algun moment el tauler sembla mostrar informació desfasada, recarrega la pàgina per forçar una actualització completa.</P>
    </>
  );
}

function S8() {
  return (
    <>
      <H2 id="s8">8. Preguntes Freqüents (FAQ)</H2>

      <H3>No puc iniciar sessió</H3>
      <P>Assegura't que el teu correu pertany a un domini autoritzat. Si el domini és correcte però no pots entrar, contacta l'administrador.</P>

      <H3>No veig alguna secció del tauler</H3>
      <P>L'accés a les seccions el controla l'administrador. Si creus que t'hi hauria de tenir accés però no el veus, contacta'l perquè pugui revisar els teus permisos.</P>

      <H3>No veig el botó Admin</H3>
      <P>Només apareix per a <strong>superusers</strong> i <strong>admins</strong>. Si tens rol <strong>user</strong>, no es mostra a la barra lateral.</P>

      <H3>Quina diferència hi ha entre admin i superuser?</H3>
      <P>Els dos poden editar dades i entrar al panell admin. L'<strong>admin</strong> és el rol complet: pot canviar rols, gestionar dominis, entrar a Sistema i executar accions destructives. El <strong>superuser</strong> té accés operatiu però no aquestes funcions de govern del sistema.</P>

      <H3>Les dades semblen antigues o incorrectes</H3>
      <P>Recarrega la pàgina per forçar una actualització completa. Si el problema persisteix, pot ser que els preus o el model no s'hagin publicat encara. Contacta l'administrador.</P>

      <H3>No veig transaccions a Searchers o Participades</H3>
      <P>La vista intenta mostrar capital calls reals quan existeixen. Si no n'hi ha, genera una entrada sintètica a partir del ticket i la data de compromís. Si encara no apareix res, revisa que el registre tingui <strong>ticket</strong> i <strong>data de compromís</strong>.</P>

      <H3>Per què les transaccions estan paginades?</H3>
      <P>Per mantenir les taules ràpides i llegibles. Els KPIs i els gràfics es calculen sobre el conjunt filtrat complet; la paginació només afecta les files visibles de la taula.</P>

      <H3>Per què les transaccions de Mercats Públics apareixen plegades?</H3>
      <P>La vista s'obre per defecte agrupada per mes per reduir soroll. Pots desplegar només els mesos que t'interessen o obrir-los tots amb el botó corresponent.</P>

      <H3>He afegit una transacció per error</H3>
      <P>Pots eliminar-la des de la mateixa pestanya on la vas crear (Transaccions o Admin → PM Operacions). Si no tens permisos d'edició, contacta un superuser o admin.</P>

      <H3>He canviat dades en un altre dispositiu i aquí no es veuen</H3>
      <P>Recarrega la pàgina. El tauler manté una caché local per fer la càrrega més ràpida, però la font de veritat és Supabase.</P>

      <H3>No puc editar una secció però sí una altra</H3>
      <P>Això és esperat per a superusers amb permisos parcials. La secció <strong>Permisos</strong> del panell admin permet limitar quines àrees pot veure i editar cada usuari elevat.</P>

      <H3>Com puc demanar accés o reportar un error?</H3>
      <P>
        Posa't en contacte amb l'administrador del sistema:{" "}
        <a href="mailto:roberto@espaidinversions.com" style={{ color: "inherit", fontWeight: 600 }}>roberto@espaidinversions.com</a>
        . També pots enviar un Teams o comentar-ho directament a l'oficina.
      </P>
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
        <Link to="/" style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 12, color: tc.textMid, fontFamily: "inherit", fontWeight: 600, textDecoration: "none" }}>
          ← Tauler
        </Link>
        <button onClick={toggleDark}
          style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 16, color: tc.textMid, fontFamily: "inherit" }}>
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
            Les accions marcades amb <AdminOnly /> requereixen rol <strong>admin</strong> o <strong>superuser</strong>. Les marcades amb <AdminStrictOnly /> només estan disponibles per a <strong>admin</strong>. Els usuaris estàndard poden veure dades però no modificar-les.
          </Note>
          <S1 />
          <S2 />
          <S3 />
          <S4 />
          <S5 />
          <S6 />
          <S7 />
          <S8 />
        </div>
      </div>
    </div>
  );
}

export default function UserGuide() {
  return (
    <ThemeProvider>
      <UserGuideInner />
    </ThemeProvider>
  );
}
