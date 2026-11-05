/* ==========================================================================
   NOVA - product-details.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This file builds the deep-dive page for ONE product - the
   photo gallery, price, colour swatches, quantity picker, tabs (description
   / specs / reviews), related items and the Add-to-Cart / Buy-Now buttons.

   WHICH PRODUCT IS SHOWN?
   The page is opened with product-details.html?id=P7. The script reads that
   id from the address bar, finds the matching object with findProduct(id)
   from storage.js, and fills the whole page from it. It also records the
   visit in novaRecentlyViewed so the homepage can suggest it later.

   FUNCTIONS IN THIS FILE
   - recordRecentlyViewed(id)  - push this product into the last-8 list
   - showGallery()             - main image + thumbnails (front/side/detail)
   - showInfo()                - name, rating, price, savings, stock status
   - swatch(color, name)       - one selectable colour dot
   - wishlistInner(id)         - filled/outline heart depending on wishlist
   - attachSwatchEvents()      - clicking a swatch marks it chosen
   - stepQty(delta)            - the +/- buttons around the quantity box
   - attachQtyInputEvents()    - keep a typed quantity within 1..stock
   - handleAddToCart()         - add chosen quantity, then show a toast
   - handleBuyNow()            - add to cart AND jump straight to checkout
   - attachTabEvents()         - switch between description/specs/reviews
   - fillTabs()                - put the real content into each tab panel
   - buildSampleReviews()      - a few clearly-labelled example reviews
   - showRelated()             - other products from the same category

   The gallery images come from the same SVG factory in storage.js, so this
   page needs no external photo files at all.
   ========================================================================== */

/* ==========================================================================
   NOVA - product-details.js  (SINGLE PRODUCT PAGE)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   - Reads ?id=P1 from the address bar and shows that product.
   - Gallery with two generated views, quantity stepper, variant dots.
   - Add to Cart / Buy Now / Wishlist / Add to Compare actions.
   - Tabs: Overview, Specifications, Reviews (sample), Shipping.
   - Saves the visit into novaRecentlyViewed and shows related products.
   ========================================================================== */

var product = null;      // the product being displayed
var chosenQty = 1;       // quantity from the stepper
var chosenVariant = "Midnight"; // simple colour choice (visual only)

document.addEventListener("DOMContentLoaded", function () {
    renderHeader("shop");
    renderFooter();

    // Read the product id from the URL: product-details.html?id=P1
    var params = new URLSearchParams(window.location.search);
    product = findProduct(params.get("id"));

    if (!product) {
        document.getElementById("pdInfo").innerHTML =
            '<div class="empty-state"><h3>Product not found</h3>' +
            '<p>It may have been deleted. Browse the full catalogue instead.</p>' +
            '<a href="products.html" class="btn btn-primary">Go to Shop</a></div>';
        return;
    }

    document.title = product.name + " – NOVA";
    recordRecentlyViewed(product.id);
    showGallery();
    showInfo();
    fillTabs();
    showRelated();
    attachTabEvents();
});

/* ---------- RECENTLY VIEWED ---------- */
// Keep the newest id first and never store more than 8 entries.
function recordRecentlyViewed(id) {
    var list = getRecentlyViewed();
    var position = list.indexOf(id);

    if (position !== -1) { list.splice(position, 1); } // avoid duplicates
    list.unshift(id);

    saveRecentlyViewed(list.slice(0, 8));
}

/* ---------- GALLERY ---------- */
// The SVG image factory can render two angles per product, so the
// thumbnails behave like a small real gallery.
function showGallery() {
    var thumbs = document.getElementById("thumbs");
    thumbs.innerHTML =
        '<img src="' + getProductImage(product, 0) + '" data-view="0" class="selected" alt="View 1" onerror="this.onerror=null;this.src=getProductSvgById(\'' + product.id + '\',0)">' +
        '<img src="' + getProductImage(product, 1) + '" data-view="1" alt="View 2" onerror="this.onerror=null;this.src=getProductSvgById(\'' + product.id + '\',1)">';

    setMainImage(0);

    thumbs.addEventListener("click", function (event) {
        if (event.target.tagName !== "IMG") { return; }
        setMainImage(Number(event.target.dataset.view));

        thumbs.querySelectorAll("img").forEach(function (img) { img.classList.remove("selected"); });
        event.target.classList.add("selected");
    });
}

// Put a product photo into the big image and (re)attach the SVG fallback, so a
// photo that fails to load quietly swaps to the offline studio render.
function setMainImage(view) {
    var main = document.getElementById("mainImage");
    main.onerror = function () { main.onerror = null; main.src = getProductSvg(product, view); };
    main.src = getProductImage(product, view);
}

