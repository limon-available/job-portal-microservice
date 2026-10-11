type AuthAppModule = typeof import("./app.js");

export const initializeAuthApp = async (
  connectRedis: () => Promise<unknown>,
  loadApp: () => Promise<AuthAppModule>,
): Promise<AuthAppModule["default"]> => {
  await connectRedis();
  const { default: app } = await loadApp();
  return app;
};
