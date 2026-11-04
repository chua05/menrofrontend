export const auth = {
  currentUser: null,
  authStateReady: async () => {},
  onAuthStateChanged: (callback) => {
    callback(null);
    return () => {};
  },
};
export const googleProvider = {};
export default {};
