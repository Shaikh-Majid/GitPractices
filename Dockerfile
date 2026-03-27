# Use a lightweight Java runtime
FROM eclipse-temurin:17-jre-jammy
# Set working directory inside the container
WORKDIR /app

# Copy your JAR file into the container
COPY /app/build/libs/*.jar app.jar

# Expose port (optional, if your app listens on 8080)
EXPOSE 8080

# Command to run the JAR
ENTRYPOINT ["java", "-jar", "app.jar"]
