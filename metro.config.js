// Learn more https://docs.expo.io/guides/customizing-metro
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add wasm asset support
config.resolver.assetExts.push('wasm');

// COEP/COOP enable SharedArrayBuffer for expo-sqlite on web. Patched at the response level because
// Expo CLI serves the HTML page before `server.enhanceMiddleware` runs.
const writeHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function (...args) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  return writeHead.apply(this, args);
};

module.exports = config;
