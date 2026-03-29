# ShopHub - Production Level E-Commerce Application

A modern, full-stack e-commerce application built with Spring Boot (Java) backend and vanilla JavaScript frontend.

## 📋 Features

- ✅ **User Authentication** - Secure JWT-based login/registration
- ✅ **Product Catalog** - Browse and filter products by category
- ✅ **Shopping Cart** - Add, update, and remove items
- ✅ **Order Management** - View and manage orders
- ✅ **PostgreSQL Database** - Persistent data storage
- ✅ **RESTful API** - Scalable backend architecture
- ✅ **Responsive Design** - Mobile-friendly frontend
- ✅ **Security** - Password encryption, JWT tokens, CORS enabled

## 🏗️ Project Structure

```
ecommerce-app/
├── backend/                          # Spring Boot Java Application
│   ├── src/main/java/com/ecommerce/
│   │   ├── controller/              # REST Controllers
│   │   ├── service/                 # Business Logic
│   │   ├── repository/              # Database Access
│   │   ├── entity/                  # JPA Entities
│   │   ├── dto/                     # Data Transfer Objects
│   │   ├── security/                # JWT & Security
│   │   ├── config/                  # Spring Configuration
│   │   └── EcommerceApiApplication.java
│   ├── src/main/resources/
│   │   └── application.yml          # Configuration
│   ├── build.gradle                 # Gradle Build Config
│   ├── gradle/wrapper/              # Gradle Wrapper
│   └── pom.xml (if using Maven)
│
└── frontend/                         # HTML/CSS/JavaScript
    ├── index.html                  # Main HTML
    ├── styles.css                  # Styling
    ├── app.js                      # Application Logic
    └── api.js                      # API Service
```

## 🛠️ Technology Stack

### Backend
- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Build Tool**: Gradle
- **Database**: PostgreSQL
- **Security**: Spring Security, JWT (JJWT)
- **ORM**: JPA/Hibernate
- **API**: RESTful

### Frontend
- **HTML5** - Structure
- **CSS3** - Responsive Styling
- **Vanilla JavaScript** - Interactivity
- **Fetch API** - HTTP Requests

## 📦 Prerequisites

- **Java 17+** - [Download](https://www.oracle.com/java/technologies/downloads/#java17)
- **Gradle 8.5+** - [Download](https://gradle.org/install/) (or use wrapper)
- **PostgreSQL 12+** - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)
- **Modern Browser** - Chrome, Firefox, Safari, Edge

## ⚙️ Setup Instructions

### 1. Database Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ecommerce_db;

# Exit
\q
```

### 2. Backend Setup

```bash
cd ecommerce-app/backend

# If using Gradle wrapper (preferred)
./gradlew build

# If using installed Gradle
gradle build

# Run the application
./gradlew bootRun
# or
gradle bootRun
```

The backend will start on `http://localhost:8080/api`

### 3. Frontend Setup

```bash
cd ecommerce-app/frontend

# Serve using Python 3
python -m http.server 8000

# Or using Node.js
npx http-server

# Or using Live Server (VS Code extension)
# Right-click index.html -> Open with Live Server
```

Open `http://localhost:8000` (or port shown) in your browser.

## 🔧 Configuration

### Backend Configuration (`application.yml`)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/ecommerce_db
    username: postgres
    password: postgres

jwt:
  secret: your-super-secret-key-change-this-in-production
  expiration: 86400000  # 24 hours in milliseconds

server:
  port: 8080
```

**Important**: Change `jwt.secret` to a strong random string in production!

### Frontend Configuration (`api.js`)

```javascript
const API_URL = 'http://localhost:8080/api';
// Update this if backend runs on different host/port
```

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Products
- `GET /api/products` - Get all products
- `GET /api/products/available` - Get available products
- `GET /api/products/{id}` - Get product details
- `GET /api/products/category/{category}` - Get products by category

### Cart (Authenticated)
- `GET /api/cart` - Get user's cart
- `POST /api/cart/add/{productId}?quantity=1` - Add to cart
- `DELETE /api/cart/remove/{cartItemId}` - Remove from cart
- `PUT /api/cart/update/{cartItemId}?quantity=2` - Update quantity
- `DELETE /api/cart/clear` - Clear cart

## 📝 Sample Data

Insert sample products into the database:

```sql
INSERT INTO products (name, description, price, quantity, category, sku, available, rating, image_url)
VALUES 
  ('Laptop', 'High-performance laptop', 999.99, 50, 'Electronics', 'LAP001', true, 4.5, ''),
  ('T-Shirt', 'Cotton t-shirt', 19.99, 200, 'Clothing', 'TSH001', true, 4.0, ''),
  ('Java Programming', 'Learn Java basics', 29.99, 100, 'Books', 'BOK001', true, 4.8, '');
```

## 🔐 Security Features

1. **Password Encryption** - BCrypt hashing
2. **JWT Tokens** - Stateless authentication
3. **CORS Protection** - Only allowed origins
4. **SQL Injection Prevention** - Parameterized queries via JPA
5. **HTTPS Ready** - Configure in production

## 📱 User Flow

1. **Registration** - Create account with email, username, password, contact info
2. **Login** - Authenticate and receive JWT token
3. **Browse** - View products and filter by category
4. **Add to Cart** - Select quantity and add items
5. **Manage Cart** - Update quantities or remove items
6. **Checkout** - Complete purchase

## 🐛 Troubleshooting

### Backend won't start
```
Error: Database connection failed
Solution: Ensure PostgreSQL is running and ecommerce_db exists
```

### CORS errors
```
Error: Access to XMLHttpRequest blocked by CORS
Solution: Check API_URL in frontend/api.js and SecurityConfig.java
```

### Gradle build fails
```
Error: Could not find tools.jar
Solution: Ensure JAVA_HOME points to JDK (not JRE)
```

### Products not loading
```
Solution: Ensure products are inserted in database
Run: SELECT * FROM products; in PostgreSQL
```

## 🔄 Build & Deployment

### Build JAR
```bash
cd backend
./gradlew bootJar
# Creates: build/libs/ecommerce-api.jar
```

### Run JAR
```bash
java -jar ecommerce-api.jar
```

### Docker (Optional)
```dockerfile
FROM openjdk:17
COPY backend/build/libs/ecommerce-api.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
```

## 📊 Database Schema

- **users** - User accounts
- **products** - Product catalog
- **cart** - Shopping carts
- **cart_items** - Items in cart
- **orders** - Customer orders
- **order_items** - Items in orders

## 🎓 Learning Outcomes

- Spring Boot REST API development
- JWT authentication implementation
- JPA/Hibernate ORM
- PostgreSQL integration
- Frontend-backend integration
- Responsive web design
- CORS and security

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 💡 Future Enhancements

- [ ] Payment gateway integration (Stripe, PayPal)
- [ ] Email notifications
- [ ] Product reviews and ratings
- [ ] Wishlist feature
- [ ] Admin dashboard
- [ ] Order tracking
- [ ] Advanced search and filtering
- [ ] User profile management
- [ ] Inventory management
- [ ] Analytics dashboard

## 🎉 Support

For issues or questions:
1. Check Troubleshooting section
2. Review console/logs for error messages
3. Ensure all prerequisites are installed
4. Verify configuration files

---

**Happy Shopping! 🛍️**
