import ing from "./ing.js";
import generic from "./generic.js";

export const PROFILES = [ing, generic];

export const byId = (id) => PROFILES.find((p) => p.id === id) || generic;

export const detectProfile = (text) => PROFILES.find((p) => p.detect(text)) || generic;
