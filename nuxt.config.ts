// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  imports: {
    autoImport: false,
  },
  devtools: { enabled: false },
  ssr: false,
  typescript: { strict: true },

  css: ["@/assets/index.css"],
  nitro: {

  },
});
