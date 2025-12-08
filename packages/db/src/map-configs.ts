/**
 * Official CS2 Map Radar Configurations
 *
 * Data sourced from: https://github.com/2mlml/cs2-radar-images
 *
 * These configurations define the coordinate transformation from
 * game world coordinates to radar image coordinates.
 *
 * Formula:
 *   radarX = (gameX - posX) / scale
 *   radarY = (posY - gameY) / scale  (Y is inverted)
 *
 * @module map-configs
 */

export interface MapConfigData {
  mapName: string;
  displayName: string;
  posX: number;
  posY: number;
  scale: number;
  radarWidth?: number;
  radarHeight?: number;
  hasLowerLevel?: boolean;
  lowerPosX?: number;
  lowerPosY?: number;
  lowerScale?: number;
  splitAltitude?: number;
  gameMode?: "competitive" | "wingman" | "casual" | "deathmatch";
  // Spawn positions (normalized 0-1 on radar)
  ctSpawnX?: number;
  ctSpawnY?: number;
  tSpawnX?: number;
  tSpawnY?: number;
  // Bomb sites (normalized 0-1 on radar)
  bombAX?: number;
  bombAY?: number;
  bombBX?: number;
  bombBY?: number;
}

/**
 * Official CS2 competitive map pool configurations
 * Values from cs2-radar-images repository .txt files
 */
