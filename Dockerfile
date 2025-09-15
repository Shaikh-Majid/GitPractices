# Use a lightweight Java runtime
FROM eclipse-temurin:17-jre-alpine

# Set working directory inside the container
WORKDIR /app

# Copy your JAR file into the container
COPY target/GitPractices-1.0-SNAPSHOT.jar ./myapp.jar

# Expose port (optional, if your app listens on 8080)
EXPOSE 80

# Command to run the JAR
CMD ["java", "-jar", "myapp.jar"]
