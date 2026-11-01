# School's Out public static site

This repository is for the public, browser-only holiday planner. It deliberately contains no Duffel server, API token, `provider.local.ini`, saved family quotes or private search history. Do not add credentials or personally identifying information to this repository.

## Deploy with GitHub Pages

1. Create a **new, public GitHub repository** solely for this static app. Anyone can view the app and its source; browser-saved preferences and quotes are not published or shared.
2. From the `HolidayPlannerPublic` folder, upload the six app files and `README.md` to the new repository root. Upload these files only; do not upload the parent engineering workspace or `HolidayPlanner` backend source. Do not add `provider.local.ini` or any key.
3. In repository **Settings → Pages**, choose **Deploy from a branch**, select branch `main` and folder `/(root)`, then save.
4. GitHub displays the public `https://OWNER.github.io/REPOSITORY/` URL in Pages settings once deployment completes. Share that URL with your friend; it opens in Chrome.
5. To publish later edits, rerun `Prepare_Public_Site.ps1`, then upload the refreshed six app files to the same repository and commit them to `main`.

## What works on the public site

Ranked illustrative examples, NRW school-holiday dates, filters, provider website hand-offs, copyable trip details and locally saved quotes work in the browser. Your friend's local browser storage is separate from yours. The website search sends trip details to the provider when the visitor opens it. Prices/examples are not live offers; the provider remains responsible for confirming inventory, room capacity and the final total.

The optional Duffel integration **does not run on GitHub Pages**. It needs a separately protected local server and private provider credentials. On the public static site the API request is not made. Direct airline, HolidayCheck, CHECK24, Ab-in-den-Urlaub, TUI, FeWo-direkt and Center Parcs links remain available.

The provider choices are deliberately limited: HolidayCheck for Pauschalreisen; Booking.com Flights and Booking.com Hotels for separate bookings; FeWo-direkt and Center Parcs for driving holidays. In-app provider previews show the trip brief because search forms require interaction and some providers block embedded pages. **Open results in browser** opens the selected provider. Saved direct offer links use a separate sandboxed preview and retain a browser fallback when blocked.

Fonts, photos, the Lucide icon library and NRW holiday dates are loaded from their respective third-party services. The pages are public and have no login; do not enter sensitive personal information.