export const CS2_MAP_CONFIGS: MapConfigData[] = [
  // ============================================================================
  // Active Duty Pool (2024)
  // ============================================================================
  {
    mapName: "de_ancient",
    displayName: "Ancient",
    posX: -2953,
    posY: 2164,
    scale: 5,
    gameMode: "competitive",
    ctSpawnX: 0.51,
    ctSpawnY: 0.17,
    tSpawnX: 0.485,
    tSpawnY: 0.87,
    bombAX: 0.31,
    bombAY: 0.25,
    bombBX: 0.8,
    bombBY: 0.4,
  },
  {
    mapName: "de_anubis",
    displayName: "Anubis",
    posX: -2796,
    posY: 3328,
    scale: 5.22,
    gameMode: "competitive",
    ctSpawnX: 0.61,
    ctSpawnY: 0.22,
    tSpawnX: 0.58,
    tSpawnY: 0.93,
  },
  {
    mapName: "de_dust2",
    displayName: "Dust II",
    posX: -2476,
    posY: 3239,
    scale: 4.4,
    gameMode: "competitive",
    ctSpawnX: 0.62,
    ctSpawnY: 0.21,
    tSpawnX: 0.39,
    tSpawnY: 0.91,
    bombAX: 0.8,
    bombAY: 0.16,
    bombBX: 0.21,
    bombBY: 0.12,
  },
  {
    mapName: "de_inferno",
    displayName: "Inferno",
    posX: -2087,
    posY: 3870,
    scale: 4.9,
    gameMode: "competitive",
    ctSpawnX: 0.9,
    ctSpawnY: 0.35,
    tSpawnX: 0.1,
    tSpawnY: 0.67,
    bombAX: 0.81,
    bombAY: 0.69,
    bombBX: 0.49,
    bombBY: 0.22,
  },
  {
    mapName: "de_mirage",
    displayName: "Mirage",
    posX: -3230,
    posY: 1713,
    scale: 5.0,
    gameMode: "competitive",
    ctSpawnX: 0.28,
    ctSpawnY: 0.7,
    tSpawnX: 0.87,
    tSpawnY: 0.36,
    bombAX: 0.54,
    bombAY: 0.76,
    bombBX: 0.23,
    bombBY: 0.28,
  },
  {
    mapName: "de_nuke",
    displayName: "Nuke",
    posX: -3453,
    posY: 2887,
    scale: 7,
    hasLowerLevel: true,
    lowerPosX: -3453,
    lowerPosY: 2887,
    lowerScale: 7,
    splitAltitude: -495,
    gameMode: "competitive",
    ctSpawnX: 0.82,
    ctSpawnY: 0.45,
    tSpawnX: 0.19,
    tSpawnY: 0.54,
    bombAX: 0.58,
    bombAY: 0.48,
    bombBX: 0.58,
    bombBY: 0.58,
  },
  {
    mapName: "de_overpass",
    displayName: "Overpass",
    posX: -4831,
    posY: 1781,
    scale: 5.2,
    gameMode: "competitive",
    ctSpawnX: 0.49,
    ctSpawnY: 0.2,
    tSpawnX: 0.66,
    tSpawnY: 0.93,
    bombAX: 0.55,
    bombAY: 0.23,
    bombBX: 0.7,
    bombBY: 0.31,
  },
  {
    mapName: "de_vertigo",
    displayName: "Vertigo",
    posX: -3168,
    posY: 1762,
    scale: 4.0,
    hasLowerLevel: true,
    lowerPosX: -3168,
    lowerPosY: 1762,
    lowerScale: 4.0,
    splitAltitude: 11700,
    gameMode: "competitive",
    ctSpawnX: 0.54,
    ctSpawnY: 0.25,
    tSpawnX: 0.2,
    tSpawnY: 0.75,
    bombAX: 0.705,
    bombAY: 0.585,
    bombBX: 0.222,
    bombBY: 0.223,
  },

  // ============================================================================
  // Reserve Pool / Classic Maps
  // ============================================================================
  {
    mapName: "de_train",
    displayName: "Train",
    posX: -2308,
    posY: 2078,
    scale: 4.082077,
    hasLowerLevel: true,
    lowerPosX: -2308,
    lowerPosY: 2078,
    lowerScale: 4.082077,
    splitAltitude: -50,
    gameMode: "competitive",
    ctSpawnX: 0.86,
    ctSpawnY: 0.77,
    tSpawnX: 0.12,
    tSpawnY: 0.25,
    bombAX: 0.63,
    bombAY: 0.49,
    bombBX: 0.52,
    bombBY: 0.76,
  },

  // ============================================================================
  // New CS2 Maps (2024)
  // ============================================================================
  {
    mapName: "de_basalt",
    displayName: "Basalt",
    posX: -2200,
    posY: 1700,
    scale: 4.5,
    gameMode: "competitive",
  },
  {
    mapName: "de_edin",
    displayName: "Edin",
    posX: -2100,
    posY: 2300,
    scale: 4.8,
    gameMode: "competitive",
  },

  // ============================================================================
  // Hostage Maps
  // ============================================================================
  {
    mapName: "cs_office",
    displayName: "Office",
    posX: -1838,
    posY: 1858,
    scale: 4.1,
    gameMode: "casual",
  },
  {
    mapName: "cs_italy",
    displayName: "Italy",
    posX: -2647,
    posY: 2592,
    scale: 4.6,
    gameMode: "casual",
  },

  // ============================================================================
  // Arms Race / Gun Game Maps
  // ============================================================================
  {
    mapName: "ar_baggage",
    displayName: "Baggage",
    posX: -2150,
    posY: 2280,
    scale: 4.0,
    hasLowerLevel: true,
    lowerPosX: -2150,
    lowerPosY: 2280,
    lowerScale: 4.0,
    splitAltitude: 0,
    gameMode: "casual",
  },
  {
    mapName: "ar_shoots",
    displayName: "Shoots",
    posX: -1552,
    posY: 2432,
    scale: 3.5,
    gameMode: "casual",
  },

  // ============================================================================
  // Wingman Maps (2v2)
  // ============================================================================
  {
    mapName: "de_shortdust",
    displayName: "Shortdust",
    posX: -2318,
    posY: 2337,
    scale: 3.6,
    gameMode: "wingman",
  },
  {
    mapName: "de_shortnuke",
    displayName: "Shortnuke",
    posX: -1620,
    posY: 1434,
    scale: 3.5,
    gameMode: "wingman",
  },
];

/**
 * Get map config by name (case-insensitive)
 */
export function getMapConfig(mapName: string): MapConfigData | undefined {
  const normalized = mapName.toLowerCase().replace(/\.bsp$/, "");
  return CS2_MAP_CONFIGS.find(
    (m) => m.mapName.toLowerCase() === normalized,
  );
}

/**
 * Get all competitive maps
 */
export function getCompetitiveMaps(): MapConfigData[] {
  return CS2_MAP_CONFIGS.filter((m) => m.gameMode === "competitive");
}

/**
 * Check if a map name is known
 */
export function isKnownMap(mapName: string): boolean {
  return getMapConfig(mapName) !== undefined;
}
