/* Overview screen. Its one question: "Which cylinders do I need to chase today?"
   So the return clock (late and nearly-due cylinders) sits under the KPIs, ahead of the trend chart. */

const DUE_SOON_DAYS = 3;
const CLOCK_ROWS = 7;

// Each client keeps one pale hue, spaced around the wheel so neighbours never look alike.
function avatar(client){
  const index = state.clients.indexOf(client);
  const initials = client.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("");
  return `<span class="av" style="--h:${(index * 137) % 360}" aria-hidden="true">${initials}</span>`;
}

function flowChart(){
  const days = 14, W = 640, H = 200, pad = { l: 24, r: 4, t: 8, b: 26 };
  const buckets = Array.from({ length: days }, (_, i) => ({ t: NOW - (days - 1 - i) * DAY, out: 0, in: 0 }));
  state.events.forEach(e => {
    const idx = days - 1 - Math.floor((NOW - e.at) / DAY);
    if (idx >= 0 && idx < days && e.kind !== "pay") buckets[idx][e.kind]++;
  });
  const top = Math.max(4, Math.ceil(Math.max(...buckets.map(b => Math.max(b.out, b.in))) / 2) * 2);
  const cw = (W - pad.l - pad.r) / days, bw = Math.min(12, cw / 3);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  let svg = "";
  for (let v = 0; v <= top; v += top / 2) svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  buckets.forEach((b, i) => {
    const cx = pad.l + cw * i + cw / 2;
    const isToday = i === days - 1;
    svg += `<rect x="${cx - bw - 1}" y="${y(b.out)}" width="${bw}" height="${y(0) - y(b.out)}" rx="2" fill="var(--accent)"><title>${fmtDate(b.t)}: ${b.out} sent</title></rect>`;
    svg += `<rect x="${cx + 1}" y="${y(b.in)}" width="${bw}" height="${y(0) - y(b.in)}" rx="2" fill="var(--series-2)"><title>${fmtDate(b.t)}: ${b.in} received</title></rect>`;
    if (i % 2 === 1 || isToday) svg += `<text x="${cx}" y="${H - 6}" text-anchor="middle" ${isToday ? 'style="fill:var(--ink)"' : ""}>${isToday ? "Today" : fmtDate(b.t)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cylinders sent and received each day, last 14 days">${svg}</svg>`;
}

function clockCandidates(){
  return state.cylinders
    .filter(c => c.clientId && overdueDays(c) > -DUE_SOON_DAYS - 1)
    .sort((a, b) => overdueDays(b) - overdueDays(a));
}

// Shared axis for every row: 0 days to the longest time any listed cylinder has been out,
// so a 9-days-late cylinder visibly runs further past its tick than a 2-days-late one.
function returnClock(){
  const rows = clockCandidates();
  if (!rows.length) return `<div class="empty">Every cylinder is well inside its return time.</div>`;
  const axis = Math.max(...rows.map(c => Math.max(daysOut(c), clientById(c.clientId).returnDays)));
  const pct = (d) => (d / axis * 100).toFixed(2) + "%";
  const html = rows.slice(0, CLOCK_ROWS).map(c => {
    const cl = clientById(c.clientId);
    const out = daysOut(c), late = overdueDays(c), limit = cl.returnDays;
    const used = Math.min(out, limit);
    const when = late > 0
      ? `<span class="late">${late} day${late > 1 ? "s" : ""} late</span><small>${out} days out · limit ${limit}</small>`
      : `<span class="soon">${late === 0 ? "Due today" : `Due in ${-late} day${late === -1 ? "" : "s"}`}</span><small>${out} days out · limit ${limit}</small>`;
    return `<div class="clock click" data-client="${cl.id}" style="cursor:pointer">
      <div class="who">${avatar(cl)}<div><div class="t">${esc(cl.name)}</div><div class="meta"><span class="mono">${c.code}</span><span class="tag">${c.type}</span></div></div></div>
      <div class="track" role="img" aria-label="${out} days out of a ${limit}-day limit">
        <span class="used" style="width:${pct(used)}"></span>
        ${late > 0 ? `<span class="over" style="left:${pct(limit)};width:${pct(late)}"></span>` : ""}
        <span class="limit" style="left:calc(${pct(limit)} - 1px)"></span>
      </div>
      <div class="when">${when}</div></div>`;
  }).join("");
  const more = rows.length > CLOCK_ROWS ? `<button class="btn sm" data-go="cylinders" data-filter="late" style="margin-top:12px">See all ${rows.length}</button>` : "";
  return html + more;
}

function gasMix(){
  return Object.keys(REFILL_PRICE).map(type => {
    const all = state.cylinders.filter(c => c.type === type);
    const out = all.filter(c => c.clientId).length;
    return `<div class="row" style="grid-template-columns:1fr auto"><div><div class="t">${type}</div>
      <div class="gasbar" style="margin-top:6px"><span style="width:${all.length ? out / all.length * 100 : 0}%"></span></div></div>
      <div class="num"><span class="t">${out}</span><span class="demo"> / ${all.length}</span></div></div>`;
  }).join("");
}

function recentScans(){
  return state.events.filter(e => e.kind !== "pay").sort((a, b) => b.at - a.at).slice(0, 5).map(e => {
    const cl = clientById(e.clientId);
    return `<div class="row click" data-client="${cl.id}" style="cursor:pointer"><div class="who">${avatar(cl)}<div>
      <div class="t">${e.kind === "out" ? "Delivered to" : "Back from"} ${esc(cl.name)}</div>
      <div class="meta"><span class="mono">${e.code}</span><span class="s">${fmtTime(e.at)}</span></div></div></div>
      <span class="pill ${e.kind === "out" ? "mute" : "ok"}">${e.kind === "out" ? "Out" : "In"}</span></div>`;
  }).join("");
}

function viewHome(){
  const clients = activeClients();
  const out = state.cylinders.filter(c => c.clientId);
  const late = out.filter(c => overdueDays(c) > 0).sort((a, b) => overdueDays(b) - overdueDays(a));
  const owing = clients.filter(c => balanceDue(c.id) > 0);
  const due = owing.reduce((s, c) => s + balanceDue(c.id), 0);
  const today = state.events.filter(e => NOW - e.at < DAY && e.kind !== "pay");
  const worst = late[0];
  const finding = worst
    ? `<b>${late.length} cylinder${late.length > 1 ? "s are" : " is"} past return time.</b> Longest: <span class="mono">${worst.code}</span> with ${esc(clientById(worst.clientId).name)}, ${overdueDays(worst)} days late.`
    : "Every cylinder is inside its return time.";
  return `
    <div class="head"><div><h1>Overview</h1><p class="sub">${finding}</p></div>
      <div class="toolbar hide-sm"><button class="btn" data-act="addCyl">Add cylinders</button><button class="btn primary" data-act="newClient">+ Add client</button></div></div>
    <section class="kpis">
      <button class="stat" data-go="cylinders" data-filter="out"><span class="k">With clients</span><span class="v">${out.length}</span><span class="h">${state.cylinders.length - out.length} more in the godown</span></button>
      <button class="stat alert" data-go="cylinders" data-filter="late"><span class="k">Late returns</span><span class="v">${late.length}</span><span class="h">past each client's own limit</span></button>
      <button class="stat" data-go="clients"><span class="k">To collect</span><span class="v">${rupees(due)}</span><span class="h">from ${owing.length} clients</span></button>
      <div class="stat"><span class="k">Last 24 hours</span><div class="split">
        <div><span class="v">${today.filter(e => e.kind === "out").length}</span><span class="key out">Sent</span></div>
        <div><span class="v">${today.filter(e => e.kind === "in").length}</span><span class="key in">Back</span></div></div></div>
    </section>
    <div class="overview">
      <div class="col">
        <section class="card"><div class="card-head"><div><h2>Return clock</h2><p>Late and due within ${DUE_SOON_DAYS} days. The tick is the client's limit.</p></div></div>${returnClock()}</section>
        <section class="card"><div class="card-head"><div><h2>Sent and received</h2><p>Cylinders per day, last 14 days</p></div>
          <div class="legend"><span><b style="background:var(--accent)"></b>Sent</span><span><b style="background:var(--series-2)"></b>Received</span></div></div>${flowChart()}</section>
      </div>
      <aside class="side">
        <section><h2>Out with clients, by gas</h2><div class="list">${gasMix()}</div></section>
        <section><h2>Recent scans</h2><div class="list">${recentScans()}</div>
          <button class="btn sm" data-go="cylinders" style="margin-top:8px">View all cylinders</button></section>
      </aside>
    </div>`;
}
