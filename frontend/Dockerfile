FROM node:22-bullseye-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_BACKEND_URL
ARG VITE_PYTHON_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_PYTHON_BACKEND_URL=$VITE_PYTHON_BACKEND_URL
RUN npm run build

FROM nginx:bullseye
COPY --from=builder /app/dist /usr/share/nginx/html
# Add basic nginx config for SPA routing if needed, but default might work if index.html is there. Let's create a custom one just in case.
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html index.htm; try_files $$uri $$uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
