/* Cylinder stock + QR labels.
   The QR holds only the cylinder code (e.g. CYL-0065). Everything else lives in the app,
   so a printed label never goes stale and stays easy to scan when dirty or scratched. */

const MAX_BATCH = 50;

function qrSvg(code, cellSize){
  const qr = qrcode(0, "M");
  qr.addData(code);
  qr.make();
  return qr.createSvgTag({ cellSize, margin: 0, scalable: true });
}

function nextCodes(count){
  const last = Math.max(0, ...state.cylinders.map(c => +c.code.slice(4)));
  return Array.from({ length: count }, (_, i) => "CYL-" + String(last + 1 + i).padStart(4, "0"));
}

// Sample serials and test dates for the seeded fleet, so the detail view is never half-empty.
function seedStockDetails(){
  state.cylinders.forEach((c, i) => {
    c.serial = c.serial || "MF" + (204310 + i * 37);
    c.testDue = c.testDue || NOW + ((i * 53) % 900 - 60) * DAY;
  });
}

function testPill(cyl){
  const days = Math.floor((cyl.testDue - NOW) / DAY);
  if (days < 0) return `<span class="pill bad">Test overdue</span>`;
  if (days < 60) return `<span class="pill warn">Test in ${days} days</span>`;
  return `<span class="pill mute">Test ${fmtDate(cyl.testDue)} ${new Date(cyl.testDue).getFullYear()}</span>`;
}

function addCylinderForm(){
  const gases = Object.keys(REFILL_PRICE).map(t => `<option>${t}</option>`).join("");
  const defaultTest = new Date(NOW + 5 * 365 * DAY).toISOString().slice(0, 10);
  openSheet(`<h2>Add cylinders</h2>
    <p class="sub" style="margin:0">Each new cylinder gets its own code and QR label.</p>
    <form id="cylForm" style="display:flex;flex-direction:column;gap:14px">
      <div class="field"><label for="fGas">Gas</label><select id="fGas">${gases}</select></div>
      <div class="f2"><div class="field"><label for="fQty">How many</label><input id="fQty" type="number" min="1" max="${MAX_BATCH}" value="1" required inputmode="numeric"></div>
      <div class="field"><label for="fTest">Next pressure test</label><input id="fTest" type="date" value="${defaultTest}" required></div></div>
      <div class="field"><label for="fSerial">Maker serial no. (optional)</label><input id="fSerial" placeholder="Stamped on the cylinder neck"></div>
      <div class="actions"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Add and make labels</button></div>
    </form>`);
  document.getElementById("cylForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const qty = Math.min(MAX_BATCH, Math.max(1, +fQty.value));
    const added = nextCodes(qty).map(code => ({
      code, type: fGas.value, clientId: null, since: null,
      serial: qty === 1 ? fSerial.value.trim() : "", testDue: new Date(fTest.value).getTime()
    }));
    state.cylinders.push(...added);
    render();
    labelSheet(added, `${qty} cylinder${qty > 1 ? "s" : ""} added`);
  });
}

function cylinderSheet(code){
  const c = state.cylinders.find(x => x.code === code);
  const cl = c.clientId && clientById(c.clientId);
  openSheet(`<h2 class="mono" style="font-size:20px">${c.code}</h2>
    <div style="width:180px;margin:0 auto;padding:12px;background:#fff;border-radius:12px">${qrSvg(c.code, 6)}</div>
    <div class="list">
      <div class="row"><span class="s">Gas</span><span>${c.type}</span></div>
      <div class="row"><span class="s">Where</span><span>${cl ? esc(cl.name) : "In godown"}</span></div>
      <div class="row"><span class="s">Maker serial</span><span class="mono">${c.serial || "—"}</span></div>
      <div class="row"><span class="s">Pressure test</span>${testPill(c)}</div>
    </div>
    <div class="actions"><button class="btn" data-act="close">Close</button><button class="btn primary" data-print="${c.code}">Print label</button></div>`);
}

function labelSheet(list, title){
  const preview = list.slice(0, 6).map(c => `<div style="width:64px;padding:4px;background:#fff;border-radius:6px">${qrSvg(c.code, 2)}</div>`).join("");
  openSheet(`<h2>${title}</h2>
    <p class="sub" style="margin:0">${list.length} label${list.length > 1 ? "s" : ""} ready: ${list[0].code}${list.length > 1 ? " to " + list[list.length - 1].code : ""}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${preview}${list.length > 6 ? `<span class="demo" style="align-self:center">+${list.length - 6} more</span>` : ""}</div>
    <p class="demo" style="margin:0">Use waterproof vinyl or polyester labels. Paper peels off cylinders fast.</p>
    <div class="actions"><button class="btn" data-act="close">Later</button><button class="btn primary" data-print="${list.map(c => c.code).join(",")}">Print labels</button></div>`);
}

function printLabels(codes){
  const list = codes.map(code => state.cylinders.find(c => c.code === code));
  let area = document.getElementById("printArea");
  if (!area) { area = document.createElement("div"); area.id = "printArea"; document.body.appendChild(area); }
  area.innerHTML = list.map(c => `<div class="label">${qrSvg(c.code, 4)}<div class="code">${c.code}</div><div class="gas">${c.type}</div></div>`).join("");
  closeSheet();
  window.print();
}

function visibleCylinderCodes(){
  return [...document.querySelectorAll("#view tbody [data-qr]")].map(b => b.dataset.qr);
}

// Capture phase on window runs before the main click router, so a QR button inside a client row
// opens the QR instead of jumping to the client page.
window.addEventListener("click", (e) => {
  const t = e.target.closest("[data-qr],[data-print],[data-act='addCyl'],[data-act='printShown']");
  if (!t) return;
  e.stopPropagation();
  if (t.dataset.qr) return cylinderSheet(t.dataset.qr);
  if (t.dataset.print) return printLabels(t.dataset.print.split(","));
  if (t.dataset.act === "addCyl") return addCylinderForm();
  const shown = visibleCylinderCodes();
  if (shown.length) labelSheet(shown.map(code => state.cylinders.find(c => c.code === code)), "Print these labels");
}, true);

seedStockDetails();
