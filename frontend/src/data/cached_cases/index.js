/**
 * Built-in static baseline snapshots for all IEEE standard power grids.
 * Loaded 100% on the client side with 0 backend HTTP requests.
 */

export const BASE_CASES_MAP = {
  case9: () => import('./case9.json'),
  case14: () => import('./case14.json'),
  case30: () => import('./case30.json'),
  case39: () => import('./case39.json'),
  case57: () => import('./case57.json'),
  case118: () => import('./case118.json'),
  case300: () => import('./case300.json'),
};

export const BUILTIN_CASES_LIST = [
  { id: 'case9', name: 'IEEE 9-Bus WSCC System', description: '3 generators, 9 buses - classic stability benchmark' },
  { id: 'case14', name: 'IEEE 14-Bus Test System', description: '5 generators, 14 buses - standard transmission benchmark' },
  { id: 'case30', name: 'IEEE 30-Bus System', description: '6 generators, 30 buses - Midwest US sub-transmission grid' },
  { id: 'case39', name: 'IEEE 39-Bus New England', description: '10 generators, 39 buses - famous New England power grid model' },
  { id: 'case57', name: 'IEEE 57-Bus System', description: '7 generators, 57 buses - US AEP transmission network' },
  { id: 'case118', name: 'IEEE 118-Bus System', description: '54 generators, 118 buses - Midwest US bulk power grid' },
  { id: 'case300', name: 'IEEE 300-Bus System', description: '69 generators, 300 buses - large-scale transmission grid' },
];

export async function getBuiltinBaseCase(caseId) {
  if (BASE_CASES_MAP[caseId]) {
    const mod = await BASE_CASES_MAP[caseId]();
    return mod.default || mod;
  }
  return null;
}
