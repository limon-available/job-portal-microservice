FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080
ENV NEXT_PUBLIC_GATEWAY_URL=${NEXT_PUBLIC_GATEWAY_URL}
COPY package.json .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/auth/package.json services/auth/package.json
COPY services/utils/package.json services/utils/package.json
COPY services/notification/package.json services/notification/package.json
COPY services/user/package.json services/user/package.json
COPY services/job/package.json services/job/package.json
COPY services/application/package.json services/application/package.json
COPY services/gateway/package.json services/gateway/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --package-lock-only --ignore-scripts && npm ci --ignore-scripts
COPY . .
RUN npm run build --workspace @hireheaven/web

FROM build AS development
ENV NODE_ENV=development
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace", "@hireheaven/web"]

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080
ENV NEXT_PUBLIC_GATEWAY_URL=${NEXT_PUBLIC_GATEWAY_URL}
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/web/server.js"]