/* ---------- INFORMATION PANEL (right column) ---------- */
function showInfo() {
    var discount = Math.round((1 - product.price / product.originalPrice) * 100);
    var wishlisted = getWishlist().indexOf(product.id) !== -1;

    // The three spec items shown as icon chips under the description.
    var specKeys = Object.keys(product.specs).slice(0, 3);
    var featureHtml = "";
    specKeys.forEach(function (key) {
        featureHtml += '<div class="pd-feature"><i data-lucide="sparkle"></i><br>' +
            key + '<br><b style="color:var(--text)">' + product.specs[key] + '</b></div>';
    });

    document.getElementById("pdInfo").innerHTML =
        (product.featured ? '<span class="hero-badge" style="margin-bottom:10px">Best Seller</span>' : "") +
        '<h1>' + escapeHtml(product.name) + '</h1>' +
        '<div class="rating" style="margin:8px 0">' + starsHtml(product.rating) + ' ' +
        product.rating.toFixed(1) + ' (' + product.reviews + ' reviews)</div>' +
        '<div class="pd-price-row"><span class="pd-price">' + formatMoney(product.price) + '</span>' +
        '<span class="price-old">' + formatMoney(product.originalPrice) + '</span>' +
        (discount > 0 ? '<span class="discount-pill" style="position:static">Save ' + discount + '%</span>' : "") +
        '</div>' +
        '<p>' + escapeHtml(product.description) + '</p>' +
        '<div class="pd-features">' + featureHtml + '</div>' +
        '<div style="display:flex;gap:40px;flex-wrap:wrap">' +
        '<div><div class="qty-row"><span style="font-size:0.85rem;color:var(--text-2)">Colour</span></div>' +
        '<div class="swatches" id="swatches">' +
        swatch("#5b3a8f", "Midnight") + swatch("#c9c6d0", "Pearl") + swatch("#3a5a8f", "Ocean") +
        '</div></div>' +
        '<div><div class="qty-row"><span style="font-size:0.85rem;color:var(--text-2)">Quantity</span></div>' +
        '<div class="qty-stepper">' +
        '<button onclick="stepQty(-1)">−</button>' +
        '<input type="number" id="qtyInput" value="1" min="1" max="' + product.stock + '">' +
        '<button onclick="stepQty(1)">+</button>' +
        '</div><div style="margin-top:8px">' + stockLabel(product.stock) + '</div></div>' +
        '</div>' +
        '<div class="pd-buy-row">' +
        '<button class="btn btn-primary" ' + (product.stock === 0 ? "disabled" : "") +
        ' onclick="handleAddToCart()"><i data-lucide="shopping-cart"></i> Add to Cart</button>' +
        '<button class="btn btn-outline" ' + (product.stock === 0 ? "disabled" : "") +
        ' onclick="handleBuyNow()"><i data-lucide="zap"></i> Buy Now</button>' +
        '<button class="btn btn-outline" onclick="toggleWishlist(\'' + product.id + '\');this.innerHTML=wishlistInner(\'' + product.id + '\');refreshIcons()">' +
        '<span id="wishBtnInner">' + (wishlisted ? "♥ In Wishlist" : "♡ Add to Wishlist") + '</span></button>' +
        '</div>' +
        '<div class="trust-row">' +
        '<span><i data-lucide="shield-check"></i> 2-Year Warranty</span>' +
        '<span><i data-lucide="rotate-ccw"></i> 30-Day Returns</span>' +
        '<span><i data-lucide="truck"></i> Free Shipping over ' + formatMoney(getSettings().freeDeliveryMin) + '</span>' +
        '<button class="btn btn-outline btn-sm" onclick="addToCompare(\'' + product.id + '\');location.href=\'compare.html\'"><i data-lucide="scale"></i> Compare</button>' +
        '</div>';

    refreshIcons();
    attachSwatchEvents();
    attachQtyInputEvents();
}

function swatch(color, name) {
    return '<button class="swatch' + (name === chosenVariant ? " selected" : "") +
        '" style="background:' + color + '" data-name="' + name + '" title="' + name + '"></button>';
}

// Wishlist button text helper (toggles heart state after a click).
function wishlistInner(id) {
    return getWishlist().indexOf(id) !== -1 ? "♥ In Wishlist" : "♡ Add to Wishlist";
}

function attachSwatchEvents() {
    document.getElementById("swatches").addEventListener("click", function (event) {
        var target = event.target;
        if (!target.classList.contains("swatch")) { return; }

        document.querySelectorAll(".swatch").forEach(function (s) { s.classList.remove("selected"); });
        target.classList.add("selected");
        chosenVariant = target.dataset.name;
    });
}

/* ---------- QUANTITY ---------- */
function stepQty(delta) {
    var input = document.getElementById("qtyInput");
    var value = Number(input.value) + delta;

    // Clamp between 1 and the available stock.
    if (value < 1) { value = 1; }
    if (value > product.stock) { value = Math.max(1, product.stock); }

    input.value = value;
    chosenQty = value;
}

