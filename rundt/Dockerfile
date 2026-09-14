# Ett trinn, fordi det ikke er noe å bygge. Prosjektet har null avhengigheter:
# serveren er node:http og ingenting mer, og sida er filer som ligger klare.
FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public

# Lista skal overleve at containeren byttes ut. Katalogen eies av node-brukeren
# fordi prosessen ikke kjører som root, og en volummontering arver eierskapet
# fra katalogen som allerede ligger i imaget.
RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/helse').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
