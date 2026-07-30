import { Link } from "react-router-dom";
import { ThemeProvider, useTheme } from "../theme.js";
import { Badge, Logo } from "./SharedComponents.jsx";

function H1({ children }) {
  const { tc } = useTheme();
  return <h1 style={{ fontSize: 26, fontWeight: 700, color: tc.navy, margin: "0 0 6px 0", lineHeight: 1.25 }}>{children}</h1>;
}

function H2({ id, children }) {
  const { tc } = useTheme();
  return <h2 id={id} style={{ fontSize: 18, fontWeight: 700, color: tc.navy, margin: "36px 0 10px 0", paddingTop: 8, borderBottom: `2px solid ${tc.border}`, paddingBottom: 8 }}>{children}</h2>;
}

function H3({ children }) {
  const { tc } = useTheme();
  return <h3 style={{ fontSize: 14, fontWeight: 700, color: tc.navy, margin: "22px 0 8px 0" }}>{children}</h3>;
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
  return <code style={{ background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 4, padding: "1px 5px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: tc.navy }}>{children}</code>;
}

function Note({ children }) {
  const { tc } = useTheme();
  return <div style={{ background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "10px 14px", margin: "10px 0 14px 0", fontSize: 13, color: tc.textMid, lineHeight: 1.6 }}>{children}</div>;
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
              <th key={i} style={{ padding: "8px 12px", textAlign: "left", color: tc.navy, fontWeight: 600, borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${tc.border}` }}>
              {row.map((cell, j) => <td key={j} style={{ padding: "7px 12px", color: tc.text, verticalAlign: "top" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTIONS = [
  { id: "s1", label: "Estructura actual" },
  { id: "s2", label: "Navegació i dreceres" },
  { id: "s3", label: "Portfoli" },
  { id: "s3-1", label: "   Alternatius", sub: true },
  { id: "s3-2", label: "   Real Estate", sub: true },
  { id: "s3-3", label: "   Mercats Públics", sub: true },
  { id: "s4", label: "Model Caixa i Liquiditat" },
  { id: "s5", label: "Transaccions" },
  { id: "s6", label: "Fitxes de detall" },
  { id: "s7", label: "Admin i permisos" },
  { id: "s8", label: "Dades i FAQ" },
];

function Sidebar({ active }) {
  const { tc } = useTheme();
  return (
    <div style={{ width: 210, flexShrink: 0, position: "sticky", top: 24, alignSelf: "flex-start" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: tc.textLight, marginBottom: 10 }}>Continguts</div>
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

function S1() {
  return (
    <>
      <H2 id="s1">1. Estructura actual del web</H2>
      <P>El web té tres àrees principals: el <strong>Dashboard</strong> a <Code>/</Code>, la <strong>Guia</strong> a <Code>/guia</Code> i el <strong>Panell d'Administració</strong> a <Code>/admin</Code>. Les fitxes de detall viuen fora del dashboard principal i s'obren des de les taules.</P>
      <Table
        head={["Àrea", "Ruta", "Què hi trobes"]}
        rows={[
          ["Dashboard", <Code>/</Code>, "Sidebar amb Portfoli, Model Caixa, Liquiditat i Transaccions"],
          ["Guia", <Code>/guia</Code>, "Documentació d'ús i estructura actual"],
          ["Admin", <Code>/admin</Code>, "Usuaris, permisos, dades, entitats, operativa PM, liquiditat i sistema"],
          ["Detalls de fons", <Code>/investments/funds/:id</Code>, "Fitxa d'una inversió o vehicle privat"],
          ["Detalls de participades", <Code>/investments/companies/:id</Code>, "Fitxa d'una companyia participada"],
          ["Detalls de searchers", <Code>/investments/searchers/:id</Code>, "Fitxa d'un search fund"],
          ["Detalls PM", <Code>/mercats-publics/:id</Code>, "Fitxa d'una posició de mercats públics"],
        ]}
      />
      <H3>Sidebar del Dashboard</H3>
      <Table
        head={["Grup", "Entrades actuals"]}
        rows={[
          ["Inici", "Només per admins o usuaris amb permís explícit d'Inici"],
          ["Portfoli > Alternatius", "Resum, Fons, Searchers, Participades, Model"],
          ["Portfoli > Real Estate", "Resum, Directe, Vehicles Real Estate, Totes les Posicions, Model"],
          ["Portfoli > Mercats Públics", "Resum, Renda Variable, Renda Fixa, Posicions, Transaccions, Traçabilitat"],
          ["Model Caixa", "Alternatius i Real Estate"],
          ["Liquiditat", "Comptes, saldos i visió de liquiditat"],
          ["Transaccions", "Alternatius, Real Estate i Mercats Públics"],
          ["Footer", "Guia sempre visible; Admin només per rols elevats"],
        ]}
      />
      <Note>La sidebar és sensible a permisos: si no tens accés a una secció, no apareix. La guia descriu l'estructura completa, però cada usuari veu només el que té autoritzat.</Note>
    </>
  );
}

function S2() {
  return (
    <>
      <H2 id="s2">2. Navegació i dreceres</H2>
      <P>La navegació principal es fa des de la sidebar fixa. Els grups es poden desplegar o plegar, i la sidebar es pot col·lapsar a mode icones amb el botó superior. La capçalera del dashboard mostra el títol de la vista activa i la cerca global.</P>
      <H3>Cerca i capçalera</H3>
      <UL>
        <LI>La <strong>cerca global</strong> filtra la vista activa sempre que la taula o secció ho suporta.</LI>
        <LI>El xip de cerca mostra el text actiu quan hi ha un filtre escrit.</LI>
        <LI>La càrrega massiva, exportacions i tema clar/fosc es mantenen com eines globals del dashboard quan estan disponibles.</LI>
      </UL>
      <H3>Tecles ràpides</H3>
      <P>Les dreceres respecten els permisos de cada usuari i no s'activen mentre escrius dins de camps, filtres o cel·les editables. Per evitar conflictes amb Chrome, prem <Code>?</Code> per mostrar les KeyTips d'estil Office i després prem la lletra del destí.</P>
      <Table
        head={["Drecera", "Acció"]}
        rows={[
          [<Code>/</Code>, "Enfoca la cerca global del dashboard"],
          [<Code>Esc</Code>, "Treu el focus de la cerca global o tanca les KeyTips"],
          [<><Code>[</Code> / <Code>]</Code></>, "Va a la secció anterior o següent visible del dashboard"],
          [<Code>?, H</Code>, "Inici"],
          [<Code>?, A</Code>, "Alternatius"],
          [<Code>?, F</Code>, "Fons"],
          [<Code>?, S</Code>, "Searchers"],
          [<Code>?, C</Code>, "Participades"],
          [<Code>?, M</Code>, "Model Caixa"],
          [<Code>?, R</Code>, "Real Estate"],
          [<Code>?, P</Code>, "Mercats Públics"],
          [<Code>?, L</Code>, "Liquiditat"],
          [<Code>?, T</Code>, "Transaccions Alternatives"],
          [<Code>?, N</Code>, "Afegeix un moviment quan ets a Transaccions Alternatives o Real Estate"],
          [<Code>?, U</Code>, "Guia"],
          [<Code>?, D</Code>, "Admin, només si tens permisos"],
        ]}
      />
    </>
  );
}

function S3() {
  return (
    <>
      <H2 id="s3">3. Portfoli</H2>
      <P>El grup Portfoli és el centre del dashboard. Agrupa <strong>Alternatius</strong>, <strong>Real Estate</strong> i <strong>Mercats Públics</strong>. Cada bloc té el seu resum i vistes operatives.</P>

      <H2 id="s3-1">3.1 Alternatius</H2>
      <Table
        head={["Vista", "Ús"]}
        rows={[
          ["Resum", "KPIs, transaccions agregades, cohorts i liquiditat d'Alternatius"],
          ["Fons", "Portfoli de fons PE/VC, amb opció d'incloure o excloure participades quan aplica"],
          ["Searchers", "Subpestanyes Resum, Tots, Actius, Legacy i Transaccions"],
          ["Participades", "Subpestanyes Portfoli i Transaccions; el portfoli es filtra per Tots, Via Search Fund i PE Directe"],
          ["Model", "Model Caixa filtrat a l'àmbit d'Alternatius"],
        ]}
      />
      <H3>Operativa editable <AdminOnly /></H3>
      <UL>
        <LI>Els moviments privats s'editen des de les vistes de transaccions o modals de capital calls.</LI>
        <LI>Searchers, Participades i Pipeline tenen edició inline quan el teu rol i permisos ho permeten.</LI>
        <LI>Els KPIs i gràfics es recalculen sobre el conjunt filtrat, no només sobre les files visibles.</LI>
      </UL>

      <H2 id="s3-2">3.2 Real Estate</H2>
      <Table
        head={["Vista", "Ús"]}
        rows={[
          ["Resum", "Visió agregada de Real Estate: moviments, compromisos, cartera i liquiditat"],
          ["Directe", "Espai reservat per cartera directa; actualment es mostra com secció en construcció"],
          ["Vehicles Real Estate", "Vehicles i fons Real Estate"],
          ["Totes les Posicions", "Vista de posicions Real Estate amb liquiditat associada"],
          ["Model", "Model Caixa filtrat a Real Estate"],
        ]}
      />
      <P>Les transaccions Real Estate també tenen una entrada específica dins del grup <strong>Transaccions</strong>.</P>

      <H2 id="s3-3">3.3 Mercats Públics</H2>
      <Table
        head={["Vista", "Ús"]}
        rows={[
          ["Resum", "KPIs de cartera, composició i evolució"],
          ["Renda Variable", "Holdings de renda variable"],
          ["Renda Fixa", "Holdings de renda fixa"],
          ["Posicions", "Llista de posicions actives i tancades"],
          ["Transaccions", "Operativa PM agrupada i filtrable"],
          ["Traçabilitat", "Seguiment i reconciliació del model PM"],
        ]}
      />
      <Note>Les fitxes de detall de Mercats Públics s'obren des de posicions o transaccions i viuen a <Code>/mercats-publics/:id</Code>.</Note>
    </>
  );
}

function S4() {
  return (
    <>
      <H2 id="s4">4. Model Caixa i Liquiditat</H2>
      <H3>Model Caixa</H3>
      <P>El grup <strong>Model Caixa</strong> dona accés directe al model prospectiu de caixa per àmbit. Actualment hi ha dues entrades: <strong>Alternatius</strong> i <strong>Real Estate</strong>. També pots arribar-hi des de les entrades <strong>Model</strong> dins de cada bloc de Portfoli.</P>
      <UL>
        <LI><strong>Alternatius:</strong> model de caixa filtrat a fons, searchers i participades alternatives.</LI>
        <LI><strong>Real Estate:</strong> model de caixa filtrat a vehicles i posicions Real Estate.</LI>
      </UL>
      <H3>Liquiditat</H3>
      <P>La secció <strong>Liquiditat</strong> mostra comptes, saldos i registres associats. La gestió de liquiditat viu a <strong>Admin → Liquiditat</strong> per als usuaris amb permisos.</P>
      <Note>La liquiditat també apareix embeguda dins d'alguns resums de Portfoli perquè forma part del context de decisió, però la vista dedicada és la font operativa principal.</Note>
    </>
  );
}

function S5() {
  return (
    <>
      <H2 id="s5">5. Transaccions</H2>
      <P>El grup <strong>Transaccions</strong> de la sidebar dona accés directe als registres transaccionals per àmbit.</P>
      <Table
        head={["Entrada", "Contingut"]}
        rows={[
          ["Alternatius", "Capital calls, distribucions, compromisos i moviments agregats d'Alternatius"],
          ["Real Estate", "Moviments i compromisos Real Estate"],
          ["Mercats Públics", "Transaccions PM; equivalent a la vista Transaccions dins de Mercats Públics"],
        ]}
      />
      <H3>Afegir o editar moviments <AdminOnly /></H3>
      <UL>
        <LI>Les vistes privades utilitzen el modal de capital calls i permeten actualitzacions ràpides quan el camp ho suporta. A Transaccions Alternatives o Real Estate, <Code>?, N</Code> obre directament el modal de nou moviment.</LI>
        <LI>Mercats Públics utilitza la taula operativa PM, amb camps de data, acció, ISIN/codi, actiu, tipus, custodi, unitats, NAV i valor.</LI>
        <LI>Eliminar una transacció recalcula les vistes derivades a la següent càrrega o refresc.</LI>
      </UL>
    </>
  );
}

function S6() {
  return (
    <>
      <H2 id="s6">6. Fitxes de detall</H2>
      <P>Les fitxes de detall són pàgines pròpies, no pestanyes dins del dashboard. S'obren clicant noms o files en taules d'inversions i posicions.</P>
      <Table
        head={["Fitxa", "Ruta", "Origen habitual"]}
        rows={[
          ["Fons / vehicle privat", <Code>/investments/funds/:id</Code>, "Fons, Vehicles Real Estate o taules de cash model"],
          ["Participada", <Code>/investments/companies/:id</Code>, "Participades"],
          ["Searcher", <Code>/investments/searchers/:id</Code>, "Searchers"],
          ["Posició PM", <Code>/mercats-publics/:id</Code>, "Mercats Públics > Posicions, RV/RF o Transaccions"],
        ]}
      />
      <P>Les fitxes mostren mètriques clau, historial de moviments i context de la posició. Per tornar, utilitza el botó superior de retorn o les KeyTips amb <Code>?</Code> i la lletra de destí.</P>
    </>
  );
}

function S7() {
  return (
    <>
      <H2 id="s7">7. Admin i permisos</H2>
      <P>El panell d'administració és a <Code>/admin</Code>. Només apareix a la sidebar per a rols elevats. Els superusers tenen accés operatiu; els admins tenen també funcions de sistema i accions destructives.</P>
      <Table
        head={["Pestanya Admin", "Funció"]}
        rows={[
          ["Usuaris", "Usuaris actius i pendents, invitacions, aprovacions i gestió de rol segons permisos"],
          ["Activitat", "Registre d'auditoria de canvis"],
          ["Permisos", "Control granular de quines seccions pot veure o editar cada usuari elevat"],
          ["Dades", "Importació, exportació i accions de taula"],
          ["Entitats", "Catàleg d'entitats privades, duplicats i noms canònics"],
          ["PM Operacions", "Transaccions, Metadades, TER, Overrides, Mensual i Managers"],
          ["Liquiditat", "Editor de comptes i registres de liquiditat"],
          ["Configuració", "Dominis de correu autoritzats"],
          ["Sistema", "Mètriques internes i manteniment; només admin"],
        ]}
      />
      <H3>Permisos principals</H3>
      <Table
        head={["Acció", "Usuari", "Superuser", "Admin"]}
        rows={[
          ["Veure seccions autoritzades", "Sí", "Sí", "Sí"],
          ["Editar dades operatives autoritzades", "No", "Sí", "Sí"],
          ["Entrar a Admin", "No", "Sí", "Sí"],
          ["Gestionar permisos granulars", "No", "Segons configuració", "Sí"],
          ["Canviar rols, dominis i sistema", "No", "No", "Sí"],
          ["Accions destructives de sistema", "No", "No", "Sí"],
        ]}
      />
      <Note>Les marques <AdminOnly /> indiquen accions per a admin o superuser. Les marques <AdminStrictOnly /> indiquen funcions restringides a admin.</Note>
    </>
  );
}

function S8() {
  return (
    <>
      <H2 id="s8">8. Dades i FAQ</H2>
      <H3>On es guarden les dades</H3>
      <UL>
        <LI>Les edicions operatives del dashboard es desen a Supabase.</LI>
        <LI>Els preus, models generats i algunes dades estàtiques es publiquen des del procés d'actualització del projecte.</LI>
        <LI>El registre d'auditoria es consulta a <strong>Admin → Activitat</strong>.</LI>
        <LI>Si una dada sembla antiga, recarrega la pàgina o utilitza el botó de refresc de la secció quan existeixi.</LI>
      </UL>
      <H3>No veig una secció</H3>
      <P>La sidebar es construeix a partir dels permisos. Si no veus una entrada, és perquè no tens permís de visualització per aquella secció o perquè és una entrada només admin.</P>
      <H3>No puc editar</H3>
      <P>Veure una secció i editar-la són permisos separats. Un admin pot revisar-ho a <strong>Admin → Permisos</strong>.</P>
      <H3>Les transaccions no apareixen on esperava</H3>
      <P>Hi ha vistes de transaccions dins de cada bloc i també un grup dedicat <strong>Transaccions</strong>. Per revisar tot un àmbit, utilitza el grup dedicat de la sidebar.</P>
      <H3>Real Estate Directe està buit</H3>
      <P>És esperat: la vista existeix a la navegació, però actualment mostra una secció en construcció.</P>
      <H3>Com reporto un error o demano accés?</H3>
      <P>
        Contacta l'administrador del sistema: <a href="mailto:roberto@espaidinversions.com" style={{ color: "inherit", fontWeight: 600 }}>roberto@espaidinversions.com</a>.
      </P>
    </>
  );
}

function UserGuideInner() {
  const { tc, dark, toggle: toggleDark } = useTheme();

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      <div className="no-print" style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 0 rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.05)" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Logo />
        </Link>
        <div style={{ flex: 1 }} />
        <Link to="/" style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 12, color: tc.textMid, fontFamily: "inherit", fontWeight: 600, textDecoration: "none" }}>
          ← Tauler
        </Link>
        <button onClick={toggleDark} style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 16, color: tc.textMid, fontFamily: "inherit" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px", display: "flex", gap: 48, alignItems: "flex-start" }}>
        <div className="no-print">
          <Sidebar />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <H1>Guia d'Ús</H1>
          <p style={{ color: tc.textLight, fontSize: 13, margin: "0 0 8px 0" }}>
            Turtle Capital Dashboard · Darrera actualització: juliol 2026
          </p>
          <Note>
            Aquesta guia reflecteix l'estructura actual del web: sidebar del dashboard, rutes de detall, Guia i Admin. Les accions marcades amb <AdminOnly /> requereixen rol <strong>admin</strong> o <strong>superuser</strong>; les marcades amb <AdminStrictOnly /> només estan disponibles per a <strong>admin</strong>.
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

