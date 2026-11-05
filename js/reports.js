/* ==========================================================================
   NOVA - reports.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This page turns the raw orders and products into simple
   business numbers and rankings - total sales, average order value, the best
   selling products and a category-by-category breakdown.

   READ-ONLY BY DESIGN
   Reports never change data. drawReports() reads novaOrders and novaProducts
   through storage.js, does a little adding and counting, and presents the
   result so the shop owner can understand how the business is doing.

   FUNCTIONS IN THIS FILE
   - drawReports()      - compute the headline totals, build the top-selling
                           list and the per-category summary, then paint them
                           with the shared stat cards and simple bar visuals
   - stat(label, value) - one little number-tile used across the report cards

   The figures are grouped by category so it is easy to see which parts of the
   catalogue earn the most, and a clearly-labelled note explains that the
   numbers come from the demo orders plus any real ones placed during testing.
   ========================================================================== */

/* ==========================================================================
   NOVA - reports.js  (SALES REPORTS)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Simple, explainable aggregates over novaOrders:
   - headline totals, top-selling products, category-wise sales,
   - a 6-month summary table.
   All computed with plain loops - no analytics library.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    if (!renderAdminShell("reports")) { return; }
    drawReports();
});

function drawReports() {
    var orders = getOrders();

    /* ---- 1. headline numbers ---- */
    var revenue = 0;
    var unitsSold = 0;
    orders.forEach(function (order) {
        revenue += order.total;
        order.items.forEach(function (item) { unitsSold += item.quantity; });
    });

    /* ---- 2. top-selling products (by quantity) ---- */
    // Build {productId: totalQuantity} with a plain object counter.
    var soldByProduct = {};
    orders.forEach(function (order) {
        order.items.forEach(function (item) {
            soldByProduct[item.id] = (soldByProduct[item.id] || 0) + item.quantity;
        });
    });

    var topList = [];
    Object.keys(soldByProduct).forEach(function (id) {
        var product = findProduct(id);
        topList.push({
            name: product ? product.name : id + " (deleted)",
            quantity: soldByProduct[id],
            revenue: (product ? product.price : 0) * soldByProduct[id]
        });
    });
    topList.sort(function (a, b) { return b.quantity - a.quantity; });

    var topRows = "";
    topList.slice(0, 5).forEach(function (row, i) {
        topRows += "<tr><td>#" + (i + 1) + "</td><td>" + escapeHtml(row.name) +
            "</td><td>" + row.quantity + "</td><td>" + formatMoney(row.revenue) + "</td></tr>";
    });

    /* ---- 3. category-wise sales ---- */
    var byCategory = {};
    NOVA_CATEGORIES.forEach(function (c) { byCategory[c] = 0; });

    orders.forEach(function (order) {
        order.items.forEach(function (item) {
            var product = findProduct(item.id);
            if (product) {
                byCategory[product.category] += item.price * item.quantity;
            }
        });
    });

    var maxCat = 1;
    NOVA_CATEGORIES.forEach(function (c) {
        if (byCategory[c] > maxCat) { maxCat = byCategory[c]; }
    });

    var catBars = "";
    NOVA_CATEGORIES.forEach(function (c) {
        catBars += '<div class="hbar-row"><span>' + c + "</span>" +
            '<div class="hbar-track"><div class="hbar-fill" style="width:' +
            Math.round(byCategory[c] / maxCat * 100) + '%"></div></div>' +
            "<span>" + formatMoney(byCategory[c]) + "</span></div>";
    });

    /* ---- 4. monthly summary (last 6 months) ---- */
    var now = new Date();
    var monthRows = "";

    for (var i = 5; i >= 0; i--) {
        var monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var label = monthDate.toLocaleString("en", { month: "short", year: "numeric" });
        var monthRevenue = 0;
        var monthOrders = 0;

        orders.forEach(function (order) {
            var od = new Date(order.date);
            if (od.getFullYear() === monthDate.getFullYear() && od.getMonth() === monthDate.getMonth()) {
                monthRevenue += order.total;
                monthOrders += 1;
            }
        });

        monthRows += "<tr><td>" + label + "</td><td>" + monthOrders +
            "</td><td>" + formatMoney(monthRevenue) + "</td></tr>";
    }

    /* ---- paint ---- */
    document.getElementById("adminContent").innerHTML =
        '<div class="panel"><div class="stat-cards">' +
        stat("Total Revenue", formatMoney(revenue)) +
        stat("Total Orders", String(orders.length)) +
        stat("Units Sold", String(unitsSold)) +
        stat("Avg. Order", orders.length ? formatMoney(revenue / orders.length) : "₹0") +
        "</div>" +
        '<p style="font-size:0.76rem;color:var(--text-2);margin-top:12px">Every figure is calculated from novaOrders in Local Storage. ' +
        "Sample orders are included; delete them via Reset demo data to see real-flow numbers only.</p></div>" +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px;align-items:start">' +
        '<div class="panel"><div class="panel-head"><h3>Top-Selling Products</h3></div>' +
        '<div class="table-wrap"><table class="admin-table" style="min-width:0">' +
        "<thead><tr><th>Rank</th><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>" +
        "<tbody>" + (topRows || "<tr><td colspan=4>No sales recorded yet.</td></tr>") + "</tbody></table></div></div>" +

        '<div class="panel"><div class="panel-head"><h3>Category-wise Sales</h3></div>' + catBars + "</div>" +

        '<div class="panel" style="grid-column:1/-1"><div class="panel-head"><h3>Monthly Summary</h3></div>' +
        '<div class="table-wrap"><table class="admin-table" style="min-width:0">' +
        "<thead><tr><th>Month</th><th>Orders</th><th>Revenue</th></tr></thead>" +
        "<tbody>" + monthRows + "</tbody></table></div></div></div>";

    refreshIcons();

    function stat(label, value) {
        return '<div class="stat-card"><div class="st-label">' + label + "</div>" +
            '<div class="st-value">' + value + "</div></div>";
    }
}
