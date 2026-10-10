import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

export const currentContext = () => storage.getStore() || {};

export const runWithContext = (values, fn) => storage.run({ ...currentContext(), ...values }, fn);

export const setContext = (values) => {
  const store = storage.getStore();
  if (store) Object.assign(store, values);
};
