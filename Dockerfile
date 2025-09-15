# Step 1: Build stage
FROM maven:3.9.2-eclipse-temurin-17 AS build

# Set working directory
WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the JAR
RUN mvn clean package -DskipTests

# Step 2: Run stage
FROM eclipse-temurin:17-jre-alpine

# Set working directory inside the container
WORKDIR /app

# Copy JAR from build stage
COPY --from=build /app/target/myapp-1.0-SNAPSHOT.jar ./myapp.jar

# Expose port if your app listens on one (optional)
EXPOSE 80

# Command to run the JAR
CMD ["java", "-jar", "myapp.jar"]
