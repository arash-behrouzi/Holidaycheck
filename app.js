(function () {
  "use strict";
  const C = HolidayCore;
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const esc = text => String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const money = number => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(number);
  const nightlyMoney = number => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  const dateLabel = date => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
  const duration = minutes => `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const defaultYear = Math.max(2027, new Date().getFullYear());
  const defaults = () => ({ adults: 2, ages: [4, 6, 8], year: defaultYear, holidayId: "", minNights: 7, maxNights: 12, minHotelStars: 0, minReviewScore: 0, budget: 6000, weights: { cost: 45, comfort: 35, time: 20 }, maxDrive: 90, driving: false, mixFlights: false, confirmedOnly: false, corporateBenefit: false, maxHolidayDrive: 360, roadBreakMinutes: 30, maxLayoverMinutes: 300, driveDestinations: C.destinations.filter(item => item.travelMode === "drive").map(item => item.id), airports: ["DTM", "DUS", "CGN", "FMO", "PAD"], destinations: C.destinations.filter(item => item.travelMode !== "drive").map(item => item.id), costPerKm: 0.30, parkingPerDay: 12, directOnly: true, mealPlan: "all-inclusive", mode: "all", examples: false });
  const nightLabel = () => settings.minNights === settings.maxNights ? String(settings.minNights) : `${settings.minNights}–${settings.maxNights}`;
  let settings = defaults();
  let quotes = [];
  let researchHistory = [];
  let holidays = [];
  let selected = [];
  let ranked = [];
  let visible = 6;
  let calendarRequest = 0;
  let toastTimer;
  let historyTimer;
  let market = { destination: "", airport: "", date: "", nights: 0 };
  const researchSnapshot = {
    checkedAt: "2026-10-31",
    criteria: { start: "2027-03-22", end: "2027-03-29", nights: 7, adults: 2, ages: [7, 7, 10], airport: "DTM", mealPlan: "all-inclusive", maxLayoverMinutes: 300 },
    destinations: [
      {
        id: "AYT", name: "Antalya / Turkish Riviera",
        hotel: { name: "Aydinbey Kings Palace & Spa", price: 1630, room: "Family room · All Inclusive Plus", stars: 5, recommendation: 97, review: 5.7, scale: 6, reviewCount: 17535, url: "https://www.holidaycheck.de/hi/aydinbey-kings-palace-spa/859de05c-795d-3c57-8271-ee31eca92fe1", packageOffer: { price: 3005, room: "Family room · All Inclusive Plus", url: "https://www.holidaycheck.de/ho/angebote-aydinbey-kings-palace-spa/859de05c-795d-3c57-8271-ee31eca92fe1/package", note: "€140 cashback shown separately; gross package price used." } },
        flights: [
          { name: "Cheapest mixed itinerary", price: 1328, direct: false, stops: 1, maxLayoverMinutes: 435, route: "SunExpress via Izmir outbound (7h 15m layover); nonstop return", url: "https://www.kayak.de/flights/DTM-AYT/2027-03-22/2027-03-29/2adults/children-7-7-10?sort=bestflight_a" },
          { name: "Nonstop SunExpress", price: 1799, direct: true, stops: 0, maxLayoverMinutes: 0, route: "Nonstop both ways · 3h 30m outbound / 3h 55m return", url: "https://www.kayak.de/flights/DTM-AYT/2027-03-22/2027-03-29/2adults/children-7-7-10?sort=bestflight_a" }
        ]
      },
      {
        id: "HRG", name: "Hurghada",
        hotel: { name: "Titanic Royal", price: 1559, room: "Family room · All Inclusive", stars: 5, recommendation: 96, review: 5.6, scale: 6, reviewCount: 2728, url: "https://www.holidaycheck.de/hi/titanic-royal/a5f394b6-7870-4022-975e-50ccbc0bfb65", packageOffer: { price: 4091.23, room: "Two-room alternative · All Inclusive Ultra", url: "https://www.holidaycheck.de/ho/angebote-titanic-royal/a5f394b6-7870-4022-975e-50ccbc0bfb65/package?_offer=airport:~DTM~DUS~CGN~FMO~PAD,departureDate:2027-03-22,duration:7,returnDate:2027-03-29,roomType:~GT04-RO%7CST04-DO,rooms=a-a-10-7-7", note: "One-room family setup had no offer; this two-room alternative showed €375 cashback separately." } },
        flights: [
          { name: "Cheapest, self-transfer", price: 1895, originalPrice: "$2,117", direct: false, stops: 2, maxLayoverMinutes: 620, route: "Wizz Air + easyJet via Milan/Naples outbound (self-transfer); Pegasus via Istanbul return", url: "https://www.kayak.com/flights/DTM-HRG/2027-03-22/2027-03-29/2adults/children-7-7-10?sort=bestflight_a", note: "Converted at 1 USD = €0.89509 on 30 Oct 2026; two self-transfers add missed-connection risk." },
          { name: "Best Pegasus itinerary", price: 2526, originalPrice: "$2,822", direct: false, stops: 1, maxLayoverMinutes: 295, route: "Pegasus via Istanbul both ways · about 10–11 hours each way", url: "https://www.kayak.com/flights/DTM-HRG/2027-03-22/2027-03-29/2adults/children-7-7-10?sort=bestflight_a", note: "Converted at 1 USD = €0.89509 on 30 Oct 2026." }
        ]
      },
      {
        id: "PMI", name: "Mallorca",
        hotel: { name: "Grupotel Mallorca Mar", price: 2194, room: "2-bedroom apartment · All Inclusive", stars: 4, recommendation: 87, review: 5.0, scale: 6, reviewCount: 2395, url: "https://www.holidaycheck.de/hi/grupotel-mallorca-mar/1083995e-aa2e-3688-b196-4a71470de4bc", packageOffer: { price: 3956, room: "2-bedroom apartment · All Inclusive · nonstop DUS–PMI", url: "https://www.holidaycheck.de/ho/angebote-grupotel-mallorca-mar/1083995e-aa2e-3688-b196-4a71470de4bc/package?_offer=airport:~DTM~DUS~CGN~FMO~PAD,departureDate:2027-03-22,duration:7,returnDate:2027-03-29,roomType:~GT04-FH%7CST04-AP,rooms=a-a-10-7-7", note: "€170 cashback shown separately; gross package price used." } },
        flights: [], note: "No matching flight fare was verified; Kayak security checks blocked further route searches."
      },
      { id: "BOJ", name: "Burgas", note: "Flight and dated HolidayCheck hotel prices not verified." },
      {
        id: "HER", name: "Crete",
        flights: [],
        hotel: { name: "Anissa Beach & Village", price: null, room: "No separate hotel-only price verified", stars: 4, recommendation: 97, review: 5.5, scale: 6, reviewCount: 5060, url: "https://www.holidaycheck.de/hi/anissa-beach-village/7fc2e18e-a086-3053-9575-ce18c48f69d1", packageOffer: { price: 12112, room: "Private Villa · 4 rooms · Garden View · private pool · All Inclusive", url: "https://www.holidaycheck.de/ho/angebote-anissa-beach-village/7fc2e18e-a086-3053-9575-ce18c48f69d1/package?_offer=airport:~DTM~DUS~CGN~FMO~PAD,departureDate:2027-03-22,duration:7,returnDate:2027-03-29,rooms=a-a-10-7-7", note: "Checked 1 Nov 2026 for 2 adults + ages 7, 7, 10, 22–29 Mar 2027. Includes direct Atlas Jet flights FMO–HER (05:55–10:15) and HER–FMO (12:05–14:35). €12,112 gross; €800 cashback shown separately, €11,312 displayed after cashback. Above the €6,000 budget even after cashback. No standalone flight fare verified." } }
      },
      { id: "TFS", name: "Tenerife", note: "Flight and dated HolidayCheck hotel prices not verified." },
      { id: "LPA", name: "Gran Canaria", note: "HolidayCheck showed hotel listings but no dated, priced hotel-only offers for this exact week. Flight price not verified." },
      { id: "AGP", name: "Costa del Sol", note: "Flight and dated HolidayCheck hotel prices not verified." },
      { id: "RHO", name: "Rhodes", note: "Checked 1 Nov 2026: HolidayCheck had no package offer for TUI KIDS CLUB Alex Beach for 2 adults + ages 7, 7, 10 on 22–29 Mar 2027. Standalone flight and hotel-only prices not verified." },
      { id: "KGS", name: "Kos", note: "Checked 1 Nov 2026: HolidayCheck had no package offer for Caravia Beach Hotel for 2 adults + ages 7, 7, 10 on 22–29 Mar 2027. Standalone flight and hotel-only prices not verified." },
      { id: "CFU", name: "Corfu", note: "Checked 1 Nov 2026: HolidayCheck had no package offer for Grecotel LUXME Costa Botanica for 2 adults + ages 7, 7, 10 on 22–29 Mar 2027. Standalone flight and hotel-only prices not verified." }
    ]
  };
  function icons() { globalThis.lucide?.createIcons(); }
  function toast(message) { $("#toast").textContent = message; $("#toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 4500); }
  function safeSettings(input) {
    const result = defaults();
    if (!input || typeof input !== "object") return result;
    if (Number.isInteger(input.nights) && input.nights >= 1 && input.nights <= 35) result.minNights = result.maxNights = input.nights;
    const bounds = { adults: [1, 6], minNights: [1, 35], maxNights: [1, 35], minHotelStars: [0, 5], minReviewScore: [0, 10], year: [2026, 2040], budget: [1500, 15000], maxDrive: [30, 360], maxHolidayDrive: [60, 720], roadBreakMinutes: [0, 180], maxLayoverMinutes: [0, 1440], costPerKm: [0, 3], parkingPerDay: [0, 100] };
    for (const [key, [min, max]] of Object.entries(bounds)) if (typeof input[key] === "number" && Number.isFinite(input[key]) && input[key] >= min && input[key] <= max && (["costPerKm", "parkingPerDay", "minHotelStars", "minReviewScore"].includes(key) || Number.isInteger(input[key]))) result[key] = input[key];
    if (Array.isArray(input.ages) && input.ages.length <= 6 && input.ages.every(age => Number.isInteger(age) && age >= 0 && age <= 17)) result.ages = [...input.ages];
    if (result.minNights > result.maxNights) result.maxNights = result.minNights;
    for (const key of ["directOnly", "examples", "driving", "mixFlights", "confirmedOnly", "corporateBenefit"]) if (typeof input[key] === "boolean") result[key] = input[key];
    if (Array.isArray(input.driveDestinations)) result.driveDestinations = input.driveDestinations.filter(id => C.destinations.some(item => item.id === id && item.travelMode === "drive"));
    if (["all-inclusive", "full-board", "room-only", "any"].includes(input.mealPlan)) result.mealPlan = input.mealPlan;
    else if (typeof input.allInclusive === "boolean") result.mealPlan = input.allInclusive ? "all-inclusive" : "any";
    for (const key of ["cost", "comfort", "time"]) if (typeof input.weights?.[key] === "number" && Number.isFinite(input.weights[key]) && input.weights[key] >= 0 && input.weights[key] <= 100) result.weights[key] = input.weights[key];
    for (const [key, valid] of [["airports", C.airports.map(item => item.code)], ["destinations", C.destinations.map(item => item.id)]]) if (Array.isArray(input[key])) result[key] = [...new Set(input[key].filter(item => valid.includes(item)))];
    if ((result.driving ? ["all", "holiday-home", "holiday-park"] : ["all", "package", "separate"]).includes(input.mode)) result.mode = input.mode;
    if (typeof input.holidayId === "string") result.holidayId = input.holidayId.slice(0, 160);
    return result;
  }
  function safeResearchHistory(input) {
    if (!Array.isArray(input)) return [];
    return input.filter(item => item && typeof item.id === "string" && C.validDate(item.date) && item.criteria && typeof item.criteria === "object" && typeof item.status === "string")
      .slice(0, 365).map(item => ({
        id: item.id.slice(0, 4000), date: item.date, searchedAt: String(item.searchedAt || "").slice(0, 40),
        criteria: item.criteria, criteriaSummary: String(item.criteriaSummary || "").slice(0, 1200), status: item.status.slice(0, 300),
        resultsSummary: String(item.resultsSummary || "").slice(0, 5000), results: Array.isArray(item.results) ? item.results.slice(0, 20) : []
      }));
  }
  function persist() {
    try { localStorage.setItem("schoolsout-v1", JSON.stringify({ version: 1, settings, quotes, researchHistory })); }
    catch { toast("Browser storage is unavailable or full. Export your plan to keep a copy."); }
  }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem("schoolsout-v1") || "null");
      if (saved?.version === 1) { settings = safeSettings(saved.settings); quotes = (saved.quotes || []).slice(0, 300).map(C.validateQuote); researchHistory = safeResearchHistory(saved.researchHistory); }
    } catch { toast("Saved data could not be loaded. A fresh plan is ready."); }
  }
  function renderAges() {
    $("#ages").innerHTML = settings.ages.map((age, index) => `<label>Child ${index + 1} age<input aria-label="Child ${index + 1} age on departure" data-age="${index}" type="number" min="0" max="17" value="${age}"></label>`).join("");
  }
  function syncControls() {
    $("#adults").value = settings.adults;
    $("#children").value = settings.ages.length;
    renderAges();
    const years = [...new Set([2026, 2027, 2028, 2029, 2030, defaultYear, defaultYear + 1, defaultYear + 2, settings.year])].sort();
    $("#year").innerHTML = years.map(year => `<option value="${year}" ${year === settings.year ? "selected" : ""}>${year}</option>`).join("");
    $("#min-nights").value = settings.minNights;
    $("#max-nights").value = settings.maxNights;
    $("#budget").value = settings.budget;
    $("#max-drive").value = settings.maxDrive;
    $("#cost-km").value = settings.costPerKm;
    $("#parking").value = settings.parkingPerDay;
    $("#direct").checked = settings.directOnly;
    $("#one-stop").checked = !settings.directOnly;
    $("#max-layover").value = settings.maxLayoverMinutes / 60;
    $("#meal-plan").value = settings.mealPlan;
    $("#examples").checked = settings.examples;
    for (const key of ["cost", "comfort", "time"]) $("#weight-" + key).value = settings.weights[key];
    $("#airports").innerHTML = C.airports.map(airport => `<label class="airport-row"><input type="checkbox" data-airport="${airport.code}" ${settings.airports.includes(airport.code) ? "checked" : ""}><strong>${airport.code}</strong><span class="airport-name">${esc(airport.name.split(" /")[0])}</span><span>${airport.km} km · ${airport.minutes} min</span></label>`).join("");
    $("#destinations").innerHTML = C.destinations.filter(item => item.travelMode !== "drive").map(destination => `<label class="check"><input type="checkbox" data-destination="${destination.id}" ${settings.destinations.includes(destination.id) ? "checked" : ""}> ${esc(destination.name)}</label>`).join("");
    all("[data-mode]").forEach(button => { button.classList.toggle("selected", button.dataset.mode === settings.mode); button.setAttribute("aria-pressed", button.dataset.mode === settings.mode); });
  }
  const holiday = () => holidays.find(item => item.id === settings.holidayId);
  function setHolidays(items, status) {
    const fallback = C.fallbackHolidays[settings.year] || [];
    const previousHoliday = holidays.find(item => item.id === settings.holidayId) || fallback.find(item => item.id === settings.holidayId || item.providerId === settings.holidayId);
    holidays = items.map(C.extendConnectedHoliday).filter(item => C.validDate(item.start) && C.validDate(item.end) && item.start <= item.end && item.end >= today).sort((first, second) => first.start.localeCompare(second.start));
    if (!holidays.some(item => item.id === settings.holidayId)) {
      const previousStart = previousHoliday?.schoolStart || previousHoliday?.start;
      const previousEnd = previousHoliday?.schoolEnd || previousHoliday?.end;
      const matchingHoliday = holidays.find(item => (item.schoolStart || item.start) === previousStart && (item.schoolEnd || item.end) === previousEnd || item.id === previousHoliday?.providerId);
      settings.holidayId = (matchingHoliday || holidays.find(item => /summer/i.test(item.name)) || holidays[0])?.id || "";
    }
    $("#holiday").innerHTML = holidays.length ? holidays.map(item => `<option value="${esc(item.id)}" ${settings.holidayId === item.id ? "selected" : ""}>${esc(item.name)}</option>`).join("") : '<option value="">No dates available</option>';
    $("#calendar-status").textContent = status;
    update();
  }
  async function loadCalendar() {
    const request = ++calendarRequest;
    const year = settings.year;
    const preferredHolidayId = settings.holidayId;
    const offlineNote = year === 2027 ? "Offline NRW reference includes Easter and summer dates for 2027." : "Offline reference: official NRW summer dates only.";
    setHolidays(C.fallbackHolidays[year] || [], `${offlineNote} Checking public calendars…`);
    $("#refresh-calendar").disabled = true;
    try {
      const response = await fetch(`https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-NW&languageIsoCode=EN&validFrom=${year}-01-01&validTo=${year}-12-31`, { signal: AbortSignal.timeout(9000) });
      if (!response.ok) throw new Error("Calendar unavailable");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Unexpected calendar format");
      const items = data.map(item => ({ id: item.id, name: item.name?.[0]?.text || "School holiday", start: item.startDate, end: item.endDate }));
      if (!items.length || items.some(item => !C.validDate(item.start) || !C.validDate(item.end))) throw new Error("No usable calendar data");
      if (request === calendarRequest) {
        if (items.some(item => item.id === preferredHolidayId)) settings.holidayId = preferredHolidayId;
        setHolidays(items, `OpenHolidays API · NRW · refreshed ${dateLabel(today)}. Verify with your school; movable days are not included.`);
      }
    } catch {
      if (request !== calendarRequest) return;
      try {
        const response = await fetch(`https://ferien-api.de/api/v1/holidays/NW/${year}`, { signal: AbortSignal.timeout(7000) });
        if (!response.ok) throw new Error("Calendar unavailable");
        const data = await response.json();
        if (!Array.isArray(data) || !data.length) throw new Error("No data");
        if (request === calendarRequest) {
          const items = data.map(item => ({ id: item.slug || item.name + item.start, name: item.name, start: item.start.slice(0, 10), end: item.end.slice(0, 10) }));
          if (items.some(item => item.id === preferredHolidayId)) settings.holidayId = preferredHolidayId;
          setHolidays(items, "ferien-api.de · NRW · verify inclusive end dates with the official calendar.");
        }
      } catch {
        if (request === calendarRequest) setHolidays(C.fallbackHolidays[year] || [], C.fallbackHolidays[year] ? `Public calendar unavailable. ${offlineNote} Verify dates with the official NRW calendar.` : "Public calendar unavailable. No verified offline dates for this year. Try refresh or another year.");
      }
    } finally { if (request === calendarRequest) $("#refresh-calendar").disabled = false; }
  }
  function empty(title, description) { return `<div class="empty"><i data-lucide="compass"></i><h3>${esc(title)}</h3><p>${esc(description)}</p></div>`; }
  function quoteCard(quote, index) {
    if (C.travelModeOf(quote) === "drive") return driveCard(quote);
    const destination = C.destinations.find(item => item.id === quote.destination);
    const airport = C.airports.find(item => item.code === quote.airport);
    const month = Number(quote.start.slice(5, 7));
    const warning = quote.demo ? "Illustrative price, route & family-room scenario. Not bookable inventory." : `Checked ${dateLabel(quote.checkedAt)} · Reconfirm price and availability before booking.`;
    return `<article class="trip-card" style="animation-delay:${Math.min(index, 5) * 35}ms">
      <div class="trip-image"><img src="https://images.unsplash.com/${destination.image}?auto=format&fit=crop&w=800&q=80" alt="Coastal travel inspiration, not the quoted hotel" loading="${index < 2 ? "eager" : "lazy"}"><span class="image-label">${quote.demo ? "Planning example" : "Your checked quote"} · ${quote.mode === "package" ? "Pauschalreise" : "Flight + hotel"}</span><span class="image-caption">Coastal inspiration · not hotel imagery</span></div>
      <div class="trip-body"><div class="card-meta"><span class="eyebrow">${esc(destination.note)}</span><span class="score">${quote.score}/100 fit</span></div><h3>${esc(destination.name)}<span class="trip-subtitle">, ${esc(destination.country)}</span></h3><p class="trip-subtitle">${esc(quote.title)}</p>
      <div class="trip-tags"><span><i data-lucide="calendar-days"></i>${dateLabel(quote.start)} · ${quote.nights} nights</span><span><i data-lucide="utensils"></i>${esc(C.mealPlanLabel(quote))}</span><span><i data-lucide="users-round"></i>${quote.adults + quote.ages.length} guests</span></div>
      <div class="route-line"><div><strong>${airport.code}</strong><span class="arrow">→</span><strong>${destination.id}</strong><p>${airport.minutes} min airport drive · ${quote.stops === 0 || quote.direct ? "direct" : quote.stops === 1 ? "1 stop" : quote.stops === null ? "stops unverified" : `${quote.stops} stops`}</p></div><div class="time"><strong>${duration(quote.journey)}</strong><br>door to resort</div></div>
      <div class="card-bottom"><div><div class="price">${money(quote.total)}</div><div class="nightly-price">${nightlyMoney(C.pricePerNight(quote, settings))} / night</div><div class="price-note">whole family · incl. airport travel</div></div><button class="compare-toggle" data-compare="${esc(quote.id)}" aria-pressed="${selected.some(item => item.id === quote.id)}"><i data-lucide="${selected.some(item => item.id === quote.id) ? "check" : "plus"}"></i>Compare</button></div>
      <p class="card-warning">${esc(warning)}${destination.season.includes(month) ? "" : " Outside the indicative beach season; check temperatures and pool heating."}</p>${quote.demo && quote.meals ? `<p class="card-warning">Includes ${money(quote.meals)} illustrative extra meals / drinks budget.</p>` : ""}</div></article>`;
  }
  function driveCard(quote) {
    const destination = C.destinations.find(item => item.id === quote.destination);
    return `<article class="trip-card"><div class="trip-image"><img src="https://images.unsplash.com/${destination.image}?auto=format&fit=crop&w=800&q=80" alt="Regional inspiration, not the quoted property"><span class="image-label">${quote.demo ? "Planning example" : "Saved quote"} · ${esc(C.bookingLabel(quote))}</span></div><div class="trip-body"><div class="card-meta"><span class="eyebrow">${esc(destination.country)}</span><span class="score">${quote.score}/100 fit</span></div><h3>${esc(destination.name)}</h3><p class="trip-subtitle">${esc(quote.title)}</p><div class="trip-tags"><span>${dateLabel(quote.start)} · ${quote.nights} nights</span><span>${esc(C.mealPlanLabel(quote))}</span></div><div class="route-line"><div><strong>Dortmund → ${esc(destination.name)}</strong><p>${quote.driveKm} km each way · ${settings.roadBreakMinutes ?? 30} min breaks</p></div><div class="time"><strong>${duration(quote.journey)}</strong><br>drive + breaks</div></div><div class="card-bottom"><div><div class="price">${money(quote.total)}</div><div class="nightly-price">${nightlyMoney(C.pricePerNight(quote, settings))} / night</div><div class="price-note">whole family · incl. return driving</div></div><button class="compare-toggle" data-compare="${esc(quote.id)}" aria-pressed="${selected.some(item => item.id === quote.id)}">Compare</button></div><p class="card-warning">${quote.demo ? "Illustrative accommodation, meals and route. No availability checked." : `Checked ${dateLabel(quote.checkedAt)}; recheck before booking.`}</p></div></article>`;
  }
  function renderResearch(selectedHoliday) {
    const snapshot = researchSnapshot.criteria;
    const summary = $("#research-summary");
    const body = $("#research-results");
    const warning = [];
    const snapshotMismatch = [];
    if (settings.adults !== snapshot.adults || [...settings.ages].sort((a, b) => a - b).join(",") !== [...snapshot.ages].sort((a, b) => a - b).join(",")) snapshotMismatch.push("traveler ages/count differ");
    if (settings.year !== 2027 || !selectedHoliday || selectedHoliday.schoolStart > snapshot.start || selectedHoliday.schoolEnd < snapshot.end) snapshotMismatch.push("selected holiday does not contain 22–29 Mar 2027");
    if (settings.minNights > snapshot.nights || settings.maxNights < snapshot.nights) snapshotMismatch.push("7 nights is outside the selected stay range");
    if (!settings.airports.includes(snapshot.airport)) snapshotMismatch.push("DTM was not selected");
    if (settings.mealPlan !== snapshot.mealPlan && settings.mealPlan !== "any") snapshotMismatch.push("meal-plan filter differs");
    if (settings.mode !== "separate") snapshotMismatch.push("snapshot uses separate flight + hotel bookings");
    warning.push(...snapshotMismatch);
    summary.innerHTML = `<strong>Provider snapshot checked ${dateLabel(researchSnapshot.checkedAt)}</strong><p>${dateLabel(snapshot.start)}–${dateLabel(snapshot.end)} · ${snapshot.nights} nights · ${snapshot.adults} adults + ages ${snapshot.ages.join(", ")} · DTM fare search only · All Inclusive · current family budget ${money(settings.budget)} · max layover ${settings.maxLayoverMinutes / 60}h. Star minimum ${settings.minHotelStars || "any"}; review minimum ${settings.minReviewScore ? settings.minReviewScore.toFixed(1) + "/10" : "any"}. Other selected airports, dates and durations were not searched. Separate flight + hotel and same-hotel HolidayCheck package prices are provider snapshots, not confirmed checkout prices.</p>${warning.length ? `<p class="research-warning">Current controls differ from this snapshot: ${esc(warning.join("; "))}. Adjust the main filters or treat these rows as reference only.</p>` : ""}`;
    const researchedDestinations = researchSnapshot.destinations.filter(item => settings.destinations.includes(item.id));
    $("#research-count").textContent = String(snapshotMismatch.length ? 0 : researchedDestinations.length);
    if (snapshotMismatch.length) {
      body.innerHTML = `<tr class="research-row-pending"><td colspan="6"><strong>No verified snapshot matches the current criteria.</strong><span class="research-detail">This table contains a fixed search for ${dateLabel(snapshot.start)}–${dateLabel(snapshot.end)}, ${snapshot.adults} adults, ages ${snapshot.ages.join(", ")}, DTM, All Inclusive, 7 nights, and separate flight + hotel bookings. It does not fetch new provider prices when filters change.</span></td></tr>`;
      recordResearchHistory(selectedHoliday, snapshotMismatch, researchedDestinations);
      return;
    }
    const rows = [];
    for (const destination of researchSnapshot.destinations) {
      if (!settings.destinations.includes(destination.id)) continue;
      if (!destination.hotel) {
        rows.push(`<tr class="research-row-pending"><td class="research-destination">${esc(destination.name)}</td><td colspan="4"><span class="research-status pending">Not priced</span><span class="research-detail">${esc(destination.note)}</span></td><td><span class="research-status pending">Incomplete</span></td></tr>`);
        continue;
      }
      const hotel = destination.hotel;
      const packageOffer = hotel.packageOffer;
      const reviewOutOfTen = hotel.review / hotel.scale * 10;
      const hotelReasons = [];
      if (hotel.stars < settings.minHotelStars) hotelReasons.push(`below ${settings.minHotelStars}+ stars`);
      if (reviewOutOfTen < settings.minReviewScore) hotelReasons.push(`below ${settings.minReviewScore.toFixed(1)}/10 review minimum`);
      if (settings.mealPlan !== "any" && settings.mealPlan !== snapshot.mealPlan) hotelReasons.push("meal plan differs");
      const packageReasons = [...hotelReasons];
      if (packageOffer && packageOffer.price > settings.budget) packageReasons.push(`over ${money(settings.budget)} budget`);
      const packageCell = packageOffer
        ? `<a href="${esc(packageOffer.url)}" target="_blank" rel="noopener noreferrer">${money(packageOffer.price)} · HolidayCheck</a><span class="research-detail">${esc(packageOffer.room)}</span>${packageOffer.note ? `<span class="research-detail">${esc(packageOffer.note)}</span>` : ""}${packageReasons.length ? `<span class="research-status outside">Outside filters: ${esc(packageReasons.join(", "))}</span>` : `<span class="research-status">Same hotel · package</span>`}`
        : '<span class="research-status pending">No same-hotel package verified</span>';
      if (!destination.flights.length) {
        const status = packageReasons.length ? `Outside filters: ${packageReasons.join(", ")}` : packageOffer ? "Package offer verified; separate prices unavailable" : "Hotel priced; flight missing";
        const flightCell = packageOffer ? '<span class="research-status pending">No standalone fare</span><span class="research-detail">Package includes flights; separate fare not verified.</span>' : `<span class="research-status pending">No verified fare</span><span class="research-detail">${esc(destination.note || "No dated fare verified.")}</span>`;
        const hotelPrice = hotel.price != null ? `<span class="research-price">${money(hotel.price)}</span>` : '<span class="research-status pending">No dated hotel-only price verified</span>';
        rows.push(`<tr class="research-row-${packageReasons.length ? "outside" : "pending"}"><td class="research-destination">${esc(destination.name)}</td><td>${flightCell}</td><td><a href="${esc(hotel.url)}" target="_blank" rel="noopener noreferrer">${esc(hotel.name)}</a><span class="research-detail">${hotel.stars} stars · ${hotel.recommendation}% · ${hotel.review}/${hotel.scale} from ${hotel.reviewCount.toLocaleString("en-US")} reviews · ${esc(hotel.room)}</span>${hotelPrice}</td><td>${packageCell}</td><td>—</td><td><span class="research-status ${packageReasons.length ? "outside" : "pending"}">${esc(status)}</span></td></tr>`);
        continue;
      }
      for (const flight of destination.flights) {
        const total = flight.price + hotel.price;
        const reasons = [...hotelReasons];
        if (settings.directOnly && flight.stops !== 0) reasons.push("not nonstop");
        if (!settings.directOnly && flight.stops > 1) reasons.push("more than 1 stop");
        if (!flight.direct && flight.maxLayoverMinutes > settings.maxLayoverMinutes) reasons.push(`layover ${duration(flight.maxLayoverMinutes)} exceeds ${settings.maxLayoverMinutes / 60}h limit`);
        if (!settings.airports.includes(snapshot.airport)) reasons.push("DTM not selected");
        if (total > settings.budget) reasons.push(`over ${money(settings.budget)} budget`);
        const status = reasons.length ? `Outside filters: ${reasons.join(", ")}` : "Matches current filters";
        rows.push(`<tr class="research-row-${reasons.length ? "outside" : ""}"><td class="research-destination">${esc(destination.name)}<span class="research-detail">${esc(flight.name)}</span></td><td><a href="${esc(flight.url)}" target="_blank" rel="noopener noreferrer">${money(flight.price)} · Kayak</a><span class="research-detail">${esc(flight.originalPrice ? `${flight.originalPrice} · ` : "")}${esc(flight.route)}</span>${flight.note ? `<span class="research-detail">${esc(flight.note)}</span>` : ""}</td><td><a href="${esc(hotel.url)}" target="_blank" rel="noopener noreferrer">${esc(hotel.name)}</a><span class="research-detail">${hotel.stars} stars · ${hotel.recommendation}% · ${hotel.review}/${hotel.scale} from ${hotel.reviewCount.toLocaleString("en-US")} reviews</span><span class="research-detail">${esc(hotel.room)}</span><span class="research-price">${money(hotel.price)}</span></td><td>${packageCell}</td><td class="research-total">${money(total)}</td><td><span class="research-status ${reasons.length ? "outside" : ""}">${esc(status)}</span></td></tr>`);
      }
    }
    body.innerHTML = rows.length ? rows.join("") : '<tr><td colspan="5">No research rows match the selected destinations.</td></tr>';
    $("#research-count").textContent = String(researchSnapshot.destinations.filter(item => settings.destinations.includes(item.id)).length);
    recordResearchHistory(selectedHoliday, [], researchedDestinations);
  }
  function recordResearchHistory(selectedHoliday, mismatch, selectedDestinations) {
    if (!selectedHoliday || $("#calendar-status").textContent.includes("Checking public calendars")) return;
    const criteria = {
      adults: settings.adults, ages: [...settings.ages], year: settings.year, holidayId: settings.holidayId,
      schoolStart: selectedHoliday.schoolStart, schoolEnd: selectedHoliday.schoolEnd, travelStart: selectedHoliday.start, travelEnd: selectedHoliday.end,
      minNights: settings.minNights, maxNights: settings.maxNights, maxLayoverMinutes: settings.maxLayoverMinutes, airports: [...settings.airports].sort(), destinations: [...settings.destinations].sort(),
      mealPlan: settings.mealPlan, mode: settings.mode, directOnly: settings.directOnly, minHotelStars: settings.minHotelStars, minReviewScore: settings.minReviewScore, budget: settings.budget
    };
    const id = `${today}|${JSON.stringify(criteria)}`;
    if (researchHistory.some(item => item.id === id)) return;
    const results = selectedDestinations.map(destination => ({
      destination: destination.name, note: destination.note || "",
      flights: (destination.flights || []).map(flight => ({ name: flight.name, price: flight.price, originalPrice: flight.originalPrice || "", currency: "EUR", route: flight.route, direct: flight.direct, stops: flight.stops, maxLayoverMinutes: flight.maxLayoverMinutes, note: flight.note || "", url: flight.url })),
      hotel: destination.hotel?.price != null ? { name: destination.hotel.name, price: destination.hotel.price, stars: destination.hotel.stars, recommendation: destination.hotel.recommendation, review: destination.hotel.review, scale: destination.hotel.scale, reviewCount: destination.hotel.reviewCount, room: destination.hotel.room, url: destination.hotel.url } : null,
      package: destination.hotel?.packageOffer ? { price: destination.hotel.packageOffer.price, room: destination.hotel.packageOffer.room, note: destination.hotel.packageOffer.note || "", url: destination.hotel.packageOffer.url } : null
    }));
    const priced = results.filter(result => result.hotel).length;
    const packages = results.filter(result => result.package).length;
    const resultSummary = mismatch.length ? `No matching captured provider snapshot: ${mismatch.join("; ")}.` : `${priced} destinations have hotel-only prices; ${packages} package offers and ${results.reduce((count, result) => count + result.flights.length, 0)} standalone flight options are recorded. Provider values are snapshots, not confirmed checkout prices.`;
    const entry = {
      id, date: today, searchedAt: new Date().toISOString(), criteria,
      criteriaSummary: `${selectedHoliday.name} · ${dateLabel(selectedHoliday.start)}–${dateLabel(selectedHoliday.end)} · ${settings.adults} adults + ages ${settings.ages.join(", ")} · ${nightLabel()} nights · ${settings.airports.join(", ")} · ${settings.mealPlan} · max layover ${settings.maxLayoverMinutes / 60}h · ${settings.mode}`,
      status: mismatch.length ? "Criteria do not match captured results" : "Provider snapshot displayed",
      resultsSummary: resultSummary, results
    };
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      if (researchHistory.some(item => item.id === id)) return;
      researchHistory.unshift(entry);
      researchHistory = researchHistory.slice(0, 365);
      persist();
      renderSearchHistory();
    }, 650);
  }
  function renderSearchHistory() {
    const count = $("#history-count");
    const container = $("#search-history");
    if (!count || !container) return;
    count.textContent = String(researchHistory.length);
    if (!researchHistory.length) {
      container.innerHTML = '<p class="field-note">No searches have been recorded yet. Opening a distinct set of criteria in Provider results creates a dated summary here.</p>';
      return;
    }
    const groups = new Map();
    for (const entry of researchHistory) groups.set(entry.date, [...(groups.get(entry.date) || []), entry]);
    container.innerHTML = [...groups].map(([date, entries]) => `<section class="history-day"><h3>${dateLabel(date)} <small>${entries.length} ${entries.length === 1 ? "search" : "searches"}</small></h3>${entries.map(entry => `<div class="saved-quote history-entry"><div class="history-entry-heading"><strong>${esc(entry.criteriaSummary)}</strong><span class="research-status ${entry.status === "Provider snapshot displayed" ? "" : "pending"}">${esc(entry.status)}</span></div><p>${esc(entry.resultsSummary)}</p>${entry.results?.length ? `<details><summary>Recorded options</summary><ul>${entry.results.map(result => { const flights = result.flights?.length ? result.flights.map(flight => `${flight.name}: ${money(flight.price)}${flight.direct ? " nonstop" : ` · ${flight.stops ?? "?"} stops · max layover ${flight.maxLayoverMinutes ?? "?"} min`}`).join("; ") : "No verified flight fare"; const hotel = result.hotel ? `Hotel: ${result.hotel.name}, ${money(result.hotel.price)}, ${result.hotel.stars} stars, ${result.hotel.recommendation}% / ${result.hotel.review}/${result.hotel.scale} (${result.hotel.reviewCount} reviews)` : "No dated hotel price"; const packageText = result.package ? `Same-hotel package: ${money(result.package.price)} · ${result.package.room}` : "No same-hotel package price"; return `<li><strong>${esc(result.destination)}</strong> · ${esc(flights)} · ${esc(hotel)} · ${esc(packageText)}</li>`; }).join("")}</ul></details>` : ""}<small>Recorded ${esc(entry.searchedAt ? new Date(entry.searchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "time unavailable")}</small></div>`).join("")}</section>`).join("");
  }
  function update() {
    const selectedHoliday = holiday();
    $("#family-summary").textContent = `${settings.adults + settings.ages.length} travellers. One good plan. Starting from Dortmund.`;
    $("#budget-label").textContent = money(settings.budget);
    $("#drive-label").textContent = duration(settings.maxDrive);
    for (const key of ["cost", "comfort", "time"]) $("#" + key + "-value").textContent = settings.weights[key];
    all("[data-airport]").forEach(input => { const airport = C.airports.find(item => item.code === input.dataset.airport); input.closest("label").classList.toggle("dim", airport.minutes > settings.maxDrive); });
    $("#window-title").textContent = selectedHoliday?.name || "Choose a holiday window";
    const officialDates = selectedHoliday ? `${dateLabel(selectedHoliday.schoolStart)} – ${dateLabel(selectedHoliday.schoolEnd)}` : "";
    const intervalNote = selectedHoliday && (selectedHoliday.start !== selectedHoliday.schoolStart || selectedHoliday.end !== selectedHoliday.schoolEnd)
      ? ` · official school break ${officialDates}; connected weekends/public holidays included`
      : " · connected weekends/public holidays checked";
    $("#window-dates").textContent = selectedHoliday ? `${dateLabel(selectedHoliday.start)} – ${dateLabel(selectedHoliday.end)} · ${nightLabel()} nights away${intervalNote}` : "Refresh the calendar or select another year.";
    $("#departure-count").textContent = C.departures(selectedHoliday, settings.minNights, today).length;
    const examples = settings.examples ? C.demoQuotes(settings, selectedHoliday, today) : [];
    ranked = C.rank([...quotes, ...examples], settings, selectedHoliday, today);
    selected = selected.map(item => {
      const current = [...quotes, ...examples].find(quote => quote.id === item.id);
      return current || item;
    });
    $("#data-label").textContent = settings.examples ? "Planning examples, not live offers." : "Your saved quotes, not a live price feed.";
    $("#data-note").textContent = settings.examples ? "Prices, routes and room availability in examples are illustrative. Add checked quotes for a real comparison." : "Prices are as entered and may have changed. Reconfirm availability and five-person occupancy with the provider.";
    $("#results-description").textContent = `${ranked.length} matching ${settings.examples ? "quotes & examples" : "saved quotes"} · ${settings.adults} adults + ${settings.ages.length} children · ${nightLabel()} nights`;
    $("#results").innerHTML = ranked.length ? ranked.slice(0, visible).map(quoteCard).join("") : empty("No matching options yet", settings.examples ? "Try a higher budget, more airports, a shorter stay or a different holiday. No route or availability is guaranteed." : "Add a checked quote in My quotes, or include planning examples. Quotes must match your dates, family, budget and filters.");
    $("#show-more").hidden = ranked.length <= visible;
    $("#compare-count").textContent = selected.length;
    $("#quote-count").textContent = quotes.length;
    renderComparison();
    renderSavedQuotes();
    renderSearch();
    renderResearch(selectedHoliday);
    renderSearchHistory();
    globalThis.HolidayResearchView?.render({ settings, holiday: selectedHoliday });
    all(".trip-image img").forEach(image => image.addEventListener("error", () => { image.hidden = true; image.parentElement.style.background = "#dbe8df"; }, { once: true }));
    persist();
    icons();
    document.dispatchEvent(new CustomEvent("planner:updated"));
  }
  function renderComparison() {
    if (!selected.length) { $("#comparison").innerHTML = empty("A little perspective helps", "Select Compare on up to three options in Discover. Your shortlist stays here while you adjust your priorities."); return; }
    const rows = [
      ["Status", quote => quote.demo ? "Illustrative example" : `Checked ${dateLabel(quote.checkedAt)}`],
      ["Booking", quote => C.bookingLabel(quote)],
      ["Price verification", quote => C.priceState(quote)],
      ["Accepted instant discount", quote => money(C.acceptedDiscount(quote))],
      ["Potential voucher / cashback", quote => money(C.benefitSaving(quote))],
      ["Meal plan", quote => C.mealPlanLabel(quote)],
      ["Hotel classification", quote => quote.hotelStars ? `${quote.hotelStars} stars` : "Unrated / not provided"],
      ["Guest review", quote => C.reviewOutOfTen(quote) === null ? "Not provided" : `${quote.reviewScore}/${quote.reviewScale} · ${quote.reviewSource} · ${C.reviewOutOfTen(quote).toFixed(1)}/10 converted`],
      ["Family", quote => `${quote.adults} adults · ages ${quote.ages.join(", ") || "none"}`],
      ["Stay", quote => `${dateLabel(quote.start)} · ${quote.nights} nights`],
      ["Route", quote => C.travelModeOf(quote) === "drive" ? `Dortmund · ${quote.driveKm} km each way` : `${quote.airport} · ${C.airports.find(item => item.code === quote.airport).km} km to airport`],
      ["Airlines out / back", quote => quote.flightLegs ? `${quote.flightLegs.outbound.carrier} / ${quote.flightLegs.inbound.carrier}` : "—"],
      ["Package", quote => money(quote.base)], ["Return flights", quote => money(quote.flights)], ["Hotel", quote => money(quote.hotel)],
      ["Return baggage", quote => money(quote.bags)], ["Return transfers", quote => money(quote.transfer)], ["Extras", quote => money(quote.extras)],
      ["Extra meals / drinks", quote => money(quote.meals ?? 0)],
      ["Return road travel / parking / tolls", quote => money(C.totalCost(quote, settings) - quote.base - quote.flights - quote.hotel - quote.bags - quote.transfer - quote.extras - (quote.meals ?? 0) + C.acceptedDiscount(quote))],
      ["Whole-family total", quote => money(C.totalCost(quote, settings))],
      ["Average / night (whole family)", quote => nightlyMoney(C.pricePerNight(quote, settings))],
      ["Outbound door to accommodation", quote => duration(C.journeyMinutes(quote, settings))],
      ["Return journey", quote => duration(C.returnJourneyMinutes(quote, settings))], ["Family comfort", quote => `${quote.comfort}/100`],
      ["Current fit score", quote => `${C.score(quote, settings)}/100`],
      ["Current filters", quote => C.eligible(quote, settings, holiday(), today) ? "Matches" : "Outside current filters"],
      ["Protection", quote => C.travelModeOf(quote) === "drive" ? "Check rental terms, deposit, cleaning charges and tourist taxes" : quote.mode === "package" ? "Check organiser, insolvency protection & terms" : "Separate contracts; check cancellation / schedule-change risks"]
    ];
    $("#comparison").innerHTML = `<div class="comparison-scroll"><table class="comparison-table"><thead><tr><th>At a glance</th>${selected.map(quote => `<th>${esc(C.destinations.find(item => item.id === quote.destination).name)}<small>${esc(quote.title)}</small><button class="remove-compare" data-remove-compare="${esc(quote.id)}">Remove</button></th>`).join("")}</tr></thead><tbody>${rows.map(([label, value]) => `<tr class="${label === "Whole-family total" ? "total-row" : ""}"><td>${esc(label)}</td>${selected.map(quote => `<td>${esc(value(quote))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function renderSavedQuotes() {
    $("#saved-quotes").innerHTML = quotes.length ? quotes.map(quote => `<div class="saved-quote"><div><h3>${esc(quote.title)}</h3><p>${quote.airport} → ${quote.destination} · ${dateLabel(quote.start)} · ${quote.nights} nights · ${money(C.totalCost(quote, settings))} total</p><p class="${C.eligible(quote, settings, holiday(), today) ? "" : "outside"}">${C.eligible(quote, settings, holiday(), today) ? "Matches your current filters" : "Saved, but outside your current filters"} · checked ${dateLabel(quote.checkedAt)}</p></div><div class="actions"><button class="compare-toggle" data-compare="${esc(quote.id)}" aria-pressed="${selected.some(item => item.id === quote.id)}">Compare</button><button class="icon-button" data-delete="${esc(quote.id)}" title="Delete quote" aria-label="Delete ${esc(quote.title)}"><i data-lucide="trash-2"></i></button></div></div>`).join("") : '<p class="field-note">No saved quotes yet. Quotes are stored locally in this browser. Export your plan to back them up.</p>';
  }
  function renderSearch() {
    if (settings.driving) { globalThis.PlannerOptions?.renderDriveSearch(holiday()); return; }
    const lengths = C.stayLengths(settings).filter(nights => C.departures(holiday(), nights, today).length);
    if (!lengths.includes(market.nights)) market.nights = lengths[0] || 0;
    const dates = market.nights ? C.departures(holiday(), market.nights, today) : [];
    const destinations = C.destinations.filter(item => item.travelMode !== "drive" && settings.destinations.includes(item.id));
    const airports = C.airports.filter(item => settings.airports.includes(item.code) && item.minutes <= settings.maxDrive);
    if (!destinations.some(item => item.id === market.destination)) market.destination = destinations[0]?.id || "";
    if (!airports.some(item => item.code === market.airport)) market.airport = airports[0]?.code || "";
    if (!dates.includes(market.date)) market.date = dates[0] || "";
    $("#market-destination").innerHTML = destinations.map(item => `<option value="${item.id}" ${item.id === market.destination ? "selected" : ""}>${esc(item.name)}</option>`).join("");
    $("#market-airport").innerHTML = airports.map(item => `<option value="${item.code}" ${item.code === market.airport ? "selected" : ""}>${item.code} · ${esc(item.name)}</option>`).join("");
    $("#market-date").innerHTML = dates.map(date => `<option value="${date}" ${date === market.date ? "selected" : ""}>${dateLabel(date)}</option>`).join("");
    $("#market-nights").innerHTML = lengths.map(nights => `<option value="${nights}" ${nights === market.nights ? "selected" : ""}>${nights} nights</option>`).join("");
    const destination = destinations.find(item => item.id === market.destination);
    const airport = airports.find(item => item.code === market.airport);
    $("#search-summary").textContent = destination && dates.length ? `${destination.name} · ${dateLabel(market.date)} · ${market.nights} nights · ${settings.adults} adults, child ages ${settings.ages.join(", ") || "none"} · ${airport?.code || "choose an airport"}` : "Choose destinations, airports and a usable holiday window to search.";
    if (!destination || !dates.length || !airport) { $("#search-links").innerHTML = ""; return; }
    const hotelParams = new URLSearchParams({ ss: destination.name, checkin: market.date, checkout: C.addDays(market.date, market.nights), group_adults: settings.adults, group_children: settings.ages.length, no_rooms: 1 });
    settings.ages.forEach(age => hotelParams.append("age", age));
    const hotelFilters = [];
    if (settings.minHotelStars > 0) for (let stars = Math.ceil(settings.minHotelStars); stars <= 5; stars += 1) hotelFilters.push(`class=${stars}`);
    const reviewBand = [6, 7, 8, 9].find(score => score >= settings.minReviewScore);
    if (settings.minReviewScore > 0 && reviewBand) hotelFilters.push(`review_score=${reviewBand * 10}`);
    if (hotelFilters.length) hotelParams.set("nflt", hotelFilters.join(";"));
    const providerLinks = [
      ["HolidayCheck Pauschalreise", "https://www.holidaycheck.de/pauschalreisen", "luggage", "package"],
      ["Booking.com flights", "https://www.booking.com/flights/", "plane", "separate"],
      ["Booking.com hotels", "https://www.booking.com/searchresults.html?" + hotelParams, "bed-double", "separate"]
    ];
    const links = settings.mode === "package" ? providerLinks.filter(link => link[3] === "package") : settings.mode === "separate" ? providerLinks.filter(link => link[3] === "separate") : providerLinks;
    $("#search-links").innerHTML = links.map(([name, url, icon]) => `<a class="quiet-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="${icon}"></i>${esc(name)}<i data-lucide="arrow-up-right"></i></a>`).join("");
  }
  function switchView(name) {
    all(".view").forEach(view => { view.hidden = view.id !== name + "-view"; });
    all("[data-view]").forEach(button => { button.classList.toggle("active", button.dataset.view === name); button.setAttribute("aria-selected", button.dataset.view === name); });
  }
  function setBrief(open) {
    $(".sidebar").classList.toggle("brief-open", open);
    document.body.classList.toggle("brief-open", open);
    $("#open-brief").setAttribute("aria-expanded", open);
    if (open) { $(".sidebar").setAttribute("role", "dialog"); $(".sidebar").setAttribute("aria-modal", "true"); $("main").inert = true; $(".topbar").inert = true; $("#close-brief").focus(); }
    else { $(".sidebar").removeAttribute("role"); $(".sidebar").removeAttribute("aria-modal"); $("main").inert = false; $(".topbar").inert = false; $("#open-brief").focus(); }
  }
  settings = safeSettings(settings);
  restore();
  syncControls();
  $("#quote-destination").innerHTML = C.destinations.filter(item => item.travelMode !== "drive").map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
  $("#quote-airport").innerHTML = C.airports.map(item => `<option value="${item.code}">${item.code} · ${esc(item.name)}</option>`).join("");
  $("#quote-form [name=checkedAt]").value = today;
  $("#quote-form [name=start]").value = `${settings.year}-07-19`;
  $("#quote-form [name=nights]").value = settings.minNights;
  $("#quote-form [name=mealPlan]").value = settings.mealPlan === "any" ? "all-inclusive" : settings.mealPlan;
  $("#open-brief").addEventListener("click", () => setBrief(true));
  $("#close-brief").addEventListener("click", () => setBrief(false));
  document.addEventListener("keydown", event => {
    if (!$(".sidebar").classList.contains("brief-open")) return;
    if (event.key === "Escape") setBrief(false);
    if (event.key === "Tab") {
      const focusable = all('.sidebar button:not(:disabled), .sidebar input:not(:disabled), .sidebar select:not(:disabled), .sidebar a[href], .sidebar summary').filter(item => item.getClientRects().length);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  matchMedia("(max-width: 600px)").addEventListener("change", event => { if (!event.matches && $(".sidebar").classList.contains("brief-open")) setBrief(false); });
  for (const [id, key] of [["market-destination", "destination"], ["market-airport", "airport"], ["market-date", "date"], ["market-nights", "nights"]]) $("#" + id).addEventListener("change", event => { market[key] = key === "nights" ? Number(event.target.value) : event.target.value; renderSearch(); icons(); });
  document.addEventListener("click", event => {
    const tab = event.target.closest("[data-view]");
    if (tab) switchView(tab.dataset.view);
    const mode = event.target.closest("[data-mode]");
    if (mode) { settings.mode = mode.dataset.mode; all("[data-mode]").forEach(button => { button.classList.toggle("selected", button === mode); button.setAttribute("aria-pressed", button === mode); }); visible = 6; update(); }
    const compare = event.target.closest("[data-compare]");
    if (compare) {
      const id = compare.dataset.compare;
      if (selected.some(item => item.id === id)) selected = selected.filter(item => item.id !== id);
      else if (selected.length >= 3) toast("Compare up to three options. Remove one to add another.");
      else { const quote = [...ranked, ...quotes].find(item => item.id === id); if (quote) selected.push({ ...quote }); }
      update();
    }
    const remove = event.target.closest("[data-remove-compare]");
    if (remove) { selected = selected.filter(item => item.id !== remove.dataset.removeCompare); update(); }
    const deleted = event.target.closest("[data-delete]");
    if (deleted && confirm("Delete this saved quote?")) { quotes = quotes.filter(item => item.id !== deleted.dataset.delete); selected = selected.filter(item => item.id !== deleted.dataset.delete); update(); }
  });
  $(".sidebar").addEventListener("change", event => {
    const target = event.target;
    if (!target.matches("input,select")) return;
    if (!target.checkValidity()) { target.reportValidity(); return; }
    const numeric = { adults: "adults", "min-nights": "minNights", "max-nights": "maxNights", "cost-km": "costPerKm", parking: "parkingPerDay" };
    if (numeric[target.id]) settings[numeric[target.id]] = Number(target.value);
    if (target.id === "max-layover") settings.maxLayoverMinutes = Math.round(Number(target.value) * 60);
    if (target.id === "min-nights" && settings.minNights > settings.maxNights) { settings.maxNights = settings.minNights; $("#max-nights").value = settings.maxNights; }
    if (target.id === "max-nights" && settings.maxNights < settings.minNights) { settings.minNights = settings.maxNights; $("#min-nights").value = settings.minNights; }
    if (target.id === "children") { settings.ages = Array.from({ length: Number(target.value) }, (_, index) => settings.ages[index] ?? 5); renderAges(); }
    if (target.dataset.age !== undefined) settings.ages[Number(target.dataset.age)] = Number(target.value);
    if (target.dataset.airport) settings.airports = all("[data-airport]:checked").map(item => item.dataset.airport);
    if (target.dataset.destination) settings[settings.driving ? "driveDestinations" : "destinations"] = all("[data-destination]:checked").map(item => item.dataset.destination);
    if (target.id === "direct") settings.directOnly = target.checked;
    if (target.id === "one-stop") settings.directOnly = !target.checked;
    if (target.id === "meal-plan") settings.mealPlan = target.value;
    if (target.id === "holiday") settings.holidayId = target.value;
    if (target.id === "year") { settings.year = Number(target.value); loadCalendar(); return; }
    visible = 6;
    update();
  });
  for (const [id, key] of [["budget", "budget"], ["max-drive", "maxDrive"]]) $("#" + id).addEventListener("input", event => { settings[key] = Number(event.target.value); update(); });
  $("#max-layover").addEventListener("input", event => {
    const hours = Number(event.target.value);
    if (event.target.value === "" || !Number.isFinite(hours) || hours < 0 || hours > 24) return;
    settings.maxLayoverMinutes = Math.round(hours * 60);
    update();
  });
  for (const key of ["cost", "comfort", "time"]) $("#weight-" + key).addEventListener("input", event => { settings.weights[key] = Number(event.target.value); update(); });
  $("#examples").addEventListener("change", event => { settings.examples = event.target.checked; visible = 6; update(); });
  $("#refresh-calendar").addEventListener("click", loadCalendar);
  $("#show-more").addEventListener("click", () => { visible += 6; update(); });
  $("#clear-compare").addEventListener("click", () => { selected = []; update(); });
  $("#clear-history").addEventListener("click", () => { if (!confirm("Clear the saved search history?")) return; clearTimeout(historyTimer); researchHistory = []; persist(); renderSearchHistory(); toast("Search history cleared."); });
  $("#reset").addEventListener("click", () => { if (!confirm("Reset preferences? Your saved quotes will be kept.")) return; settings = defaults(); selected = []; syncControls(); loadCalendar(); });
  $("#method-button").addEventListener("click", () => $("#method-dialog").showModal());
  $("#close-method").addEventListener("click", () => $("#method-dialog").close());
  $("#quote-form").addEventListener("submit", event => {
    event.preventDefault();
    try {
      if (quotes.length >= 300) throw new Error("Export or remove quotes before adding more (300 maximum).");
      const data = Object.fromEntries(new FormData(event.target));
      const raw = { ...data, adults: settings.adults, ages: [...settings.ages], direct: data.direct === "on" };
      const quote = C.validateQuote(globalThis.PlannerOptions?.prepareInput(raw) || raw);
      quotes.push(globalThis.PlannerOptions?.finalizeQuote(quote, data) || quote);
      $("#form-message").textContent = "";
      update();
      toast("Quote saved. Only matching quotes appear in Discover.");
    } catch (error) { $("#form-message").textContent = error.message; }
  });
  $("#export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings, quotes, researchHistory }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "schools-out-plan.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Plan exported. It contains child ages but no names.");
  });
  $("#import-button").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async event => {
    try {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 2000000) throw new Error("Choose a plan smaller than 2 MB.");
      const data = JSON.parse(await file.text());
      if (data.version !== 1 || !Array.isArray(data.quotes) || data.quotes.length > 300) throw new Error("Unsupported plan format (version 1, up to 300 quotes).");
      const imported = data.quotes.map(C.validateQuote);
      const importedHistory = safeResearchHistory(data.researchHistory);
      if (!confirm("Replace current preferences, saved quotes and search history with this plan?")) return;
      quotes = imported; researchHistory = importedHistory; settings = safeSettings(data.settings); selected = []; syncControls(); loadCalendar(); toast("Plan imported.");
    } catch (error) { toast("Import failed: " + error.message); }
    finally { event.target.value = ""; }
  });
  globalThis.HolidayPlanner = { get settings() { return settings; }, get quotes() { return quotes; }, get ranked() { return ranked; }, get selected() { return selected; }, update, switchView, holiday, toast };
  loadCalendar();
  switchView("research");
  icons();
})();