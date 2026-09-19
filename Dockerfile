# Use an official nginx image as the base
FROM nginx:latest

# Copy only the public site, excluding source history and local development files.
COPY index.html 404.html styles.css script.js robots.txt sitemap.xml site.webmanifest /usr/share/nginx/html/
COPY assets/favicon.svg assets/social-card.svg /usr/share/nginx/html/assets/

# Expose port 80 to serve the website
EXPOSE 80
