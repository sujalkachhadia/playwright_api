# Use the official Microsoft Playwright image which has all the browser binaries pre-installed
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy the package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of your application files (server.js, .env, etc.)
COPY . .

# Expose port 3000 for the API
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
