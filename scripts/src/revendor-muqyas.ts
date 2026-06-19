/**
 * Re-vendor the embedded Muqyas copy used inside Muhakkim.
 *
 * `artifacts/muhakkim/src/MuqyasEmbedded.jsx` is a verbatim copy of the
 * standalone `artifacts/muqyas/src/MuqyasProV1.jsx` with a small, fixed set of
 * "embed-mode" patches applied. This script regenerates the embedded copy from
 * the standalone source and re-applies those patches so the two never drift.
 *
 * Each patch is an asserted string replacement: if an anchor is missing or
 * appears more than once, the script aborts with a clear message. That means a
 * failure points at exactly which upstream change broke the assumption, so you
 * can hand-fix the patch list below and re-run.
 *
 * Usage:  pnpm --filter @workspace/scripts run revendor-muqyas
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

const SOURCE = resolve(repoRoot, "artifacts/muqyas/src/MuqyasProV1.jsx");
const TARGET = resolve(repoRoot, "artifacts/muhakkim/src/MuqyasEmbedded.jsx");

/**
 * Ordered list of embed-mode patches. Each `find` must occur exactly once in
 * the (progressively patched) source. Keep this list in sync with the actual
 * embed edits — it is the single source of truth for what "embed mode" changes.
 */
const PATCHES: { name: string; find: string; replace: string }[] = [
  {
    name: "component signature + group helper + embed-aware props",
    find: `export default function MuhakkimV4() {`,
    replace: `const _mqGroupOf = key => key ? (GROUPS.find(g=>g.tools.some(t=>t.key===key))?.id ?? null) : null;

export default function MuqyasEmbedded({ embed = false, initialTool = null, dark: darkProp } = {}) {`,
  },
  {
    name: "activeGroup initial state",
    find: `  const [activeGroup, setActiveGroup] = useState(null);`,
    replace: `  const [activeGroup, setActiveGroup] = useState(embed ? _mqGroupOf(initialTool) : null);`,
  },
  {
    name: "activeTool initial state + host-sync effects",
    find: `  const [activeTool, setActiveTool] = useState(null);`,
    replace: `  const [activeTool, setActiveTool] = useState(embed ? initialTool : null);`,
  },
  {
    name: "host-sync effects (theme + requested tool)",
    find: `  const findGroup = key => GROUPS.find(g=>g.tools.some(t=>t.key===key));`,
    replace: `  // Sync theme coming from the host (محكّم) when embedded
  useEffect(()=>{
    if(embed && typeof darkProp==="boolean" && darkProp!==dark) toggleTheme();
  },[embed, darkProp, dark]);

  // Follow the tool requested by the host when embedded
  useEffect(()=>{
    if(embed){ setActiveTool(initialTool); setActiveGroup(_mqGroupOf(initialTool)); }
  },[embed, initialTool]);

  const findGroup = key => GROUPS.find(g=>g.tools.some(t=>t.key===key));`,
  },
  {
    name: "root container style (embed = transparent, no full-height chrome)",
    find: `  return <div dir="rtl" style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Segoe UI','Tajawal',sans-serif",transition:"background .3s,color .3s"}}>`,
    replace: `  return <div dir="rtl" style={embed ? {background:"transparent",color:T.text} : {minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Segoe UI','Tajawal',sans-serif",transition:"background .3s,color .3s"}}>`,
  },
  {
    name: "hide header when embedded (open)",
    find: `    <header ref={navRef} style={{position:"sticky",top:0,zIndex:200,background:T.nav,backdropFilter:"blur(20px)",borderBottom:\`1px solid \${T.border}\`,boxShadow:T.shadow}}>`,
    replace: `    {!embed && <header ref={navRef} style={{position:"sticky",top:0,zIndex:200,background:T.nav,backdropFilter:"blur(20px)",borderBottom:\`1px solid \${T.border}\`,boxShadow:T.shadow}}>`,
  },
  {
    name: "hide header when embedded (close)",
    find: `    </header>`,
    replace: `    </header>}`,
  },
  {
    name: "main padding (embed = no max-width wrapper)",
    find: `    <main style={{maxWidth:1280,margin:"0 auto",padding:"0 14px"}}>`,
    replace: `    <main style={embed ? {} : {maxWidth:1280,margin:"0 auto",padding:"0 14px"}}>`,
  },
  {
    name: "hide footer when embedded",
    find: `    {!activeTool&&<footer style={{borderTop:\`1px solid \${T.border}\`,padding:"16px",textAlign:"center",background:T.card,marginTop:8}}>`,
    replace: `    {!embed&&!activeTool&&<footer style={{borderTop:\`1px solid \${T.border}\`,padding:"16px",textAlign:"center",background:T.card,marginTop:8}}>`,
  },
];

const TRAILER = `\nexport { GROUPS as MUQYAS_GROUPS };\n`;

function fail(msg: string): never {
  console.error(`\n[revendor-muqyas] ERROR: ${msg}\n`);
  console.error(
    "The standalone Muqyas source changed in a way that broke an embed patch.\n" +
      "Open scripts/src/revendor-muqyas.ts, update the failing patch's `find`/`replace`\n" +
      "to match the new upstream code, then re-run the script.",
  );
  process.exit(1);
}

function main() {
  let content = readFileSync(SOURCE, "utf8");

  for (const patch of PATCHES) {
    const count = content.split(patch.find).length - 1;
    if (count === 0) {
      fail(`patch "${patch.name}" anchor not found.`);
    }
    if (count > 1) {
      fail(`patch "${patch.name}" anchor matched ${count} times (must be unique).`);
    }
    content = content.replace(patch.find, patch.replace);
  }

  if (content.includes("MuhakkimV4")) {
    fail('"MuhakkimV4" still present after patching — the component rename did not apply cleanly.');
  }

  if (!content.endsWith("\n")) content += "\n";
  content += TRAILER;

  writeFileSync(TARGET, content, "utf8");
  console.log(
    `[revendor-muqyas] OK — regenerated ${TARGET.replace(repoRoot + "/", "")} ` +
      `from ${SOURCE.replace(repoRoot + "/", "")} with ${PATCHES.length} embed patches.`,
  );
}

main();
