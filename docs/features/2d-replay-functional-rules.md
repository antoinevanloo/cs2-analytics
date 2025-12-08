# 2D Replay - Documentation Fonctionnelle Exhaustive

> **Version**: 1.0.0
> **Dernière mise à jour**: 2025-12-08
> **Statut**: Implémenté
> **Domaine**: Visualisation & Analyse

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Modèles de données](#3-modèles-de-données)
4. [Système de coordonnées](#4-système-de-coordonnées)
5. [Rendu des joueurs](#5-rendu-des-joueurs)
6. [Événements de jeu](#6-événements-de-jeu)
7. [Contrôles de lecture](#7-contrôles-de-lecture)
8. [Interface utilisateur](#8-interface-utilisateur)
9. [API REST](#9-api-rest)
10. [Configuration des cartes](#10-configuration-des-cartes)
11. [Performance & Optimisation](#11-performance--optimisation)
12. [Gestion des erreurs](#12-gestion-des-erreurs)
13. [Évolutions futures](#13-évolutions-futures)

---

## 1. Vue d'ensemble

### 1.1 Description fonctionnelle

Le **2D Replay** est un module de visualisation permettant de rejouer les rounds de matchs CS2 sur une carte radar 2D. Il affiche en temps réel :

- Position des 10 joueurs sur la carte
- Direction du regard (view angle)
- État de vie, santé, armure
- Équipement (bombe, kit de désamorçage, arme active)
- Événements (kills, grenades, bombes)
- Indicateurs de mouvement (marche, course, accroupi)

### 1.2 Personas cibles

| Persona | Usage principal | Fonctionnalités clés |
|---------|-----------------|---------------------|
| **Joueur** | Analyser ses erreurs de positionnement | Kill lines, view angles |
| **Coach** | Expliquer les stratégies et erreurs | Replay frame par frame, focus joueur |
| **Analyste** | Étudier les tendances et patterns | Timeline événements, vitesse variable |
| **Recruteur** | Évaluer les performances individuelles | Focus joueur, health bars |

### 1.3 Flux utilisateur

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│   Parsing   │────▶│  Round      │────▶│  2D Replay  │
│   Demo      │     │   Queue     │     │  Selection  │     │  Viewer     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 2. Architecture technique

### 2.1 Stack technologique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | React + Konva.js | Canvas 2D performant |
| **State** | Zustand | Gestion d'état réactive |
| **Data** | React Query | Fetching & caching |
| **Backend** | NestJS | API REST |
| **Database** | PostgreSQL + Prisma | Stockage tick data |
| **Cache** | Redis | Cache API responses |

### 2.2 Composants frontend

```
apps/web/src/
├── components/replay/
│   ├── replay-viewer.tsx      # Container principal
│   ├── replay-canvas.tsx      # Rendu Konva 2D
│   ├── replay-controls.tsx    # Boutons de contrôle
│   ├── replay-timeline.tsx    # Barre de progression
│   └── replay-player-list.tsx # Liste des joueurs
├── stores/
│   └── replay-store.ts        # État Zustand
└── hooks/
    └── use-replay.ts          # Hook de chargement
```

### 2.3 Modules backend

```
apps/api/src/modules/replay/
├── replay.controller.ts       # Endpoints REST
├── replay.service.ts          # Logique métier
├── replay.module.ts           # Module NestJS
└── types/
    └── replay.types.ts        # Types TypeScript
```

### 2.4 Flux de données

```
┌──────────────┐   parse_ticks   ┌──────────────┐   GET /round/:n   ┌──────────────┐
│   Parser     │───────────────▶│   PlayerTick │─────────────────▶│   Frontend   │
│ (demoparser2)│                 │   (DB)       │                   │   (Zustand)  │
└──────────────┘                 └──────────────┘                   └──────────────┘
       │                                │                                  │
       │   parse_event                  │   getRoundEvents                 │   Konva
       │   player_death                 │                                  │   render
       ▼                                ▼                                  ▼
┌──────────────┐                 ┌──────────────┐                   ┌──────────────┐
│   GameEvent  │───────────────▶│   Kill       │─────────────────▶│   KillLine   │
│   (DB)       │                 │   Grenade    │                   │   Component  │
└──────────────┘                 │   (DB)       │                   └──────────────┘
                                 └──────────────┘
```

---

## 3. Modèles de données

### 3.1 PlayerFrame (État joueur par tick)

```typescript
interface PlayerFrame {
  // Identité
  steamId: string;              // Steam ID 64-bit
  name?: string;                // Nom affiché

  // Position (coordonnées radar 0-1024)
  x: number;
  y: number;
  z: number;                    // Altitude (pour cartes multi-niveaux)

  // Vélocité (unités de jeu par seconde)
  velocityX: number;            // -450 à +450 typique
  velocityY: number;
  velocityZ: number;

  // Direction du regard
  yaw: number;                  // Angle horizontal 0-360°
  pitch: number;                // Angle vertical -90° à +90°

  // État de vie
  health: number;               // 0-100
  armor: number;                // 0-100
  isAlive: boolean;

  // État de mouvement
  isDucking: boolean;           // Accroupi
  isWalking: boolean;           // Shift-walk (silencieux)
  isScoped: boolean;            // Zoomed (AWP, etc.)
  isDefusing: boolean;          // En désamorçage
  isPlanting: boolean;          // En pose de bombe

  // Équipe & équipement
  team: number;                 // 2=Terrorist, 3=Counter-Terrorist
  activeWeapon?: string;        // "ak47", "awp", etc.
  weaponAmmo?: number | null;   // Munitions actuelles
  hasDefuseKit: boolean;        // Kit de désamorçage (CT)
  hasBomb: boolean;             // Porte la bombe (T)
  money: number;                // Argent en poche

  // Effets de flash
  flashDuration: number;        // Durée restante (secondes)
  flashAlpha: number;           // Intensité 0-255
}
```

### 3.2 TickFrame (État complet par tick)

```typescript
interface TickFrame {
  tick: number;                 // Numéro de tick absolu
  time: number;                 // Secondes depuis début du round
  players: PlayerFrame[];       // 10 joueurs max
}
```

### 3.3 ReplayEvent (Événement de jeu)

```typescript
interface ReplayEvent {
  id: string;                   // "kill-0", "nade-1", etc.
  type: ReplayEventType;        // Type d'événement
  tick: number;                 // Tick de l'événement
  time: number;                 // Secondes depuis début round

  // Position principale
  x: number;                    // Coordonnées radar
  y: number;
  z: number;

  // Position secondaire (optionnelle)
  endX?: number;                // Position fin (ex: victime pour kill)
  endY?: number;
  endZ?: number;

  // Données spécifiques au type
  data: Record<string, unknown>;
}
```

### 3.4 Types d'événements

```typescript
type ReplayEventType =
  // Kills
  | "KILL"

  // Bombe
  | "BOMB_PLANT"
  | "BOMB_DEFUSE"
  | "BOMB_EXPLODE"

  // Grenades
  | "SMOKE_START"
  | "SMOKE_END"
  | "MOLOTOV_START"
  | "MOLOTOV_END"
  | "HE_EXPLODE"
  | "FLASH_EFFECT"
  | "DECOY_START"
  | "GRENADE_THROW"

  // Non implémentés
  | "DAMAGE"
  | "FOOTSTEP"
  | "SHOT_FIRED";
```

### 3.5 MapConfig (Configuration carte)

```typescript
interface MapConfig {
  mapName: string;              // "de_dust2", "de_mirage", etc.
  displayName?: string;         // "Dust II", "Mirage", etc.

  // Origine du système de coordonnées
  posX: number;                 // Décalage X (game units)
  posY: number;                 // Décalage Y (game units)
  scale: number;                // Facteur d'échelle

  // Dimensions radar
  radarWidth: number;           // 1024 typique
  radarHeight: number;          // 1024 typique

  // Support multi-niveaux (Nuke, Vertigo)
  hasLowerLevel: boolean;
  lowerPosX?: number;
  lowerPosY?: number;
  lowerScale?: number;
  splitAltitude?: number;       // Seuil Z pour changer de niveau

  // URL image radar
  radarImageUrl?: string;
}
```

### 3.6 RoundMetadata (Métadonnées round)

```typescript
interface RoundMetadata {
  roundNumber: number;          // 1-30 (ou plus en OT)
  startTick: number;
  endTick: number;
  duration: number;             // Secondes
  winnerTeam: number;           // 2=T, 3=CT
  winReason: string;            // "BombDefused", "Elimination", etc.
  ctScore: number;
  tScore: number;
  bombPlanted: boolean;
  bombSite?: string;            // "A" ou "B"
}
```

---

## 4. Système de coordonnées

### 4.1 Pipeline de conversion

```
Game Units ──────▶ Radar Coords ──────▶ Canvas Coords
(parser)          (API)               (frontend)
ex: 1500, -2000   ex: 450, 600        ex: 225, 300
```

### 4.2 Conversion Game → Radar (API)

**Formule:**
```typescript
radarX = (gameX - posX) / scale
radarY = (posY - gameY) / scale  // Y inversé!
```

**Implémentation:**
```typescript
function convertToRadarCoords(
  gameX: number,
  gameY: number,
  gameZ: number,
  mapConfig: MapRadarConfig
): { x: number; y: number; level: string; isOutOfBounds: boolean } {

  // 1. Validation des entrées
  if (!Number.isFinite(gameX) || !Number.isFinite(gameY)) {
    return { x: 0, y: 0, level: "upper", isOutOfBounds: true };
  }

  // 2. Sélection du niveau (cartes multi-niveaux)
  let { posX, posY, scale } = mapConfig;
  let level = "upper";

  if (mapConfig.hasLowerLevel &&
      gameZ < mapConfig.splitAltitude) {
    posX = mapConfig.lowerPosX ?? posX;
    posY = mapConfig.lowerPosY ?? posY;
    scale = mapConfig.lowerScale ?? scale;
    level = "lower";
  }

  // 3. Application de la formule
  const radarX = (gameX - posX) / scale;
  const radarY = (posY - gameY) / scale;

  // 4. Clamping aux limites
  return {
    x: Math.max(0, Math.min(mapConfig.radarWidth, radarX)),
    y: Math.max(0, Math.min(mapConfig.radarHeight, radarY)),
    level,
    isOutOfBounds: radarX < 0 || radarX > mapConfig.radarWidth ||
                   radarY < 0 || radarY > mapConfig.radarHeight
  };
}
```

### 4.3 Conversion Radar → Canvas (Frontend)

**Formule:**
```typescript
canvasX = radarX * (canvasWidth / radarWidth)
canvasY = radarY * (canvasHeight / radarHeight)
```

**Implémentation:**
```typescript
function radarToCanvas(
  radarX: number,
  radarY: number,
  mapConfig: MapConfig,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: radarX * (canvasWidth / mapConfig.radarWidth),
    y: radarY * (canvasHeight / mapConfig.radarHeight)
  };
}
```

### 4.4 Règles de validation

| Règle | Condition | Action |
|-------|-----------|--------|
| Coordonnées NaN/Infinity | `!Number.isFinite(x)` | Retourner origine (0,0) |
| Scale invalide | `scale === 0 \|\| !isFinite(scale)` | Retourner origine |
| Hors limites | `x < 0 \|\| x > radarWidth` | Clamper aux bornes |
| Coordonnées suspectes | `\|x\| < 1 && \|y\| < 1` | Considérer invalide (origine) |

---

## 5. Rendu des joueurs

### 5.1 Couleurs des équipes

```typescript
const TEAM_COLORS = {
  // Counter-Terrorists (team=3)
  CT: "#5d79ae",              // Bleu - joueur vivant
  CT_DEAD: "#3d4f6e",         // Bleu foncé - joueur mort
  CT_FOCUSED: "#8fa4d4",      // Bleu clair - joueur focus/hover

  // Terrorists (team=2)
  T: "#de9b35",               // Orange - joueur vivant
  T_DEAD: "#8e6322",          // Orange foncé - joueur mort
  T_FOCUSED: "#f4c56e",       // Orange clair - joueur focus/hover
};
```

### 5.2 Taille du marqueur joueur

| État | Rayon (px) | Condition |
|------|-----------|-----------|
| **Course** | 8 | `!isDucking && !isWalking && speed >= 140` |
| **Marche** | 6.5 | `isWalking \|\| speed < 140` |
| **Accroupi** | 6 | `isDucking` |

**Logique de détermination:**
```typescript
function getPlayerRadius(player: PlayerFrame): number {
  const speed = Math.sqrt(
    player.velocityX ** 2 + player.velocityY ** 2
  );

  if (player.isDucking) return 6;
  if (player.isWalking || speed < 140) return 6.5;
  return 8;
}
```

### 5.3 Indicateur de direction (View Angle)

**Constantes:**
```typescript
const VIEW_ANGLE_LENGTH = 20;   // Longueur du cône (px)
const VIEW_ANGLE_SPREAD = 30;   // Ouverture du cône (degrés)
```

**Rendu:**
```typescript
// Triangle/cône partant du centre du joueur
const yawRad = (player.yaw * Math.PI) / 180;
const spreadRad = (VIEW_ANGLE_SPREAD * Math.PI) / 180;

const viewPoints = [
  pos.x, pos.y,  // Sommet (centre joueur)
  pos.x + Math.cos(yawRad - spreadRad/2) * VIEW_ANGLE_LENGTH,
  pos.y - Math.sin(yawRad - spreadRad/2) * VIEW_ANGLE_LENGTH,
  pos.x + Math.cos(yawRad + spreadRad/2) * VIEW_ANGLE_LENGTH,
  pos.y - Math.sin(yawRad + spreadRad/2) * VIEW_ANGLE_LENGTH,
];

// Style: fill=teamColor, opacity=0.3, closed=true
```

**Règles:**
- Affiché uniquement si `isAlive === true`
- Couleur = couleur de l'équipe
- Opacité = 30%

### 5.4 Indicateur de mouvement (flèche de vélocité)

**Constantes:**
```typescript
const MOVEMENT_INDICATOR_LENGTH = 12;    // Longueur max flèche (px)
const MOVEMENT_INDICATOR_MIN_SPEED = 50; // Seuil d'affichage
const SPEED_RUNNING_MIN = 200;           // Vitesse de course
```

**Logique:**
```typescript
const speed = Math.sqrt(velocityX ** 2 + velocityY ** 2);

if (isAlive && speed > MOVEMENT_INDICATOR_MIN_SPEED) {
  const arrowLength = Math.min(speed / SPEED_RUNNING_MIN, 1) * 12;
  const movementAngle = Math.atan2(velocityY, velocityX);

  // Flèche du centre vers direction de mouvement
  // opacity=0.7, stroke=teamColor
}
```

### 5.5 Barre de vie et armure

**Position:**
```typescript
// Barre de vie
x: pos.x - 15
y: pos.y - radius - 14
width: 30
height: 4

// Barre d'armure (sous la vie)
x: pos.x - 15
y: pos.y - radius - 9
width: 30 * (armor / 100)
height: 2
```

**Couleurs de vie:**
```typescript
function getHealthColor(health: number): string {
  if (health > 50) return "#44ff44";  // Vert
  if (health > 25) return "#ffff44";  // Jaune
  return "#ff4444";                    // Rouge
}

// Armure: toujours bleu "#5d79ae"
```

**Règles:**
- Affiché uniquement si `isAlive === true`
- Affiché uniquement si toggle `showHealthBars === true`
- Fond gris `#333333` derrière la barre

### 5.6 Indicateurs d'équipement

#### Bombe (Terrorist)
```typescript
// Condition: hasBomb && isAlive
// Cercle rouge au-dessus de la tête
{
  x: pos.x,
  y: pos.y - radius - 6,
  radius: 4,
  fill: "#ff4444"
}
```

#### Kit de désamorçage (CT)
```typescript
// Condition: hasDefuseKit && isAlive && team === 3
// Carré vert au-dessus de la tête
{
  x: pos.x - 3,
  y: pos.y - radius - 8,
  width: 6,
  height: 6,
  fill: "#44ff44"
}
```

### 5.7 Marqueur de mort

```typescript
// Condition: isAlive === false
// Croix rouge (X)
{
  line1: [pos.x - 5, pos.y - 5, pos.x + 5, pos.y + 5],
  line2: [pos.x + 5, pos.y - 5, pos.x - 5, pos.y + 5],
  stroke: "#ff0000",
  strokeWidth: 2
}
```

### 5.8 Effet de flash

**Logique de calcul:**
```typescript
function getFlashOpacity(player: PlayerFrame): number {
  // Priorité: flashAlpha (plus précis) > flashDuration (fallback)
  if (player.flashAlpha > 0) {
    return (player.flashAlpha / 255) * 0.8;
  }
  if (player.flashDuration > 0) {
    return Math.min(player.flashDuration / 2, 1) * 0.7;
  }
  return 0;
}
```

**Rendu:**
```typescript
// Cercle blanc autour du joueur
{
  x: pos.x,
  y: pos.y,
  radius: radius + 4,
  fill: "#ffffff",
  opacity: flashOpacity
}
```

### 5.9 Nom du joueur

```typescript
// Condition: showPlayerNames === true && name existe
{
  x: pos.x - 30,
  y: pos.y + radius + 4,
  width: 60,
  text: player.name,
  fontSize: 10,
  fill: "#ffffff",
  align: "center",
  opacity: isAlive ? 1 : 0.5,
  shadowColor: "#000000",
  shadowBlur: 2
}
```

---

## 6. Événements de jeu

### 6.1 Kill Lines (Lignes de kill)

#### 6.1.1 Données requises

| Champ | Type | Source | Description |
|-------|------|--------|-------------|
| `x` | Float | Kill.attackerX → radar | Position attaquant |
| `y` | Float | Kill.attackerY → radar | Position attaquant |
| `endX` | Float | Kill.victimX → radar | Position victime |
| `endY` | Float | Kill.victimY → radar | Position victime |
| `headshot` | Boolean | Kill.headshot | Tir à la tête |
| `weapon` | String | Kill.weapon | Arme utilisée |

#### 6.1.2 Durée d'affichage

```typescript
const KILL_DISPLAY_WINDOW = 64 * 3; // 192 ticks = 3 secondes

function isKillVisible(event: ReplayEvent, currentTick: number): boolean {
  return currentTick >= event.tick &&
         currentTick <= event.tick + KILL_DISPLAY_WINDOW;
}
```

#### 6.1.3 Validation des coordonnées

```typescript
const COORD_THRESHOLD = 1;

function hasValidKillCoordinates(event: ReplayEvent): boolean {
  // Doit avoir position victime valide (pas à l'origine)
  const hasValidVictim =
    event.endX !== undefined &&
    event.endY !== undefined &&
    (Math.abs(event.endX) > COORD_THRESHOLD ||
     Math.abs(event.endY) > COORD_THRESHOLD);

  return hasValidVictim;
}
```

#### 6.1.4 Style visuel

| Propriété | Headshot | Non-headshot |
|-----------|----------|--------------|
| **Couleur ligne** | `#ff0000` (rouge) | `#ffffff` (blanc) |
| **Épaisseur** | 2px | 1px |
| **Opacité** | 0.6 | 0.6 |
| **Pointillés** | `[4, 4]` | `[4, 4]` |
| **Flèche** | 6x4 px | 6x4 px |

#### 6.1.5 Skull (marqueur victime)

```typescript
{
  text: "☠",
  fontSize: 12,
  fill: "#ff0000",
  x: victimPos.x - 6,
  y: victimPos.y - 6
}
```

#### 6.1.6 Cas particuliers

| Cas | Comportement |
|-----|--------------|
| **Suicide** | Skull seul (pas de ligne) - `attackerSteamId === victimSteamId` |
| **Fall damage** | Skull seul - `attackerSteamId === null` |
| **Teamkill** | Ligne + skull normaux |
| **Coords invalides (0,0)** | Non affiché |

### 6.2 Grenades

#### 6.2.1 Configuration par type

```typescript
const GRENADE_CONFIG = {
  smoke: {
    color: "#b0b0b0",       // Gris
    icon: "💨",
    label: "SMOKE",
    glowColor: "#808080"
  },
  flashbang: {
    color: "#ffee00",       // Jaune vif
    icon: "⚡",
    label: "FLASH",
    glowColor: "#ffffaa"
  },
  hegrenade: {
    color: "#ff3333",       // Rouge
    icon: "💥",
    label: "HE",
    glowColor: "#ff6666"
  },
  molotov: {
    color: "#ff6600",       // Orange
    icon: "🔥",
    label: "MOLLY",
    glowColor: "#ffaa00"
  },
  incgrenade: {
    color: "#ff6600",       // Orange (même que molotov)
    icon: "🔥",
    label: "INCEN",
    glowColor: "#ffaa00"
  },
  decoy: {
    color: "#44ff44",       // Vert
    icon: "📢",
    label: "DECOY",
    glowColor: "#88ff88"
  }
};
```

#### 6.2.2 Durée d'affichage

```typescript
const GRENADE_DISPLAY_DURATION = 64 * 5; // 320 ticks = 5 secondes

function isGrenadeVisible(event: ReplayEvent, currentTick: number): boolean {
  return currentTick >= event.tick &&
         currentTick <= event.tick + GRENADE_DISPLAY_DURATION;
}
```

#### 6.2.3 Fade-out progressif

```typescript
function getGrenadeOpacity(event: ReplayEvent, currentTick: number): number {
  const ticksSinceEvent = currentTick - event.tick;
  const fadeProgress = Math.min(ticksSinceEvent / GRENADE_DISPLAY_DURATION, 1);
  return Math.max(0.3, 1 - fadeProgress * 0.7);
  // Opacité: 100% → 30% sur 5 secondes
}
```

#### 6.2.4 Animations par type

**Smoke (fumigène):**
```typescript
// Expansion progressive
const smokeRadius = Math.min(ticksSinceEvent / 8, 30);

// Couches:
// 1. Anneau extérieur: radius=smokeRadius, fill, opacity=0.3
// 2. Remplissage intérieur: radius=smokeRadius*0.7, fill, opacity=0.5
// 3. Contour pointillé: stroke, dash=[4,4]
// 4. Badge icône/label au centre
```

**Molotov/Incendiaire:**
```typescript
// Expansion + pulsation
const fireRadius = Math.min(ticksSinceEvent / 6, 25);
const pulseOffset = Math.sin(ticksSinceEvent / 4) * 3;

// Couches:
// 1. Anneau feu extérieur: radius=fireRadius, opacity=0.4
// 2. Feu intérieur pulsant: radius=fireRadius*0.6 + pulseOffset, fill=#ffaa00
// 3. Centre chaud: radius=fireRadius*0.3, fill=#ffff00
// 4. Badge icône/label
```

**Flashbang:**
```typescript
// Flash décroissant rapide
const flashIntensity = Math.max(0, 1 - ticksSinceEvent / 25);
const flashRadius = 12 + flashIntensity * 15;

// Couches:
// 1. Halo extérieur: radius=flashRadius, opacity=intensity*0.6
// 2. Centre brillant: radius=flashRadius*0.5, fill=#ffffff, opacity=intensity*0.9
// 3. Badge icône/label
```

**HE Grenade:**
```typescript
// Explosion décroissante
const explosionProgress = Math.min(ticksSinceEvent / 20, 1);
const explosionRadius = 8 + explosionProgress * 18;

// Couches:
// 1. Blast extérieur: radius=explosionRadius, opacity=0.5
// 2. Blast intérieur: radius=explosionRadius*0.5, fill=#ffff00
// 3. Onde de choc: radius=explosionRadius*1.2, opacity=1-progress
// 4. Badge icône/label
```

**Decoy:**
```typescript
// Cercle pulsant
const pulseRadius = 8 + Math.sin(ticksSinceEvent / 3) * 3;

// Couches:
// 1. Cercle pulsant pointillé: stroke, dash=[3,3]
// 2. Badge icône/label
```

#### 6.2.5 Badge icône/label

```typescript
// Glow effect
{ circle: radius=14, fill=glowColor, opacity=0.4 }

// Background circle
{ circle: radius=11, fill=color, stroke=#ffffff, strokeWidth=2, opacity=0.9 }

// Icon (emoji)
{ text: icon, fontSize=14, x=pos.x-7, y=pos.y-7, align="center" }

// Label above
{ text: label, fontSize=9, fontStyle="bold", fill=#ffffff,
  x=pos.x-20, y=pos.y-26, width=40, align="center",
  shadowColor=#000000, shadowBlur=3 }
```

### 6.3 Bombe

#### 6.3.1 Durée d'affichage

```typescript
function isBombVisible(
  bombPlantEvent: ReplayEvent,
  events: ReplayEvent[],
  currentTick: number
): boolean {
  // Trouver événement de fin (defuse ou explosion)
  const endEvent = events.find(e =>
    (e.type === "BOMB_DEFUSE" || e.type === "BOMB_EXPLODE") &&
    e.tick > bombPlantEvent.tick
  );

  if (endEvent) {
    return currentTick >= bombPlantEvent.tick &&
           currentTick < endEvent.tick;
  }

  // Pas de fin = afficher jusqu'à fin du round
  return currentTick >= bombPlantEvent.tick;
}
```

#### 6.3.2 Style visuel

```typescript
// Animation pulsante
const timeSincePlant = (currentTick - event.tick) / 64;
const pulseRadius = 15 + Math.sin(timeSincePlant * 4) * 5;

// Cercle extérieur pulsant
{ circle: radius=pulseRadius, stroke=#ff0000, strokeWidth=2, opacity=0.5 }

// Cercle central
{ circle: radius=8, fill=#ff0000 }

// Label "C4"
{ text: "C4", fontSize=8, fill=#ffffff, fontStyle="bold",
  x=pos.x-4, y=pos.y-5 }
```

---

## 7. Contrôles de lecture

### 7.1 États de lecture

```typescript
type PlaybackState =
  | "idle"      // Aucune donnée chargée
  | "loading"   // Chargement en cours
  | "ready"     // Prêt à lire (pausé au début)
  | "playing"   // Lecture en cours
  | "paused"    // Pausé par l'utilisateur
  | "ended";    // Fin du round atteinte
```

### 7.2 Vitesses de lecture

```typescript
const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];

// Défaut: 1x (temps réel)
```

### 7.3 Raccourcis clavier

| Touche | Action | Fonction |
|--------|--------|----------|
| `Space` | Play/Pause | `togglePlay()` |
| `←` | Frame précédente | `previousFrame()` |
| `→` | Frame suivante | `nextFrame()` |
| `Shift+←` | Reculer 10s | `skipBackward(10)` |
| `Shift+→` | Avancer 10s | `skipForward(10)` |
| `1` | Vitesse 0.25x | `setPlaybackSpeed(0.25)` |
| `2` | Vitesse 0.5x | `setPlaybackSpeed(0.5)` |
| `3` | Vitesse 1x | `setPlaybackSpeed(1)` |
| `4` | Vitesse 2x | `setPlaybackSpeed(2)` |
| `5` | Vitesse 4x | `setPlaybackSpeed(4)` |
| `K` | Toggle Kill Lines | `toggleKillLines()` |
| `G` | Toggle Grenades | `toggleGrenades()` |
| `N` | Toggle Player Names | `togglePlayerNames()` |
| `H` | Toggle Health Bars | `toggleHealthBars()` |
| `R` | Reset Zoom | `resetViewport()` |

### 7.4 Logique de navigation

#### Skip temporel
```typescript
function skipForward(seconds: number): void {
  const ticksToSkip = Math.round(seconds * tickRate);
  const targetTick = currentTick + ticksToSkip;
  seekToTick(targetTick);
}

function skipBackward(seconds: number): void {
  const ticksToSkip = Math.round(seconds * tickRate);
  const targetTick = Math.max(0, currentTick - ticksToSkip);
  seekToTick(targetTick);
}
```

#### Recherche par tick (binary search)
```typescript
function seekToTick(tick: number): void {
  let left = 0;
  let right = frames.length - 1;
  let closestIndex = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTick = frames[mid].tick;

    if (midTick === tick) {
      closestIndex = mid;
      break;
    }

    if (midTick < tick) {
      closestIndex = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  seek(closestIndex);
}
```

### 7.5 Boucle d'animation

```typescript
// Calcul de l'avancement
const ticksToAdvance = (deltaTimeMs / 1000) * tickRate * playbackSpeed;
const framesToAdvance = Math.floor(ticksToAdvance / sampleInterval);

// Avancement de frame
if (currentFrameIndex + framesToAdvance >= frames.length - 1) {
  setPlaybackState("ended");
} else {
  setCurrentFrameIndex(currentFrameIndex + framesToAdvance);
}
```

### 7.6 Toggles d'overlay

| Toggle | État par défaut | Effet |
|--------|-----------------|-------|
| `showKillLines` | `true` | Affiche/masque les lignes de kill |
| `showGrenades` | `true` | Affiche/masque les grenades |
| `showPlayerNames` | `true` | Affiche/masque les noms |
| `showHealthBars` | `true` | Affiche/masque les barres de vie |

---

## 8. Interface utilisateur

### 8.1 Layout principal

```
┌─────────────────────────────────────────────────────────────┐
│  [Round Selector ▼]                          [Toggles]     │
├─────────────────────────────────────────────┬───────────────┤
│                                             │               │
│                                             │  CT Team      │
│                                             │  ├─ Player 1  │
│                                             │  ├─ Player 2  │
│             CANVAS 2D                       │  └─ ...       │
│           (800x800 typ)                     │               │
│                                             │  T Team       │
│                                             │  ├─ Player 1  │
│                                             │  └─ ...       │
│                                             │               │
├─────────────────────────────────────────────┴───────────────┤
│  [⏪] [◀] [▶/⏸] [▶] [⏩]    [1x ▼]    ━━━━━●━━━━━  0:45/1:55 │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Sélecteur de round

```typescript
// Format d'affichage
`Round ${roundNumber} (${ctScore}-${tScore})`

// Exemple: "Round 5 (3-1)"
```

### 8.3 Liste des joueurs (sidebar)

#### Tri des joueurs
```typescript
function sortPlayers(players: PlayerFrame[]): PlayerFrame[] {
  return [...players].sort((a, b) => {
    // 1. Vivants d'abord
    if (a.isAlive !== b.isAlive) {
      return a.isAlive ? -1 : 1;
    }
    // 2. Alphabétique par nom
    return (a.name || "").localeCompare(b.name || "");
  });
}
```

#### Informations affichées par joueur
```
┌────────────────────────────────────────┐
│ ▌ PlayerName              💣           │  ← Barre équipe + nom + bombe
│   ❤️ 100  🛡️ 100  [Kit]               │  ← Vie, armure, kit
│   AK-47                    $4750       │  ← Arme, argent
└────────────────────────────────────────┘
```

#### États visuels
- **Joueur mort**: Opacité 50%
- **Joueur focus**: Background primary + ring
- **Joueur hover**: Background muted

### 8.4 Timeline

#### Marqueurs d'événements
```typescript
const EVENT_COLORS = {
  KILL: "#ff4444",         // Rouge
  BOMB_PLANT: "#ffaa00",   // Orange
  BOMB_DEFUSE: "#44ff44",  // Vert
  BOMB_EXPLODE: "#ff0000", // Rouge vif
};
```

#### Format du temps
```typescript
function formatTime(tick: number, startTick: number, tickRate: number): string {
  const seconds = (tick - startTick) / tickRate;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
// Exemple: "1:23"
```

#### Scrubber
- **Click**: Seek à la position (pause automatique si playing)
- **Drag**: Seek continu
- **Hover**: Tooltip avec temps et tick

### 8.5 Contrôles de zoom

```typescript
// Limites de zoom
const MIN_SCALE = 0.5;  // 50%
const MAX_SCALE = 4;    // 400%

// Facteur de zoom par scroll
const SCALE_BY = 1.1;   // 10% par cran

// Zoom vers le curseur
function handleWheel(e: WheelEvent): void {
  const oldScale = viewportScale;
  const pointer = stage.getPointerPosition();

  const mousePointTo = {
    x: (pointer.x - viewportOffsetX) / oldScale,
    y: (pointer.y - viewportOffsetY) / oldScale,
  };

  const newScale = e.deltaY > 0
    ? Math.max(MIN_SCALE, oldScale / SCALE_BY)
    : Math.min(MAX_SCALE, oldScale * SCALE_BY);

  const newOffset = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };

  setViewport(newScale, newOffset.x, newOffset.y);
}
```

---

## 9. API REST

### 9.1 Endpoints

#### GET /v1/replay/:demoId/rounds
```yaml
Description: Liste des rounds avec métadonnées
Auth: Bearer token (role: user)
Response:
  - roundNumber: number
  - startTick: number
  - endTick: number
  - duration: number
  - winnerTeam: number (2=T, 3=CT)
  - winReason: string
  - ctScore: number
  - tScore: number
  - bombPlanted: boolean
  - bombSite: string | null
```

#### GET /v1/replay/:demoId/round/:roundNumber
```yaml
Description: Données complètes d'un round
Auth: Bearer token (role: user)
Query params:
  - includeEvents: boolean (default: true)
  - sampleInterval: number (default: 8)
Response:
  - demoId: string
  - roundNumber: number
  - startTick: number
  - endTick: number
  - tickRate: number
  - sampleInterval: number
  - map: MapRadarConfig
  - teams: { ct: TeamInfo, t: TeamInfo }
  - frames: TickFrame[]
  - events: ReplayEvent[]
```

#### GET /v1/replay/:demoId/round/:roundNumber/stream
```yaml
Description: Stream NDJSON du round
Auth: Bearer token (role: user)
Query params:
  - sampleInterval: number (default: 8)
  - batchSize: number (default: 100)
Headers:
  - Content-Type: application/x-ndjson
  - Transfer-Encoding: chunked
  - X-Accel-Buffering: no
Response: NDJSON lines
  - { type: "metadata", data: {...} }
  - { type: "frame", data: TickFrame }
  - { type: "event", data: ReplayEvent }
  - { type: "end", data: { framesStreamed, eventsStreamed } }
  - { type: "error", data: { message, code } }
```

#### GET /v1/replay/map/:mapName
```yaml
Description: Configuration radar d'une carte
Auth: Public (pas de token requis)
Response: MapRadarConfig
```

#### GET /v1/replay/:demoId/available
```yaml
Description: Vérifie si les tick data existent
Auth: Bearer token (role: user)
Response:
  - available: boolean
  - tickDataExists: boolean
```

#### GET /v1/replay/maps
```yaml
Description: Liste toutes les cartes disponibles
Auth: Public
Response: MapRadarConfig[]
```

### 9.2 Cache Redis

| Clé | TTL | Description |
|-----|-----|-------------|
| `replay:rounds:{demoId}` | 1 heure | Métadonnées rounds |
| `replay:map:{mapName}` | 24 heures | Config carte |
| `replay:round:{demoId}:{round}` | 30 minutes | Données round |
| `replay:playernames:{demoId}:{steamIds}` | 1 heure | Noms joueurs |

### 9.3 Échantillonnage des données

```typescript
// Paramètre: sampleInterval (défaut: 8)
// Signification: Prendre 1 tick sur sampleInterval

// Exemple avec tickRate=64 et sampleInterval=8:
// → 64/8 = 8 frames par seconde
// → Round de 2 minutes = ~960 frames

// Algorithme d'adaptation:
const storedInterval = ticks[1] - ticks[0]; // Intervalle stocké
const skipCount = Math.round(sampleInterval / storedInterval);

const sampledTicks = [];
for (let i = 0; i < ticks.length; i += skipCount) {
  sampledTicks.push(ticks[i]);
}
```

---

## 10. Configuration des cartes

### 10.1 Cartes Active Duty (2024)

| Carte | posX | posY | scale | Multi-niveau |
|-------|------|------|-------|--------------|
| de_ancient | -2953 | 2164 | 5.0 | Non |
| de_anubis | -2796 | 3328 | 5.22 | Non |
| de_dust2 | -2476 | 3239 | 4.4 | Non |
| de_inferno | -2087 | 3870 | 4.9 | Non |
| de_mirage | -3230 | 1713 | 5.0 | Non |
| de_nuke | -3453 | 2887 | 7.0 | **Oui** (splitAlt=-495) |
| de_overpass | -4831 | 1781 | 5.2 | Non |
| de_vertigo | -3168 | 1762 | 4.0 | **Oui** (splitAlt=11700) |

### 10.2 Cartes avec niveaux multiples

#### de_nuke
```typescript
{
  posX: -3453, posY: 2887, scale: 7,
  hasLowerLevel: true,
  splitAltitude: -495,
  lowerPosX: -3453, lowerPosY: 2887, lowerScale: 7
}
// Niveau inférieur: Z < -495
```

#### de_vertigo
```typescript
{
  posX: -3168, posY: 1762, scale: 4,
  hasLowerLevel: true,
  splitAltitude: 11700,
  lowerPosX: -3168, lowerPosY: 1762, lowerScale: 4
}
// Niveau inférieur: Z < 11700
```

#### de_train
```typescript
{
  posX: -2308, posY: 2078, scale: 4.082077,
  hasLowerLevel: true,
  splitAltitude: -50
}
```

### 10.3 URL des images radar

```typescript
function getRadarImageUrl(mapName: string, level?: "lower" | "upper"): string {
  const normalizedName = mapName.toLowerCase().replace(/\.bsp$/, "");
  const suffix = level === "lower" ? "_lower" : "";
  return `/radars/${normalizedName}${suffix}.png`;
}

// Exemples:
// de_dust2 → /radars/de_dust2.png
// de_nuke (lower) → /radars/de_nuke_lower.png
```

---

## 11. Performance & Optimisation

### 11.1 Targets de performance

| Métrique | Target | Mesure |
|----------|--------|--------|
| **Rendu frame** | < 16ms | 60 FPS maintenu |
| **Chargement round** | < 2s | Temps avant ready |
| **Mémoire par frame** | < 5KB | ~500B/joueur × 10 |
| **Seek latence** | < 50ms | Temps de réponse scrubber |

### 11.2 Optimisations implémentées

#### Mémoisation des composants
```typescript
const PlayerMarker = React.memo(function PlayerMarker({...}) {
  // Re-render uniquement si props changent
});

const KillLine = React.memo(function KillLine({...}) {...});
const GrenadeIndicator = React.memo(function GrenadeIndicator({...}) {...});
```

#### Filtrage efficace des événements
```typescript
const activeEvents = useMemo(() => {
  return events.filter(event => {
    // Logique de filtrage par type et fenêtre temporelle
  });
}, [events, currentTick, showKillLines, showGrenades]);
```

#### Échantillonnage adaptatif
```typescript
// Données stockées à intervalle X
// Requête avec intervalle Y
// → Skip = Y/X frames
```

#### Streaming NDJSON
- Évite de charger tout en mémoire
- Affichage progressif des frames
- Batches de 100 frames

### 11.3 Limites connues

| Limite | Valeur | Impact |
|--------|--------|--------|
| Max frames en mémoire | ~10000 | Round de ~20min max |
| Max joueurs par frame | 10 | Standard CS2 |
| Max événements | Illimité | Filtrage par fenêtre |

---

## 12. Gestion des erreurs

### 12.1 Hiérarchie des erreurs

```typescript
// Erreurs de chargement
"Demo not found"           // 404 - Demo inexistante
"Round not found"          // 404 - Round inexistant
"Tick data not available"  // 400 - Pas de données tick
"Authentication required"  // 401 - Token manquant/invalide
"Access denied"            // 403 - Pas d'accès à la demo

// Erreurs de données
"Invalid coordinates"      // Coords NaN/Infinity
"Invalid map config"       // Scale = 0 ou invalide
"No frames loaded"         // frames.length === 0
```

### 12.2 Stratégies de récupération

| Erreur | Stratégie | UX |
|--------|-----------|-----|
| Coords invalides | Retourner origine + flag | Élément non affiché |
| Frame manquante | Clamper à la dernière valide | Pas de saut |
| Map config absente | Utiliser coords brutes | Échelle incorrecte |
| Événement sans coords | Skip silencieux | Pas d'affichage |
| Streaming interrompu | Retry automatique | Loader visible |

### 12.3 Logging

```typescript
// API (NestJS Logger)
this.logger.warn(`Invalid coordinates: (${x}, ${y})`);
this.logger.log(`Processed ${count} frames for demo ${id}`);

// Frontend (Console en dev)
console.log(`[Store:play] called, state=${playbackState}`);
console.warn(`Failed to load radar image: ${url}`);
```

---

## 13. Évolutions futures

### 13.1 Roadmap

| Phase | Feature | Priorité |
|-------|---------|----------|
| v1.1 | Icônes wallbang/noscope sur kills | Haute |
| v1.1 | Animation draw des kill lines | Moyenne |
| v1.2 | Filtres par joueur/arme | Moyenne |
| v1.2 | Heatmap des positions | Moyenne |
| v2.0 | Mode POV (caméra joueur) | Basse |
| v2.0 | Replay 3D (Three.js) | Basse |
| v2.0 | Export GIF/vidéo | Basse |

### 13.2 Paramètres configurables (future)

```typescript
interface ReplayConfig {
  // Affichage
  playerRadius: number;
  viewAngleLength: number;
  viewAngleSpread: number;

  // Durées
  killDisplayDuration: number;
  grenadeDisplayDuration: number;

  // Couleurs
  teamColors: {
    ct: string;
    t: string;
    ctDead: string;
    tDead: string;
  };

  // Animations
  enableAnimations: boolean;
  animationSpeed: number;
}
```

### 13.3 Intégrations prévues

- **Clips**: Marquer et exporter des segments
- **Annotations**: Ajouter des notes sur le replay
- **Partage**: Lien direct vers un moment précis
- **Comparaison**: Superposer deux rounds

---

## Annexes

### A. Fichiers source

| Fichier | Rôle |
|---------|------|
| `apps/web/src/components/replay/replay-viewer.tsx` | Container principal |
| `apps/web/src/components/replay/replay-canvas.tsx` | Rendu Konva 2D |
| `apps/web/src/components/replay/replay-controls.tsx` | Boutons contrôle |
| `apps/web/src/components/replay/replay-timeline.tsx` | Timeline scrubber |
| `apps/web/src/components/replay/replay-player-list.tsx` | Liste joueurs |
| `apps/web/src/stores/replay-store.ts` | État Zustand |
| `apps/web/src/hooks/use-replay.ts` | Hook chargement |
| `apps/api/src/modules/replay/replay.service.ts` | Service API |
| `apps/api/src/modules/replay/replay.controller.ts` | Endpoints |
| `apps/api/src/modules/replay/types/replay.types.ts` | Types TS |
| `packages/db/src/map-configs.ts` | Configs cartes |
| `packages/db/prisma/schema.prisma` | Modèles DB |

### B. Constantes globales

```typescript
// Timing
const TICK_RATE = 64;                    // Ticks par seconde
const DEFAULT_SAMPLE_INTERVAL = 8;        // 1 frame / 8 ticks
const KILL_DISPLAY_DURATION = 192;        // 3 secondes
const GRENADE_DISPLAY_DURATION = 320;     // 5 secondes

// Dimensions
const PLAYER_RADIUS = 8;
const PLAYER_RADIUS_WALKING = 6.5;
const PLAYER_RADIUS_DUCKING = 6;
const VIEW_ANGLE_LENGTH = 20;
const VIEW_ANGLE_SPREAD = 30;
const MOVEMENT_INDICATOR_LENGTH = 12;

// Vitesses
const SPEED_WALKING_MAX = 140;
const SPEED_RUNNING_MIN = 200;
const MOVEMENT_INDICATOR_MIN_SPEED = 50;

// Zoom
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.1;

// Cache TTL (ms)
const CACHE_ROUND_METADATA = 3600000;     // 1 heure
const CACHE_MAP_METADATA = 86400000;      // 24 heures
const CACHE_ROUND_REPLAY = 1800000;       // 30 minutes
```

### C. Checklist qualité

| Critère | Status | Notes |
|---------|--------|-------|
| ✅ Extensibilité | OK | Architecture modulaire, configs séparées |
| ✅ Scalabilité | OK | Streaming, échantillonnage adaptatif |
| ✅ Exhaustivité | OK | Toutes les données joueur extraites |
| ✅ Performance | OK | 60fps, <2s load |
| ✅ Stabilité | OK | Validation + fallbacks complets |
| ✅ Résilience | OK | Graceful degradation |
| ✅ Gamification | OK | Feedback visuel riche |
| ✅ Mobile-ready | OK | Touch support via Konva |
| ⏳ Paramètrable | Partiel | Toggles OK, config avancée à venir |

---

*Document généré le 2025-12-08 - CS2 Analytics v1.0*
