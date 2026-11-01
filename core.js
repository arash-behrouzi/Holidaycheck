(function (root) {
  "use strict";
  const airports = [
    { code: "DTM", name: "Dortmund", km: 14, minutes: 25 },
    { code: "DUS", name: "Düsseldorf", km: 82, minutes: 65 },
    { code: "CGN", name: "Cologne / Bonn", km: 100, minutes: 80 },
    { code: "FMO", name: "Münster / Osnabrück", km: 92, minutes: 75 },
    { code: "PAD", name: "Paderborn", km: 105, minutes: 80 },
    { code: "HAJ", name: "Hannover", km: 215, minutes: 150 },
    { code: "EIN", name: "Eindhoven", km: 180, minutes: 135 },
    { code: "FRA", name: "Frankfurt", km: 235, minutes: 170 },
    { code: "AMS", name: "Amsterdam", km: 260, minutes: 185 },
    { code: "NRN", name: "Weeze", km: 125, minutes: 100 },
    { code: "BRU", name: "Brussels", km: 280, minutes: 205 },
    { code: "LUX", name: "Luxembourg", km: 315, minutes: 225 },
    { code: "HAM", name: "Hamburg", km: 355, minutes: 250 },
    { code: "LEJ", name: "Leipzig / Halle", km: 385, minutes: 260 },
    { code: "BER", name: "Berlin Brandenburg", km: 505, minutes: 330 }
  ];
  const mealPlans = [
    { id: "all-inclusive", label: "All inclusive", search: "all inclusive" },
    { id: "full-board", label: "Full board (Vollpension)", search: "full board Vollpension" },
    { id: "room-only", label: "No meals (Ohne Verpflegung)", search: "room only ohne Verpflegung" },
    { id: "other", label: "Other / unspecified board", search: "" }
  ];
  const mealPlanOf = quote => quote.mealPlan || (quote.allInclusive === true ? "all-inclusive" : "other");
  const mealPlanLabel = quote => mealPlans.find(item => item.id === mealPlanOf(quote))?.label || "Other / unspecified board";
  const travelModeOf = quote => quote.travelMode || "flight";
  const bookingLabel = quote => ({ package: "Pauschalreise", separate: "Flight + hotel", "holiday-home": "Holiday home / FeWo", "holiday-park": "Holiday park" })[quote.mode];
  const driveProviders = [
    { name: "FeWo-direkt", url: "https://www.fewo-direkt.de/", domain: "fewo-direkt.de" },
    { name: "Center Parcs", url: "https://www.centerparcs.de/", domain: "centerparcs.de" }
  ];
  const airlines = [
    { id: "sunexpress", name: "SunExpress", url: "https://www.sunexpress.com/" },
    { id: "corendon", name: "Corendon", url: "https://www.corendonairlines.com/" },
    { id: "condor", name: "Condor", url: "https://www.condor.com/" },
    { id: "eurowings", name: "Eurowings", url: "https://www.eurowings.com/" },
    { id: "pegasus", name: "Pegasus", url: "https://www.flypgs.com/" },
    { id: "tuifly", name: "TUI fly", url: "https://www.tui.com/flug/" }
  ];
  function combineFlightLegs(outbound, inbound) {
    return outbound.flatMap(go => inbound.map(back => ({ outbound: { ...go }, inbound: { ...back }, total: go.price + back.price + go.baggage + back.baggage })))
      .sort((first, second) => first.total - second.total || first.outbound.minutes + first.inbound.minutes - second.outbound.minutes - second.inbound.minutes);
  }
  function providerLinks(quote) {
    if (!quote.demo && quote.url) {
      try {
        const url = new URL(quote.url);
        if (url.protocol === "https:" && !url.username && !url.password) return [{ name: url.hostname, url: url.href, exact: true }];
      } catch { }
    }
    const destination = destinations.find(item => item.id === quote.destination);
    if (!destination || !validDate(quote.start) || !Number.isInteger(quote.nights) || quote.nights < 1 || !Array.isArray(quote.ages)) return [];
    if (travelModeOf(quote) === "drive") return driveProviders.map(provider => ({ name: provider.name, url: provider.url, exact: false }));
    if (quote.mode === "package") return [{ name: "HolidayCheck", url: "https://www.holidaycheck.de/pauschalreisen", exact: false }];
    if (quote.mode === "separate") return [
      { name: "Booking.com flights", url: "https://www.booking.com/flights/", exact: false },
      { name: "Booking.com hotels", url: bookingStayUrl(destination, quote.start, quote.nights, quote.adults, quote.ages), exact: false },
    ];
    return [];
  }
  function bookingStayUrl(destination, start, nights, adults, ages) {
    return bookingStayUrlWithQuality(destination, start, nights, adults, ages, 0, 0);
  }
  function bookingStayUrlWithQuality(destination, start, nights, adults, ages, minHotelStars, minReviewScore) {
    const params = new URLSearchParams({ ss: destination.name, checkin: start, checkout: addDays(start, nights), group_adults: adults, group_children: ages.length, no_rooms: 1 });
    ages.forEach(age => params.append("age", age));
    const filters = [];
    if (minHotelStars > 0) for (let stars = Math.ceil(minHotelStars); stars <= 5; stars += 1) filters.push(`class=${stars}`);
    const reviewBand = [6, 7, 8, 9].find(score => score >= minReviewScore);
    if (minReviewScore > 0 && reviewBand) filters.push(`review_score=${reviewBand * 10}`);
    if (filters.length) params.set("nflt", filters.join(";"));
    return "https://www.booking.com/searchresults.html?" + params;
  }
  function websiteSearchPlan(settings, trip) {
    const destination = destinations.find(item => item.id === trip.destination && (item.travelMode === "drive") === Boolean(settings.driving));
    const airport = airports.find(item => item.code === trip.airport);
    if (!destination || !validDate(trip.start) || !stayLengths(settings).includes(trip.nights) || (!settings.driving && !airport)) return null;
    const end = addDays(trip.start, trip.nights);
    const board = mealPlans.find(item => item.id === settings.mealPlan);
    const lines = [
      `${destination.name}, ${destination.country}`,
      `Departure / check-in: ${trip.start}`,
      `Return / check-out: ${end} (${trip.nights} nights)`,
      `${settings.adults} adults; ${settings.ages.length} children; ages on departure: ${settings.ages.join(", ") || "none"}`,
      settings.driving ? `Driving from Dortmund; approx. ${destination.km} km / ${destination.minutes} minutes each way before breaks` : `Airport: ${airport.name} (${airport.code}) → ${destination.id}`,
      `Meal plan: ${board?.label || "Any"}`,
      `Whole-family budget: EUR ${settings.budget}`,
      `Minimum hotel stars: ${settings.minHotelStars || "any"}; guest review: ${settings.minReviewScore ? settings.minReviewScore + "/10 (converted)" : "any"}`,
      "Confirm room capacity, mandatory charges, baggage / transfers, cancellation terms and final payable price.",
    ];
    if (settings.corporateBenefit) lines.push("Check employer voucher eligibility privately; do not assume acceptance or deduct estimated cashback.");
    const holidayCheck = { name: "HolidayCheck packages", url: "https://www.holidaycheck.de/pauschalreisen", domain: "www.holidaycheck.de" };
    const bookingFlights = { name: "Booking.com flights", url: "https://www.booking.com/flights/", domain: "www.booking.com" };
    const bookingHotels = { name: "Booking.com hotels", url: bookingStayUrlWithQuality(destination, trip.start, trip.nights, settings.adults, settings.ages, settings.minHotelStars, settings.minReviewScore), domain: "www.booking.com" };
    const bookingReviewBand = [6, 7, 8, 9].find(score => score >= settings.minReviewScore);
    const bookingRatingNote = [
      settings.minHotelStars > 0 ? `Booking.com hotel star filter: ${Math.ceil(settings.minHotelStars)} stars and above.` : "",
      settings.minReviewScore > 0 && bookingReviewBand ? `Booking.com review filter: ${bookingReviewBand}+ (the next supported band above your ${settings.minReviewScore.toFixed(1)} minimum).` : "",
      settings.minReviewScore > 9 ? "Booking.com has no review tier above 9+; verify this stricter threshold manually." : "",
      settings.mode !== "separate" && (settings.minHotelStars || settings.minReviewScore) ? "HolidayCheck opens its package page; apply the review/star requirements from the copied trip brief manually." : "",
    ].filter(Boolean).join(" ");
    const ratedHotelSearch = { ...bookingHotels, name: "Booking.com hotels (separate booking)" };
    const hasQualityMinimums = Boolean(settings.minHotelStars || settings.minReviewScore);
    const links = settings.driving ? driveProviders.map(provider => ({ ...provider })) : settings.mode === "package" ? [holidayCheck, ...(hasQualityMinimums ? [ratedHotelSearch] : [])] : settings.mode === "separate" ? [bookingFlights, bookingHotels] : [holidayCheck, bookingFlights, bookingHotels];
    return { destination, airport, start: trip.start, end, nights: trip.nights, brief: lines.join("\n"), links, bookingRatingNote };
  }
  function stayLengths(settings) {
    const min = settings.minNights ?? settings.nights ?? 7;
    const max = settings.maxNights ?? settings.nights ?? min;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 35 || min > max) return [];
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }
  const destinations = [
    { id: "AYT", name: "Antalya", country: "Türkiye", flight: 215, transfer: 60, adult: 510, night: 195, comfort: 89, season: [4, 5, 6, 7, 8, 9, 10], note: "Your family favourite", image: "photo-1507525428034-b723cf961d3e" },
    { id: "HRG", name: "Hurghada", country: "Egypt", flight: 285, transfer: 35, adult: 580, night: 180, comfort: 86, season: [2, 3, 4, 5, 9, 10, 11, 12], note: "Your family favourite", image: "photo-1519046904884-53103b34b206" },
    { id: "BOJ", name: "Burgas", country: "Bulgaria", flight: 165, transfer: 35, adult: 400, night: 150, comfort: 77, season: [6, 7, 8, 9], note: "Familiar & budget-friendly", image: "photo-1473116763249-2faaef81ccda" },
    { id: "HER", name: "Crete", country: "Greece", flight: 205, transfer: 50, adult: 540, night: 210, comfort: 85, season: [5, 6, 7, 8, 9, 10], note: "Something new", image: "photo-1500375592092-40eb2168fd21" },
    { id: "PMI", name: "Mallorca", country: "Spain", flight: 150, transfer: 50, adult: 430, night: 205, comfort: 86, season: [5, 6, 7, 8, 9, 10], note: "Spain · Balearic Islands", image: "photo-1507525428034-b723cf961d3e" },
    { id: "TFS", name: "Tenerife", country: "Spain", flight: 285, transfer: 35, adult: 610, night: 220, comfort: 87, season: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], note: "Spain · Canary Islands", image: "photo-1500375592092-40eb2168fd21" },
    { id: "LPA", name: "Gran Canaria", country: "Spain", flight: 285, transfer: 40, adult: 590, night: 215, comfort: 86, season: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], note: "Spain · Canary Islands", image: "photo-1519046904884-53103b34b206" },
    { id: "AGP", name: "Costa del Sol", country: "Spain", flight: 180, transfer: 45, adult: 470, night: 190, comfort: 84, season: [4, 5, 6, 7, 8, 9, 10], note: "Spain · via Málaga", image: "photo-1507525428034-b723cf961d3e" },
    { id: "RHO", name: "Rhodes", country: "Greece", flight: 220, transfer: 50, adult: 550, night: 205, comfort: 86, season: [5, 6, 7, 8, 9, 10], note: "Greece · Dodecanese Islands", image: "photo-1500375592092-40eb2168fd21" },
    { id: "KGS", name: "Kos", country: "Greece", flight: 210, transfer: 35, adult: 520, night: 195, comfort: 85, season: [5, 6, 7, 8, 9, 10], note: "Greece · Dodecanese Islands", image: "photo-1519046904884-53103b34b206" },
    { id: "CFU", name: "Corfu", country: "Greece", flight: 165, transfer: 45, adult: 490, night: 190, comfort: 84, season: [5, 6, 7, 8, 9], note: "Greece · Ionian Islands", image: "photo-1473116763249-2faaef81ccda" },
    { id: "SAUERLAND", travelMode: "drive", name: "Sauerland", country: "Germany", km: 100, minutes: 95, night: 150, comfort: 85, season: [], note: "Close to home", image: "photo-1441974231531-c6227db76b6e" },
    { id: "LIMBURG", travelMode: "drive", name: "Limburg", country: "Netherlands", km: 155, minutes: 125, night: 175, comfort: 88, season: [], note: "Holiday-park country", image: "photo-1473448912268-2022ce9509d8" },
    { id: "EIFEL", travelMode: "drive", name: "Eifel", country: "Germany", km: 200, minutes: 150, night: 155, comfort: 84, season: [], note: "Forest paths & family time", image: "photo-1441974231531-c6227db76b6e" },
    { id: "ZEELAND", travelMode: "drive", name: "Zeeland", country: "Netherlands", km: 310, minutes: 225, night: 210, comfort: 86, season: [], note: "A coast within driving distance", image: "photo-1507525428034-b723cf961d3e" },
    { id: "ARDENNES", travelMode: "drive", name: "Ardennes", country: "Belgium", km: 280, minutes: 210, night: 160, comfort: 82, season: [], note: "Space to slow down", image: "photo-1473448912268-2022ce9509d8" }
  ];
  const fallbackHolidays = {
    2027: [
      { id: "easter-2027", providerId: "c9edf367-0f13-492f-bf7c-957b8209e5d4", name: "Easter holidays", start: "2027-03-22", end: "2027-04-03" },
      { id: "summer-2027", providerId: "1da9b5c8-3b0d-4510-a727-f44689e3f881", name: "Summer holidays", start: "2027-07-19", end: "2027-08-31" }
    ],
    2028: [{ id: "summer-2028", name: "Summer holidays", start: "2028-07-10", end: "2028-08-22" }],
    2029: [{ id: "summer-2029", name: "Summer holidays", start: "2029-07-02", end: "2029-08-14" }],
    2030: [{ id: "summer-2030", name: "Summer holidays", start: "2030-06-24", end: "2030-08-06" }]
  };
  const iso = date => date.toISOString().slice(0, 10);
  const addDays = (date, days) => iso(new Date(Date.parse(date + "T12:00:00Z") + days * 86400000));
  const daysBetween = (start, end) => Math.round((Date.parse(end + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / 86400000);
  const validDate = date => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + "T12:00:00Z")) && iso(new Date(date + "T12:00:00Z")) === date;
  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = (h + l - 7 * m + 114) % 31 + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function nrwPublicHolidays(year) {
    const easter = easterSunday(year);
    return new Set([
      `${year}-01-01`, `${year}-05-01`, `${year}-10-03`, `${year}-11-01`, `${year}-12-25`, `${year}-12-26`,
      addDays(easter, -2), addDays(easter, 1), addDays(easter, 39), addDays(easter, 50), addDays(easter, 60)
    ]);
  }
  function extendConnectedHoliday(holiday) {
    if (!holiday || !validDate(holiday.start) || !validDate(holiday.end) || holiday.start > holiday.end) return holiday;
    const schoolStart = holiday.schoolStart || holiday.start;
    const schoolEnd = holiday.schoolEnd || holiday.end;
    const publicDays = new Set();
    for (let year = Number(schoolStart.slice(0, 4)) - 1; year <= Number(schoolEnd.slice(0, 4)) + 1; year += 1) {
      nrwPublicHolidays(year).forEach(date => publicDays.add(date));
    }
    const isConnectedDay = date => {
      const weekday = new Date(date + "T12:00:00Z").getUTCDay();
      return weekday === 0 || weekday === 6 || publicDays.has(date);
    };
    let start = schoolStart;
    while (isConnectedDay(addDays(start, -1))) start = addDays(start, -1);
    let end = schoolEnd;
    while (isConnectedDay(addDays(end, 1))) end = addDays(end, 1);
    return { ...holiday, start, end, schoolStart, schoolEnd };
  }
  function departures(holiday, nights, today) {
    if (!holiday || !validDate(holiday.start) || !validDate(holiday.end)) return [];
    const dates = [];
    const earliest = today && today > holiday.start ? today : holiday.start;
    for (let date = earliest; addDays(date, nights) <= holiday.end; date = addDays(date, 1)) dates.push(date);
    return dates;
  }
  function totalCost(quote, settings) {
    if (travelModeOf(quote) === "drive") return Math.round(quote.hotel + quote.extras + (quote.meals ?? 0) + quote.driveKm * 2 * settings.costPerKm + quote.roadFees + quote.stayParking - acceptedDiscount(quote));
    const airport = airports.find(item => item.code === quote.airport);
    const drive = airport.km * 2 * settings.costPerKm;
    const parking = settings.parkingPerDay * (quote.nights + 1);
    return Math.round(quote.base + quote.flights + quote.hotel + quote.bags + quote.transfer + quote.extras + (quote.meals ?? 0) + drive + parking - acceptedDiscount(quote));
  }
  function journeyMinutes(quote, settings = {}) {
    if (travelModeOf(quote) === "drive") return quote.driveMinutes + (settings.roadBreakMinutes ?? 30);
    const airport = airports.find(item => item.code === quote.airport);
    return airport.minutes + 120 + quote.flightMinutes + quote.transferMinutes + 45;
  }
  function pricePerNight(quote, settings) {
    return totalCost(quote, settings) / quote.nights;
  }
  const supplierTotal = quote => quote.base + quote.flights + quote.hotel + quote.bags + quote.transfer + quote.extras;
  function benefitSaving(quote) {
    const benefit = quote.benefit;
    if (!benefit || supplierTotal(quote) < benefit.minimumSpend) return 0;
    return Math.round(Math.min(benefit.eligibleAmount * benefit.percent / 100, benefit.cap ?? Infinity) * 100) / 100;
  }
  const acceptedDiscount = quote => quote.benefit?.accepted === true && quote.benefit.type === "instant" ? benefitSaving(quote) : 0;
  const priceFingerprint = quote => JSON.stringify([quote.travelMode || "flight", quote.mode, quote.destination, quote.airport, quote.start, quote.nights, quote.adults, [...quote.ages].sort((first, second) => first - second), quote.capacity, mealPlanOf(quote), quote.url, quote.base, quote.flights, quote.hotel, quote.bags, quote.transfer, quote.extras, quote.direct, quote.stops, quote.layoverMinutes, quote.flightMinutes, quote.transferMinutes, quote.driveKm, quote.driveMinutes, quote.roadFees, quote.stayParking, quote.flightLegs || null, quote.benefit || null]);
  function priceState(quote, now = Date.now()) {
    if (quote.demo) return "example";
    const verification = quote.priceVerification;
    if (!verification || verification.kind !== "manual-final" || !verification.provider.trim() || !quote.url || !Number.isFinite(verification.total) || verification.total < 0 || verification.fingerprint !== priceFingerprint(quote) || Math.abs(verification.total - (supplierTotal(quote) - acceptedDiscount(quote))) > 0.005) return "unverified";
    const checked = Date.parse(verification.checkedAt);
    if (!Number.isFinite(checked) || checked > now + 60000) return "unverified";
    return now - checked > 30 * 60000 ? "expired" : "manual-final";
  }
  function markFinalPriceChecked(quote, provider, checkoutTotal, now = Date.now()) {
    if (!provider.trim() || !quote.url || quote.demo) throw new Error("Final-price checks need a provider name and an HTTPS offer link.");
    if (!Number.isFinite(checkoutTotal) || Math.abs(checkoutTotal - (supplierTotal(quote) - acceptedDiscount(quote))) > 0.005) throw new Error("Final checkout total must match supplier charges after accepted instant discounts. Do not deduct the voucher twice.");
    return { ...quote, priceVerification: { kind: "manual-final", provider: provider.trim().slice(0, 160), checkedAt: new Date(now).toISOString(), total: checkoutTotal, fingerprint: priceFingerprint(quote) } };
  }
  function returnJourneyMinutes(quote, settings) {
    return journeyMinutes(quote.flightLegs ? { ...quote, flightMinutes: quote.flightLegs.inbound.minutes } : quote, settings);
  }
  function score(quote, settings) {
    const cost = Math.max(0, 100 * (1 - totalCost(quote, settings) / (settings.budget * 1.5)));
    const averageJourney = (journeyMinutes(quote, settings) + returnJourneyMinutes(quote, settings)) / 2;
    const time = Math.max(0, 100 * (1 - averageJourney / 900));
    const sum = settings.weights.cost + settings.weights.comfort + settings.weights.time;
    if (!sum) return 0;
    return Math.round((cost * settings.weights.cost + quote.comfort * settings.weights.comfort + time * settings.weights.time) / sum);
  }
  function reviewOutOfTen(quote) {
    if (typeof quote.reviewScore !== "number" || !Number.isFinite(quote.reviewScore) || ![5, 6, 10].includes(quote.reviewScale) || quote.reviewScore < 0 || quote.reviewScore > quote.reviewScale) return null;
    return quote.reviewScore * 10 / quote.reviewScale;
  }
  function qualityMatches(quote, settings) {
    const stars = settings.minHotelStars ?? 0;
    const minimumReview = settings.minReviewScore ?? 0;
    const review = reviewOutOfTen(quote);
    return (!stars || (typeof quote.hotelStars === "number" && quote.hotelStars >= stars)) &&
      (!minimumReview || (review !== null && review >= minimumReview));
  }
  function eligible(quote, settings, holiday, today) {
    const airport = airports.find(item => item.code === quote.airport);
    const mealPlan = settings.mealPlan ?? (settings.allInclusive ? "all-inclusive" : "any");
    const driving = travelModeOf(quote) === "drive";
    const layoverMatches = quote.direct || (typeof quote.layoverMinutes === "number" && quote.layoverMinutes <= (settings.maxLayoverMinutes ?? 300));
    const stopMatches = settings.directOnly ? quote.direct : (quote.direct || (quote.stops === 1 && layoverMatches));
    const routeMatches = driving ? settings.driveDestinations?.includes(quote.destination) && quote.driveMinutes <= (settings.maxHolidayDrive ?? 360) : airport && settings.airports.includes(quote.airport) && airport.minutes <= settings.maxDrive && settings.destinations.includes(quote.destination) && stopMatches;
    return travelModeOf(quote) === (settings.driving ? "drive" : "flight") && routeMatches && holiday &&
      (settings.mode === "all" || quote.mode === settings.mode) && qualityMatches(quote, settings) && (!settings.confirmedOnly || priceState(quote) === "manual-final") && (!quote.flightLegs || settings.mixFlights === true) && (mealPlan === "any" || mealPlanOf(quote) === mealPlan) &&
      stayLengths(settings).includes(quote.nights) && quote.start >= holiday.start && quote.start >= today &&
      addDays(quote.start, quote.nights) <= holiday.end && quote.adults === settings.adults &&
      JSON.stringify([...quote.ages].sort((first, second) => first - second)) === JSON.stringify([...settings.ages].sort((first, second) => first - second)) &&
      quote.capacity >= settings.adults + settings.ages.length && totalCost(quote, settings) <= settings.budget;
  }
  function rank(quotes, settings, holiday, today) {
    return quotes.filter(quote => eligible(quote, settings, holiday, today))
      .map(quote => ({ ...quote, total: totalCost(quote, settings), journey: journeyMinutes(quote, settings), score: score(quote, settings) }))
      .sort((first, second) => second.score - first.score || first.total - second.total);
  }
  function emptyReason(quotes, settings, holiday, today) {
    if (!holiday || !departures(holiday, stayLengths(settings)[0] || 36, today).length) return "dates";
    if (!quotes.length && !settings.examples) return "no-data";
    if (settings.confirmedOnly && !quotes.some(quote => priceState(quote) === "manual-final")) return "final-price";
    const candidates = [...quotes, ...(settings.examples ? demoQuotes(settings, holiday, today) : [])];
    if ((settings.minHotelStars || settings.minReviewScore) && rank(candidates, { ...settings, minHotelStars: 0, minReviewScore: 0 }, holiday, today).length) return "quality";
    if (settings.mealPlan !== "any" && rank(candidates, { ...settings, mealPlan: "any" }, holiday, today).length) return "meal-plan";
    return "filters";
  }
  function demoQuotes(settings, holiday, today) {
    if (settings.driving) return driveDemoQuotes(settings, holiday, today);
    const guests = settings.adults + settings.ages.length;
    const quotes = [];
    for (const nights of stayLengths(settings)) {
      const dates = departures(holiday, nights, today);
      if (!dates.length) continue;
      destinations.filter(destination => destination.travelMode !== "drive").forEach((destination, destinationIndex) => airports.forEach((airport, airportIndex) => {
        ["package", "separate"].forEach(mode => {
          ["all-inclusive", "full-board", "room-only"].forEach(mealPlan => {
            const start = dates[Math.min(dates.length - 1, (airportIndex * 3 + destinationIndex * 5) % dates.length)];
            const flights = Math.round((destination.adult + (airportIndex % 3 - 1) * 55) * (settings.adults + settings.ages.length * 0.85));
            const hotelFactor = mealPlan === "room-only" ? 0.65 : mealPlan === "full-board" ? 0.88 : 1;
            const hotel = Math.round(destination.night * nights * Math.max(1, guests / 5) * hotelFactor);
            const meals = mealPlan === "room-only" ? nights * (settings.adults * 30 + settings.ages.length * 18) : mealPlan === "full-board" ? nights * (settings.adults * 8 + settings.ages.length * 5) : 0;
            quotes.push({ id: `demo-${destination.id}-${airport.code}-${mode}-${mealPlan}-${nights}`, destination: destination.id, airport: airport.code,
              title: `${destination.name} family-resort scenario`, mode, start, nights,
              adults: settings.adults, ages: [...settings.ages], capacity: guests, direct: true, mealPlan, allInclusive: mealPlan === "all-inclusive",
              base: mode === "package" ? Math.round((flights + hotel) * (0.91 + (airportIndex % 3) * 0.055)) : 0,
              flights: mode === "separate" ? flights : 0, hotel: mode === "separate" ? hotel : 0,
              bags: mode === "separate" ? 160 : 0, transfer: mode === "separate" ? 110 : 0, extras: 0, meals,
              flightMinutes: destination.flight, transferMinutes: destination.transfer,
              comfort: Math.min(100, destination.comfort + (mode === "package" ? 4 : -3)), demo: true, checkedAt: "", url: "" });
          });
        });
      }));
    }
    return quotes;
  }
  function driveDemoQuotes(settings, holiday, today) {
    const quotes = [];
    for (const nights of stayLengths(settings)) {
      const dates = departures(holiday, nights, today);
      if (!dates.length) continue;
      destinations.filter(destination => destination.travelMode === "drive").forEach((destination, index) => {
        ["holiday-home", "holiday-park"].forEach(mode => {
          const meals = nights * (settings.adults * 30 + settings.ages.length * 18);
          quotes.push({ id: `demo-drive-${destination.id}-${mode}-${nights}`, travelMode: "drive", destination: destination.id,
            airport: "", title: `${destination.name} ${bookingLabel({ mode })} scenario`, mode, start: dates[Math.min(index * 3, dates.length - 1)], nights,
            adults: settings.adults, ages: [...settings.ages], capacity: settings.adults + settings.ages.length,
            base: 0, flights: 0, hotel: Math.round(destination.night * nights * Math.max(1, (settings.adults + settings.ages.length) / 5) * (mode === "holiday-park" ? 1.15 : 1)),
            bags: 0, transfer: 0, extras: 100, meals, driveKm: destination.km, driveMinutes: destination.minutes, roadFees: 0, stayParking: 0,
            flightMinutes: 0, transferMinutes: 0, direct: false, mealPlan: "room-only", allInclusive: false, comfort: destination.comfort, demo: true, checkedAt: "", url: "" });
        });
      });
    }
    return quotes;
  }
  function validateQuote(input) {
    if (!input || typeof input !== "object") throw new Error("Each quote must be an object.");
    const quote = {};
    if (input.travelMode !== undefined && !["flight", "drive"].includes(input.travelMode)) throw new Error("Invalid travel mode.");
    quote.travelMode = travelModeOf(input);
    const driving = quote.travelMode === "drive";
    for (const key of ["title", "mode", "destination", "airport", "start", "checkedAt", "url"]) quote[key] = String(input[key] ?? "").slice(0, key === "url" ? 2000 : 160);
    if (!quote.title.trim() || !(driving ? ["holiday-home", "holiday-park"] : ["package", "separate"]).includes(quote.mode) || (!driving && !airports.some(item => item.code === quote.airport)) || !destinations.some(item => item.id === quote.destination && (item.travelMode || "flight") === quote.travelMode)) throw new Error("Invalid title, booking type, airport, or destination for this travel mode.");
    if (!validDate(quote.start) || !validDate(quote.checkedAt)) throw new Error("Enter valid departure and price-check dates.");
    for (const key of ["nights", "adults", "capacity", "base", "flights", "hotel", "bags", "transfer", "extras", "flightMinutes", "transferMinutes", "comfort"]) {
      if (input[key] === "" || input[key] === null || input[key] === undefined || !Number.isFinite(Number(input[key])) || Number(input[key]) < 0) throw new Error(`Invalid ${key}.`);
      quote[key] = Number(input[key]);
    }
    if (!Number.isInteger(quote.nights) || quote.nights < 1 || quote.nights > 35 || !Number.isInteger(quote.adults) || quote.adults < 1 || quote.adults > 6 || !Number.isInteger(quote.capacity) || quote.capacity < 1 || quote.capacity > 20 || quote.comfort > 100 || (!driving && quote.flightMinutes < 1)) throw new Error("Check nights, adults, occupancy, flight time, and comfort (0–100).");
    if (driving) {
      for (const key of ["driveKm", "driveMinutes", "roadFees", "stayParking"]) {
        if (input[key] === "" || input[key] === null || input[key] === undefined || !Number.isFinite(Number(input[key])) || Number(input[key]) < 0) throw new Error(`Invalid ${key}.`);
        quote[key] = Number(input[key]);
      }
      if (!quote.driveKm || !quote.driveMinutes || quote.hotel <= 0 || quote.base || quote.flights || quote.bags || quote.transfer || quote.flightMinutes || quote.transferMinutes || quote.airport) throw new Error("Driving quotes need accommodation and road details, with zero airport/flight costs and times.");
    }
    if (!Array.isArray(input.ages) || input.ages.length > 6 || input.ages.some(age => !Number.isInteger(age) || age < 0 || age > 17)) throw new Error("Child ages must be whole numbers from 0 to 17.");
    quote.ages = [...input.ages];
    if (input.flightLegs !== undefined) {
      if (driving || quote.mode !== "separate" || !input.flightLegs || typeof input.flightLegs !== "object") throw new Error("Independent flight legs require a Flight + hotel quote.");
      quote.flightLegs = {};
      for (const direction of ["outbound", "inbound"]) {
        const leg = input.flightLegs[direction];
        if (!leg || !airlines.some(airline => airline.id === leg.carrier)) throw new Error(`Choose a valid ${direction} airline.`);
        const normalized = { carrier: leg.carrier };
        for (const key of ["price", "baggage", "minutes"]) {
          if (leg[key] === "" || leg[key] === null || leg[key] === undefined || !Number.isFinite(Number(leg[key])) || Number(leg[key]) < 0) throw new Error(`Invalid ${direction} ${key}.`);
          normalized[key] = Number(leg[key]);
        }
        if (!normalized.price || !normalized.minutes) throw new Error("Each flight leg needs a positive fare and journey time.");
        quote.flightLegs[direction] = normalized;
      }
      const { outbound, inbound } = quote.flightLegs;
      if (Math.abs(quote.flights - outbound.price - inbound.price) > 0.005 || Math.abs(quote.bags - outbound.baggage - inbound.baggage) > 0.005 || quote.flightMinutes !== outbound.minutes) throw new Error("Flight totals, baggage and outbound time must match the two legs.");
    }
    if (quote.capacity < quote.adults + quote.ages.length) throw new Error("Confirmed room capacity is too small for this family.");
    if (quote.mode === "package" && (quote.base <= 0 || quote.flights || quote.hotel)) throw new Error("Packages need a package price and zero separate flight/hotel prices.");
    if (quote.mode === "separate" && (quote.base || quote.flights <= 0 || quote.hotel <= 0)) throw new Error("Separate bookings need flight and hotel prices, and a zero package price.");
    if (typeof input.direct !== "boolean") throw new Error("The direct-flight flag must be true or false.");
    if (input.mealPlan === undefined && typeof input.allInclusive !== "boolean") throw new Error("Choose a meal plan.");
    if (input.mealPlan !== undefined && !mealPlans.some(item => item.id === input.mealPlan)) throw new Error("Invalid meal plan.");
    quote.mealPlan = mealPlanOf(input);
    if (input.meals !== undefined && (input.meals === null || input.meals === "" || !Number.isFinite(Number(input.meals)) || Number(input.meals) < 0)) throw new Error("Invalid meals and drinks budget.");
    quote.meals = input.meals === undefined ? 0 : Number(input.meals);
    if (quote.url && !/^https:\/\//i.test(quote.url)) throw new Error("Quote links must start with https://.");
    if (quote.url) { try { new URL(quote.url); } catch { throw new Error("Invalid quote link."); } }
    quote.direct = input.direct;
    quote.stops = input.stops === undefined || input.stops === null || input.stops === "" ? (quote.direct ? 0 : null) : Number(input.stops);
    if (quote.stops !== null && (!Number.isInteger(quote.stops) || quote.stops < 0 || quote.stops > 10)) throw new Error("Flight stops must be an integer from 0 to 10, or left unverified.");
    if (quote.direct && quote.stops !== 0) throw new Error("A direct flight must have zero stops.");
    if (!quote.direct && quote.stops === 0) throw new Error("A zero-stop flight must be marked direct.");
    quote.layoverMinutes = input.layoverMinutes === undefined || input.layoverMinutes === null || input.layoverMinutes === "" ? (quote.direct ? 0 : null) : Number(input.layoverMinutes);
    if (quote.layoverMinutes !== null && (!Number.isInteger(quote.layoverMinutes) || quote.layoverMinutes < 0 || quote.layoverMinutes > 1440)) throw new Error("Longest layover must be 0–1440 minutes, or left unverified.");
    if (quote.direct && quote.layoverMinutes !== 0) throw new Error("A direct flight must have no layover.");
    quote.allInclusive = quote.mealPlan === "all-inclusive";
    quote.hotelStars = input.hotelStars === undefined || input.hotelStars === null || input.hotelStars === "" ? null : Number(input.hotelStars);
    if (quote.hotelStars !== null && (!Number.isFinite(quote.hotelStars) || quote.hotelStars < 1 || quote.hotelStars > 5 || !Number.isInteger(quote.hotelStars * 2))) throw new Error("Hotel stars must be 1–5 in half-star steps, or left unrated.");
    quote.reviewScore = input.reviewScore === undefined || input.reviewScore === null || input.reviewScore === "" ? null : Number(input.reviewScore);
    quote.reviewScale = Number(input.reviewScale ?? 10);
    if (![5, 6, 10].includes(quote.reviewScale) || (quote.reviewScore !== null && (!Number.isFinite(quote.reviewScore) || quote.reviewScore < 0 || quote.reviewScore > quote.reviewScale))) throw new Error("Review score must be within its selected 5-, 6- or 10-point scale.");
    quote.reviewSource = String(input.reviewSource ?? "").trim().slice(0, 160);
    if (quote.reviewScore !== null && !quote.reviewSource) throw new Error("Enter the review source, for example HolidayCheck or Booking.com.");
    if (input.benefit !== undefined) {
      const benefit = input.benefit;
      if (!benefit || !["instant", "cashback"].includes(benefit.type) || typeof benefit.accepted !== "boolean") throw new Error("Invalid corporate benefit.");
      const host = quote.url ? new URL(quote.url).hostname.toLowerCase() : "";
      if (host !== "ab-in-den-urlaub.de" && !host.endsWith(".ab-in-den-urlaub.de")) throw new Error("This benefit is restricted to an Ab-in-den-Urlaub offer link.");
      quote.benefit = { type: benefit.type, accepted: benefit.accepted };
      for (const key of ["percent", "eligibleAmount", "minimumSpend"]) {
        if (typeof benefit[key] !== "number" || !Number.isFinite(benefit[key]) || benefit[key] < 0) throw new Error(`Invalid benefit ${key}.`);
        quote.benefit[key] = benefit[key];
      }
      quote.benefit.cap = benefit.cap ?? null;
      if (quote.benefit.percent > 100 || quote.benefit.eligibleAmount > supplierTotal(quote) || (quote.benefit.cap !== null && (typeof quote.benefit.cap !== "number" || !Number.isFinite(quote.benefit.cap) || quote.benefit.cap < 0))) throw new Error("Check voucher percentage, eligible amount and cap.");
    }
    if (input.priceVerification?.kind === "manual-final") {
      const verification = input.priceVerification;
      quote.priceVerification = { kind: "manual-final", provider: String(verification.provider || "").slice(0, 160), checkedAt: String(verification.checkedAt || "").slice(0, 40), total: Number(verification.total), fingerprint: String(verification.fingerprint || "").slice(0, 8000) };
    }
    quote.demo = false;
    quote.id = "quote-" + (root.crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(36).slice(2));
    return quote;
  }
  root.HolidayCore = { airports, mealPlans, mealPlanOf, mealPlanLabel, travelModeOf, bookingLabel, driveProviders, airlines, combineFlightLegs, providerLinks, websiteSearchPlan, stayLengths, destinations, fallbackHolidays, addDays, daysBetween, validDate, extendConnectedHoliday, departures, totalCost, pricePerNight, supplierTotal, benefitSaving, acceptedDiscount, priceState, markFinalPriceChecked, reviewOutOfTen, qualityMatches, journeyMinutes, returnJourneyMinutes, score, eligible, rank, emptyReason, demoQuotes, validateQuote };
})(globalThis);