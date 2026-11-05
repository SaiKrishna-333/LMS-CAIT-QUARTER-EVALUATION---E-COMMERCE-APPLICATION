/* ==========================================================================
   NOVA - marketing.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This page lets the admin steer the store's promotions -
   switch the flash sale on and tune it, change the delivery charge, and pick
   which products are flagged as "Featured" on the shop front.

   EVERYTHING WRITES TO novaSettings
   The flash-sale on/off, its discount percent, its end time, the delivery
   fee, the free-delivery limit and the featured product list all live in the
   novaSettings object. Changing them here is what makes the homepage
   countdown and the cart's delivery maths behave differently.

   FUNCTIONS IN THIS FILE
   - drawPage()               - renderAdminShell + lay out the three control
                                 panels (flash sale, delivery, featured)
   - pad(n)                   - small helper to show countdown numbers as "05"
   - saveFlash()              - store the flash-sale toggle, percent and end
                                 time, then log the change in activity
   - saveDelivery()           - store the delivery charge + free-delivery limit
   - toggleFeatured(id, el)   - tick/untick a product in the featured list and
                                 redraw its button state

   Because the storefront reads novaSettings on load, an offer switched on
   here shows up on the customer homepage the next time it refreshes.
   ========================================================================== */

/* ==========================================================================
   NOVA - marketing.js  (FLASH SALE / OFFERS / FEATURED PRODUCTS)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Everything here edits ONE object: novaSettings. The storefront reads
   those settings, so switching a toggle here visibly changes the shop:
   - flash sale on/off + end time  -> homepage Flash Deals section
   - delivery charge / free limit  -> cart + checkout bill
   - featured products             -> homepage "Best Sellers" row
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    if (!renderAdminShell("marketing")) { return; }
    drawPage();
});

function drawPage() {
    var settings = getSettings();
    var products = getProducts();

    // Format the end time for a datetime-local input: "YYYY-MM-DDTHH:MM"
    var endDate = new Date(settings.flashDealEnd);
    var localValue = endDate.getFullYear() + "-" +
        pad(endDate.getMonth() + 1) + "-" + pad(endDate.getDate()) +
        "T" + pad(endDate.getHours()) + ":" + pad(endDate.getMinutes());

    function pad(n) { return n < 10 ? "0" + n : n; }

    // Featured toggle list (max 6 to keep the homepage tidy).
    var featuredRows = "";
    products.forEach(function (p) {
        var isFeatured = settings.featuredIds.indexOf(p.id) !== -1;
        featuredRows += '<div class="feed-item"><div class="f-avatar">' + p.name.charAt(0) + "</div>" +
            "<div style='flex:1'><div class='f-title'>" + escapeHtml(p.name) + "</div>" +
            '<div class="f-desc">' + p.category + " · " + formatMoney(p.price) + "</div></div>" +
            '<div class="toggle-switch' + (isFeatured ? " on" : "") + '" ' +
            'onclick="toggleFeatured(\'' + p.id + '\', this)"></div></div>';
    });

    document.getElementById("adminContent").innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">' +

        // --- flash sale panel ---
        '<div class="panel"><div class="panel-head"><h3><i data-lucide="zap"></i> Flash Sale</h3>' +
        '<div class="toggle-switch' + (settings.flashDealActive ? " on" : "") + '" id="flashToggle"></div></div>' +
        '<p style="font-size:0.82rem;margin-bottom:16px">Controls the <b>NOVA Flash Deals</b> section on the customer homepage.</p>' +
        '<div class="form-group"><label>Promotion ends at</label>' +
        '<input class="form-control" type="datetime-local" id="endTime" value="' + localValue + '"></div>' +
        '<div class="form-group"><label>Highlight discount % (label only)</label>' +
        '<input class="form-control" type="number" id="dealPct" min="5" max="70" value="' + settings.flashDealPercent + '"></div>' +
        '<button class="btn btn-primary btn-sm" onclick="saveFlash()">Save promotion</button></div>' +

        // --- delivery / discount settings ---
        '<div class="panel"><div class="panel-head"><h3><i data-lucide="truck"></i> Offers &amp; Delivery</h3></div>' +
        '<div class="form-group"><label>Delivery charge (₹)</label>' +
        '<input class="form-control" type="number" id="delvCharge" min="0" step="0.5" value="' + settings.deliveryCharge + '"></div>' +
        '<div class="form-group"><label>Free delivery above (₹)</label>' +
        '<input class="form-control" type="number" id="freeMin" min="0" step="10" value="' + settings.freeDeliveryMin + '"></div>' +
        '<p style="font-size:0.78rem;margin-bottom:14px">Product discounts themselves are set per product in <a href="products.html" style="color:var(--violet)">Products</a> (original vs selling price).</p>' +
        '<button class="btn btn-primary btn-sm" onclick="saveDelivery()">Save delivery rules</button></div>' +

        // --- featured products (full width) ---
        '<div class="panel" style="grid-column:1/-1"><div class="panel-head"><h3><i data-lucide="star"></i> Featured Products (Best Sellers)</h3>' +
        '<span style="font-size:0.76rem;color:var(--text-2)">max 6</span></div>' +
        '<div class="feed-list">' + featuredRows + "</div></div></div>";

    // The flash toggle is interactive immediately.
    document.getElementById("flashToggle").addEventListener("click", function () {
        this.classList.toggle("on");
        var settingsNow = getSettings();
        settingsNow.flashDealActive = this.classList.contains("on");
        saveSettings(settingsNow);
        adminToast("Flash sale " + (settingsNow.flashDealActive ? "enabled" : "disabled") + " on the homepage");
        logActivity("Flash sale switched " + (settingsNow.flashDealActive ? "ON" : "OFF"));
    });

    refreshIcons();
}

/* ---------- SAVE HANDLERS ---------- */
function saveFlash() {
    var settings = getSettings();
    var endValue = document.getElementById("endTime").value;
    var pct = Number(document.getElementById("dealPct").value);

    if (!endValue) {
        adminToast("Please choose a promotion end date and time.", "error");
        return;
    }

    if (pct < 5 || pct > 70) {
        adminToast("Discount label must be between 5% and 70%.", "error");
        return;
    }

    settings.flashDealEnd = new Date(endValue).toISOString();
    settings.flashDealPercent = pct;
    saveSettings(settings);

    logActivity("Flash deal end time updated");
    adminToast("Promotion timing saved — the homepage countdown now targets it");
    drawPage();
}

function saveDelivery() {
    var settings = getSettings();
    var charge = Number(document.getElementById("delvCharge").value);
    var freeMin = Number(document.getElementById("freeMin").value);

    if (isNaN(charge) || charge < 0 || isNaN(freeMin) || freeMin < 0) {
        adminToast("Both values must be zero or more.", "error");
        return;
    }

    settings.deliveryCharge = charge;
    settings.freeDeliveryMin = freeMin;
    saveSettings(settings);

    logActivity("Delivery rules updated");
    adminToast("Delivery rules saved — carts will re-bill with them");
}

// Toggle a product in/out of the featured list (max 6).
function toggleFeatured(productId, element) {
    var settings = getSettings();
    var position = settings.featuredIds.indexOf(productId);

    if (position !== -1) {
        settings.featuredIds.splice(position, 1);
    } else {
        if (settings.featuredIds.length >= 6) {
            adminToast("Only 6 products can be featured. Remove one first.", "error");
            return;
        }
        settings.featuredIds.push(productId);
    }

    saveSettings(settings);
    element.classList.toggle("on");
    adminToast("Homepage Best Sellers updated");
}
