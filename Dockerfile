# Puppeteer ke official image ka use kar rahe hain jisme Chrome pehle se hota hai
FROM ghcr.io/puppeteer/puppeteer:latest

# Root user banna zaroori hai taaki libraries install ho sakein
USER root

# App directory set karna
WORKDIR /app

# Sabse pehle dependencies install karna
COPY package*.json ./
RUN npm install

# Baaki saara code copy karna
COPY . .

# Environment variable set karna taaki Puppeteer ko pata chale Chrome kahan hai
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Port expose karna jo Render provide karega
EXPOSE 3000

# Server start karne ki command
CMD ["node", "api/pdf.js"]
