# 🚀 Quick Start Guide

Get ShopHub running in minutes!

## 5-Minute Setup

### Step 1: PostgreSQL Database (2 min)
```bash
# Start PostgreSQL service
# Linux/Mac:
brew services start postgresql
# or
sudo systemctl start postgresql

# Or ensure PostgreSQL is running in your system

# Create database
psql -U postgres

# In PostgreSQL prompt:
CREATE DATABASE ecommerce_db;
\q
```

### Step 2: Start Backend (2 min)
```bash
cd ecommerce-app/backend

# Build and run
./gradlew bootRun

# Wait for: "Started EcommerceApiApplication in X seconds"
# Backend ready at: http://localhost:8080/api
```

### Step 3: Start Frontend (1 min)
```bash
cd ecommerce-app/frontend

# Option A: Python
python -m http.server 8000

# Option B: Node
npx http-server

# Option C: VS Code Live Server
# Right-click index.html → Open with Live Server
```

**Open browser:** http://localhost:8000

## 📝 First-Time Usage

### 1. Create Account
- Click **Register** tab
- Fill all fields (10-digit phone required)
- Click **Register**

### 2. Login
- Enter credentials
- You're logged in! ✅

### 3. Browse Products
- See featured products
- Filter by category
- View product details

### 4. Shopping Cart
- Click on product card → "Add to Cart"
- View cart (🛒 icon in navbar)
- Update quantities or remove items
- Proceed to checkout

## 🆘 Troubleshooting

### Backend won't start
```
❌ Error: Could not connect to database
✅ Fix: Run `CREATE DATABASE ecommerce_db;` in PostgreSQL
```

### Frontend shows blank page
```
❌ Error: CORS error in console
✅ Fix: Ensure backend is running on http://localhost:8080/api
```

### Can't add products to cart
```
❌ Error: 401 Unauthorized
✅ Fix: Make sure you're logged in first
```

### No products showing
```
❌ Error: Products list empty
✅ Fix: Insert sample data:
     psql -U postgres -d ecommerce_db
     INSERT INTO products (name, price, quantity, category, sku, available, rating)
     VALUES ('Test Product', 19.99, 100, 'Electronics', 'TEST001', true, 4.5);
```

## 🧪 Test Credentials

Use these after registering:
- **Username**: testuser
- **Email**: test@example.com
- **Password**: Test@123

## 📦 Sample Products to Add

```sql
INSERT INTO products (name, description, price, quantity, category, sku, available, rating)
VALUES 
  ('Gaming Laptop', 'High-performance gaming laptop', 1299.99, 25, 'Electronics', 'LAP-GAME-001', true, 4.8),
  ('Wireless Headphones', 'Premium noise-cancelling headphones', 199.99, 50, 'Electronics', 'HEAD-001', true, 4.6),
  ('Cotton T-Shirt', '100% cotton comfortable t-shirt', 24.99, 100, 'Clothing', 'TSHIRT-001', true, 4.2),
  ('Denim Jeans', 'Classic blue denim jeans', 59.99, 75, 'Clothing', 'JEANS-001', true, 4.4),
  ('Java Programming', 'Learn Java from scratch', 39.99, 200, 'Books', 'BOOK-JAVA-001', true, 4.7),
  ('Web Development Guide', 'Complete web dev course', 49.99, 150, 'Books', 'BOOK-WEB-001', true, 4.5);
```

## 🔑 Default Admin Credentials

Database user: `postgres`
Password: `postgres`

## 🌐 Project URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8000 |
| Backend API | http://localhost:8080/api |
| Database | localhost:5432 |

## 📚 API Testing

Use **Postman** or **cURL**:

```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"user@example.com",
    "username":"testuser",
    "password":"Test@123",
    "firstName":"John",
    "lastName":"Doe",
    "address":"123 Main St",
    "phone":"1234567890"
  }'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@123"}'

# Get Products (save token from login response)
curl -X GET http://localhost:8080/api/products \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 💡 Tips

- **JWT Token expires** in 24 hours (configurable in `application.yml`)
- **Password must be** bcrypt encrypted in database
- **CORS enabled** for localhost development
- **Database auto-creates** tables on first run (ddl-auto: update)

## 🎯 Next Steps

1. ✅ Get it running
2. 📝 Test all features
3. 🛠️ Customize styling in `styles.css`
4. 🔧 Add more products
5. 🚀 Deploy to production

## 📞 Need Help?

1. Check main **README.md** for detailed docs
2. Review console errors (F12)
3. Check server logs for backend issues
4. Verify PostgreSQL is running

---

**Everything set? Open http://localhost:8000 and start shopping! 🛍️**
