# Use an official nginx image as the base
FROM nginx:latest

# Copy your static website files to the nginx container
COPY . /usr/share/nginx/html

# Expose port 80 to serve the website
EXPOSE 80
