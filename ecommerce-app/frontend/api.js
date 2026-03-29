const API_URL = 'http://localhost:8080/api';

let token = localStorage.getItem('token');
let currentUser = localStorage.getItem('username');

class ApiService {
    static async request(method, endpoint, body = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_URL}${endpoint}`, options);
        
        if (response.status === 401) {
            logout();
            return null;
        }

        return await response.json();
    }

    static register(data) {
        return this.request('POST', '/auth/register', data);
    }

    static login(data) {
        return this.request('POST', '/auth/login', data);
    }

    static getProducts() {
        return this.request('GET', '/products');
    }

    static getAvailableProducts() {
        return this.request('GET', '/products/available');
    }

    static getProductsByCategory(category) {
        return this.request('GET', `/products/category/${category}`);
    }

    static getCart() {
        return this.request('GET', '/cart');
    }

    static addToCart(productId, quantity = 1) {
        return this.request('POST', `/cart/add/${productId}?quantity=${quantity}`);
    }

    static removeFromCart(cartItemId) {
        return this.request('DELETE', `/cart/remove/${cartItemId}`);
    }

    static updateCartItem(cartItemId, quantity) {
        return this.request('PUT', `/cart/update/${cartItemId}?quantity=${quantity}`);
    }

    static clearCart() {
        return this.request('DELETE', '/cart/clear');
    }
}
