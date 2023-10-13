// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  imports: {
    autoImport: false,
  },
  devtools: { enabled: false },
  ssr: false,
  typescript: { strict: true },

  css: ["@/assets/index.css"],
  app: {
    baseURL: '/visualization/', // baseURL: '/<repository>/'
    buildAssetsDir: 'assets', // don't use "_" at the begining of the folder name to avoids nojkill conflict
  }
});
