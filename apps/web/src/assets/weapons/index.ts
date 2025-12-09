/**
 * Weapon SVG Components - Barrel File
 *
 * Pattern from Lexogrine cs2-react-hud
 * https://github.com/lexogrine/cs2-react-hud/blob/main/src/assets/Weapons.tsx
 *
 * Each SVG is imported as a React component via @svgr/webpack.
 * Usage: import * as Weapons from "@/assets/weapons"
 *        const Icon = Weapons["ak47"]
 */

// === RIFLES ===
import ak47 from "./ak47.svg";
import aug from "./aug.svg";
import awp from "./awp.svg";
import famas from "./famas.svg";
import g3sg1 from "./g3sg1.svg";
import galilar from "./galilar.svg";
import m4a1 from "./m4a1.svg";
import m4a1_silencer from "./m4a1_silencer.svg";
import m4a1_silencer_off from "./m4a1_silencer_off.svg";
import scar20 from "./scar20.svg";
import sg556 from "./sg556.svg";
import ssg08 from "./ssg08.svg";

// === SMGs ===
import bizon from "./bizon.svg";
import mac10 from "./mac10.svg";
import mp5sd from "./mp5sd.svg";
import mp7 from "./mp7.svg";
import mp9 from "./mp9.svg";
import p90 from "./p90.svg";
import ump45 from "./ump45.svg";

// === PISTOLS ===
import cz75a from "./cz75a.svg";
import deagle from "./deagle.svg";
import elite from "./elite.svg";
import fiveseven from "./fiveseven.svg";
import glock from "./glock.svg";
import hkp2000 from "./hkp2000.svg";
import p250 from "./p250.svg";
import revolver from "./revolver.svg";
import tec9 from "./tec9.svg";
import usp_silencer from "./usp_silencer.svg";
import usp_silencer_off from "./usp_silencer_off.svg";

// === SHOTGUNS ===
import mag7 from "./mag7.svg";
import nova from "./nova.svg";
import sawedoff from "./sawedoff.svg";
import xm1014 from "./xm1014.svg";

// === MACHINE GUNS ===
import m249 from "./m249.svg";
import negev from "./negev.svg";

// === GRENADES ===
import decoy from "./decoy.svg";
import flashbang from "./flashbang.svg";
import hegrenade from "./hegrenade.svg";
import incgrenade from "./incgrenade.svg";
import molotov from "./molotov.svg";
import smokegrenade from "./smokegrenade.svg";
import inferno from "./inferno.svg";

// === EQUIPMENT ===
import c4 from "./c4.svg";
import taser from "./taser.svg";

// === KNIVES ===
import knife from "./knife.svg";
import knife_t from "./knife_t.svg";
import bayonet from "./bayonet.svg";
import knife_bayonet from "./knife_bayonet.svg";
import knife_butterfly from "./knife_butterfly.svg";
import knife_canis from "./knife_canis.svg";
import knife_cord from "./knife_cord.svg";
import knife_css from "./knife_css.svg";
import knife_falchion from "./knife_falchion.svg";
import knife_flip from "./knife_flip.svg";
import knife_gut from "./knife_gut.svg";
import knife_gypsy_jackknife from "./knife_gypsy_jackknife.svg";
import knife_karambit from "./knife_karambit.svg";
import knife_m9_bayonet from "./knife_m9_bayonet.svg";
import knife_outdoor from "./knife_outdoor.svg";
import knife_push from "./knife_push.svg";
import knife_skeleton from "./knife_skeleton.svg";
import knife_stiletto from "./knife_stiletto.svg";
import knife_survival_bowie from "./knife_survival_bowie.svg";
import knife_tactical from "./knife_tactical.svg";
import knife_ursus from "./knife_ursus.svg";
import knife_widowmaker from "./knife_widowmaker.svg";

// === MISC ===
import out from "./out.svg";
import trigger_hurt from "./trigger_hurt.svg";
import world from "./world.svg";

// Re-export all weapons
export {
  // Rifles
  ak47,
  aug,
  awp,
  famas,
  g3sg1,
  galilar,
  m4a1,
  m4a1_silencer,
  m4a1_silencer_off,
  scar20,
  sg556,
  ssg08,
  // SMGs
  bizon,
  mac10,
  mp5sd,
  mp7,
  mp9,
  p90,
  ump45,
  // Pistols
  cz75a,
  deagle,
  elite,
  fiveseven,
  glock,
  hkp2000,
  p250,
  revolver,
  tec9,
  usp_silencer,
  usp_silencer_off,
  // Shotguns
  mag7,
  nova,
  sawedoff,
  xm1014,
  // Machine guns
  m249,
  negev,
  // Grenades
  decoy,
  flashbang,
  hegrenade,
  incgrenade,
  molotov,
  smokegrenade,
  inferno,
  // Equipment
  c4,
  taser,
  // Knives
  knife,
  knife_t,
  bayonet,
  knife_bayonet,
  knife_butterfly,
  knife_canis,
  knife_cord,
  knife_css,
  knife_falchion,
  knife_flip,
  knife_gut,
  knife_gypsy_jackknife,
  knife_karambit,
  knife_m9_bayonet,
  knife_outdoor,
  knife_push,
  knife_skeleton,
  knife_stiletto,
  knife_survival_bowie,
  knife_tactical,
  knife_ursus,
  knife_widowmaker,
  // Misc
  out,
  trigger_hurt,
  world,
};
