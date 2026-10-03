/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the WhyTired API in production, e.g. https://whytired-api.onrender.com */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
