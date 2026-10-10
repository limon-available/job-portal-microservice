FROM node:20-alpine AS build
WORKDIR /app
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
RUN npm run build --workspace @hireheaven/shared && npm run build --workspace @hireheaven/notification

FROM build AS development
ENV NODE_ENV=development
RUN chown -R node:node /app
EXPOSE 5005
USER node
CMD ["./node_modules/.bin/concurrently", "-k", "npm run build --workspace @hireheaven/shared -- --watch", "npm run dev --workspace @hireheaven/notification"]

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/.npmrc ./.npmrc
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/services/auth/package.json ./services/auth/package.json
COPY --from=build /app/services/utils/package.json ./services/utils/package.json
COPY --from=build /app/services/notification/package.json ./services/notification/package.json
COPY --from=build /app/services/user/package.json ./services/user/package.json
COPY --from=build /app/services/job/package.json ./services/job/package.json
COPY --from=build /app/services/application/package.json ./services/application/package.json
COPY --from=build /app/services/gateway/package.json ./services/gateway/package.json
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
RUN npm ci --omit=dev --ignore-scripts --workspace @hireheaven/shared --workspace @hireheaven/notification --include-workspace-root=false
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/services/notification/dist ./services/notification/dist
COPY --from=build /app/services/notification/migrations ./services/notification/migrations
COPY --from=build /app/services/notification/scripts ./services/notification/scripts
RUN chown -R node:node /app
USER node
EXPOSE 5005
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:5005/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "services/notification/dist/index.js"]
