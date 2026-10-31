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
  const defaults = () => ({ adults: 2, ages: [4, 6, 8], year: defaultYear, holidayId: "", minNights: 7, maxNights: 12, minHotelStars: 0, minReviewScore: 0, budget: 6000, weights: { cost: 45, comfort: 35, time: 20 }, maxDrive: 90, driving: false, mixFlights: false, confirmedOnly: false, corporateBenefit: false, maxHolidayDrive: 360, roadBreakMinutes: 30, driveDestinations: C.destinations.filter(item => item.travelMode === "drive").map(item => item.id), airports: ["DTM", "DUS", "CGN", "FMO", "PAD"], destinations: C.destinations.filter(item => item.travelMode !== "drive").map(item => item.id), costPerKm: 0.30, parkingPerDay: 12, directOnly: true, mealPlan: "all-inclusive", mode: "all", examples: true });
  const nightLabel = () => settings.minNights === settings.maxNights ? String(settings.minNights) : `${settings.minNights}–${settings.maxNights}`;
  let settings = defaults();
  let quotes = [];
  let holidays = [];
  let selected = [];
  let ranked = [];
  let visible = 6;
  let calendarRequest = 0;
  let toastTimer;
  let market = { destination: "", airport: "", date: "", nights: 0 };
  function icons() { globalThis.lucide?.createIcons(); }
  function toast(message) { $("#toast").textContent = message; $("#toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 4500); }
  function safeSettings(input) {
    const result = defaults();
    if (!input || typeof input !== "object") return result;
    if (Number.isInteger(input.nights) && input.nights >= 1 && input.nights <= 35) result.minNights = result.maxNights = input.nights;
    const bounds = { adults: [1, 6], minNights: [1, 35], maxNights: [1, 35], minHotelStars: [0, 5], minReviewScore: [0, 10], year: [2026, 2040], budget: [1500, 15000], maxDrive: [30, 360], maxHolidayDrive: [60, 720], roadBreakMinutes: [0, 180], costPerKm: [0, 3], parkingPerDay: [0, 100] };
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
  function persist() {
    try { localStorage.setItem("schoolsout-v1", JSON.stringify({ version: 1, settings, quotes })); }
    catch { toast("Browser storage is unavailable or full. Export your plan to keep a copy."); }
  }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem("schoolsout-v1") || "null");
      if (saved?.version === 1) { settings = safeSettings(saved.settings); quotes = (saved.quotes || []).slice(0, 300).map(C.validateQuote); }
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
    $("#meal-plan").value = settings.mealPlan;
    $("#examples").checked = settings.examples;
    for (const key of ["cost", "comfort", "time"]) $("#weight-" + key).value = settings.weights[key];
    $("#airports").innerHTML = C.airports.map(airport => `<label class="airport-row"><input type="checkbox" data-airport="${airport.code}" ${settings.airports.includes(airport.code) ? "checked" : ""}><strong>${airport.code}</strong><span class="airport-name">${esc(airport.name.split(" /")[0])}</span><span>${airport.km} km · ${airport.minutes} min</span></label>`).join("");
    $("#destinations").innerHTML = C.destinations.filter(item => item.travelMode !== "drive").map(destination => `<label class="check"><input type="checkbox" data-destination="${destination.id}" ${settings.destinations.includes(destination.id) ? "checked" : ""}> ${esc(destination.name)}</label>`).join("");
    all("[data-mode]").forEach(button => { button.classList.toggle("selected", button.dataset.mode === settings.mode); button.setAttribute("aria-pressed", button.dataset.mode === settings.mode); });
  }
  const holiday = () => holidays.find(item => item.id === settings.holidayId);
  function setHolidays(items, status) {
    holidays = items.filter(item => C.validDate(item.start) && C.validDate(item.end) && item.start <= item.end && item.end >= today).sort((first, second) => first.start.localeCompare(second.start));
    if (!holidays.some(item => item.id === settings.holidayId)) settings.holidayId = (holidays.find(item => /summer/i.test(item.name)) || holidays[0])?.id || "";
    $("#holiday").innerHTML = holidays.length ? holidays.map(item => `<option value="${esc(item.id)}" ${settings.holidayId === item.id ? "selected" : ""}>${esc(item.name)}</option>`).join("") : '<option value="">No dates available</option>';
    $("#calendar-status").textContent = status;
    update();
  }
  async function loadCalendar() {
    const request = ++calendarRequest;
    const year = settings.year;
    const preferredHolidayId = settings.holidayId;
    setHolidays(C.fallbackHolidays[year] || [], "Offline reference: official NRW summer dates only. Checking public calendars…");
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
        if (request === calendarRequest) setHolidays(C.fallbackHolidays[year] || [], C.fallbackHolidays[year] ? "Public calendar unavailable. Offline reference: official NRW summer dates only; other holidays are not loaded." : "Public calendar unavailable. No verified offline dates for this year. Try refresh or another year.");
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
      <div class="route-line"><div><strong>${airport.code}</strong><span class="arrow">→</span><strong>${destination.id}</strong><p>${airport.minutes} min airport drive · ${quote.direct ? "direct" : "with stops"}</p></div><div class="time"><strong>${duration(quote.journey)}</strong><br>door to resort</div></div>
      <div class="card-bottom"><div><div class="price">${money(quote.total)}</div><div class="nightly-price">${nightlyMoney(C.pricePerNight(quote, settings))} / night</div><div class="price-note">whole family · incl. airport travel</div></div><button class="compare-toggle" data-compare="${esc(quote.id)}" aria-pressed="${selected.some(item => item.id === quote.id)}"><i data-lucide="${selected.some(item => item.id === quote.id) ? "check" : "plus"}"></i>Compare</button></div>
      <p class="card-warning">${esc(warning)}${destination.season.includes(month) ? "" : " Outside the indicative beach season; check temperatures and pool heating."}</p>${quote.demo && quote.meals ? `<p class="card-warning">Includes ${money(quote.meals)} illustrative extra meals / drinks budget.</p>` : ""}</div></article>`;
  }
  function driveCard(quote) {
    const destination = C.destinations.find(item => item.id === quote.destination);
    return `<article class="trip-card"><div class="trip-image"><img src="https://images.unsplash.com/${destination.image}?auto=format&fit=crop&w=800&q=80" alt="Regional inspiration, not the quoted property"><span class="image-label">${quote.demo ? "Planning example" : "Saved quote"} · ${esc(C.bookingLabel(quote))}</span></div><div class="trip-body"><div class="card-meta"><span class="eyebrow">${esc(destination.country)}</span><span class="score">${quote.score}/100 fit</span></div><h3>${esc(destination.name)}</h3><p class="trip-subtitle">${esc(quote.title)}</p><div class="trip-tags"><span>${dateLabel(quote.start)} · ${quote.nights} nights</span><span>${esc(C.mealPlanLabel(quote))}</span></div><div class="route-line"><div><strong>Dortmund → ${esc(destination.name)}</strong><p>${quote.driveKm} km each way · ${settings.roadBreakMinutes ?? 30} min breaks</p></div><div class="time"><strong>${duration(quote.journey)}</strong><br>drive + breaks</div></div><div class="card-bottom"><div><div class="price">${money(quote.total)}</div><div class="nightly-price">${nightlyMoney(C.pricePerNight(quote, settings))} / night</div><div class="price-note">whole family · incl. return driving</div></div><button class="compare-toggle" data-compare="${esc(quote.id)}" aria-pressed="${selected.some(item => item.id === quote.id)}">Compare</button></div><p class="card-warning">${quote.demo ? "Illustrative accommodation, meals and route. No availability checked." : `Checked ${dateLabel(quote.checkedAt)}; recheck before booking.`}</p></div></article>`;
  }
  function update() {
    const selectedHoliday = holiday();
    $("#family-summary").textContent = `${settings.adults + settings.ages.length} travellers. One good plan. Starting from Dortmund.`;
    $("#budget-label").textContent = money(settings.budget);
    $("#drive-label").textContent = duration(settings.maxDrive);
    for (const key of ["cost", "comfort", "time"]) $("#" + key + "-value").textContent = settings.weights[key];
    all("[data-airport]").forEach(input => { const airport = C.airports.find(item => item.code === input.dataset.airport); input.closest("label").classList.toggle("dim", airport.minutes > settings.maxDrive); });
    $("#window-title").textContent = selectedHoliday?.name || "Choose a holiday window";
    $("#window-dates").textContent = selectedHoliday ? `${dateLabel(selectedHoliday.start)} – ${dateLabel(selectedHoliday.end)} · ${nightLabel()} nights away` : "Refresh the calendar or select another year.";
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
    const boardTerms = C.mealPlans.find(item => item.id === settings.mealPlan)?.search || "";
    const terms = `${destination.name} ${market.date} ${C.addDays(market.date, market.nights)} ${market.nights} nights ${settings.adults} adults ${settings.ages.length} children ages ${settings.ages.join(" ")} ${airport.code} ${boardTerms} ${settings.directOnly ? "direct flight" : ""} family room`;
    const links = [
      ["CHECK24 packages", "https://www.google.com/search?q=" + encodeURIComponent("site:urlaub.check24.de Pauschalreise " + terms), "luggage"],
      ["TUI packages", "https://www.google.com/search?q=" + encodeURIComponent("site:tui.com Pauschalreise " + terms), "sun"],
      ["Google Flights", "https://www.google.com/travel/flights?q=" + encodeURIComponent(`Flights from ${airport.name} ${airport.code} to ${destination.name} ${destination.id} on ${market.date} returning ${C.addDays(market.date, market.nights)} ${settings.adults} adults ${settings.ages.length} children`), "plane"],
      ["Hotels", "https://www.booking.com/searchresults.html?" + new URLSearchParams({ ss: destination.name, checkin: market.date, checkout: C.addDays(market.date, market.nights), group_adults: settings.adults, group_children: settings.ages.length, no_rooms: 1 }).toString() + settings.ages.map(age => "&age=" + age).join(""), "bed-double"]
    ];
    $("#search-links").innerHTML = links.map(([name, url, icon], index) => `<a class="${index === 0 ? "primary-button" : "quiet-button"}" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="${icon}"></i>${esc(name)}<i data-lucide="arrow-up-right"></i></a>`).join("");
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
    if (target.id === "min-nights" && settings.minNights > settings.maxNights) { settings.maxNights = settings.minNights; $("#max-nights").value = settings.maxNights; }
    if (target.id === "max-nights" && settings.maxNights < settings.minNights) { settings.minNights = settings.maxNights; $("#min-nights").value = settings.minNights; }
    if (target.id === "children") { settings.ages = Array.from({ length: Number(target.value) }, (_, index) => settings.ages[index] ?? 5); renderAges(); }
    if (target.dataset.age !== undefined) settings.ages[Number(target.dataset.age)] = Number(target.value);
    if (target.dataset.airport) settings.airports = all("[data-airport]:checked").map(item => item.dataset.airport);
    if (target.dataset.destination) settings[settings.driving ? "driveDestinations" : "destinations"] = all("[data-destination]:checked").map(item => item.dataset.destination);
    if (target.id === "direct") settings.directOnly = target.checked;
    if (target.id === "meal-plan") settings.mealPlan = target.value;
    if (target.id === "holiday") settings.holidayId = target.value;
    if (target.id === "year") { settings.year = Number(target.value); loadCalendar(); return; }
    visible = 6;
    update();
  });
  for (const [id, key] of [["budget", "budget"], ["max-drive", "maxDrive"]]) $("#" + id).addEventListener("input", event => { settings[key] = Number(event.target.value); update(); });
  for (const key of ["cost", "comfort", "time"]) $("#weight-" + key).addEventListener("input", event => { settings.weights[key] = Number(event.target.value); update(); });
  $("#examples").addEventListener("change", event => { settings.examples = event.target.checked; visible = 6; update(); });
  $("#refresh-calendar").addEventListener("click", loadCalendar);
  $("#show-more").addEventListener("click", () => { visible += 6; update(); });
  $("#clear-compare").addEventListener("click", () => { selected = []; update(); });
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
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings, quotes }, null, 2)], { type: "application/json" });
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
      if (!confirm("Replace current preferences and saved quotes with this plan?")) return;
      quotes = imported; settings = safeSettings(data.settings); selected = []; syncControls(); loadCalendar(); toast("Plan imported.");
    } catch (error) { toast("Import failed: " + error.message); }
    finally { event.target.value = ""; }
  });
  globalThis.HolidayPlanner = { get settings() { return settings; }, get quotes() { return quotes; }, get ranked() { return ranked; }, get selected() { return selected; }, update, switchView, holiday, toast };
  loadCalendar();
  icons();
})();