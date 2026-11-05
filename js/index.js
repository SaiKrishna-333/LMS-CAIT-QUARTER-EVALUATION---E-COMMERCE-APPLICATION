/* ==========================================================================
   NOVA - index.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This script fills the homepage. It paints the hero banner,
   the category tiles, the live flash-deal countdown and every product row by
   reading the catalogue from storage.js and reusing the shared card.

   WHY IT IS SHORT
   The heavy lifting lives elsewhere: storage.js gives the data and common.js
   gives the reusable product card (buildProductCard). This file only decides
   WHICH products to show in each row and drops those cards into the page.

   FUNCTIONS IN THIS FILE (each fills one section top-to-bottom)
   - showHero()            - headline + call-to-action at the very top
   - showCategories()      - the five clickable category tiles
   - countByCategory(cat)  - how many products sit in a category (for tiles)
   - showFlashDeals()      - featured deal items + starts the countdown
   - startCountdown(endIso, noteElement) - ticks every second until the sale
                            time is up, then flips the banner to "ended"
   - tick()                - one second of the countdown maths (days/h/m/s)
   - unit(value, label)    - formats "05 HOURS" style blocks for the timer
   - showBestSellers()     - a row of the highest-rated products
   - showNewArrivals()     - a row of products flagged isNew
   - showRecentlyViewed()  - a row from novaRecentlyViewed (empty at first)
   - showRecommended()     - a personalised-ish row built from the catalogue

   ALL OF THESE RUN ONCE when the page loads, so the homepage appears fully
   populated without the shopper doing anything.
   ========================================================================== */

/* ==========================================================================
   NOVA - index.js  (HOMEPAGE LOGIC)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Fills the homepage sections with live data from Local Storage:
   hero image, category tiles, flash deals + countdown, best sellers,
   new arrivals, recently viewed and simple recommendations.
   ========================================================================== */

// Runs once the page has finished loading.
document.addEventListener("DOMContentLoaded", function () {
    renderHeader("home");
    renderFooter();
    showHero();
    showCategories();
    showFlashDeals();
    showBestSellers();
    showNewArrivals();
    showRecentlyViewed();
    showRecommended();
});

/* ---------- HERO IMAGE ---------- */
// Reuse the first featured product's generated image as the hero visual.
function showHero() {
    var products = getProducts();
    var featured = products.find(function (p) { return p.featured; }) || products[0];

    if (featured) {
        var hero = document.getElementById("heroImage");
        hero.onerror = function () { hero.onerror = null; hero.src = getProductSvg(featured, 0); };
        hero.src = getProductImage(featured, 0);
    }
}

/* ---------- CATEGORY TILES ---------- */
function showCategories() {
    // One emoji icon per category keeps this simple and dependency-free.
    var icons = {
        "Electronics": "💻",
        "Fashion": "🧥",
        "Home & Living": "🛋️",
        "Accessories": "⌚",
        "Lifestyle": "🧘"
    };

    var html = "";
    NOVA_CATEGORIES.forEach(function (category) {
        html += '<a class="category-tile" href="products.html?category=' +
            encodeURIComponent(category) + '">' +
            '<div class="cat-icon">' + icons[category] + '</div>' +
            '<h4>' + category + '</h4><p style="font-size:0.78rem">' +
            countByCategory(category) + ' products</p></a>';
    });

    document.getElementById("categoryGrid").innerHTML = html;
}

// Count products in a category (a simple filter + length).
function countByCategory(category) {
    return getProducts().filter(function (p) {
        return p.category === category;
    }).length;
}

/* ---------- FLASH DEALS + COUNTDOWN ---------- */
var flashTimer = null; // remember setInterval so we can stop it later

