(function () {
  "use strict";
  const P = HolidayPlanner;
  const C = HolidayCore;
  const $ = selector => document.querySelector(selector);
  const esc = text => String(text ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const money = value => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value));
  let connection = null;
  let busy = false;
  let results = [];
  let searchId = "";
  let searchedInput = null;
  let operation = 0;
  let context = "";

  $("#discover-view .results-toolbar").insertAdjacentHTML("beforebegin", `<section id="live-panel" class="live-panel"><div class="results-toolbar"><div><span class="eyebrow">CONNECTED FLIGHT SEARCH</span><h2>Flight fares from Duffel</h2></div><button id="live-status-refresh" class="quiet-button" title="Refresh connection status"><i data-lucide="refresh-cw"></i> Connection</button></div><p id="live-connection" role="status">Checking local API…</p><p class="field-note">Flights only, not a package or hotel offer. Charter availability depends on your Duffel account; SunExpress, Corendon and Condor are not guaranteed. Refreshed fares include taxes but exclude unselected extras, payment-specific fees and accommodation.</p><div id="live-controls"><div class="market-fields"><label>Departure airport<select id="live-origin"></select></label><label>Destination airport<select id="live-destination"></select></label><label>Nights<select id="live-nights"></select></label><label>Departure date<select id="live-date"></select></label></div><div class="live-commands"><label class="check"><input id="live-cost-consent" type="checkbox"> Allow Duffel API requests, which may incur provider charges</label><button id="live-search" class="primary-button" disabled><i data-lucide="search"></i> Search flight fares</button></div><p id="live-scope" class="field-note"></p></div><p id="live-message" class="field-note" role="status"></p><div id="live-results"></div></section>`);

  const optionalApi = document.createElement("details"); optionalApi.id = "optional-api";
  const optionalSummary = document.createElement("summary"); optionalSummary.textContent = "Optional flight API (provider account required)";
  const panel = $("#live-panel"); panel.replaceWith(optionalApi); optionalApi.append(optionalSummary, panel);
  $("#discover-view").append(optionalApi);
  optionalApi.addEventListener("toggle", () => { if (optionalApi.open) checkConnection(); });
  function settingsContext() {
    const settings = P.settings;
    return JSON.stringify([settings.adults, settings.ages, settings.driving, settings.directOnly, settings.maxLayoverMinutes, settings.mixFlights, settings.minNights, settings.maxNights, settings.holidayId, settings.airports, settings.destinations, settings.maxDrive]);
  }
  function input() {
    const holiday = P.holiday();
    const nights = Number($("#live-nights").value);
    const start = $("#live-date").value;
    if (!holiday || !C.validDate(start) || !nights || !$("#live-origin").value || !$("#live-destination").value) return null;
    return {
      origin: $("#live-origin").value, destination: $("#live-destination").value,
      departure_date: start, return_date: C.addDays(start, nights), holiday_start: holiday.start, holiday_end: holiday.end,
      adults: P.settings.adults, ages: [...P.settings.ages], direct_only: P.settings.directOnly,
      independent: P.settings.mixFlights, max_offers: 3, cost_consent: $("#live-cost-consent").checked,
    };
  }
  function clearResults() {
    operation += 1; results = []; searchId = ""; searchedInput = null;
    $("#live-results").replaceChildren();
  }
  function fillSelect(selector, options) {
    const select = $(selector);
    const previous = select.value;
    select.innerHTML = options.map(([value, name]) => `<option value="${esc(value)}">${esc(name)}</option>`).join("");
    if (options.some(([value]) => String(value) === previous)) select.value = previous;
  }
  function syncDates() {
    const holiday = P.holiday();
    const today = new Date().toLocaleDateString("sv-SE");
    const lengths = C.stayLengths(P.settings).filter(nights => C.departures(holiday, nights, today).length);
    fillSelect("#live-nights", lengths.map(nights => [nights, `${nights} nights`]));
    const nights = Number($("#live-nights").value);
    fillSelect("#live-date", (nights ? C.departures(holiday, nights, today) : []).map(date => [date, date]));
  }
  function sync() {
    const next = settingsContext();
    if (next !== context) {
      context = next; clearResults();
      fillSelect("#live-origin", C.airports.filter(airport => P.settings.airports.includes(airport.code) && airport.minutes <= P.settings.maxDrive).map(airport => [airport.code, `${airport.code} · ${airport.name}`]));
      fillSelect("#live-destination", C.destinations.filter(destination => destination.travelMode !== "drive" && P.settings.destinations.includes(destination.id)).map(destination => [destination.id, `${destination.name} (${destination.id})`]));
      syncDates();
    }
    $("#live-controls").hidden = P.settings.driving;
    $("#live-scope").textContent = P.settings.mixFlights ? "Two independent one-way searches; up to 3 refreshed offers each, then all returned pairings. Separate ticket conditions apply. One airport pair and date pair only." : "One round-trip search for the selected airports and dates; at most 3 candidate offers refreshed. This is not a search across every date or airport.";
    if (P.settings.driving) $("#live-message").textContent = "Driving accommodation is not connected to a live provider. FeWo / Center Parcs remain website hand-offs.";
    updateButtons();
  }
  function updateButtons() {
    $("#live-search").disabled = busy || !connection?.configured || !$("#live-cost-consent").checked || !input() || P.settings.driving;
    document.querySelectorAll("[data-live-refresh]").forEach(button => { button.disabled = busy || !$("#live-cost-consent").checked || !connection?.configured; });
  }
  async function checkConnection() {
    if (location.hostname.endsWith(".github.io")) {
      connection = null;
      $("#live-connection").textContent = "Public static share: provider website searches work without an API account. Duffel live fares require your own privately configured local server.";
      updateButtons(); return;
    }
    if (location.protocol === "file:") {
      connection = null;
      $("#live-connection").textContent = "Offline / static mode: provider website searches work without an API account. Duffel live fares require your own privately configured local server.";
      updateButtons(); return;
    }
    try {
      const response = await fetch("/api/status", { signal: AbortSignal.timeout(6000), cache: "no-store" });
      if (!response.ok) throw new Error("Local API unavailable.");
      connection = await response.json();
      $("#live-connection").textContent = connection.configured ? `Duffel token configured · ${connection.mode === "live" ? "LIVE" : "TEST DATA ONLY"}. Access is verified by a successful search. No hotel, package or voucher-validation API is connected.` : "Local API running · Duffel credentials not configured. Set DUFFEL_ACCESS_TOKEN or provider.local.ini privately and restart the server.";
    } catch { connection = null; $("#live-connection").textContent = "Live flight API not connected here. Use the provider website searches; no search was sent."; }
    sync();
  }
  async function post(path, body) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Planner-Token": connection.sessionToken }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The server rejected the selected trip. Check dates, passengers and request settings.");
    return data;
  }
  function baggageText(segment) {
    if (!segment.passengerBaggage?.length || segment.passengerBaggage.some(value => value === null)) return "Baggage allowance not fully supplied; check with provider.";
    return segment.passengerBaggage.map((bags, index) => `Traveller ${index + 1}: ${bags.length ? bags.map(bag => `${bag.quantity ?? "?"} ${bag.type}`).join(", ") : "no listed allowance"}`).join(" · ");
  }
  function journeyLayoverMinutes(journey) {
    return Math.max(0, ...journey.segments.slice(1).map((segment, index) => {
      const previousArrival = Date.parse(journey.segments[index].arrivingAt);
      const nextDeparture = Date.parse(segment.departingAt);
      return Number.isFinite(previousArrival) && Number.isFinite(nextDeparture) ? Math.max(0, Math.round((nextDeparture - previousArrival) / 60000)) : 0;
    }));
  }
  const itineraryLayoverMinutes = itinerary => Math.max(0, ...itinerary.journeys.map(journeyLayoverMinutes));
  function renderResults() {
    $("#live-results").innerHTML = results.map(result => `<article class="live-flight"><div class="live-flight-heading"><div><strong>${result.live ? "Live provider fare" : "TEST OFFER — NOT A LIVE FARE"}</strong><p>${esc(searchedInput.origin)} ↔ ${esc(searchedInput.destination)} · ${result.passengerCount} travellers · ${result.independent ? "independent tickets" : "round trip"}</p></div><div><strong class="price">${money(result.amount)}</strong><p class="price-note">flight fare + taxes, whole family</p></div></div>${result.journeys.map((journey, index) => `<section class="flight-journey"><h3>${index ? "Return" : "Outbound"} · ${journey.segments.length - 1} stops · max layover ${journeyLayoverMinutes(journey)} min · ${journey.minutes} minutes total</h3>${journey.segments.map(segment => `<p><strong>${esc(segment.operatingCarrier)}</strong> ${esc(segment.flightNumber)} · ${esc(segment.origin)} → ${esc(segment.destination)}<br>${esc(segment.departingAt)} → ${esc(segment.arrivingAt)}</p><p class="field-note">${esc(baggageText(segment))}</p>`).join("")}</section>`).join("")}<p class="field-note">Refreshed ${esc(new Date(result.checkedAt).toLocaleString())} · supplier expiry ${esc(new Date(result.expiresAt).toLocaleString())}. Not held. ${result.priceChanged ? "Price changed during refresh; this is the updated amount." : ""}</p><p class="field-note">${esc(result.scope)} Optional baggage services returned: ${result.availableBaggageServices.length}. No hotel, package, corporate voucher or payment-method total is confirmed.</p><div class="live-commands"><button type="button" class="quiet-button" data-live-refresh="${esc(result.id)}"><i data-lucide="refresh-cw"></i> Refresh provider price</button><button type="button" class="quiet-button" data-live-copy="${esc(result.id)}"><i data-lucide="copy"></i> Use as quote starting point</button></div></article>`).join("");
    globalThis.lucide?.createIcons(); updateButtons();
  }
  $("#live-search").addEventListener("click", async () => {
    const request = input(); if (!request || !connection?.configured || !request.cost_consent || busy) return;
    busy = true; const currentOperation = ++operation; updateButtons();
    $("#live-message").textContent = "Querying Duffel and refreshing candidate prices. No booking or payment is submitted…";
    results = []; $("#live-results").replaceChildren();
    try {
      const data = await post("/api/flights/search", request);
      if (currentOperation !== operation) return;
      searchedInput = request; searchId = data.searchId;
      const overLayoverLimit = data.itineraries.filter(itinerary => itineraryLayoverMinutes(itinerary) > P.settings.maxLayoverMinutes).length;
      results = data.itineraries.filter(itinerary => itineraryLayoverMinutes(itinerary) <= P.settings.maxLayoverMinutes);
      $("#live-message").textContent = `${results.length} refreshed flight itineraries within the ${P.settings.maxLayoverMinutes / 60}h maximum layover · ${overLayoverLimit} longer itineraries excluded · ${data.mode === "live" ? "LIVE" : "TEST DATA ONLY"}. ${data.scope} ${data.warnings.join(" ")}`;
      renderResults();
    } catch (error) { if (currentOperation === operation) $("#live-message").textContent = `Search failed: ${error.message}`; }
    finally { busy = false; updateButtons(); }
  });
  $("#live-results").addEventListener("click", async event => {
    const refresh = event.target.closest("[data-live-refresh]");
    const copy = event.target.closest("[data-live-copy]");
    if (refresh && !busy && $("#live-cost-consent").checked) {
      busy = true; const currentOperation = operation; updateButtons();
      try {
        const updated = await post("/api/flights/refresh", { search_id: searchId, itinerary_id: refresh.dataset.liveRefresh, cost_consent: true });
        if (operation !== currentOperation) return;
        results = results.map(result => result.id === updated.id ? updated : result); renderResults();
        $("#live-message").textContent = updated.priceChanged ? "Provider price changed; the displayed flight fare is updated." : "Provider flight fare refreshed. Not a guaranteed or held total.";
      } catch (error) {
        if (operation === currentOperation) { results = results.filter(result => result.id !== refresh.dataset.liveRefresh); renderResults(); $("#live-message").textContent = `Offer removed: ${error.message}`; }
      } finally { busy = false; updateButtons(); }
    }
    if (copy && !busy) {
      const result = results.find(item => item.id === copy.dataset.liveCopy);
      if (!result || !result.live || Date.parse(result.expiresAt) <= Date.now()) { P.toast("Test or expired offers cannot become real quote starting points."); return; }
      const form = $("#quote-form");
      $("#clear-selected-legs").click();
      form.elements.mode.value = "separate"; form.elements.base.value = "0";
      form.elements.airport.value = searchedInput.origin; form.elements.destination.value = searchedInput.destination;
      form.elements.start.value = searchedInput.departure_date; form.elements.nights.value = C.daysBetween(searchedInput.departure_date, searchedInput.return_date);
      form.elements.flights.value = result.amount; form.elements.flightMinutes.value = result.journeys[0].minutes;
      form.elements.hotel.value = "0"; form.elements.bags.value = "0";
      form.elements.transfer.value = "0"; form.elements.extras.value = "0"; form.elements.meals.value = "0"; form.elements.url.value = "";
      form.elements.benefitAccepted.checked = false; form.elements.finalAcknowledged.checked = false; form.elements.confirmed.checked = false;
      form.elements.direct.checked = result.journeys.every(journey => journey.segments.length === 1);
      form.elements.stops.value = String(Math.max(...result.journeys.map(journey => journey.segments.length - 1)));
      form.elements.layoverMinutes.value = String(itineraryLayoverMinutes(result));
      form.elements.priceStage.value = "estimate"; form.elements.priceStage.dispatchEvent(new Event("change"));
      form.elements.title.value = "Flight fare via Duffel — accommodation not yet checked";
      P.switchView("quotes"); P.toast("Flight amount copied as an unverified starting point. Add hotel, bags and fees; verify every supplier before saving a final price.");
    }
  });
  for (const id of ["live-origin", "live-destination", "live-date", "live-nights"]) $("#" + id).addEventListener("change", () => { clearResults(); if (id === "live-nights") syncDates(); $("#live-message").textContent = "Search details changed; previous offers cleared."; updateButtons(); });
  $("#live-cost-consent").addEventListener("change", updateButtons);
  $("#live-status-refresh").addEventListener("click", checkConnection);
  document.addEventListener("planner:updated", sync);
  globalThis.LiveFlights = { checkConnection };
  sync();
  if (location.protocol === "file:" || location.hostname.endsWith(".github.io")) checkConnection();
  else $("#live-connection").textContent = "Optional only. Open this section to check Duffel configuration; no provider request is made until you explicitly consent and search.";
})();