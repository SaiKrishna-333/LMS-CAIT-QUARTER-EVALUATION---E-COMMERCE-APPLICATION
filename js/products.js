/* ==========================================================================
   NOVA - products.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This is the shopping catalogue engine. It shows every
   product as a card and lets the shopper search, filter by category and
   price, and sort - all working on the list it reads from storage.js.

   HOW THE GRID STAYS IN SYNC
   One function, applyFilters(), is the heart of the page. Every control
   (search box, category ticks, price slider, sort dropdown) simply updates a
   set of options and calls applyFilters(), which re-draws the grid. Because
   there is ONE place that draws results, the filters never fight each other.

   THE URL CAN PRESET A FILTER
   Clicking a category tile on the homepage opens products.html?category=...
   and readUrlParameters() picks that up so the list starts already filtered.

   FUNCTIONS IN THIS FILE
   - buildCategoryCheckboxes() - make the tick-list of the five categories
   - readUrlParameters()       - read ?search= / ?category= from the address
   - attachControlEvents()     - listen to search, ticks, price, sort changes
   - applyFilters()            - filter + sort the catalogue and repaint the
                                 grid, showing a friendly message if empty

   It reuses buildProductCard() from common.js, so a card here behaves
   exactly like the same card on the homepage or wishlist.
   ========================================================================== */

/* ==========================================================================
   NOVA - products.js  (CATALOGUE LOGIC)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Keeps one array of "current filters" in memory, then filters + sorts the
   product list every time anything changes and repaints the grid.
   Also understands URL parameters so other pages can deep-link:
     products.html?search=headphones
     products.html?category=Fashion
     products.html?sort=new          (new arrivals)
     products.html?sort=rating
     products.html?deals=1           (flash deals only)
   ========================================================================== */

// The filter state - every control writes here, applyFilters() reads it.
var filters = {
    search: "",
    categories: [],   // list of ticked categories
    minPrice: null,
    maxPrice: null,
    sort: "default"
};

document.addEventListener("DOMContentLoaded", function () {
    renderHeader("shop");
    renderFooter();
    buildCategoryCheckboxes();
    readUrlParameters();
    attachControlEvents();
    applyFilters();
});

/* ---------- 1. CATEGORY CHECKBOXES ---------- */
function buildCategoryCheckboxes() {
    var html = "";
    NOVA_CATEGORIES.forEach(function (category) {
        html += '<label class="filter-option">' +
            '<input type="checkbox" value="' + category + '" class="cat-check"> ' +
            category + '</label>';
    });
    document.getElementById("categoryFilters").innerHTML = html;
}

/* ---------- 2. URL PARAMETERS ---------- */
function readUrlParameters() {
    var params = new URLSearchParams(window.location.search);

    if (params.get("search")) {
        filters.search = params.get("search");
        document.getElementById("searchInput").value = filters.search;
    }

    if (params.get("category")) {
        filters.categories = [params.get("category")];
    }

    if (params.get("sort")) {
        filters.sort = params.get("sort");
        document.getElementById("sortSelect").value = filters.sort;
    }

    // Deals view: only show products that are discounted.
    if (params.get("deals") === "1") {
        document.getElementById("pageTitle").textContent = "Flash Deals";
        filters.dealsOnly = true;
    }

    if (filters.sort === "new") {
        document.getElementById("pageTitle").textContent = "New Arrivals";
    }

    // Tick the checkboxes that the URL asked for.
    document.querySelectorAll(".cat-check").forEach(function (box) {
        box.checked = filters.categories.indexOf(box.value) !== -1;
    });
}

/* ---------- 3. CONTROL EVENTS ---------- */
function attachControlEvents() {
    // Typing in search: filter live on every keystroke.
    document.getElementById("searchInput").addEventListener("input", function () {
        filters.search = this.value.trim().toLowerCase();
        applyFilters();
    });

    document.querySelectorAll(".cat-check").forEach(function (box) {
        box.addEventListener("change", function () {
            // Rebuild the ticked-category list from the checkboxes.
            filters.categories = [];
            document.querySelectorAll(".cat-check:checked").forEach(function (checked) {
                filters.categories.push(checked.value);
            });
            applyFilters();
        });
    });

    document.getElementById("minPrice").addEventListener("input", function () {
        filters.minPrice = this.value === "" ? null : Number(this.value);
        applyFilters();
    });

    document.getElementById("maxPrice").addEventListener("input", function () {
        filters.maxPrice = this.value === "" ? null : Number(this.value);
        applyFilters();
    });

    document.getElementById("sortSelect").addEventListener("change", function () {
        filters.sort = this.value;
        applyFilters();
    });

    document.getElementById("clearFilters").addEventListener("click", function () {
        // Reset the state object and every control back to "nothing chosen".
        filters = { search: "", categories: [], minPrice: null, maxPrice: null, sort: "default" };
        document.getElementById("searchInput").value = "";
        document.getElementById("minPrice").value = "";
        document.getElementById("maxPrice").value = "";
        document.getElementById("sortSelect").value = "default";
        document.querySelectorAll(".cat-check").forEach(function (b) { b.checked = false; });
        applyFilters();
    });
}

/* ---------- 4. THE HEART OF THE PAGE: FILTER + SORT + PAINT ---------- */
function applyFilters() {
    var list = getProducts();

    // (a) text search - case-insensitive "contains" on the name
    if (filters.search) {
        list = list.filter(function (p) {
            return p.name.toLowerCase().indexOf(filters.search) !== -1 ||
                p.category.toLowerCase().indexOf(filters.search) !== -1;
        });
    }

    // (b) category tick-boxes
    if (filters.categories.length > 0) {
        list = list.filter(function (p) {
            return filters.categories.indexOf(p.category) !== -1;
        });
    }

    // (c) price window
    if (filters.minPrice !== null) {
        list = list.filter(function (p) { return p.price >= filters.minPrice; });
    }
    if (filters.maxPrice !== null) {
        list = list.filter(function (p) { return p.price <= filters.maxPrice; });
    }

    // (d) deals-only view (from the Flash Deals link)
    if (filters.dealsOnly) {
        list = list.filter(function (p) { return p.originalPrice > p.price; });
    }

    // (e) sorting - Array.sort receives a comparison function.
    if (filters.sort === "priceLow") {
        list.sort(function (a, b) { return a.price - b.price; });
    } else if (filters.sort === "priceHigh") {
        list.sort(function (a, b) { return b.price - a.price; });
    } else if (filters.sort === "rating") {
        list.sort(function (a, b) { return b.rating - a.rating; });
    } else if (filters.sort === "new") {
        list = list.filter(function (p) { return p.isNew; });
    }

    // (f) paint the grid (or the empty state)
    var grid = document.getElementById("grid");
    grid.innerHTML = list.map(buildProductCard).join("");
    document.getElementById("noResults").hidden = list.length > 0;
    document.getElementById("resultCount").textContent = list.length + " product" + (list.length === 1 ? "" : "s");
    refreshIcons();
}
