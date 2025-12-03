-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'COACH', 'ANALYST', 'PLAYER');

-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('LOCAL', 'S3', 'GCS');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('COMPETITIVE', 'PREMIER', 'WINGMAN', 'CASUAL', 'DEATHMATCH', 'CUSTOM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DemoStatus" AS ENUM ('PENDING', 'UPLOADING', 'PARSING', 'PARSED', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('PISTOL', 'ECO', 'FORCE_BUY', 'FULL_BUY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "GrenadeType" AS ENUM ('SMOKE', 'FLASHBANG', 'HEGRENADE', 'MOLOTOV', 'INCENDIARY', 'DECOY');

-- CreateEnum
CREATE TYPE "AnalysisType" AS ENUM ('BASIC', 'ADVANCED', 'HEATMAPS', 'ECONOMY', 'UTILITY', 'OPENINGS', 'CLUTCHES', 'TRADES', 'POSITIONING', 'COACHING');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "steamId" TEXT,
    "faceitId" TEXT,
    "eseaId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "planExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'PLAYER',
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "faceitId" TEXT,
    "faceitElo" INTEGER,
    "faceitLevel" INTEGER,
    "eseaId" TEXT,
    "eseaRws" DOUBLE PRECISION,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "totalKills" INTEGER NOT NULL DEFAULT 0,
    "totalDeaths" INTEGER NOT NULL DEFAULT 0,
    "totalAssists" INTEGER NOT NULL DEFAULT 0,
    "totalDamage" INTEGER NOT NULL DEFAULT 0,
    "totalHsKills" INTEGER NOT NULL DEFAULT 0,
    "totalMvps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demo" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "storageType" "StorageType" NOT NULL DEFAULT 'LOCAL',
    "mapName" TEXT NOT NULL,
    "gameMode" "GameMode" NOT NULL DEFAULT 'COMPETITIVE',
    "matchId" TEXT,
    "serverName" TEXT,
    "tickRate" INTEGER NOT NULL DEFAULT 64,
    "totalTicks" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "playedAt" TIMESTAMP(3),
    "team1Name" TEXT NOT NULL DEFAULT 'Team 1',
    "team2Name" TEXT NOT NULL DEFAULT 'Team 2',
    "team1Score" INTEGER NOT NULL DEFAULT 0,
    "team2Score" INTEGER NOT NULL DEFAULT 0,
    "status" "DemoStatus" NOT NULL DEFAULT 'PENDING',
    "parsedAt" TIMESTAMP(3),
    "parseError" TEXT,
    "parsedDataPath" TEXT,
    "uploadedById" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "startTick" INTEGER NOT NULL,
    "freezeEndTick" INTEGER,
    "endTick" INTEGER NOT NULL,
    "winnerTeam" INTEGER NOT NULL,
    "winReason" TEXT NOT NULL,
    "winReasonCode" INTEGER NOT NULL,
    "ctScore" INTEGER NOT NULL,
    "tScore" INTEGER NOT NULL,
    "ctEquipValue" INTEGER NOT NULL DEFAULT 0,
    "tEquipValue" INTEGER NOT NULL DEFAULT 0,
    "ctMoneySpent" INTEGER NOT NULL DEFAULT 0,
    "tMoneySpent" INTEGER NOT NULL DEFAULT 0,
    "roundType" "RoundType" NOT NULL DEFAULT 'UNKNOWN',
    "bombPlanted" BOOLEAN NOT NULL DEFAULT false,
    "bombPlantTick" INTEGER,
    "bombSite" TEXT,
    "bombDefused" BOOLEAN NOT NULL DEFAULT false,
    "bombExploded" BOOLEAN NOT NULL DEFAULT false,
    "mvpSteamId" TEXT,
    "mvpReason" INTEGER,
    "demoId" TEXT NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayerStats" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "teamNum" INTEGER NOT NULL,
    "teamName" TEXT,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "headshotKills" INTEGER NOT NULL DEFAULT 0,
    "damage" INTEGER NOT NULL DEFAULT 0,
    "kd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hsp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "totalCashSpent" INTEGER NOT NULL DEFAULT 0,
    "avgEquipValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mvps" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "firstKills" INTEGER NOT NULL DEFAULT 0,
    "firstDeaths" INTEGER NOT NULL DEFAULT 0,
    "clutchesWon" INTEGER NOT NULL DEFAULT 0,
    "clutchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "enemiesFlashed" INTEGER NOT NULL DEFAULT 0,
    "flashAssists" INTEGER NOT NULL DEFAULT 0,
    "utilityDamage" INTEGER NOT NULL DEFAULT 0,
    "demoId" TEXT NOT NULL,
    "playerId" TEXT,

    CONSTRAINT "MatchPlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundPlayerStats" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "teamNum" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "damage" INTEGER NOT NULL DEFAULT 0,
    "equipValue" INTEGER NOT NULL DEFAULT 0,
    "moneySpent" INTEGER NOT NULL DEFAULT 0,
    "startBalance" INTEGER NOT NULL DEFAULT 0,
    "survived" BOOLEAN NOT NULL DEFAULT false,
    "firstKill" BOOLEAN NOT NULL DEFAULT false,
    "firstDeath" BOOLEAN NOT NULL DEFAULT false,
    "clutchVs" INTEGER,
    "clutchWon" BOOLEAN,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT,

    CONSTRAINT "RoundPlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kill" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "attackerSteamId" TEXT,
    "attackerName" TEXT,
    "attackerTeam" INTEGER,
    "attackerX" DOUBLE PRECISION,
    "attackerY" DOUBLE PRECISION,
    "attackerZ" DOUBLE PRECISION,
    "victimSteamId" TEXT NOT NULL,
    "victimName" TEXT NOT NULL,
    "victimTeam" INTEGER NOT NULL,
    "victimX" DOUBLE PRECISION NOT NULL,
    "victimY" DOUBLE PRECISION NOT NULL,
    "victimZ" DOUBLE PRECISION NOT NULL,
    "assisterSteamId" TEXT,
    "assisterName" TEXT,
    "weapon" TEXT NOT NULL,
    "headshot" BOOLEAN NOT NULL DEFAULT false,
    "penetrated" INTEGER NOT NULL DEFAULT 0,
    "noscope" BOOLEAN NOT NULL DEFAULT false,
    "thrusmoke" BOOLEAN NOT NULL DEFAULT false,
    "attackerblind" BOOLEAN NOT NULL DEFAULT false,
    "assistedflash" BOOLEAN NOT NULL DEFAULT false,
    "distance" DOUBLE PRECISION,
    "isSuicide" BOOLEAN NOT NULL DEFAULT false,
    "isTeamkill" BOOLEAN NOT NULL DEFAULT false,
    "isFirstKill" BOOLEAN NOT NULL DEFAULT false,
    "isTradeKill" BOOLEAN NOT NULL DEFAULT false,
    "tradedWithin" INTEGER,
    "demoId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "attackerId" TEXT,
    "victimId" TEXT,
    "assisterId" TEXT,

    CONSTRAINT "Kill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grenade" (
    "id" TEXT NOT NULL,
    "type" "GrenadeType" NOT NULL,
    "tick" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,
    "throwerSteamId" TEXT NOT NULL,
    "throwerName" TEXT NOT NULL,
    "throwerTeam" INTEGER NOT NULL,
    "enemiesBlinded" INTEGER NOT NULL DEFAULT 0,
    "teammatesBlinded" INTEGER NOT NULL DEFAULT 0,
    "totalBlindDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "damageDealt" INTEGER NOT NULL DEFAULT 0,
    "enemiesDamaged" INTEGER NOT NULL DEFAULT 0,
    "demoId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,

    CONSTRAINT "Grenade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "roundNumber" INTEGER,
    "data" JSONB NOT NULL,
    "demoId" TEXT NOT NULL,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "steamId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isAllChat" BOOLEAN NOT NULL DEFAULT true,
    "demoId" TEXT NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "type" "AnalysisType" NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "results" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "demoId" TEXT NOT NULL,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamProfile" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "personaName" TEXT NOT NULL,
    "profileUrl" TEXT,
    "avatar" TEXT,
    "avatarMedium" TEXT,
    "avatarFull" TEXT,
    "totalPlaytime" INTEGER,
    "recentPlaytime" INTEGER,
    "lastFetched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceitProfile" (
    "id" TEXT NOT NULL,
    "faceitId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT,
    "country" TEXT,
    "skillLevel" INTEGER,
    "elo" INTEGER,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "avgKd" DOUBLE PRECISION,
    "avgHsPercent" DOUBLE PRECISION,
    "lastFetched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceitProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EseaProfile" (
    "id" TEXT NOT NULL,
    "eseaId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "rws" DOUBLE PRECISION,
    "adr" DOUBLE PRECISION,
    "lastFetched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EseaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "User_faceitId_key" ON "User"("faceitId");

-- CreateIndex
CREATE UNIQUE INDEX "User_eseaId_key" ON "User"("eseaId");

-- CreateIndex
CREATE INDEX "User_steamId_idx" ON "User"("steamId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_steamId_key" ON "Player"("steamId");

-- CreateIndex
CREATE INDEX "Player_steamId_idx" ON "Player"("steamId");

-- CreateIndex
CREATE INDEX "Player_faceitId_idx" ON "Player"("faceitId");

-- CreateIndex
CREATE UNIQUE INDEX "Demo_fileHash_key" ON "Demo"("fileHash");

-- CreateIndex
CREATE INDEX "Demo_fileHash_idx" ON "Demo"("fileHash");

-- CreateIndex
CREATE INDEX "Demo_mapName_idx" ON "Demo"("mapName");

-- CreateIndex
CREATE INDEX "Demo_status_idx" ON "Demo"("status");

-- CreateIndex
CREATE INDEX "Demo_playedAt_idx" ON "Demo"("playedAt");

-- CreateIndex
CREATE INDEX "Round_demoId_idx" ON "Round"("demoId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_demoId_roundNumber_key" ON "Round"("demoId", "roundNumber");

-- CreateIndex
CREATE INDEX "MatchPlayerStats_demoId_idx" ON "MatchPlayerStats"("demoId");

-- CreateIndex
CREATE INDEX "MatchPlayerStats_playerId_idx" ON "MatchPlayerStats"("playerId");

-- CreateIndex
CREATE INDEX "MatchPlayerStats_steamId_idx" ON "MatchPlayerStats"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayerStats_demoId_steamId_key" ON "MatchPlayerStats"("demoId", "steamId");

-- CreateIndex
CREATE INDEX "RoundPlayerStats_roundId_idx" ON "RoundPlayerStats"("roundId");

-- CreateIndex
CREATE INDEX "RoundPlayerStats_playerId_idx" ON "RoundPlayerStats"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundPlayerStats_roundId_steamId_key" ON "RoundPlayerStats"("roundId", "steamId");

-- CreateIndex
CREATE INDEX "Kill_demoId_idx" ON "Kill"("demoId");

-- CreateIndex
CREATE INDEX "Kill_roundId_idx" ON "Kill"("roundId");

-- CreateIndex
CREATE INDEX "Kill_attackerSteamId_idx" ON "Kill"("attackerSteamId");

-- CreateIndex
CREATE INDEX "Kill_victimSteamId_idx" ON "Kill"("victimSteamId");

-- CreateIndex
CREATE INDEX "Grenade_demoId_idx" ON "Grenade"("demoId");

-- CreateIndex
CREATE INDEX "Grenade_roundId_idx" ON "Grenade"("roundId");

-- CreateIndex
CREATE INDEX "Grenade_type_idx" ON "Grenade"("type");

-- CreateIndex
CREATE INDEX "Grenade_throwerSteamId_idx" ON "Grenade"("throwerSteamId");

-- CreateIndex
CREATE INDEX "GameEvent_demoId_idx" ON "GameEvent"("demoId");

-- CreateIndex
CREATE INDEX "GameEvent_eventName_idx" ON "GameEvent"("eventName");

-- CreateIndex
CREATE INDEX "GameEvent_tick_idx" ON "GameEvent"("tick");

-- CreateIndex
CREATE INDEX "GameEvent_roundNumber_idx" ON "GameEvent"("roundNumber");

-- CreateIndex
CREATE INDEX "ChatMessage_demoId_idx" ON "ChatMessage"("demoId");

-- CreateIndex
CREATE INDEX "ChatMessage_steamId_idx" ON "ChatMessage"("steamId");

-- CreateIndex
CREATE INDEX "Analysis_demoId_idx" ON "Analysis"("demoId");

-- CreateIndex
CREATE INDEX "Analysis_type_idx" ON "Analysis"("type");

-- CreateIndex
CREATE INDEX "Analysis_status_idx" ON "Analysis"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SteamProfile_steamId_key" ON "SteamProfile"("steamId");

-- CreateIndex
CREATE INDEX "SteamProfile_steamId_idx" ON "SteamProfile"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "FaceitProfile_faceitId_key" ON "FaceitProfile"("faceitId");

-- CreateIndex
CREATE INDEX "FaceitProfile_faceitId_idx" ON "FaceitProfile"("faceitId");

-- CreateIndex
CREATE INDEX "FaceitProfile_nickname_idx" ON "FaceitProfile"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "EseaProfile_eseaId_key" ON "EseaProfile"("eseaId");

-- CreateIndex
CREATE INDEX "EseaProfile_eseaId_idx" ON "EseaProfile"("eseaId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demo" ADD CONSTRAINT "Demo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demo" ADD CONSTRAINT "Demo_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStats" ADD CONSTRAINT "MatchPlayerStats_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStats" ADD CONSTRAINT "MatchPlayerStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundPlayerStats" ADD CONSTRAINT "RoundPlayerStats_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundPlayerStats" ADD CONSTRAINT "RoundPlayerStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kill" ADD CONSTRAINT "Kill_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kill" ADD CONSTRAINT "Kill_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kill" ADD CONSTRAINT "Kill_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kill" ADD CONSTRAINT "Kill_victimId_fkey" FOREIGN KEY ("victimId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kill" ADD CONSTRAINT "Kill_assisterId_fkey" FOREIGN KEY ("assisterId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grenade" ADD CONSTRAINT "Grenade_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grenade" ADD CONSTRAINT "Grenade_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
