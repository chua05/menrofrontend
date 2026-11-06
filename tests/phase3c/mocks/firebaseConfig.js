export const auth = {
  get currentUser() {
    const role = new URLSearchParams(window.location.search).get("role");
    return role && role !== "unauthenticated" ? { getIdToken: async () => "phase3c-test-token" } : null;
  },
  authStateReady: async () => {},
  onAuthStateChanged: (callback) => {
    callback(null);
    return () => {};
  },
};
export const googleProvider = {};
export default {};