function showFlashDeals() {
    var settings = getSettings();
    var grid = document.getElementById("flashGrid");
    var note = document.getElementById("flashNote");

    // Flash deals are switched off from the admin Marketing page.
    if (!settings.flashDealActive) {
        document.getElementById("flashSection").hidden = true;
        return;
    }

    // Top 4 discounted products become the flash deal items.
    var deals = getProducts()
        .filter(function (p) { return p.originalPrice > p.price; })
        .sort(function (a, b) { return (b.originalPrice - b.price) - (a.originalPrice - a.price); })
        .slice(0, 4);

    grid.innerHTML = deals.map(buildProductCard).join("");
    refreshIcons();
    startCountdown(settings.flashDealEnd, note);
}

// Update the four countdown boxes once per second until the end time.
function startCountdown(endIso, noteElement) {
    var box = document.getElementById("flashCountdown");

    function tick() {
        var msLeft = new Date(endIso).getTime() - Date.now();

        if (msLeft <= 0) {
            // Promotion over: show the expired state and stop the timer.
            box.innerHTML = '<div class="unit"><b>00</b><span>expired</span></div>';
            noteElement.textContent = "This promotion has ended. Stay tuned for the next drop!";
            clearInterval(flashTimer);
            return;
        }

        var seconds = Math.floor(msLeft / 1000);
        var days = Math.floor(seconds / 86400);
        var hours = Math.floor(seconds % 86400 / 3600);
        var mins = Math.floor(seconds % 3600 / 60);
        var secs = seconds % 60;

        box.innerHTML =
            unit(days, "days") + unit(hours, "hrs") +
            unit(mins, "min") + unit(secs, "sec");
    }

    function unit(value, label) {
        var text = value < 10 ? "0" + value : value;
        return '<div class="unit"><b>' + text + '</b><span>' + label + '</span></div>';
    }

    tick(); // draw immediately so there is no empty flash
    flashTimer = setInterval(tick, 1000);
}

/* ---------- BEST SELLERS ---------- */
// The admin Marketing page chooses featured ids; we show those products.
function showBestSellers() {
    var settings = getSettings();
    var html = "";

    settings.featuredIds.forEach(function (id) {
        var product = findProduct(id);
        if (product) { html += buildProductCard(product); }
    });

    document.getElementById("bestGrid").innerHTML = html;
    refreshIcons();
}

/* ---------- NEW ARRIVALS ---------- */
function showNewArrivals() {
    var news = getProducts().filter(function (p) { return p.isNew; });
    document.getElementById("newGrid").innerHTML = news.map(buildProductCard).join("");
    refreshIcons();
}

/* ---------- RECENTLY VIEWED ---------- */
// Every time a visitor opens a product page its id is unshifted into
// novaRecentlyViewed (see product-details.js). We simply render them back.
function showRecentlyViewed() {
    var ids = getRecentlyViewed();
    var section = document.getElementById("recentSection");

    if (ids.length === 0) {
        section.hidden = true;
        return;
    }

    section.hidden = false;
    var html = "";
    ids.slice(0, 6).forEach(function (id) {
        var product = findProduct(id);
        if (product) { html += buildProductCard(product); }
    });

    document.getElementById("recentGrid").innerHTML = html;
    refreshIcons();
}

/* ---------- RECOMMENDED ---------- */
// A tiny rule-based "recommendation engine": if you recently viewed an
// Electronics product, suggest other highly-rated Electronics you have not
// opened yet. Simple, explainable, and no machine learning needed.
function showRecommended() {
    var viewed = getRecentlyViewed();
    var section = document.getElementById("recSection");

    if (viewed.length === 0) {
        section.hidden = true;
        return;
    }

    var lastViewed = findProduct(viewed[0]);
    if (!lastViewed) { section.hidden = true; return; }

    var picks = getProducts().filter(function (p) {
        return p.category === lastViewed.category &&
            p.id !== lastViewed.id &&
            viewed.indexOf(p.id) === -1 &&
            p.rating >= 4.4;
    }).slice(0, 4);

    if (picks.length === 0) { section.hidden = true; return; }

    section.hidden = false;
    document.getElementById("recGrid").innerHTML = picks.map(buildProductCard).join("");
    refreshIcons();
}
