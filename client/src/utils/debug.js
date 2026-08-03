// quick debug helpers
export const log = (...args) => {
  if(import.meta.env.DEV) {
    console.log('[DEBUG]', ...args);
  }
}

export const logError = (msg, err) => {
  console.error(`[ERROR] ${msg}:`, err);
}

// used this during dev to test yjs updates
export const logYjsUpdate = (update) => {
  log('yjs update size:', update.length, 'bytes');
}
