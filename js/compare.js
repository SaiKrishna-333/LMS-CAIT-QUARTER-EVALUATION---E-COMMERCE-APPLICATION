/* ==========================================================================
   NOVA - compare.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: Compare Studio lets a shopper line up to THREE products
   side by side and see how they differ on price, rating, stock and
   specifications, in a simple readable table.

   WHERE THE LIST COMES FROM
   The tray of chosen products is stored in novaCompare by addToCompare()
   (common.js). This page just reads that list, refuses to show more than
   three, and turns it into columns.

   FUNCTIONS IN THIS FILE
   - drawTable()               - build the whole comparison grid; shows a
                                 friendly empty state if nothing is picked
   - row(label, values)        - one horizontal line (e.g. "Price" + the three
                                 prices) so rows stay neatly aligned
   - removeFromCompare(id)     - drop one product out and redraw the rest

   A short-comparison line is included so the difference between items is
   obvious even without reading every cell.
   ========================================================================== */

/* ==========================================================================
   NOVA - compare.js  (COMPARE STUDIO LOGIC)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Reads the novaCompare tray (max 3 product ids), builds a side-by-side
   table and marks the best value in the Price and Rating rows.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    renderHeader("compare");
    renderFooter();
    drawTable();
});

function drawTable() {
    var tray = loadData("novaCompare", []);
    var table = document.getElementById("compareTable");
    var empty = document.getElementById("emptyTray");

    // Remove ids whose products no longer exist (admin may have deleted one).
    var items = [];
    tray.forEach(function (id) {
        var product = findProduct(id);
        if (product) { items.push(product); }
    });

    if (items.length === 0) {
        table.hidden = true;
        empty.hidden = false;
        return;
    }

    table.hidden = false;
    empty.hidden = true;

    // Find the best price (lowest) and best rating (highest) to highlight.
    var bestPrice = items[0].price;
    var bestRating = items[0].rating;
    items.forEach(function (p) {
        if (p.price < bestPrice) { bestPrice = p.price; }
        if (p.rating > bestRating) { bestRating = p.rating; }
    });

    // ---- header row: image, name, remove button ----
    var html = "<tr><td></td>";
    items.forEach(function (p) {
        html += '<td><img src="' + getProductImage(p, 0) + '" alt="' + escapeHtml(p.name) + '" onerror="this.onerror=null;this.src=getProductSvgById(\'' + p.id + '\',0)">' +
            "<b>" + escapeHtml(p.name) + "</b><br>" +
            '<button class="compare-remove" onclick="removeFromCompare(\'' + p.id + '\')">✕ remove</button></td>';
    });
    html += "</tr>";

    // ---- simple attribute rows ----
    html += row("Category", items.map(function (p) { return p.category; }));
    html += row("Price", items.map(function (p) {
        var cls = p.price === bestPrice ? ' class="compare-best"' : "";
        return "<span" + cls + ">" + formatMoney(p.price) + "</span>" +
            (p.originalPrice > p.price ? '<br><span class="price-old">' + formatMoney(p.originalPrice) + "</span>" : "");
    }));
    html += row("Rating", items.map(function (p) {
        var cls = p.rating === bestRating ? ' class="compare-best"' : "";
        return "<span" + cls + ">" + starsHtml(p.rating) + " " + p.rating.toFixed(1) + "</span><br>(" + p.reviews + " reviews)";
    }));
    html += row("Availability", items.map(function (p) { return stockLabel(p.stock); }));
    html += row("Action", items.map(function (p) {
        return '<button class="btn btn-primary btn-sm" ' + (p.stock === 0 ? "disabled" : "") +
            ' onclick="addToCart(\'' + p.id + '\')">Add to Cart</button>';
    }));

    // ---- specification rows ----
    // Collect every spec key used by any selected product so nothing hides.
    var keys = [];
    items.forEach(function (p) {
        Object.keys(p.specs).forEach(function (key) {
            if (keys.indexOf(key) === -1) { keys.push(key); }
        });
    });

    keys.forEach(function (key) {
        html += row(key, items.map(function (p) {
            return p.specs[key] !== undefined ? p.specs[key] : "—";
        }));
    });

    table.innerHTML = html;
    refreshIcons();

    // Builder for one label + values row.
    function row(label, values) {
        var cells = "";
        values.forEach(function (value) { cells += "<td>" + value + "</td>"; });
        return "<tr><td>" + label + "</td>" + cells + "</tr>";
    }
}

// Delete one product from the tray and redraw the table.
function removeFromCompare(productId) {
    var tray = loadData("novaCompare", []).filter(function (id) { return id !== productId; });
    saveData("novaCompare", tray);
    drawTable();
    showToast("Removed from Compare Studio");
}
