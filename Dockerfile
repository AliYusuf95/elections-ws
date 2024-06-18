FROM node:alpine

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Exports
EXPOSE 3000

CMD [ "npm", "run", "start.dev" ]
