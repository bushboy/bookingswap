/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_HEDERA_NETWORK: string;
  readonly VITE_HEDERA_MIRROR_NODE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
