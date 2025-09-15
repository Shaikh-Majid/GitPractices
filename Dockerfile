# Use an official Java runtime as the base image
FROM openjdk:17-jdk-slim

# Set working directory inside the container
WORKDIR /app

# Copy the built JAR file into the container
COPY target/GitPractices-1.0-SNAPSHOT.jar myapp.jar

# Expose port (optional, but useful for documentation)
EXPOSE 80

# Run the application
ENTRYPOINT ["java", "-jar", "myapp.jar"]
