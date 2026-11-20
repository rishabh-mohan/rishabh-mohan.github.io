// Colours are variables on .app so the theme can switch. data-theme is auto, light or dark.
(() => {
  const DARK = `
  --bg: #1c2126; --fg: #e8ebed; --muted: #9ba6ae; --link: #5fb6e6; --line: #3b444c; --line2: #2b3238;
  --soft: #252c32; --soft2: #303940; --bad: #ff8a80; --ok: #5fd08f; --hi: #17384a; --primary: #2a8fd0; --shadow: rgba(0,0,0,.5);
  --rail: #11161a; --rail-hover: #070a0c; --rail-on-bg: #1c2126; --rail-on-fg: #5fb6e6; color-scheme: dark;`;

  BSX.styles = `
:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.app {
  --bg: #fff; --fg: #2d3b45; --muted: #6b7780; --link: #0374b5; --line: #c7cdd1; --line2: #e8eaec;
  --soft: #f5f5f5; --soft2: #e8eaec; --bad: #c2271f; --ok: #0b874b; --hi: #e5f2f8; --primary: #0374b5; --shadow: rgba(0,0,0,.25);
  --rail: #394b58; --rail-hover: #2d3b45; --rail-on-bg: #fff; --rail-on-fg: #0374b5; color-scheme: light;
  position: fixed; top: 0; left: 0; width: 100vw; max-width: 100%; height: 100vh; overflow: hidden; z-index: 2147483647;
  display: flex; background: var(--bg); color: var(--fg);
  font: 16px/1.5 "BSX Lato", "Lato Extended", Lato, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;
  --ease: cubic-bezier(.2,.7,.3,1); }
.app[data-theme="dark"] {${DARK} }
@media (prefers-color-scheme: dark) { .app[data-theme="auto"] {${DARK} } }

a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
button { font: inherit; cursor: pointer; color: inherit; }
a:focus-visible, button:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--link); outline-offset: 1px; }
h1, h2, h3, p { margin: 0; }
p { margin: 12px 0; }
.ic { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; vertical-align: -0.2em; flex: none; }
.ok { color: var(--ok); }
.bad { color: var(--bad); }
.muted { color: var(--muted); }
.small { font-size: 14px; }
.nowrap { white-space: nowrap; }
.pad { padding: 8px 0; }
.empty { padding: 32px 8px; color: var(--muted); text-align: center; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 5px; flex: none; }

/* global navigation */
/* the rail sits above the tray, so a tray slides out from underneath it */
.rail { width: 84px; flex: none; background: var(--rail); display: flex; flex-direction: column; overflow-y: auto; position: relative; z-index: 3; }
.rail a, .rail button { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 11px 2px 9px; color: #fff; font-size: 13.5px; line-height: 1.2;
  background: none; border: 0; text-align: center; }
.rail a:hover, .rail button:hover { background: var(--rail-hover); text-decoration: none; }
.rail .on, .rail .open { background: var(--rail-on-bg); color: var(--rail-on-fg); }
.rail .on:hover, .rail .open:hover { background: var(--rail-on-bg); }
.rail .gap { flex: 1; }
.tray { position: absolute; left: 84px; top: 0; bottom: 0; width: 320px; background: var(--bg); border-right: 1px solid var(--line); box-shadow: 4px 0 14px var(--shadow); padding: 20px 22px; overflow-y: auto; z-index: 2; }
.trayhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.trayhead h2 { font-size: 24px; font-weight: 700; }
.trayitem { display: flex; gap: 10px; align-items: baseline; width: 100%; padding: 8px 4px; border: 0; background: none; text-align: left; color: var(--link); border-bottom: 1px solid var(--line2); }
.trayitem:hover { text-decoration: underline; }
.trayitem.all { border-bottom: 0; margin-top: 6px; }
.tname { display: block; font-weight: 700; }
.tcode { display: block; }
.tip { padding: 9px 4px; border-bottom: 1px solid var(--line2); }
/* motion: short and quiet, as Canvas's; all of it is switched off for reduced motion (end of sheet) */
@keyframes bsx-slide { from { transform: translateX(-100%); } to { transform: none; } }
@keyframes bsx-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bsx-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes bsx-pop { 0% { transform: scale(.6); } 60% { transform: scale(1.15); } 100% { transform: none; } }
@keyframes bsx-drop { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
@keyframes bsx-zoom { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes bsx-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@keyframes bsx-spin { to { transform: rotate(360deg); } }
.tray { animation: bsx-slide .22s var(--ease); }
.layout { animation: bsx-rise .22s var(--ease); }
.layout.still { animation: none; }
.arrived { animation: bsx-fade .2s ease-out; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skel { display: grid; gap: 10px; padding: 10px 0; }
.skel i, .skelbar { display: block; height: 14px; border-radius: 4px; background: linear-gradient(90deg, var(--soft2) 0%, var(--soft) 50%, var(--soft2) 100%); background-size: 200% 100%; animation: bsx-shimmer 1.3s linear infinite; }
.skel i.short { width: 55%; }
.skel.big { gap: 16px; padding-top: 4px; }
.skel.big i { height: 18px; }
.skelbar.title { height: 30px; width: 240px; margin: 4px 0; }
.traylabel { margin: 20px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.who { display: flex; gap: 12px; align-items: center; padding: 6px 0 4px; }
.avatar { width: 44px; height: 44px; border-radius: 22px; background: var(--soft2); color: var(--fg); display: inline-flex; align-items: center; justify-content: center; font-weight: 700; flex: none; }
.avatar.sm { width: 34px; height: 34px; font-size: 14px; color: var(--muted); }

/* page frame */
.main { flex: 1; overflow: auto; min-width: 0; overscroll-behavior: contain; }
.tray, .menu, .dialog { overscroll-behavior: contain; }
.head, .crumbs { position: sticky; top: 0; z-index: 1; background: var(--bg); }
.pday { scroll-margin-top: 84px; }
.head { display: flex; align-items: center; gap: 12px; margin: 0 24px; padding: 18px 0 14px; border-bottom: 1px solid var(--line); }
.head h1 { font-size: 30px; font-weight: 300; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crumbs { display: flex; align-items: center; gap: 10px; margin: 0 24px; padding: 12px 0; border-bottom: 1px solid var(--line); min-height: 60px; }
.crumbs .trail { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; font-size: 18px; white-space: nowrap; overflow: hidden; }
.crumbs .trail a, .crumbs .trail .here { overflow: hidden; text-overflow: ellipsis; }
.crumbs .sep { color: var(--muted); display: inline-flex; }
.iconbtn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 4px; border: 0; background: none; color: var(--fg); flex: none; }
.iconbtn:hover { background: var(--soft2); }
.layout { display: flex; gap: 28px; padding: 24px; align-items: flex-start; }
.content { flex: 1; min-width: 0; }
.right { width: 288px; flex: none; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 14px; border: 1px solid var(--line); border-radius: 4px; background: var(--soft); color: var(--fg); font-size: 15px; line-height: 1.3; white-space: nowrap; }
.btn:hover { background: var(--soft2); text-decoration: none; }
.btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn.primary:hover { filter: brightness(.92); }
.btn.wide { display: flex; width: 100%; margin-bottom: 10px; }
.btn.icon { padding: 7px 9px; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; flex: none; }
.seg button { border: 0; border-right: 1px solid var(--line); background: var(--bg); padding: 7px 12px; font-size: 14.5px; }
.seg button:last-child { border-right: 0; }
.seg button:hover { background: var(--soft); }
.seg button.on { background: var(--fg); color: var(--bg); }
.tag { display: inline-block; font-size: 12px; line-height: 1.5; padding: 0 8px; border-radius: 10px; border: 1px solid var(--line); color: var(--muted); margin-left: 8px; font-weight: 400; vertical-align: middle; }
.tag.okt { color: var(--ok); border-color: var(--ok); }
.tag.badt { color: var(--bad); border-color: var(--bad); }
input.txt { width: 100%; padding: 7px 10px; font: inherit; font-size: 15px; border: 1px solid var(--line); border-radius: 4px; color: var(--fg); background: var(--bg); }
input.search { max-width: 340px; }
.toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; }
.sect { font-size: 20px; font-weight: 400; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
.error { margin: 24px; padding: 14px 16px; border: 1px solid var(--bad); border-radius: 4px; color: var(--bad); }
.banner { margin: 14px 0; padding: 10px 14px; border: 1px solid var(--line); border-left: 4px solid var(--link); border-radius: 4px; background: var(--soft); font-size: 15px; }

/* sidebar */
.sidesec { margin-bottom: 26px; }
.tkact { display: inline-flex; align-items: center; }
.tkact .menuwrap > .iconbtn { width: 26px; height: 26px; color: var(--muted); }
.sidesec h2 { display: flex; align-items: center; justify-content: space-between; min-height: 32px; font-size: 15px; font-weight: 700; padding-bottom: 4px; margin-bottom: 4px; border-bottom: 1px solid var(--line); }
.iconbtn.xs { width: 26px; height: 26px; color: var(--muted); }
.todo { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line2); }
.todo .iconbtn { visibility: hidden; }
.todo:hover .iconbtn, .todo .iconbtn:focus-visible { visibility: visible; }
.todoic { flex: none; padding-top: 2px; }
.tmid { flex: 1; min-width: 0; }
.todo .t, .t { font-weight: 700; }
.todo .t { display: block; font-size: 15px; line-height: 1.3; }
.linklike { border: 0; background: none; padding: 0; text-align: left; color: var(--fg); font-weight: 700; }
.linklike:hover { color: var(--link); text-decoration: underline; }
.ctx { font-size: 12.5px; text-transform: uppercase; letter-spacing: .02em; color: var(--c, var(--muted)); color: color-mix(in srgb, var(--c, var(--muted)) 65%, var(--fg)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* dialog */
.modal { position: absolute; inset: 0; z-index: 5; background: rgba(0,0,0,.45); display: flex; align-items: flex-start; justify-content: center; padding-top: 9vh; }
.dialog { width: min(460px, 92vw); max-height: 82vh; overflow: auto; background: var(--bg); border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,.4); padding: 20px 22px; display: grid; gap: 12px; }
.dialog label { display: grid; gap: 4px; font-size: 14px; font-weight: 700; }
.dialog .trayhead { margin-bottom: 0; }
select.txt, textarea.txt { width: 100%; padding: 7px 10px; font: inherit; font-size: 15px; border: 1px solid var(--line); border-radius: 4px; color: var(--fg); background: var(--bg); }
select.pick { width: auto; max-width: 320px; }
.todo .m { font-size: 13.5px; color: var(--muted); }
.todo .m.bad { color: var(--bad); }
.quote { font-style: italic; color: var(--muted); margin-top: 6px; }
.sidebtns { margin-bottom: 16px; }
.sidelink { display: block; padding: 4px 0; }

/* dashboard cards */
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 30px 28px; }
.card { border-radius: 4px; overflow: hidden; background: var(--bg); box-shadow: 0 2px 5px var(--shadow); position: relative; }
.card .hero { display: block; height: 146px; position: relative; overflow: hidden; }
.card .hero img { width: 100%; height: 100%; object-fit: cover; opacity: .4; display: block; }
.card .more { position: absolute; top: 6px; right: 6px; width: 34px; height: 34px; border-radius: 4px; border: 0; background: none; color: #fff; display: flex; align-items: center; justify-content: center; }
.card .more .ic { stroke-width: 3.2; }
.card .more:hover { background: rgba(0,0,0,.3); }
.card .text { display: block; padding: 14px 16px 2px; color: inherit; }
.card .text:hover { text-decoration: none; }
.card .text:hover .name { text-decoration: underline; }
.card .name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-weight: 700; font-size: 15.5px; line-height: 1.3; overflow: hidden;
  color: var(--c); color: color-mix(in srgb, var(--c) 70%, var(--fg)); }
.card .code { display: block; color: var(--muted); font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
.cardics { display: flex; gap: 14px; padding: 12px 14px 12px; }
.cardic { position: relative; color: var(--muted); padding: 4px; border-radius: 4px; display: inline-flex; }
.cardic:hover { background: var(--soft2); color: var(--fg); }
.badge { position: absolute; top: -5px; right: -7px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--primary); color: #fff; font-size: 11.5px; line-height: 18px; text-align: center; font-weight: 700; }
.card .edit { padding: 12px 14px 14px; display: grid; gap: 10px; }
.card .edit label { font-size: 13px; color: var(--muted); display: grid; gap: 4px; }
.swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.sw { width: 24px; height: 24px; border-radius: 12px; border: 2px solid transparent; padding: 0; }
.sw.on { border-color: var(--fg); box-shadow: inset 0 0 0 2px var(--bg); }
.row { display: flex; gap: 8px; flex-wrap: wrap; }

/* planner list and activity stream */
.pday { margin-bottom: 22px; }
.pday h2 { font-size: 17px; font-weight: 700; padding: 6px 0; border-bottom: 1px solid var(--line); }
.pday h2 .muted { font-weight: 400; font-size: 15px; }
.pday.today h2 { color: var(--link); border-bottom: 2px solid var(--link); }
.prow, .srow { display: flex; gap: 14px; align-items: center; padding: 12px 10px 12px 14px; border-bottom: 1px solid var(--line2); border-left: 4px solid var(--c, transparent); }
.srow { border-left: 0; padding-left: 4px; align-items: flex-start; }
.pcheck { width: 22px; height: 22px; padding: 0; border: 1.5px solid var(--muted); border-radius: 4px; background: var(--bg); display: inline-flex; align-items: center; justify-content: center; flex: none; }
.pcheck.done { background: var(--ok); border-color: var(--ok); color: #fff; }
.pcheck:disabled { cursor: default; }
.prow.isdone .t { font-weight: 400; color: var(--muted); }
.pic { color: var(--c); display: inline-flex; }
.pmid { flex: 1; min-width: 0; }
.pmid .t { display: block; }
.pend { text-align: right; font-size: 14px; white-space: nowrap; }
.agrow { padding: 6px 0; border-bottom: 1px solid var(--line2); }
.agrow .event { white-space: normal; font-size: 15px; }

/* course pages */
.cnav { width: 180px; flex: none; overflow: hidden; transition: width .26s var(--ease), margin-right .26s var(--ease), opacity .2s ease, visibility 0s linear 0s; }
.cnav > * { min-width: 180px; }
/* Closed: no width, the layout gap taken back, faded; hidden from view once the slide ends. */
.cnav.closed { width: 0; margin-right: -28px; opacity: 0; visibility: hidden; transition: width .26s var(--ease), margin-right .26s var(--ease), opacity .16s ease, visibility 0s linear .26s; }
.cnav a { display: block; padding: 5px 10px 5px 12px; border-left: 2px solid transparent; font-size: 15.5px; }
.cnav a.on { color: var(--fg); border-left-color: var(--fg); }
.cnav .sep { margin: 16px 0 4px; padding: 0 12px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
/* Not clipped, so an entry's ⋮ menu can open over what follows; the header rounds itself. */
.group { margin-bottom: 18px; border: 1px solid var(--line); border-radius: 4px; }
.group > summary { border-radius: 3px 3px 0 0; }
.group:not([open]) > summary { border-radius: 3px; }
.group summary { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; padding: 13px 14px; background: var(--soft); list-style: none; }
.group summary::-webkit-details-marker { display: none; }
.group:not([open]) summary .ic { transform: rotate(-90deg); }
.group .gname { flex: 1; }
/* a sub-module sits inside its parent module, indented, and collapses with it */
.group .group { margin: 12px 14px 12px 28px; }
.group .group summary { background: var(--bg); padding: 10px 12px; }
.group .count { font-weight: 400; font-size: 13px; color: var(--muted); border: 1px solid var(--line); border-radius: 10px; padding: 0 8px; }
.irow { display: flex; gap: 14px; align-items: center; padding: 11px 14px; border-top: 1px solid var(--line); }
.iic { color: var(--muted); display: inline-flex; flex: none; }
/* The ⋮ on the left of a module entry: small, quiet until hovered or focused. */
.irow > .menuwrap { margin: 0 -6px 0 -8px; }
.irow > .menuwrap > .iconbtn { width: 28px; height: 28px; color: var(--muted); opacity: .55; }
.irow:hover > .menuwrap > .iconbtn, .irow > .menuwrap > .iconbtn:focus-visible, .irow > .menuwrap > .iconbtn[aria-expanded="true"] { opacity: 1; }
.irow > .menuwrap .menu { right: auto; left: 0; min-width: 140px; }
.iic.ok { color: var(--ok); }
.iic.inline { vertical-align: middle; }
.imid { flex: 1; min-width: 0; }
.imid .t { display: block; overflow-wrap: anywhere; }
a.t { color: var(--fg); }
a.t:hover { color: var(--link); }
.t.read { font-weight: 400; }
.t.dark { color: var(--fg); }
.newdot { width: 10px; height: 10px; border-radius: 5px; background: var(--link); flex: none; }
.notice { border: 1px solid var(--line); border-radius: 4px; margin-bottom: 22px; overflow: hidden; }
.nhead { padding: 9px 14px; background: var(--soft); font-weight: 700; font-size: 15px; }
.nrow { display: flex; gap: 14px; align-items: baseline; padding: 9px 14px; border-top: 1px solid var(--line); color: var(--fg); }
.nrow .t { flex: none; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nrow .muted:not(.nowrap) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rows { border-top: 1px solid var(--line); margin-bottom: 14px; }
.arow { display: flex; gap: 14px; align-items: flex-start; padding: 14px 6px; border-bottom: 1px solid var(--line); color: var(--fg); }
.arow:hover { background: var(--soft); text-decoration: none; }
.detail h1, .dhead h1 { font-size: 26px; font-weight: 400; line-height: 1.25; }
.dhead { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; margin-bottom: 6px; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 28px; margin: 12px 0 18px; padding: 10px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.meta div { display: flex; gap: 8px; }
.meta dt { font-weight: 700; }
.meta dd { margin: 0; }
.prose { margin-top: 12px; overflow-wrap: anywhere; line-height: 1.55; }
.prose > :first-child { margin-top: 0; }
.prose p { margin: 0 0 12px; }
.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 { font-size: 17px; font-weight: 700; margin: 14px 0 6px; }
.prose table { width: auto; border-collapse: collapse; }
.prose td, .prose th { border: 1px solid var(--line); padding: 4px 8px; }
.prose pre { white-space: pre-wrap; }
.prose img { max-width: 100%; height: auto; border-radius: 4px; }
.filelist { list-style: none; padding: 0; margin: 8px 0; }
.filelist li { padding: 5px 0; }
.bigscore { font-size: 30px; font-weight: 700; line-height: 1.2; }
.bigscore.hyp, .grouprow td.hyp { color: var(--link); }
.substat { font-weight: 700; padding: 8px 0; }
.post { border: 1px solid var(--line); border-radius: 4px; padding: 12px 16px; margin-bottom: 10px; }
.phead { display: flex; gap: 10px; align-items: center; }
.psub { font-weight: 700; margin-top: 10px; }

.viewer { display: block; width: 100%; height: calc(100vh - 230px); min-height: 460px; border: 1px solid var(--line); border-radius: 4px; background: #fff; margin: 12px 0; }
.viewer.full { height: calc(100vh - 140px); margin: 0; }
.pager { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; }
.pager .btn { max-width: 48%; overflow: hidden; }
.linkcard { display: flex; gap: 16px; align-items: center; padding: 22px; border: 1px solid var(--line); border-radius: 4px; margin: 14px 0; }
.linkcard > div { flex: 1; min-width: 0; }

/* rubric (Canvas-style: criterion, ratings, points) */
.rubric { border-collapse: collapse; width: 100%; margin: 10px 0 18px; font-size: 14px; }
.rubric th, .rubric td { border: 1px solid var(--line); padding: 8px 10px; vertical-align: top; text-align: left; }
.rubric thead th { background: var(--soft); }
.rubric .ratings { display: flex; flex-wrap: wrap; gap: 0; padding: 0; }
.rubric .rating { flex: 1 1 110px; padding: 8px 10px; border-right: 1px solid var(--line2); min-width: 0; }
.rubric .rating:last-child { border-right: 0; }
.rubric .rating.on { background: var(--hi); box-shadow: inset 0 -3px 0 var(--link); }
.rubric .rpts { font-weight: 700; }
.rubric .num { text-align: right; white-space: nowrap; }
.rubric .cfb { margin-top: 6px; font-style: italic; color: var(--muted); }

/* hand-in panel */
.submitbox { margin: 18px 0; padding: 16px; border: 1px solid var(--line); border-radius: 4px; background: var(--soft); }
.submitbox h2 { margin: 0 0 10px; font-size: 18px; }
.submitbox label { display: block; margin: 10px 0 4px; font-weight: 700; font-size: 14px; }
.submitbox .row { margin-top: 14px; gap: 8px; }
.submitbox .msg { margin-top: 10px; font-size: 14px; }
.submitbox .msg.bad { color: var(--bad); }
.btn[disabled] { opacity: .6; cursor: default; }
.replyopen { display: flex; align-items: center; gap: 6px; width: 100%; margin: 18px 0 4px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--muted); text-align: left; font-size: 15px; transition: border-color .15s; }
.replyopen:hover { border-color: var(--link); color: var(--fg); }
.replybox { display: grid; gap: 10px; margin: 14px 0; padding: 14px; border: 1px solid var(--line); border-radius: 4px; background: var(--soft); animation: bsx-rise .2s var(--ease); }
.replybox label { display: grid; gap: 4px; font-weight: 700; font-size: 14px; }
.replybox .msg { font-size: 14px; }
.replybox .msg.bad { color: var(--bad); }
.linkbtn { margin-top: 8px; border: 0; background: none; padding: 2px 0; color: var(--link); font-size: 14px; display: inline-flex; align-items: center; gap: 4px; }
.linkbtn:hover { text-decoration: underline; }

/* outside copies of an item, and the Connected Sites page */
.also { display: inline-flex; gap: 6px; margin-left: 8px; vertical-align: middle; }
.alsochip { font-size: 12px; padding: 0 7px; border: 1px solid var(--line); border-radius: 10px; color: var(--muted); }
.alsochip:hover { color: var(--link); border-color: var(--link); text-decoration: none; }
.edform { display: grid; gap: 10px; max-width: 520px; margin: 14px 0; }
.edform label { display: grid; gap: 4px; font-weight: 700; font-size: 14px; }

/* search across every course */
.dialog.wide { width: min(640px, 94vw); }
.gsearch { max-height: 56vh; overflow-y: auto; display: grid; gap: 2px; }
.gres { display: flex; gap: 12px; align-items: center; padding: 8px 10px; border-radius: 4px; border-left: 3px solid var(--c, var(--line)); color: var(--fg); }
.gres:hover, .gres.on { background: var(--hi); text-decoration: none; }
.gres .imid { display: grid; min-width: 0; }
.gres .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gkind { flex: none; width: 96px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* confetti for a finished week */
.confetti { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20; }

/* Tasks panel */
.tkhead { display: flex; align-items: center; justify-content: space-between; margin: 2px 0 8px; }
.tkweek { font-weight: 700; font-size: 14px; }
.tkprog { display: grid; justify-items: center; gap: 12px; padding: 4px 0 12px; }
.tkchart { position: relative; width: 150px; height: 150px; }
.tkrings { display: block; }
.tktrack { stroke: var(--soft2); }
.tkarc { transition: stroke-dashoffset .9s var(--ease); }
.tkcenter { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; line-height: 1.1; }
.tkbig { font-size: 22px; font-weight: 700; }
.tklegend { width: 100%; min-width: 0; display: grid; gap: 4px; }
.tkkey { display: flex; align-items: center; gap: 6px; font-size: 13px; min-width: 0; }
.tkname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tktabs { display: flex; margin-bottom: 4px; }
.tktabs button { flex: 1; font-size: 13.5px; padding: 5px 6px; }
.tkrow { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0 9px 8px; border-bottom: 1px solid var(--line2); border-left: 3px solid var(--c); animation: bsx-fade .2s ease-out; }
.tkrow .t { font-size: 15px; line-height: 1.3; }
.tkrow .pcheck { width: 20px; height: 20px; margin-top: 1px; }

/* groups */
.gcards { display: grid; gap: 14px; }
.gcard { border: 1px solid var(--line); border-left: 4px solid var(--c, var(--line)); border-radius: 4px; padding: 14px 16px; }
.gtop { display: flex; gap: 14px; align-items: center; }
.gtop .avatar { color: var(--c, var(--muted)); }
.members { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; }
.member { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; }
.avatar.xs { width: 24px; height: 24px; font-size: 11px; color: var(--muted); }
.post.unread { border-left: 3px solid var(--link); }
.newdot.inline { display: inline-block; margin-left: 8px; vertical-align: middle; }
kbd { display: inline-block; min-width: 22px; padding: 1px 6px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; background: var(--soft); font: 13px/1.4 ui-monospace, Consolas, monospace; text-align: center; }
.keys td:first-child { white-space: nowrap; width: 40%; }

/* tables and grades */
table.grid { border-collapse: collapse; width: 100%; }
.grid th, .grid td { text-align: left; padding: 10px 10px; border-bottom: 1px solid var(--line2); vertical-align: top; }
.grid th { font-size: 14px; font-weight: 700; border-bottom: 1px solid var(--line); }
.grid td.num, .grid th.num { text-align: right; white-space: nowrap; }
.grid tr.grouprow td { background: var(--soft); font-weight: 700; }
.grid.tight th, .grid.tight td { padding: 6px 4px; font-size: 14px; }
.note { color: var(--muted); font-size: 13.5px; margin-top: 2px; white-space: pre-wrap; }
.totalbox { border: 1px solid var(--line); border-radius: 4px; padding: 14px 16px; margin-bottom: 12px; }
.tlabel { font-weight: 700; font-size: 15px; }
.tnote { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line2); font-size: 12.5px; }
.totalbox.top { display: none; margin-bottom: 16px; }
input.wi { width: 84px; padding: 3px 6px; font: inherit; text-align: right; border: 1px solid var(--line); border-radius: 4px; color: var(--fg); background: var(--bg); }
input.wi.changed { border-color: var(--link); background: var(--hi); }
.wilock { color: var(--muted); cursor: help; white-space: nowrap; }
.grid tr.dropped td.num, .grid tr.dropped td.num input { text-decoration: line-through; color: var(--muted); }

/* calendar */
.calnav { display: flex; gap: 8px; align-items: center; }
.cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-left: 1px solid var(--line); border-top: 1px solid var(--line); }
.cal .dow { padding: 6px 8px; font-size: 13px; font-weight: 700; color: var(--muted); text-align: center; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.cal .day { min-height: 108px; padding: 4px 5px 6px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.cal .day.other { background: var(--soft); }
.cal .day.other .dnum { opacity: .6; }
.cal .dnum { font-size: 13px; margin-bottom: 3px; text-align: right; padding-right: 2px; }
.cal .day.today .dnum { font-weight: 700; color: var(--link); }
.cal .day.today { box-shadow: inset 0 3px 0 var(--link); }
.event { display: block; font-size: 12.5px; line-height: 1.35; margin-bottom: 3px; padding: 1px 5px; border-left: 3px solid var(--c, var(--muted)); border-radius: 2px;
  color: var(--fg); background: color-mix(in srgb, var(--c, var(--muted)) 12%, transparent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button.event { width: 100%; border-top: 0; border-right: 0; border-bottom: 0; text-align: left; font-family: inherit; }
.etime { color: var(--muted); }
.evmeta { display: grid; grid-template-columns: 22px 1fr; gap: 8px 10px; margin: 0; align-items: center; }
.evmeta dt { display: inline-flex; justify-content: center; color: var(--muted); }
.evmeta dd { margin: 0; }
.calrow { display: flex; gap: 8px; align-items: center; padding: 6px 0; font-size: 14.5px; cursor: pointer; }

.pill { position: fixed; z-index: 2147483647; left: 12px; bottom: 12px; padding: 7px 14px; border-radius: 18px; border: 1px solid #2d3b45;
  background: #2d3b45; color: #fff; font: 13px/1.2 Lato, "Helvetica Neue", Helvetica, Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.3); cursor: pointer; }

/* flash alerts, top centre */
.flashes { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 10; display: grid; gap: 8px; width: min(560px, 92vw); pointer-events: none; }
.flash { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 14px; border-radius: 4px; background: var(--bg); color: var(--fg); border: 1px solid var(--ok); border-left: 6px solid var(--ok); box-shadow: 0 4px 16px var(--shadow); font-size: 15px; animation: bsx-drop .25s var(--ease); transition: opacity .2s, transform .2s; }
.flash > span { flex: 1; }
.flash > .ic { color: var(--ok); }
.flash.bad { border-color: var(--bad); }
.flash.bad > .ic { color: var(--bad); }
.flash.out { opacity: 0; transform: translateY(-10px); }

/* popup menus */
.menuwrap { position: relative; display: inline-flex; }
.menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 6; min-width: 210px; padding: 6px 0; background: var(--bg); border: 1px solid var(--line); border-radius: 4px; box-shadow: 0 6px 20px var(--shadow); animation: bsx-zoom .14s var(--ease); transform-origin: top right; }
.menu.toleft { right: auto; left: 0; transform-origin: top left; }
.menu button { display: flex; align-items: center; gap: 6px; width: 100%; padding: 7px 14px 7px 8px; border: 0; background: none; text-align: left; font-size: 15px; color: var(--fg); }
.menu button:hover, .menu button:focus-visible { background: var(--primary); color: #fff; outline: none; }
.menu .mcheck { width: 20px; display: inline-flex; }
.menu .mdiv { height: 1px; margin: 6px 0; background: var(--line2); }

/* small interactions */
.btn, .iconbtn, .seg button, .trayitem, .cardic, .pcheck { transition: background-color .15s, color .15s, border-color .15s, box-shadow .15s, transform .1s; }
.btn:active, .iconbtn:active { transform: translateY(1px); }
.card { transition: box-shadow .2s var(--ease); }
.card:hover { box-shadow: 0 4px 12px var(--shadow); }
.app[data-wide="on"] .cards { grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); }
.app[data-wide="on"] .card .hero { height: auto; aspect-ratio: 12 / 5; }
.app[data-overlay="off"] .card .hero img { opacity: 1; }
.app[data-overlay="off"] .card:hover .hero img { opacity: .9; }
.card .hero img { transition: opacity .25s; }
.card:hover .hero img { opacity: .5; }
.group summary .ic { transition: transform .2s var(--ease); }
.irow, .arow, .prow, .todo, .nrow { transition: background-color .15s; }
.irow:hover, .prow:hover, .nrow:hover { background: color-mix(in srgb, var(--soft) 70%, transparent); }
.pcheck.done .ic { animation: bsx-pop .25s var(--ease); }
.modal { animation: bsx-fade .16s ease-out; }
.modal .dialog { animation: bsx-zoom .2s var(--ease); }
.submitbox:not([hidden]) { animation: bsx-rise .22s var(--ease); }
.rubric .rating { transition: background-color .2s; }
.newdot { animation: bsx-pop .3s var(--ease); }
.rail a, .rail button { transition: background-color .15s, color .15s; }
.cnav a { transition: border-color .15s, color .15s, background-color .15s; }
.cnav a:hover { background: var(--soft); text-decoration: none; }
.event { transition: filter .15s; }
.event:hover { filter: brightness(.95); text-decoration: none; }
@media (prefers-reduced-motion: reduce) {
  .app *, .app *::before, .app *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
}

@media (max-width: 1100px) { .right { width: 240px; } .cnav { width: 150px; } .cnav > * { min-width: 150px; } }
@media (max-width: 860px) {
  .layout { flex-direction: column; align-items: stretch; gap: 18px; padding: 16px; }
  .right, .cnav { width: 100%; }
  /* Narrow screens: the grade total sits above the grades, not after them. */
  .totalbox.top { display: block; }
  .right .totalbox { display: none; }
  .cnav { display: flex; flex-wrap: wrap; gap: 0 2px; border-bottom: 1px solid var(--line); padding-bottom: 8px; max-height: 480px; transition: max-height .26s var(--ease), opacity .2s ease, padding .26s var(--ease); }
  .cnav > * { min-width: 0; }
  /* On narrow screens the menu is a strip above the page: it folds up instead of sideways. */
  /* Hidden only once the fold has finished, so the closing is seen. */
  .cnav.closed { width: 100%; margin-right: 0; max-height: 0; padding-bottom: 0; border-bottom-width: 0; transition: max-height .26s var(--ease), opacity .2s ease, padding .26s var(--ease), visibility 0s linear .26s; }
  .cnav a { border-left: 0; border-bottom: 2px solid transparent; padding: 4px 9px; }
  .cnav a.on { border-bottom-color: var(--fg); }
  .cnav .sep { width: 100%; margin: 8px 0 0; padding: 0 9px; }
  .cnav > div:not(.sep) { display: contents; }
  .head, .crumbs { margin: 0 16px; }
  .head h1 { font-size: 24px; }
  .head { flex-wrap: wrap; }
}
@media (max-width: 560px) {
  .rail { width: 48px; }
  .tray { left: 48px; width: calc(100vw - 48px); }
  .layout { padding: 12px; }
  .head, .crumbs { margin: 0 12px; gap: 8px; }
  .head h1 { flex-basis: 100%; white-space: normal; }
  .head .seg button { padding: 6px 8px; font-size: 13px; }
  .crumbs .trail { font-size: 16px; }
  .calnav, .toolbar, .row { flex-wrap: wrap; }
  .dhead { flex-direction: column; align-items: stretch; }
  .dhead .btn { align-self: flex-start; white-space: normal; }
  .content { overflow-x: auto; }
  .irow, .prow, .srow, .arow, .nrow { flex-wrap: wrap; gap: 8px 10px; }
  .imid, .pmid { flex-basis: 60%; }
  .nrow .t { max-width: 100%; }
  .cal .day { min-height: 64px; padding: 2px; }
  .cal .dow { padding: 4px 0; font-size: 11px; }
  .event { font-size: 10.5px; padding: 0 2px; border-left-width: 2px; }
  .meta { gap: 4px 18px; }
  .cards { grid-template-columns: 1fr; gap: 18px; }
  .viewer { height: 70vh; }
  select.pick { max-width: 100%; }
  .rail { width: 60px; }
  .rail a span, .rail button span { display: none; }
  .tray { left: 60px; width: min(320px, calc(100vw - 60px)); }
}
`;
})();
