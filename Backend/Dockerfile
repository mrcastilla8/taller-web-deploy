FROM node:24-trixie-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DB_STORAGE=/app/data/eventos.sqlite
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && mkdir -p /app/data \
    && chown node:node /app/data
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
