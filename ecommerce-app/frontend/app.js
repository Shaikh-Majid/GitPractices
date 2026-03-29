let products = [];
let cart = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    if (token && currentUser) {
        showMainApp();
        loadProducts();
        updateNavBar();
    }
});

// Auth Functions
function showLoginTab() {
    document.getElementById('loginTab').classList.add('active');
    document.getElementById('registerTab').classList.remove('active');
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.querySelectorAll('.tab-btn')[1].classList.remove('active');
}

function showRegisterTab() {
    document.getElementById('registerTab').classList.add('active');
    document.getElementById('loginTab').classList.remove('active');
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.querySelectorAll('.tab-btn')[0].classList.remove('active');
}

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await ApiService.login({ username, password });
        
        if (response && response.token) {
            token = response.token;
            currentUser = response.username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', currentUser);
            
            showMainApp();
            loadProducts();
            updateNavBar();
        } else {
            document.getElementById('loginError').textContent = response?.message || 'Login failed';
        }
    } catch (error) {
        document.getElementById('loginError').textContent = 'Network error';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const data = {
        email: document.getElementById('regEmail').value,
        username: document.getElementById('regUsername').value,
        password: document.getElementById('regPassword').value,
        firstName: document.getElementById('regFirstName').value,
        lastName: document.getElementById('regLastName').value,
        address: document.getElementById('regAddress').value,
        phone: document.getElementById('regPhone').value,
    };

    try {
        const response = await ApiService.register(data);
        
        if (response && response.token) {
            token = response.token;
            currentUser = response.username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', currentUser);
            
            showMainApp();
            loadProducts();
            updateNavBar();
        } else {
            document.getElementById('registerError').textContent = response?.message || 'Registration failed';
        }
    } catch (error) {
        document.getElementById('registerError').textContent = 'Network error';
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    document.getElementById('authPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('cartPage').style.display = 'none';
    showLoginTab();
}

// Navigation
function showMainApp() {
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('cartPage').style.display = 'none';
}

function goToLogin() {
    if (!token) {
        document.getElementById('authPage').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('cartPage').style.display = 'none';
    }
}

function updateNavBar() {
    if (token) {
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userMenu').style.display = 'block';
        document.getElementById('cartBtn').style.display = 'block';
        document.getElementById('userMenu').textContent = `👤 ${currentUser}`;
        document.getElementById('userMenu').onclick = logout;
    } else {
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('userMenu').style.display = 'none';
        document.getElementById('cartBtn').style.display = 'none';
    }
}

// Products
async function loadProducts() {
    try {
        const response = await ApiService.getAvailableProducts();
        if (response && Array.isArray(response)) {
            products = response;
            displayProducts(products);
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

async function filterProducts(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    currentFilter = category;

    if (category === 'all') {
        displayProducts(products);
    } else {
        try {
            const response = await ApiService.getProductsByCategory(category);
            if (response && Array.isArray(response)) {
                displayProducts(response);
            }
        } catch (error) {
            console.error('Error filtering products:', error);
        }
    }
}

function displayProducts(productList) {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';

    productList.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        card.innerHTML = `
            <div class="product-image">📦</div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <div class="product-rating">⭐ ${product.rating.toFixed(1)}</div>
                <div class="product-actions">
                    <button class="btn btn-primary" onclick="addToCartClick(${product.id})">
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

async function addToCartClick(productId) {
    if (!token) {
        goToLogin();
        return;
    }

    try {
        const response = await ApiService.addToCart(productId, 1);
        if (response) {
            updateCartCount();
            alert('Product added to cart!');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
    }
}

async function updateCartCount() {
    try {
        const response = await ApiService.getCart();
        if (response && response.itemCount) {
            document.getElementById('cartCount').textContent = response.itemCount;
        }
    } catch (error) {
        console.error('Error updating cart:', error);
    }
}

// Cart Functions
function openCart() {
    if (!token) {
        goToLogin();
        return;
    }
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('cartPage').style.display = 'block';
    loadCart();
}

document.getElementById('cartBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openCart();
});

async function loadCart() {
    try {
        const response = await ApiService.getCart();
        if (response) {
            displayCart(response);
        }
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

function displayCart(cartData) {
    const cartItemsDiv = document.getElementById('cartItems');
    const subtotalDiv = document.getElementById('subtotal');
    const totalDiv = document.getElementById('total');

    if (!cartData.items || cartData.items.length === 0) {
        cartItemsDiv.innerHTML = `
            <div class="empty-cart">
                <p>Your cart is empty</p>
                <button class="btn btn-primary" onclick="backToProducts()">Start Shopping</button>
            </div>
        `;
        subtotalDiv.textContent = '$0.00';
        totalDiv.textContent = '$0.00';
        return;
    }

    cartItemsDiv.innerHTML = '';

    cartData.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';

        const itemTotal = item.price * item.quantity;

        itemDiv.innerHTML = `
            <div class="cart-item-image">📦</div>
            <div class="cart-item-details">
                <h3>${item.product.name}</h3>
                <p>${item.product.category}</p>
                <p>Price: $${item.price.toFixed(2)}</p>
            </div>
            <div class="cart-item-price">
                <div class="quantity-control">
                    <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                    <input type="number" value="${item.quantity}" readonly>
                    <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                </div>
                <div class="total" style="margin-top: 0.5rem;">$${itemTotal.toFixed(2)}</div>
                <button class="remove-btn" style="margin-top: 0.5rem;" onclick="removeFromCart(${item.id})">Remove</button>
            </div>
        `;

        cartItemsDiv.appendChild(itemDiv);
    });

    subtotalDiv.textContent = `$${cartData.totalPrice.toFixed(2)}`;
    totalDiv.textContent = `$${cartData.totalPrice.toFixed(2)}`;
}

async function updateQuantity(cartItemId, quantity) {
    if (quantity <= 0) {
        await removeFromCart(cartItemId);
        return;
    }

    try {
        await ApiService.updateCartItem(cartItemId, quantity);
        loadCart();
        updateCartCount();
    } catch (error) {
        console.error('Error updating quantity:', error);
    }
}

async function removeFromCart(cartItemId) {
    try {
        await ApiService.removeFromCart(cartItemId);
        loadCart();
        updateCartCount();
    } catch (error) {
        console.error('Error removing from cart:', error);
    }
}

function backToProducts() {
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('cartPage').style.display = 'none';
}

function checkout() {
    alert('Thank you for your purchase! Checkout feature coming soon.');
    ApiService.clearCart();
    backToProducts();
    updateCartCount();
}