function attachQtyInputEvents() {
    document.getElementById("qtyInput").addEventListener("input", function () {
        var value = Number(this.value);
        if (isNaN(value) || value < 1) { value = 1; }
        if (value > product.stock) {
            value = Math.max(1, product.stock);
            showToast("Only " + product.stock + " units in stock.", "error");
        }
        this.value = value;
        chosenQty = value;
    });
}

/* ---------- BUY ACTIONS ---------- */
function handleAddToCart() {
    addToCart(product.id, chosenQty);
}

// Buy Now: put the item in the cart and jump straight to checkout.
function handleBuyNow() {
    if (addToCart(product.id, chosenQty)) {
        window.location.href = "checkout.html";
    }
}

/* ---------- TABS ---------- */
function attachTabEvents() {
    document.querySelectorAll(".tab-btn").forEach(function (button) {
        button.addEventListener("click", function () {
            document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
            document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });

            button.classList.add("active");
            document.getElementById("tab-" + button.dataset.tab).classList.add("active");
        });
    });
}

function fillTabs() {
    // Overview: description + bullet highlights from the specs.
    var bullets = "";
    Object.keys(product.specs).forEach(function (key) {
        bullets += "<li>✔ " + key + ": " + product.specs[key] + "</li>";
    });

    document.getElementById("tab-overview").innerHTML =
        "<p>" + escapeHtml(product.description) + "</p><ul style='margin-top:14px'>" + bullets + "</ul>";

    // Specifications: one two-column table.
    var rows = "";
    Object.keys(product.specs).forEach(function (key) {
        rows += "<tr><td>" + key + "</td><td>" + product.specs[key] + "</td></tr>";
    });
    document.getElementById("tab-specs").innerHTML =
        '<table class="spec-table"><tbody>' + rows +
        '<tr><td>Category</td><td>' + product.category + '</td></tr>' +
        '<tr><td>Availability</td><td>' + (product.stock > 0 ? product.stock + " in stock" : "Out of stock") + '</td></tr>' +
        '</tbody></table>';

    // Reviews: clearly-labelled SAMPLE reviews generated from the rating.
    document.getElementById("tab-reviews").innerHTML = buildSampleReviews();
}

// The reviews are demonstration content, so we say so on the page.
function buildSampleReviews() {
    var names = ["Aarav S.", "Meera K.", "Rohan T."];
    var texts = [
        "Exactly as described. The build quality feels premium for the price.",
        "Delivered quickly and the packaging was excellent. Happy with the purchase.",
        "Good value overall. Would recommend to a friend looking in this category."
    ];

    var listHtml = "";
    for (var i = 0; i < 3; i++) {
        var stars = Math.max(3, Math.round(product.rating) - (i === 2 ? 1 : 0));
        listHtml += '<div class="review"><div class="r-head"><b>' + names[i] + '</b>' +
            '<span>' + starsHtml(stars) + '</span></div>' +
            '<p style="font-size:0.85rem">' + texts[i] + '</p></div>';
    }

    // Distribution bars: build a believable split around the average rating.
    var five = Math.round(product.rating / 5 * 80);
    var distHtml = "";
    var shares = [five, Math.round(five * 0.18), 3, 1, 1];
    for (var star = 5; star >= 1; star--) {
        var pct = shares[5 - star];
        distHtml += '<div class="dist-row"><span>' + star + ' ★</span>' +
            '<div class="dist-bar"><div class="dist-fill" style="width:' + pct + '%"></div></div>' +
            '<span>' + pct + '%</span></div>';
    }

    return '<div style="display:grid;grid-template-columns:200px 1fr;gap:26px">' +
        '<div style="text-align:center"><div style="font-size:3rem;font-weight:800">' + product.rating.toFixed(1) + '</div>' +
        starsHtml(product.rating) + '<p style="font-size:0.8rem;margin-top:6px">Based on ' + product.reviews + ' sample reviews</p></div>' +
        '<div>' + distHtml + '</div></div>' +
        '<p style="font-size:0.75rem;margin:14px 0">⚠ Demonstration reviews - included to show the layout.</p>' +
        listHtml;
}

/* ---------- RELATED PRODUCTS ---------- */
// Same category, skipping the current product; fill up to 4 slots.
function showRelated() {
    var related = getProducts().filter(function (p) {
        return p.category === product.category && p.id !== product.id;
    }).slice(0, 3);

    if (related.length < 4) {
        getProducts().forEach(function (p) {
            if (related.length < 4 && p.id !== product.id &&
                !related.some(function (r) { return r.id === p.id; })) {
                related.push(p);
            }
        });
    }

    document.getElementById("relatedGrid").innerHTML = related.map(buildProductCard).join("");
    refreshIcons();

    // Breadcrumb category link
    document.getElementById("crumbCategory").textContent = product.category;
    document.getElementById("crumbCategory").href =
        "products.html?category=" + encodeURIComponent(product.category);
    document.getElementById("crumbName").textContent = product.name;
}
