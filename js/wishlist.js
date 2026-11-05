/* ==========================================================================
   NOVA - wishlist.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This page shows the products a shopper saved for later
   (novaWishlist) and lets them move any of them into the cart or un-save it.

   FUNCTIONS IN THIS FILE
   - drawWishlist()          - read the saved ids, look each one up with
                               findProduct(), and drop the shared product card
                               (buildProductCard) into the grid; shows a
                               friendly empty state when nothing is saved
   - moveToCart(productId)   - add that product to the cart through
                               addToCart() and tell the shopper via a toast

   Because it reuses the common card, the heart button on each tile still
   toggles save/un-save exactly as it does elsewhere in the shop.
   ========================================================================== */

/* ==========================================================================
   NOVA - wishlist.js  (WISHLIST PAGE LOGIC)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Shows saved products with two actions each: Move to Cart and Remove.
   "Move to Cart" adds the product, then deletes it from the wishlist.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    renderHeader("wishlist");
    renderFooter();
    drawWishlist();
});

function drawWishlist() {
    var ids = getWishlist();
    var grid = document.getElementById("wishGrid");
    var empty = document.getElementById("wishEmpty");

    document.getElementById("wishCount").textContent = ids.length + " saved item(s)";

    if (ids.length === 0) {
        grid.innerHTML = "";
        empty.hidden = false;
        return;
    }

    empty.hidden = true;

    // Reuse the shared product card, then append wishlist-specific buttons.
    var html = "";
    ids.forEach(function (id) {
        var product = findProduct(id);
        if (!product) { return; } // deleted product: skip quietly

        html += "<div>" + buildProductCard(product) +
            '<div style="display:flex;gap:10px;margin-top:10px">' +
            '<button class="btn btn-primary btn-sm" style="flex:1" ' +
            (product.stock === 0 ? "disabled" : "") +
            ' onclick="moveToCart(\'' + id + '\')"><i data-lucide="shopping-cart"></i> Move to Cart</button>' +
            '<button class="btn btn-outline btn-sm" onclick="toggleWishlist(\'' + id + '\');drawWishlist()">' +
            '<i data-lucide="trash-2"></i></button>' +
            "</div></div>";
    });

    grid.innerHTML = html;
    refreshIcons();
}

// Add to cart first; only leave the wishlist when that succeeded.
function moveToCart(productId) {
    if (addToCart(productId)) {
        var list = getWishlist().filter(function (id) { return id !== productId; });
        saveWishlist(list);
        updateBadges();
        drawWishlist();
    }
}
