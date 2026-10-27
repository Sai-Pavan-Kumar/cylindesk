/* Prices. Billing is per refill: each delivery charges the gas's price at that moment.
   A client can have its own rate for a gas (big contracts negotiate), which beats the list price.
   The charged amount is saved on the delivery, so editing prices later never rewrites old bills. */

function priceList(){
  state.prices = state.prices || { ...REFILL_PRICE };
  return state.prices;
}

function priceFor(client, type){
  const special = client && client.rates && client.rates[type];
  return special || priceList()[type];
}

function viewPrices(){
  const list = priceList();
  const rows = Object.keys(list).map(type => {
    const onRate = activeClients().filter(c => c.rates && c.rates[type]).length;
    return `<tr><td><span class="t">${type}</span></td>
      <td class="num"><label class="money"><span>₹</span><input type="number" min="0" step="10" inputmode="numeric" data-price="${type}" value="${list[type]}" aria-label="List price for ${type}"></label></td>
      <td class="num">${onRate ? `${onRate} client${onRate > 1 ? "s" : ""}` : `<span class="demo">—</span>`}</td></tr>`;
  }).join("");
  const special = activeClients().flatMap(c => Object.entries(c.rates || {}).map(([type, rate]) => ({ c, type, rate })));
  const specialRows = special.map(({ c, type, rate }) => {
    const diff = rate - list[type];
    return `<div class="row click" data-client="${c.id}" style="cursor:pointer;grid-template-columns:1fr auto auto">
      <div class="who">${avatar(c)}<div><div class="t">${esc(c.name)}</div><div class="s">${type}</div></div></div>
      <span class="num t">${rupees(rate)}</span>
      <span class="pill ${diff < 0 ? "ok" : "warn"}" style="justify-self:end">${diff < 0 ? rupees(-diff) + " below list" : rupees(diff) + " above list"}</span></div>`;
  }).join("") || `<div class="empty">No client has a special rate. Add one from a client's Edit form.</div>`;
  return `
    <div class="head"><div><h1>Prices</h1><p class="sub">Charged once per refill delivery. A client's own rate replaces the list price for that client.</p></div>
      <button class="btn primary" data-act="savePrices">Save prices</button></div>
    <div class="overview">
      <div class="tbl-wrap"><table style="min-width:420px"><thead><tr><th>Gas</th><th class="num">List price per refill</th><th class="num">On a special rate</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="demo" style="margin-top:12px">New prices apply to deliveries from now on. Past bills keep the price they were charged at.</p></div>
      <aside class="side"><section><h2>Client rates</h2><div class="list">${specialRows}</div></section></aside>
    </div>`;
}

function savePrices(){
  const list = priceList();
  document.querySelectorAll("[data-price]").forEach(input => {
    const value = Math.round(+input.value);
    if (value > 0) list[input.dataset.price] = value;
  });
  toast("Prices saved");
  render();
}

// Fields for the client form: blank means "use the list price".
function clientRateFields(c){
  const list = priceList();
  const fields = Object.keys(list).map((type, i) => `<div class="field"><label for="fRate${i}">${type}</label>
    <input id="fRate${i}" type="number" min="0" step="10" inputmode="numeric" data-rate="${type}" placeholder="List ₹${list[type]}" value="${c && c.rates && c.rates[type] || ""}"></div>`).join("");
  const count = c && c.rates ? Object.keys(c.rates).length : 0;
  return `<details class="rates"${count ? " open" : ""}><summary>Special rates${count ? ` (${count})` : " (optional)"}</summary>
    <p class="demo" style="margin:4px 0 8px">Leave blank to charge the list price.</p><div class="f2">${fields}</div></details>`;
}

function readClientRates(){
  const rates = {};
  document.querySelectorAll("[data-rate]").forEach(input => {
    const value = Math.round(+input.value);
    if (input.value && value > 0) rates[input.dataset.rate] = value;
  });
  return rates;
}

function deliveryPriceLine(cyl, client){
  const special = client && client.rates && client.rates[cyl.type];
  return `<span>Charge for this refill</span><span><b>${rupees(priceFor(client, cyl.type))}</b> <span class="demo">${special ? "client rate" : "list price"}</span></span>`;
}
