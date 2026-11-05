/* ==========================================================================
   NOVA - inventory.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This page is the stock control desk. It lists every
   product with a coloured stock meter and lets the admin nudge stock up or
   down, or set it to an exact number, all saved straight back to storage.

   WHY IT MATTERS
   Stock is what stops the shop from overselling. Lowering a number here is
   immediately reflected on the customer product pages, and the red/green
   meters make it obvious at a glance which items are running low.

   FUNCTIONS IN THIS FILE
   - buildContent()               - renderAdminShell + draw the inventory list
   - drawInventory()              - one row per product with a stock bar whose
                                     colour warns Out / Low / Healthy, plus
                                     quick +/- and a set-exact input
   - adjustStock(productId, delta)- add or subtract a few units (e.g. +5 / -1)
   - setStock(productId, value)   - jump to an exact quantity the admin typed

   Both writers update novaProducts through storage.js, so the catalogue, the
   dashboard low-stock alerts and the storefront availability all stay in
   perfect agreement.
   ========================================================================== */

/* ==========================================================================
   NOVA - inventory.js  (ADMIN STOCK MANAGEMENT)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   A focused stock view: search, category filter, colour-coded stock
   meters and inline +/- editing. Saving writes to novaProducts, which is
   the exact list the customer catalogue reads - so availability updates
   everywhere at once.
   ========================================================================== */

var invSearch = "";
var invCategory = "";

document.addEventListener("DOMContentLoaded", function () {
    if (!renderAdminShell("inventory")) { return; }
    buildContent();
});

function buildContent() {
    var options = '<option value="">All categories</option>';
    NOVA_CATEGORIES.forEach(function (c) {
        options += "<option value='" + c + "'>" + c + "</option>";
    });

    document.getElementById("adminContent").innerHTML =
        '<div class="panel">' +
        '<div class="toolbar">' +
        '<input class="form-control" id="invSearch" placeholder="Search inventory...">' +
        '<select class="form-control" id="invCategory">' + options + "</select>" +
        '<div class="spacer"></div>' +
        '<span id="invSummary" style="font-size:0.8rem;color:var(--text-2)"></span>' +
        "</div>" +
        '<div class="table-wrap"><table class="admin-table" id="invTable"></table></div>' +
        '<p style="font-size:0.76rem;color:var(--text-2);margin-top:12px">' +
        "Meter colours: purple = healthy · amber = low (≤10) · red = out of stock.</p></div>";

    document.getElementById("invSearch").addEventListener("input", function () {
        invSearch = this.value.trim().toLowerCase();
        drawInventory();
    });

    document.getElementById("invCategory").addEventListener("change", function () {
        invCategory = this.value;
        drawInventory();
    });

    drawInventory();
    refreshIcons();
}

function drawInventory() {
    var list = getProducts().filter(function (p) {
        if (invSearch && p.name.toLowerCase().indexOf(invSearch) === -1) { return false; }
        if (invCategory && p.category !== invCategory) { return false; }
        return true;
    });

    var lowCount = 0;
    var outCount = 0;
    list.forEach(function (p) {
        if (p.stock === 0) { outCount += 1; }
        else if (p.stock <= 10) { lowCount += 1; }
    });

    document.getElementById("invSummary").textContent =
        list.length + " items · " + lowCount + " low · " + outCount + " out of stock";

    var rows = "";
    list.forEach(function (p) {
        // Meter width is capped at 50 units so full bars look sensible.
        var pct = Math.min(100, Math.round(p.stock / 50 * 100));
        var meterClass = p.stock === 0 ? " out" : (p.stock <= 10 ? " low" : "");

        rows += "<tr><td style='display:flex;align-items:center;gap:12px'>" + adminThumb(p) +
            "<div><b>" + escapeHtml(p.name) + "</b>" +
            '<div style="font-size:0.75rem;color:var(--text-2)">' + p.category + "</div></div></td>" +
            "<td><span class='stock-meter" + meterClass + "'><span style='width:" + pct + "%'></span></span>" +
            stockLabel(p.stock) + "</td>" +
            "<td><div class='qty-ctrl'>" +
            "<button onclick='adjustStock(\"" + p.id + "\",-5)'>−5</button>" +
            "<button onclick='adjustStock(\"" + p.id + "\",-1)'>−1</button>" +
            "<input type='number' min='0' value='" + p.stock + "' onchange='setStock(\"" + p.id + "\",this.value)'>" +
            "<button onclick='adjustStock(\"" + p.id + "\",1)'>+1</button>" +
            "<button onclick='adjustStock(\"" + p.id + "\",5)'>+5</button>" +
            "</div></td></tr>";
    });

    document.getElementById("invTable").innerHTML =
        "<thead><tr><th>Product</th><th>Stock level</th><th>Update quantity</th></tr></thead>" +
        "<tbody>" + (rows || "<tr><td colspan=3>Nothing matches.</td></tr>") + "</tbody>";
}

/* ---------- STOCK EDITING ---------- */
// Every helper re-reads the products, changes ONE number and saves back.
function adjustStock(productId, delta) {
    var products = getProducts();
    for (var i = 0; i < products.length; i++) {
        if (products[i].id === productId) {
            var next = products[i].stock + delta;
            if (next < 0) {
                adminToast("Stock cannot go below zero.", "error");
                return;
            }
            products[i].stock = next;
            saveProducts(products);
            logActivity("Stock of " + products[i].name + " set to " + next);
            drawInventory();
            return;
        }
    }
}

function setStock(productId, value) {
    var quantity = Number(value);

    if (isNaN(quantity) || quantity < 0) {
        adminToast("Please enter a valid, non-negative stock number.", "error");
        drawInventory(); // redraw to restore the old value in the box
        return;
    }

    var products = getProducts();
    for (var i = 0; i < products.length; i++) {
        if (products[i].id === productId) {
            products[i].stock = quantity;
            saveProducts(products);
            logActivity("Stock of " + products[i].name + " set to " + quantity);
            adminToast("Stock updated — the shop now shows " + quantity + " units");
            drawInventory();
            return;
        }
    }
}
