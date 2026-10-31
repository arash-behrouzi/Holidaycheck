(function () {
  "use strict";
  const P = HolidayPlanner;
  const C = HolidayCore;
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const esc = text => String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const euro = number => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(number);
  const form = $("#quote-form");
  const field = name => form.elements.namedItem(name);
  let modeKey = "";
  let pendingLegs = null;
  let pendingContext = "";
  let fareContext = "";
  let farePairs = [];
  const driveRegions = () => C.destinations.filter(item => item.travelMode === "drive");
  const contextFor = (airport, destination, start, nights) => JSON.stringify([airport, destination, start, Number(nights), P.settings.adults, P.settings.ages]);
  const websiteSection = $("#search-links").closest(".search-section");
  websiteSection.id = "website-search";
  $("#show-more").insertAdjacentElement("afterend", websiteSection);
  websiteSection.querySelector(".eyebrow").textContent = "NO API ACCOUNT REQUIRED";
  websiteSection.querySelector("h2").textContent = "Find offers on provider websites";
  websiteSection.querySelector(".field-note").textContent = "Provider pages may require re-entering your filters. Only the provider can confirm the final price, room capacity and availability.";
  const providerLayout = document.createElement("div"); providerLayout.className = "website-layout";
  $("#search-links").replaceWith(providerLayout); providerLayout.append(document.createElement("div")); providerLayout.firstElementChild.id = "search-links";
  providerLayout.insertAdjacentHTML("beforeend", `<div class="trip-brief"><div class="brief-heading"><h3>Trip details</h3><button id="copy-trip" class="quiet-button" type="button"><i data-lucide="copy"></i> Copy</button></div><textarea id="trip-brief" readonly aria-label="Trip details for provider websites"></textarea><button id="add-checked-offer" type="button" class="primary-button"><i data-lucide="plus"></i> Add checked offer</button><div id="direct-airlines" class="direct-airlines"></div></div>`);
  $("[data-view=discover]").innerHTML = '<i data-lucide="compass"></i> Discover';
  $("#discover-view>.results-toolbar h2").textContent = "Your ranked holiday options";

  $(".sidebar-title").insertAdjacentHTML("afterend", `<section class="filter-section option-switches"><label class="check"><input id="driving" type="checkbox" role="switch"> Driving holidays (no flights)</label><label class="check" id="mix-switch"><input id="mix-flights" type="checkbox" role="switch"> Independent outbound / return flights</label><label class="check"><input id="corporate-benefit" type="checkbox" role="switch"> Corporate-benefit voucher</label></section><section id="road-controls" class="filter-section" hidden><h3>Driving from Dortmund</h3><label>Maximum one-way drive (minutes)<input id="road-limit" type="number" min="60" max="720" step="30" value="360"></label><div class="two-fields meal-fields"><label>Car cost / km (€)<input id="road-km-cost" type="number" min="0" max="3" step="0.01" value="0.30"></label><label>Breaks, each way (min)<input id="road-breaks" type="number" min="0" max="180" value="30"></label></div><p class="field-note">Approximate regional distances and off-peak driving times; check the actual property address, traffic, tolls and ferries. The drive limit excludes breaks.</p></section>`);
  $(".results-options").insertAdjacentHTML("beforebegin", `<div class="verification-toolbar"><label class="check"><input id="confirmed-only" type="checkbox" checked> Only final-price-checked quotes</label><span class="field-note">Manually checked, not reserved. Recheck after 30 minutes.</span></div>`);
  $(".form-footer").insertAdjacentHTML("beforebegin", `<section id="benefit-fields" class="quote-extra" hidden><h3>Ab-in-den-Urlaub corporate benefit</h3><div class="form-grid"><label>Discount (%)<input name="benefitPercent" type="number" min="0" max="100" step="0.1" value="7"></label><label>Eligible supplier amount (€)<input name="benefitEligible" type="number" min="0" step="0.01"></label><label>Maximum saving (€), blank = no cap<input name="benefitCap" type="number" min="0" step="0.01"></label><label>Minimum supplier spend (€)<input name="benefitMinimum" type="number" min="0" step="0.01" value="0"></label><label>Benefit type<select name="benefitType"><option value="instant">Instant discount</option><option value="cashback">Later cashback</option></select></label></div><label class="check meal-fields"><input name="benefitAccepted" type="checkbox"> Voucher / benefit accepted by the provider for this exact offer</label><p class="field-note">Company-provided 7% is an example, not a verified public promotion. Check the portal's validity, eligible operators, exclusions, cap, minimum spend and cashback conditions. Enter supplier charges before an instant discount; it is deducted once. Estimates and cashback never reduce the upfront total. No voucher code is collected. <a href="https://www.ab-in-den-urlaub.de/" target="_blank" rel="noopener noreferrer">Ab-in-den-Urlaub ↗</a></p></section><section class="quote-extra"><h3>Final supplier price</h3><label>Price status<select name="priceStage"><option value="estimate">Unverified / advertised price</option><option value="manual-final">Final pre-booking total checked manually</option></select></label><div id="final-price-fields" hidden><div class="two-fields meal-fields"><label>Provider / organiser<input name="finalProvider" maxlength="160" placeholder="HolidayCheck / organiser name"></label><label>Actual final supplier total (€)<input name="checkoutTotal" type="number" min="0" step="0.01"></label></div><label class="check meal-fields"><input name="finalAcknowledged" type="checkbox"> Exact dates, ages, room, meals, both journeys, availability and mandatory fees checked at the final pre-booking step</label><p class="field-note">No booking or payment is submitted. The supplier total must match your supplier charges after accepted instant discounts; airport driving and estimated meals are separate. A manual check is not an API confirmation, reservation or price guarantee. Independent flights and hotel must each be repriced.</p></div></section><div id="selected-legs" class="pending-legs" hidden><p id="selected-legs-text"></p><button id="clear-selected-legs" type="button" class="text-button">Clear selected flight pair</button></div><div id="road-quote-fields" class="form-grid quote-extra" hidden><label>One-way distance (km)<input name="driveKm" type="number" min="1" step="0.1" required disabled></label><label>One-way driving (minutes, no breaks)<input name="driveMinutes" type="number" min="1" required disabled></label><label>Return tolls / ferries (€)<input name="roadFees" type="number" min="0" step="0.01" value="0" required disabled></label><label>Destination parking, full stay (€)<input name="stayParking" type="number" min="0" step="0.01" value="0" required disabled></label></div>`);
  $("#discover-view").insertAdjacentHTML("beforeend", `<section id="airline-workbench" class="search-section" hidden><span class="eyebrow">DIRECT AIRLINE CHECKS</span><h2>Independent outbound + return</h2><p id="airline-context" class="field-note"></p><p class="field-note">No live fare feed. Amounts are for everyone, per direction. Verify operating airline, dates, airports, baggage and flight + layover minutes. Separate tickets have separate cancellation and schedule-change conditions. Listed airlines do not guarantee service on this route.</p><div id="airline-fares" class="comparison-scroll"></div><p id="pair-count" class="field-note" role="status"></p><div id="airline-pairs"></div></section>`);

  function clearLegs() {
    pendingLegs = null; pendingContext = ""; $("#selected-legs").hidden = true;
    for (const name of ["flights", "bags", "flightMinutes"]) field(name).readOnly = false;
  }
  const starOptions = Array.from({ length: 9 }, (_, index) => 1 + index / 2);
  $(".option-switches").insertAdjacentHTML("afterend", `<section class="filter-section"><h3>Accommodation quality</h3><label>Minimum hotel stars<select id="min-hotel-stars"><option value="0">Any / unrated allowed</option>${starOptions.map(stars => `<option value="${stars}">${stars} stars or more</option>`).join("")}</select></label><label class="range-label meal-fields" for="min-review-score">Minimum guest review <strong id="min-review-label">Any</strong></label><input id="min-review-score" type="range" min="0" max="10" step="0.1" value="0"><div class="range-ends"><span>Any</span><span>10 / 10</span></div><p class="field-note">Review threshold uses a linear conversion to /10 from /5, /6 or /10. Sources and methodologies differ. Unrated options are excluded by positive thresholds. Planning examples have no real hotel ratings.</p></section>`);
  $("#benefit-fields").insertAdjacentHTML("beforebegin", `<section class="quote-extra"><h3>Accommodation quality</h3><div class="form-grid"><label>Hotel stars<select name="hotelStars"><option value="">Unrated / not provided</option>${starOptions.map(stars => `<option value="${stars}">${stars} stars</option>`).join("")}</select></label><label>Guest review score (original)<input name="reviewScore" type="number" min="0" max="10" step="0.1" placeholder="e.g. 5.1"></label><label>Original review scale<select name="reviewScale"><option value="10">Out of 10</option><option value="6">Out of 6 (e.g. HolidayCheck)</option><option value="5">Out of 5</option></select></label><label class="wide">Review source<input name="reviewSource" maxlength="160" placeholder="e.g. HolidayCheck or Booking.com"></label></div><p class="field-note">Enter the property's actual classification and published guest score, not your personal comfort score. Leave unknown ratings blank. A recommendation percentage is not a review score.</p></section>`);
  function syncQuality() {
    $("#min-hotel-stars").value = P.settings.minHotelStars ?? 0;
    $("#min-review-score").value = P.settings.minReviewScore ?? 0;
    $("#min-review-label").textContent = P.settings.minReviewScore ? `${P.settings.minReviewScore.toFixed(1)} / 10` : "Any";
  }
  $("#min-hotel-stars").addEventListener("change", event => { P.settings.minHotelStars = Number(event.target.value); P.update(); });
  $("#min-review-score").addEventListener("input", event => { P.settings.minReviewScore = Number(event.target.value); P.update(); });
  field("reviewScale").addEventListener("change", () => { field("reviewScore").max = field("reviewScale").value; });
  document.body.insertAdjacentHTML("beforeend", `<dialog id="provider-dialog" aria-labelledby="provider-dialog-title"><div class="provider-preview-header"><div><h2 id="provider-dialog-title">Provider website</h2><p id="provider-dialog-trip"></p></div><div class="provider-preview-controls"><a id="provider-browser-link" class="quiet-button" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i> Open in browser</a><button type="button" id="close-provider" class="icon-button" aria-label="Close provider website" title="Close"><i data-lucide="x"></i></button></div></div><p id="provider-preview-kind" class="field-note"></p><p class="field-note provider-frame-notice">Some providers block embedded viewing or require cookies/sign-in. If the page stays blank or refuses to load, use Open in browser. Prices and availability must be checked on the provider's page; this preview does not verify them.</p><div class="provider-frame-slot"><iframe id="provider-frame" title="Selected trip on provider website" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe></div></dialog>`);
  function openProviderPreview(link, quote) {
    $("#provider-dialog-title").textContent = link.exact ? "Provider offer" : `Search ${link.name}`;
    $("#provider-dialog-trip").textContent = `${quote.title} · ${quote.start} to ${C.addDays(quote.start, quote.nights)} · ${quote.nights} nights · ${quote.adults} adults + ${quote.ages.length} children`;
    $("#provider-preview-kind").textContent = link.exact ? `Saved offer link · ${new URL(link.url).hostname}` : "Search for similar offers only. This is not a booking page for the illustrative trip.";
    $("#provider-browser-link").href = link.url;
    $("#provider-frame").src = link.url;
    $("#provider-dialog").showModal();
  }
  function providerActions(quote) {
    const links = C.providerLinks(quote);
    if (!links.length) return null;
    const wrapper = document.createElement("div"); wrapper.dataset.optionMeta = ""; wrapper.className = "provider-actions";
    let selectedIndex = 0;
    const browser = document.createElement("a"); browser.className = "quiet-button"; browser.target = "_blank"; browser.rel = "noopener noreferrer";
    const preview = document.createElement("button"); preview.type = "button"; preview.className = "quiet-button"; preview.innerHTML = '<i data-lucide="panel-top"></i> View in app';
    preview.title = "Preview provider page; some sites require opening in browser";
    const updateLink = () => { browser.href = links[selectedIndex].url; browser.innerHTML = `<i data-lucide="external-link"></i> ${links[selectedIndex].exact ? "Open provider offer" : "Search provider"}`; globalThis.lucide?.createIcons(); };
    if (links.length > 1) {
      const select = document.createElement("select"); select.className = "provider-selector"; select.setAttribute("aria-label", `Provider for ${quote.title}`);
      links.forEach((link, index) => { const option = document.createElement("option"); option.value = index; option.textContent = link.name; select.append(option); });
      select.addEventListener("change", () => { selectedIndex = Number(select.value); updateLink(); }); wrapper.append(select);
    }
    preview.addEventListener("click", () => openProviderPreview(links[selectedIndex], quote));
    wrapper.append(browser, preview);
    if (!links[0].exact) { const note = document.createElement("p"); note.className = "field-note"; note.textContent = quote.demo ? "Illustrative option; search for similar real offers." : "No exact offer URL saved; these are provider searches."; wrapper.append(note); }
    updateLink();
    return wrapper;
  }
  $("#close-provider").addEventListener("click", () => $("#provider-dialog").close());
  $("#provider-dialog").addEventListener("close", () => { $("#provider-frame").removeAttribute("src"); });
  function syncFinalFields() {
    const final = field("priceStage").value === "manual-final";
    $("#final-price-fields").hidden = !final;
    for (const name of ["finalProvider", "checkoutTotal", "finalAcknowledged"]) { field(name).required = final; field(name).disabled = !final; }
  }
  function roadDefaults() {
    const destination = driveRegions().find(item => item.id === field("destination").value);
    if (destination) { field("driveKm").value = destination.km; field("driveMinutes").value = destination.minutes; }
  }
  function syncMode() {
    const settings = P.settings;
    $("#driving").checked = settings.driving;
    $("#mix-flights").checked = settings.mixFlights;
    $("#corporate-benefit").checked = settings.corporateBenefit;
    $("#confirmed-only").checked = settings.confirmedOnly;
    $("#road-controls").hidden = !settings.driving;
    $("#airport-section").hidden = settings.driving;
    $("#mix-switch").hidden = settings.driving;
    $("#direct").closest("label").hidden = settings.driving;
    $("#market-airport").closest("label").hidden = settings.driving;
    $("#road-limit").value = settings.maxHolidayDrive;
    $("#road-breaks").value = settings.roadBreakMinutes;
    $("#road-km-cost").value = settings.costPerKm;
    $("#benefit-fields").hidden = !settings.corporateBenefit;
    all("#benefit-fields input, #benefit-fields select").forEach(input => { input.disabled = !settings.corporateBenefit; });
    field("benefitEligible").required = settings.corporateBenefit;
    $("#examples").disabled = settings.confirmedOnly;
    $("#examples").checked = settings.examples && !settings.confirmedOnly;
    const key = JSON.stringify([settings.driving, settings.driving ? settings.driveDestinations : settings.destinations]);
    if (key !== modeKey) {
      modeKey = key;
      const destinations = C.destinations.filter(item => (item.travelMode === "drive") === settings.driving);
      const selected = settings.driving ? settings.driveDestinations : settings.destinations;
      $("#destinations").innerHTML = destinations.map(item => `<label class="check"><input type="checkbox" data-destination="${item.id}" ${selected.includes(item.id) ? "checked" : ""}>${esc(item.name)}</label>`).join("");
      const modes = settings.driving ? [["all", "All"], ["holiday-home", "Holiday home"], ["holiday-park", "Holiday park"]] : [["all", "All"], ["package", "Pauschalreise"], ["separate", "Flight + hotel"]];
      all("[data-mode]").forEach((button, index) => { button.dataset.mode = modes[index][0]; button.textContent = modes[index][1]; button.classList.toggle("selected", button.dataset.mode === settings.mode); });
      const previousDestination = field("destination").value;
      const previousMode = field("mode").value;
      field("destination").innerHTML = destinations.map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
      if (destinations.some(item => item.id === previousDestination)) field("destination").value = previousDestination;
      field("mode").innerHTML = modes.slice(1).map(([id, name]) => `<option value="${id}">${name}</option>`).join("");
      if (modes.slice(1).some(([id]) => id === previousMode)) field("mode").value = previousMode;
      for (const name of ["airport", "base", "flights", "bags", "transfer", "flightMinutes", "transferMinutes", "direct"]) { field(name).disabled = settings.driving; field(name).closest("label").hidden = settings.driving; }
      field("hotel").parentElement.firstChild.textContent = settings.driving ? "Accommodation, full stay (€)" : "Hotel, full stay (€)";
      $("#road-quote-fields").hidden = !settings.driving;
      all("#road-quote-fields input").forEach(input => { input.disabled = !settings.driving; });
      if (settings.driving) roadDefaults();
    }
  }
  function renderDriveSearch(holiday) {
    const settings = P.settings;
    const lengths = C.stayLengths(settings).filter(nights => C.departures(holiday, nights).length);
    const chosenLength = Number($("#market-nights").value);
    const nights = lengths.includes(chosenLength) ? chosenLength : lengths[0];
    $("#market-nights").innerHTML = lengths.map(length => `<option value="${length}" ${length === nights ? "selected" : ""}>${length} nights</option>`).join("");
    const dates = nights ? C.departures(holiday, nights, new Date().toLocaleDateString("sv-SE")) : [];
    const previousDate = $("#market-date").value;
    const start = dates.includes(previousDate) ? previousDate : dates[0];
    $("#market-date").innerHTML = dates.map(date => `<option value="${date}" ${date === start ? "selected" : ""}>${date}</option>`).join("");
    const destinations = driveRegions().filter(item => settings.driveDestinations.includes(item.id) && item.minutes <= settings.maxHolidayDrive);
    const previousDestination = $("#market-destination").value;
    const destination = destinations.find(item => item.id === previousDestination) || destinations[0];
    $("#market-destination").innerHTML = destinations.map(item => `<option value="${item.id}" ${item.id === destination?.id ? "selected" : ""}>${esc(item.name)}</option>`).join("");
    if (!destination || !start) { $("#search-links").innerHTML = ""; $("#search-summary").textContent = "No driving destination or valid stay matches this window."; return; }
    const terms = `${destination.name} ${destination.country} ${start} ${C.addDays(start, nights)} ${nights} nights ${settings.adults} adults ${settings.ages.length} children ages ${settings.ages.join(" ")}`;
    $("#search-summary").textContent = `${terms} · approx. ${destination.km} km / ${destination.minutes} driving minutes each way from Dortmund`;
    $("#search-links").innerHTML = C.driveProviders.map(provider => `<a class="quiet-button" target="_blank" rel="noopener noreferrer" href="${esc(provider.url)}">${esc(provider.name)} ↗</a><a class="quiet-button" target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(`site:${provider.domain} ${terms}`)}">${esc(provider.name)} search ↗</a>`).join("");
  }
  function renderEmptyResults() {
    if (P.ranked.length) return;
    const settings = P.settings;
    const reason = C.emptyReason(P.quotes, settings, P.holiday(), new Date().toLocaleDateString("sv-SE"));
    const messages = {
      "no-data": ["No saved quotes yet", "No provider offers have been saved to your shortlist. Website searches above do not require a travel API account."],
      "final-price": ["No final-price-checked offers", "No recent manually checked final supplier totals are saved. Advertised prices and planning examples cannot count as confirmed offers; no live booking API is connected."],
      quality: ["No matching rated stays", "The minimum hotel stars or guest-review score exclude the otherwise matching options. Planning examples and quotes with missing ratings do not meet a positive rating minimum."],
      "meal-plan": ["No matching meal plan", "Other meal plans match these filters, but the selected meal plan does not. This does not mean the provider has no availability."],
      dates: ["No valid overnight travel window", "The selected holiday dates are unavailable, in the past, or too short for the requested nights. Check the calendar and minimum stay."],
      filters: ["No matching options", "The loaded quotes or examples do not match the selected family, dates, budget, destination, travel type or journey limits. No live provider inventory is being searched."]
    };
    const [title, description] = messages[reason];
    const panel = document.createElement("div"); panel.className = "empty"; panel.dataset.emptyReason = reason;
    const heading = document.createElement("h3"); heading.textContent = title;
    const detail = document.createElement("p"); detail.textContent = description;
    const summary = document.createElement("p"); summary.className = "field-note"; summary.textContent = `${P.quotes.length} saved quotes · examples ${settings.examples ? "on (illustrative only)" : "off"}`;
    panel.append(heading, detail, summary);
    const start = $("#market-date").value;
    const nights = Number($("#market-nights").value);
    const context = { demo: true, title: "Find a real stay", travelMode: settings.driving ? "drive" : "flight", mode: settings.mode === "all" ? (settings.driving ? "holiday-home" : "package") : settings.mode, destination: $("#market-destination").value, airport: settings.driving ? "" : $("#market-airport").value, start, nights, adults: settings.adults, ages: settings.ages, mealPlan: settings.mealPlan };
    const links = C.providerLinks(context);
    if (links.length && reason !== "no-data") {
      const providers = document.createElement("div"); providers.className = "empty-actions";
      links.forEach(link => { const anchor = document.createElement("a"); anchor.className = "quiet-button"; anchor.href = link.url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.textContent = `Search ${link.name} ↗`; providers.append(anchor); });
      panel.append(providers);
      const note = document.createElement("p"); note.className = "field-note"; note.textContent = "Web searches for the trip selected in Check the market, not confirmed or bookable offers."; panel.append(note);
    }
    const actions = document.createElement("div"); actions.className = "empty-actions";
    const add = document.createElement("button"); add.type = "button"; add.className = "quiet-button"; add.innerHTML = '<i data-lucide="plus"></i> Add real quote';
    add.addEventListener("click", () => $("#add-checked-offer").click()); actions.append(add);
    if (!settings.examples || settings.confirmedOnly || settings.minHotelStars || settings.minReviewScore) {
      const examples = document.createElement("button"); examples.type = "button"; examples.className = "secondary-button"; examples.dataset.showExamples = ""; examples.textContent = "Show unrated planning examples";
      examples.addEventListener("click", () => { Object.assign(P.settings, { examples: true, confirmedOnly: false, minHotelStars: 0, minReviewScore: 0 }); P.update(); P.toast("Illustrative examples enabled; rating and final-price filters cleared. Family, dates, budget and meal plan kept."); }); actions.append(examples);
    }
    if (reason === "meal-plan") { const meals = document.createElement("button"); meals.type = "button"; meals.className = "secondary-button"; meals.textContent = "Include other meal plans"; meals.addEventListener("click", () => { settings.mealPlan = "any"; $("#meal-plan").value = "any"; P.update(); }); actions.append(meals); }
    if (reason === "dates") { const refresh = document.createElement("button"); refresh.type = "button"; refresh.className = "secondary-button"; refresh.textContent = "Refresh school calendar"; refresh.addEventListener("click", () => $("#refresh-calendar").click()); actions.append(refresh); }
    panel.append(actions);
    $("#results").replaceChildren(panel);
  }
  function render() {
    syncMode(); syncFinalFields(); syncQuality();
    all("[data-option-meta]").forEach(element => element.remove());
    all(".trip-card").forEach((card, index) => {
      const quote = P.ranked[index]; if (!quote) return;
      const state = C.priceState(quote);
      const label = state === "manual-final" ? `Final supplier price checked manually ${new Date(quote.priceVerification.checkedAt).toLocaleTimeString()} · not held` : state === "expired" ? "Final-price check expired; recheck required" : state === "example" ? "Illustrative example — no live availability" : "Unverified price — not a final supplier quote";
      const text = document.createElement("p"); text.dataset.optionMeta = ""; text.className = "card-warning"; text.textContent = label;
      if (quote.benefit) text.textContent += ` · ${C.acceptedDiscount(quote) ? "Accepted instant saving" : "Potential benefit / cashback (not deducted)"}: ${euro(C.benefitSaving(quote))}`;
      if (quote.flightLegs) text.textContent += ` · ${quote.flightLegs.outbound.carrier} outbound / ${quote.flightLegs.inbound.carrier} return`;
      card.querySelector(".trip-body").append(text);
      const rating = document.createElement("p"); rating.dataset.optionMeta = ""; rating.className = "rating-note";
      const review = C.reviewOutOfTen(quote);
      rating.textContent = `${quote.hotelStars ? `${quote.hotelStars}-star hotel` : "Stars not provided"} · ${review === null ? "Review not provided" : `${review.toFixed(1)}/10 · ${quote.reviewScore}/${quote.reviewScale} on ${quote.reviewSource}`}`;
      card.querySelector(".trip-tags").insertAdjacentElement("beforebegin", rating);
      const assessment = document.createElement("details"); assessment.dataset.optionMeta = ""; assessment.className = "option-assessment";
      const driving = C.travelModeOf(quote) === "drive";
      const components = [["Package", quote.base], ["Return flights", quote.flights], ["Accommodation", quote.hotel], ["Return baggage", quote.bags], ["Return transfers", quote.transfer], ["Extra meals / drinks", quote.meals ?? 0], ["Other charges", quote.extras], ["Return driving / parking / tolls", C.totalCost(quote, P.settings) - C.supplierTotal(quote) - (quote.meals ?? 0) + C.acceptedDiscount(quote)]];
      assessment.innerHTML = `<summary>Assessment & cost breakdown</summary><dl>${components.filter(([, value]) => value > 0).map(([label, value]) => `<div><dt>${label}</dt><dd>${euro(value)}</dd></div>`).join("")}${C.acceptedDiscount(quote) ? `<div><dt>Accepted instant discount</dt><dd>−${euro(C.acceptedDiscount(quote))}</dd></div>` : ""}<div><dt>Whole-family total</dt><dd>${euro(C.totalCost(quote, P.settings))}</dd></div><div><dt>Average per night</dt><dd>${euro(C.pricePerNight(quote, P.settings))}</dd></div><div><dt>${quote.demo ? "Assumed" : "Entered"} family comfort</dt><dd>${quote.comfort}/100</dd></div><div><dt>${driving ? "Drive plus breaks" : "Outbound door to resort"}</dt><dd>${C.journeyMinutes(quote, P.settings)} min</dd></div></dl><p class="field-note">${quote.demo ? "Scenario calculations only: no specific hotel, flight schedule, room availability or price has been verified." : "Based on entered supplier amounts and your travel-cost assumptions; recheck current prices before booking."}</p>`;
      card.querySelector(".trip-body").append(assessment);
      const actions = providerActions(quote); if (actions) card.querySelector(".trip-body").append(actions);
    });
    all(".saved-quote").forEach((row, index) => {
      const quote = P.quotes[index]; if (!quote) return;
      const status = document.createElement("p"); status.dataset.optionMeta = ""; status.className = "field-note";
      status.textContent = `Price status: ${C.priceState(quote)}${quote.priceVerification ? ` · supplier total ${euro(quote.priceVerification.total)} · ${quote.priceVerification.checkedAt}` : " · no final supplier price check"}`;
      row.firstElementChild.append(status);
      const rating = document.createElement("p"); rating.dataset.optionMeta = ""; rating.className = "field-note";
      rating.textContent = `${quote.hotelStars ? `${quote.hotelStars} stars` : "Unrated"} · ${C.reviewOutOfTen(quote) === null ? "No review score" : `${quote.reviewScore}/${quote.reviewScale} on ${quote.reviewSource}`}`;
      row.firstElementChild.append(rating);
      const actions = providerActions(quote); if (actions) row.firstElementChild.append(actions);
    });
    all("#comparison thead th").slice(1).forEach((column, index) => { const quote = P.selected[index]; if (!quote) return; const actions = providerActions(quote); if (actions) column.append(actions); });
    if (P.settings.confirmedOnly) {
      $("#data-label").textContent = "Final-price-checked quotes only.";
      $("#data-note").textContent = "No live booking API is connected. Only recent manually checked final-step supplier totals appear; prices are not held. Checks expire after 30 minutes.";
    }
    renderWebsiteSearch();
    if (!P.settings.confirmedOnly) {
      $("#data-label").textContent = P.settings.examples ? "Planning estimates — not verified holiday offers." : "Your saved holiday quotes.";
      $("#data-note").textContent = P.settings.examples ? "Example prices, routes, room availability and comfort scores are illustrative. Provider links let you check real offers; hotel stars and guest reviews are not invented." : "Provider prices and availability must be checked on the provider website.";
    }
    $("#airline-workbench").hidden = P.settings.driving || !P.settings.mixFlights;
    renderEmptyResults();
    globalThis.PlannerOptions.renderAirlines?.();
    globalThis.lucide?.createIcons();
  }
  function currentWebsitePlan() {
    return C.websiteSearchPlan(P.settings, { destination: $("#market-destination").value, airport: $("#market-airport").value, start: $("#market-date").value, nights: Number($("#market-nights").value) });
  }
  function renderWebsiteSearch() {
    const plan = currentWebsitePlan();
    $("#copy-trip").disabled = !plan;
    $("#add-checked-offer").disabled = !plan;
    $("#trip-brief").value = plan?.brief || "Select a destination, dates and an airport for flight holidays.";
    if (!plan) { $("#search-links").textContent = "No valid trip selected."; $("#direct-airlines").replaceChildren(); return; }
    $("#search-links").innerHTML = plan.links.map(link => `<div class="website-provider"><div><strong>${esc(link.name)}</strong><small>${esc(link.domain)}</small></div><div class="website-provider-actions"><a class="quiet-button" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" data-provider-home="${esc(link.name)}"><i data-lucide="external-link"></i> Open website</a><a class="text-button" href="${esc(link.searchUrl)}" target="_blank" rel="noopener noreferrer"><i data-lucide="search"></i> Web search</a></div></div>`).join("");
    $("#direct-airlines").innerHTML = P.settings.driving ? "" : `<h3>Direct airlines</h3><div>${C.airlines.map(airline => `<a href="${esc(airline.url)}" target="_blank" rel="noopener noreferrer">${esc(airline.name)} ↗</a>`).join("")}</div>`;
  }
  $("#copy-trip").addEventListener("click", async () => {
    const plan = currentWebsitePlan(); if (!plan) return;
    try { await navigator.clipboard.writeText(plan.brief); P.toast("Trip details copied."); }
    catch { $("#trip-brief").focus(); $("#trip-brief").select(); P.toast("Clipboard unavailable; trip details selected."); }
  });
  $("#add-checked-offer").addEventListener("click", () => {
    const plan = currentWebsitePlan(); if (!plan) return;
    if ((field("title").value.trim() || field("url").value.trim()) && !confirm("Replace the unsaved quote form with this trip? Saved quotes are kept.")) return;
    clearLegs(); form.reset();
    field("destination").value = plan.destination.id; field("airport").value = plan.airport?.code || "";
    field("mode").value = P.settings.driving ? (P.settings.mode === "holiday-park" ? "holiday-park" : "holiday-home") : (P.settings.mode === "separate" ? "separate" : "package");
    field("start").value = plan.start; field("nights").value = plan.nights; field("capacity").value = P.settings.adults + P.settings.ages.length;
    field("mealPlan").value = P.settings.mealPlan === "any" ? "other" : P.settings.mealPlan;
    field("checkedAt").value = new Date().toLocaleDateString("sv-SE"); field("direct").checked = P.settings.directOnly;
    field("reviewScore").max = "10"; field("priceStage").dispatchEvent(new Event("change"));
    if (P.settings.driving) roadDefaults();
    P.switchView("quotes"); field("title").focus();
  });
  function prepareInput(raw) {
    const input = { ...raw, travelMode: P.settings.driving ? "drive" : "flight" };
    if (P.settings.driving) Object.assign(input, { airport: "", base: 0, flights: 0, bags: 0, transfer: 0, flightMinutes: 0, transferMinutes: 0, direct: false });
    if (pendingLegs && !P.settings.driving) {
      if (pendingContext !== contextFor(input.airport, input.destination, input.start, input.nights)) throw new Error("The selected flight pair belongs to another route, date or family. Check the flights again.");
      input.flightLegs = pendingLegs;
    }
    if (P.settings.corporateBenefit) input.benefit = { type: raw.benefitType, accepted: raw.benefitAccepted === "on", percent: Number(raw.benefitPercent), eligibleAmount: Number(raw.benefitEligible), minimumSpend: Number(raw.benefitMinimum), cap: raw.benefitCap === "" ? null : Number(raw.benefitCap) };
    return input;
  }
  function finalizeQuote(quote, data) {
    if (data.priceStage !== "manual-final") return quote;
    if (data.finalAcknowledged !== "on") throw new Error("Confirm that all final booking details were checked.");
    return C.markFinalPriceChecked(quote, String(data.finalProvider || ""), Number(data.checkoutTotal));
  }
  for (const [id, key] of [["driving", "driving"], ["mix-flights", "mixFlights"], ["corporate-benefit", "corporateBenefit"], ["confirmed-only", "confirmedOnly"]]) $("#" + id).addEventListener("change", event => {
    P.settings[key] = event.target.checked;
    if (key === "driving") { P.settings.mode = "all"; clearLegs(); modeKey = ""; if (P.settings.driving && P.settings.mealPlan === "all-inclusive") { P.settings.mealPlan = "room-only"; $("#meal-plan").value = "room-only"; field("mealPlan").value = "room-only"; } }
    if (key === "mixFlights" && !P.settings.mixFlights) clearLegs();
    P.update();
  });
  for (const [id, key] of [["road-limit", "maxHolidayDrive"], ["road-km-cost", "costPerKm"], ["road-breaks", "roadBreakMinutes"]]) $("#" + id).addEventListener("change", event => { if (!event.target.reportValidity()) return; P.settings[key] = Number(event.target.value); $("#cost-km").value = P.settings.costPerKm; P.update(); });
  field("destination").addEventListener("change", () => { if (P.settings.driving) roadDefaults(); });
  field("priceStage").addEventListener("change", syncFinalFields);
  $("#clear-selected-legs").addEventListener("click", clearLegs);
  for (const id of ["market-destination", "market-date", "market-nights", "market-airport"]) $("#" + id).addEventListener("change", () => { if (P.settings.driving) renderDriveSearch(P.holiday()); render(); });
  document.addEventListener("planner:updated", render);
  function renderAirlines() {
    if (P.settings.driving || !P.settings.mixFlights) return;
    const airport = $("#market-airport").value;
    const destination = $("#market-destination").value;
    const start = $("#market-date").value;
    const nights = Number($("#market-nights").value);
    if (!airport || !destination || !start || !nights) { $("#airline-context").textContent = "Choose an airport, destination and valid dates."; $("#airline-fares").innerHTML = ""; $("#airline-pairs").innerHTML = ""; fareContext = ""; return; }
    const context = contextFor(airport, destination, start, nights);
    $("#airline-context").textContent = `${airport} → ${destination} on ${start} · ${destination} → ${airport} on ${C.addDays(start, nights)} · ${P.settings.adults} adults + ${P.settings.ages.length} children · 6 listed airlines / 36 potential airline pairings`;
    if (context === fareContext) return;
    fareContext = context; farePairs = []; clearLegs();
    $("#airline-fares").innerHTML = `<table class="comparison-table fare-table"><thead><tr><th>Direct airline check</th><th>Outbound (all travellers)</th><th>Return (all travellers)</th></tr></thead><tbody>${C.airlines.map(airline => `<tr><th><a href="${esc(airline.url)}" target="_blank" rel="noopener noreferrer">${esc(airline.name)} ↗</a>${["outbound", "inbound"].map(direction => { const route = direction === "outbound" ? `${airport} to ${destination} ${start}` : `${destination} to ${airport} ${C.addDays(start, nights)}`; return `<small><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(`site:${new URL(airline.url).hostname} ${route} ${P.settings.adults} adults ${P.settings.ages.length} children ages ${P.settings.ages.join(" ")}`)}">${direction === "outbound" ? "Outbound" : "Return"} search ↗</a></small>`; }).join("")}</th>${["outbound", "inbound"].map(direction => `<td><div class="fare-fields">${[["price", "Fare (€)", "0.01"], ["baggage", "Bags (€)", "0"], ["minutes", "Flight + stops (min)", "1"]].map(([key, label, min]) => `<label>${label}<input type="number" min="${min}" step="${key === "minutes" ? "1" : "0.01"}" data-carrier="${airline.id}" data-direction="${direction}" data-leg-field="${key}" aria-label="${esc(airline.name)} ${direction} ${label}" ${key === "baggage" ? 'value="0"' : ""}></label>`).join("")}</div></td>`).join("")}</tr>`).join("")}</tbody></table>`;
    updatePairs();
  }
  function updatePairs() {
    const legs = { outbound: [], inbound: [] };
    for (const direction of ["outbound", "inbound"]) for (const airline of C.airlines) {
      const inputs = all(`[data-carrier="${airline.id}"][data-direction="${direction}"]`);
      const values = Object.fromEntries(inputs.map(input => [input.dataset.legField, input.value]));
      if (inputs.length === 3 && inputs.every(input => input.value !== "" && input.checkValidity()) && Number(values.price) > 0 && Number(values.minutes) > 0) legs[direction].push({ carrier: airline.id, price: Number(values.price), baggage: Number(values.baggage), minutes: Number(values.minutes) });
    }
    farePairs = C.combineFlightLegs(legs.outbound, legs.inbound);
    $("#pair-count").textContent = `${legs.outbound.length} priced outbound × ${legs.inbound.length} priced return = ${farePairs.length} checked fare combinations. Missing fares are not zero-priced or unavailable flights. All entered airline pairings are included; not every flight number, charter allocation or airline is covered.`;
    const airlineName = id => C.airlines.find(item => item.id === id).name;
    $("#airline-pairs").innerHTML = farePairs.length ? `<div class="comparison-scroll"><table class="comparison-table"><thead><tr><th>Outbound</th><th>Return</th><th>Flights + bags</th><th></th></tr></thead><tbody>${farePairs.map((pair, index) => `<tr><td>${esc(airlineName(pair.outbound.carrier))}<small>${euro(pair.outbound.price)} + ${euro(pair.outbound.baggage)} bags</small></td><td>${esc(airlineName(pair.inbound.carrier))}<small>${euro(pair.inbound.price)} + ${euro(pair.inbound.baggage)} bags</small></td><td>${euro(pair.total)}</td><td><button type="button" class="quiet-button" data-use-pair="${index}">Use pair</button></td></tr>`).join("")}</tbody></table></div>` : "";
  }
  $("#airline-fares").addEventListener("input", updatePairs);
  $("#airline-pairs").addEventListener("click", event => {
    const button = event.target.closest("[data-use-pair]");
    if (button) globalThis.PlannerOptions.setFlightPair(farePairs[Number(button.dataset.usePair)], fareContext);
  });
  globalThis.PlannerOptions = { renderDriveSearch, prepareInput, finalizeQuote, setFlightPair(pair, context) {
    clearLegs(); pendingLegs = { outbound: pair.outbound, inbound: pair.inbound }; pendingContext = context;
    field("mode").value = "separate"; field("base").value = "0"; field("airport").value = $("#market-airport").value; field("destination").value = $("#market-destination").value; field("start").value = $("#market-date").value; field("nights").value = $("#market-nights").value;
    field("flights").value = (pair.outbound.price + pair.inbound.price).toFixed(2); field("bags").value = (pair.outbound.baggage + pair.inbound.baggage).toFixed(2); field("flightMinutes").value = pair.outbound.minutes;
    for (const name of ["flights", "bags", "flightMinutes"]) field(name).readOnly = true;
    $("#selected-legs-text").textContent = `${pair.outbound.carrier} outbound + ${pair.inbound.carrier} return · ${euro(pair.total)} flights + bags for everyone. Hotel and other costs are separate.`;
    $("#selected-legs").hidden = false; P.switchView("quotes");
  } };
  globalThis.PlannerOptions.renderAirlines = renderAirlines;
  P.update();
  setInterval(() => { if (P.settings.confirmedOnly || P.quotes.some(quote => quote.priceVerification)) P.update(); }, 60000);
})();