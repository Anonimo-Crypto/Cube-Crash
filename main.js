let gameSpeed = 100;

// Colors
const BLUE =   { r: 0x67, g: 0xd7, b: 0xf0 };
const GREEN =  { r: 0x00, g: 0xff, b: 0x24 };
const PINK =   { r: 0xfa, g: 0x24, b: 0x73 };
const ORANGE = { r: 0xfe, g: 0x95, b: 0x22 };
const BLACK =  { r: 0x00, g: 0x00, b: 0x00 };
const WHITE =  { r: 0xFF, g: 0xFF, b: 0xFF };
const RED =    { r: 0xff, g: 0x00, b: 0x00 };
const PURPLE = { r: 0xb9, g: 0x00, b: 0xf7 };
const GRAY =   { r: 0x66, g: 0x66, b: 0x66 };
const YELLOW = { r: 0xFF, g: 0xF9, b: 0x00 };
const allColors = [BLUE, GREEN, PINK, ORANGE, BLACK, WHITE, RED, PURPLE, GRAY, YELLOW];

// Gameplay
const getSpawnDelay = () => {
	if (isDesafianteGame()) {
		// Much faster spawning
		const max = 700;
		const min = 280;
		const delay = max - state.game.cubeCount * 2.2;
		return Math.max(delay, min);
	}
	const spawnDelayMax = 1400;
	const spawnDelayMin = 550;
	const spawnDelay = spawnDelayMax - state.game.cubeCount * 3.1;
	return Math.max(spawnDelay, spawnDelayMin);
}
const doubleStrongEnableScore = 2000;
// Number of cubes that must be smashed before activating a feature.
const slowmoThreshold = 10;
const strongThreshold = 25;
const spinnerThreshold = 25;

// Interaction state
let pointerIsDown = false;
// The last known position of the primary pointer in screen coordinates.`
let pointerScreen = { x: 0, y: 0 };
// Same as `pointerScreen`, but converted to scene coordinates in rAF.
let pointerScene = { x: 0, y: 0 };
// Minimum speed of pointer before "hits" are counted.
const minPointerSpeed = 60;
// The hit speed affects the direction the target post-hit. This number dampens that force.
const hitDampening = 0.1;
// Backboard receives shadows and is the farthest negative Z position of entities.
const backboardZ = -400;
const shadowColor = '#262e36';
// How much air drag is applied to standard objects
const airDrag = 0.022;
const gravity = 0.3;
// Spark config
const sparkColor = 'rgba(170,221,255,.9)';
const sparkThickness = 2.2;
const airDragSpark = 0.1;
// Track pointer positions to show trail
const touchTrailColor = 'rgba(170,221,255,.62)';     
const touchTrailThickness = 7;
const touchPointLife = 120;
const touchPoints = [];
// Size of in-game targets. This affects rendered size and hit area.
const targetRadius = 40;
const targetHitRadius = 50;
const makeTargetGlueColor = target => {
	// const alpha = (target.health - 1) / (target.maxHealth - 1);
	// return `rgba(170,221,255,${alpha.toFixed(3)})`;
	return 'rgb(170,221,255)';
};
// Size of target fragments
const fragRadius = targetRadius / 3;



// Game canvas element needed in setup.js and interaction.js
const canvas = document.querySelector('#c');

// 3D camera config
// Affects perspective
const cameraDistance = 900;
// Does not affect perspective
const sceneScale = 1;
// Objects that get too close to the camera will be faded out to transparent over this range.
// const cameraFadeStartZ = 0.8*cameraDistance - 6*targetRadius;
const cameraFadeStartZ = 0.45*cameraDistance;
const cameraFadeEndZ = 0.65*cameraDistance;
const cameraFadeRange = cameraFadeEndZ - cameraFadeStartZ;

// Globals used to accumlate all vertices/polygons in each frame
const allVertices = [];
const allPolys = [];
const allShadowVertices = [];
const allShadowPolys = [];




// state.js
// ============================================================================
// ============================================================================

///////////
// Enums //
///////////

// Game Modes
const GAME_MODE_RANKED = Symbol('GAME_MODE_RANKED');
const GAME_MODE_CASUAL = Symbol('GAME_MODE_CASUAL');
const GAME_MODE_HEARTS = Symbol('GAME_MODE_HEARTS');
const GAME_MODE_DESAFIANTE = Symbol('GAME_MODE_DESAFIANTE');
const GAME_MODE_LEGEND = Symbol('GAME_MODE_LEGEND');

// Available Menus
const MENU_MAIN = Symbol('MENU_MAIN');
const MENU_MODES = Symbol('MENU_MODES');
const MENU_PAUSE = Symbol('MENU_PAUSE');
const MENU_SCORE = Symbol('MENU_SCORE');
const MENU_SHOP = Symbol('MENU_SHOP');
const MENU_ACHIEVEMENTS = Symbol('MENU_ACHIEVEMENTS');



//////////////////
// Global State //
//////////////////

const state = {
	game: {
		mode: GAME_MODE_RANKED,
		time: 0,
		score: 0,
		cubeCount: 0,
		level: 1,
		scoreAtLevelStart: 0,
		coins: 0,
		lives: 3,
		totalCubesEver: 0 // lifetime for achievements
	},
	menus: {
		active: null // set to MENU_MAIN after splash
	},
	upgrades: {
		slowmoDuration: 1500,
		slowmoPrice: 10,
		touchPower: 1.0,
		touchPowerPrice: 100,
		mining: 1.0,
		miningPrice: 50
	},
	achievements: {} // will be filled from ACHIEVEMENT_DEFS
};


////////////////////////////
// Global State Selectors //
////////////////////////////

let appReady = false; // false until splash finishes
const isInGame = () => appReady && !state.menus.active;
const isMenuVisible = () => !!state.menus.active;
const isCasualGame = () => state.game.mode === GAME_MODE_CASUAL;
const isHeartsGame = () => state.game.mode === GAME_MODE_HEARTS;
const isDesafianteGame = () => state.game.mode === GAME_MODE_DESAFIANTE;
// gamePaused stays true while browsing shop/achievements opened from pause
let gamePaused = false;
const isPaused = () => gamePaused;
const canEarnCoinsAndAchievements = () => 
	state.game.mode === GAME_MODE_RANKED || 
	state.game.mode === GAME_MODE_HEARTS || 
	state.game.mode === GAME_MODE_DESAFIANTE;
const hasLevelBar = () => 
	state.game.mode === GAME_MODE_RANKED || 
	state.game.mode === GAME_MODE_HEARTS || 
	state.game.mode === GAME_MODE_DESAFIANTE;


///////////////////
// Local Storage //
///////////////////

const highScoreKey = 'Record:';
const getHighScore = () => {
	const raw = localStorage.getItem(highScoreKey);
	return raw ? parseInt(raw, 10) : 0;
};

let _lastHighscore = getHighScore();
const setHighScore = score => {
	_lastHighscore = getHighScore();
	localStorage.setItem(highScoreKey, String(score));
};

const isNewHighScore = () => state.game.score > _lastHighscore;


// Coins & Upgrades persistence
const coinsKey = 'CubeCrash_Coins';
const upgradesKey = 'CubeCrash_Upgrades';

const loadCoins = () => {
	const raw = localStorage.getItem(coinsKey);
	return raw ? parseInt(raw, 10) : 0;
};

const saveCoins = () => {
	localStorage.setItem(coinsKey, String(state.game.coins));
};

const loadUpgrades = () => {
	try {
		const raw = localStorage.getItem(upgradesKey);
		if (raw) {
			const data = JSON.parse(raw);
			if (data.slowmoDuration) state.upgrades.slowmoDuration = data.slowmoDuration;
			if (data.slowmoPrice) state.upgrades.slowmoPrice = data.slowmoPrice;
			if (data.touchPower) state.upgrades.touchPower = data.touchPower;
			if (data.touchPowerPrice) state.upgrades.touchPowerPrice = data.touchPowerPrice;
			if (data.mining) state.upgrades.mining = data.mining;
			if (data.miningPrice) state.upgrades.miningPrice = data.miningPrice;
		}
	} catch(e) {}
};

const saveUpgrades = () => {
	localStorage.setItem(upgradesKey, JSON.stringify(state.upgrades));
};

// Level helpers
const getLevelRequirement = (level) => {
	// Points needed to complete this level and go to level+1
	let req = 100;
	for (let i = 1; i < level; i++) {
		req *= 1.2;
	}
	return Math.round(req);
};

const getLevelProgress = () => {
	const req = getLevelRequirement(state.game.level);
	const gained = state.game.score - state.game.scoreAtLevelStart;
	return clamp(gained / req, 0, 1);
};

const checkLevelUp = () => {
	const req = getLevelRequirement(state.game.level);
	const gained = state.game.score - state.game.scoreAtLevelStart;
	if (gained >= req) {
		state.game.level++;
		state.game.scoreAtLevelStart = state.game.score;
		saveModeProgress();
		checkLevelAchievements();
		playSfx('levelup', 0.75);
		return true;
	}
	return false;
};

// Per-mode level + bar progress persistence (all modes except Casual)
const modeProgressKey = (mode) => {
	if (mode === GAME_MODE_RANKED) return 'CubeCrash_Progress_Ranked';
	if (mode === GAME_MODE_HEARTS) return 'CubeCrash_Progress_Hearts';
	if (mode === GAME_MODE_DESAFIANTE) return 'CubeCrash_Progress_Desafiante';
	return null;
};

const saveModeProgress = () => {
	const key = modeProgressKey(state.game.mode);
	if (!key) return;
	const data = {
		level: state.game.level,
		progress: getLevelProgress()
	};
	localStorage.setItem(key, JSON.stringify(data));
};

const loadModeProgress = (mode) => {
	const key = modeProgressKey(mode);
	if (!key) return { level: 1, progress: 0 };
	try {
		const raw = localStorage.getItem(key);
		if (raw) {
			const data = JSON.parse(raw);
			return {
				level: Math.max(1, parseInt(data.level, 10) || 1),
				progress: clamp(Number(data.progress) || 0, 0, 0.999)
			};
		}
	} catch (e) {}
	return { level: 1, progress: 0 };
};

// ========================
// ACHIEVEMENTS
// ========================
const ACHIEVEMENT_DEFS = [
	{ id: 'first_cube',    name: '¡Cube Crash!',          desc: 'Rompe tu primer cubo.',              reward: 10,  icon: '💥' },
	{ id: 'cubes_10',      name: 'Demoledor',             desc: 'Rompe 10 cubos.',                    reward: 20,  icon: '🔨' },
	{ id: 'cubes_50',      name: 'Destructor',            desc: 'Rompe 50 cubos.',                    reward: 50,  icon: '💣' },
	{ id: 'cubes_100',     name: 'Aniquilador',           desc: 'Rompe 100 cubos.',                   reward: 100, icon: '🔥' },
	{ id: 'cubes_500',     name: 'Grúa de Demolición',    desc: 'Rompe 500 cubos.',                   reward: 200, icon: '🏗️' },
	{ id: 'cubes_1000',    name: '¡I am Crash!',          desc: 'Rompe 1000 cubos.',                  reward: 500, icon: '👑' },
	{ id: 'first_slowmo',  name: 'Slow Crash',            desc: 'Rompiste un cubo slow-mo.',          reward: 10,  icon: '❄️' },
	{ id: 'first_resist',  name: '¡Que fuerte!',          desc: 'Rompe tu primer cubo resistente.',   reward: 20,  icon: '💪' },
	{ id: 'play_casual',   name: 'Practicando',           desc: 'Juega por primera vez en Casual.',   reward: 0,   icon: '🎯', noReward: true },
	{ id: 'play_ranked',   name: 'Endless Game',          desc: 'Juega por primera vez en Clásico.',  reward: 0,   icon: '♾️', noReward: true },
	{ id: 'play_hearts',   name: 'Un clásico!',           desc: 'Juega por primera vez en Hearts.',   reward: 0,   icon: '❤️', noReward: true },
	{ id: 'play_desafiante', name: 'Cosa Seria',           desc: 'Juega por primera vez en Desafiante.', reward: 0, icon: '⚡', noReward: true },
	{ id: 'level_1',       name: 'Iniciando',             desc: 'Supera el nivel 1.',                 reward: 5,   icon: '🌱' },
	{ id: 'level_5',       name: 'Aprendíz',              desc: 'Supera el nivel 5.',                 reward: 10,  icon: '📘' },
	{ id: 'level_10',      name: 'Aficionado',            desc: 'Supera el nivel 10.',                reward: 15,  icon: '🎮' },
	{ id: 'level_20',      name: 'Frecuente',             desc: 'Supera el nivel 20.',                reward: 20,  icon: '⭐' },
	{ id: 'level_30',      name: 'Jugador',               desc: 'Supera el nivel 30.',                reward: 40,  icon: '🏅' },
	{ id: 'level_50',      name: 'Pro',                   desc: 'Supera el nivel 50.',                reward: 80,  icon: '💎' },
	{ id: 'level_70',      name: 'Maestro',               desc: 'Supera el nivel 70.',                reward: 100, icon: '🏆' },
	{ id: 'level_100',     name: 'Legend',                desc: 'Supera el nivel 100.',               reward: 0,   icon: '🌟', special: true },
];

const achievementsKey = 'CubeCrash_Achievements';
const totalCubesKey = 'CubeCrash_TotalCubes';

const loadAchievements = () => {
	try {
		const raw = localStorage.getItem(achievementsKey);
		if (raw) state.achievements = JSON.parse(raw);
	} catch(e) {}
	// Ensure all defs exist
	ACHIEVEMENT_DEFS.forEach(def => {
		if (!state.achievements[def.id]) {
			state.achievements[def.id] = { unlocked: false, claimed: false };
		}
	});
};

const saveAchievements = () => {
	localStorage.setItem(achievementsKey, JSON.stringify(state.achievements));
};

const loadTotalCubes = () => {
	const raw = localStorage.getItem(totalCubesKey);
	state.game.totalCubesEver = raw ? parseInt(raw, 10) : 0;
};

const saveTotalCubes = () => {
	localStorage.setItem(totalCubesKey, String(state.game.totalCubesEver));
};

const achToastQueue = [];
let achToastShowing = false;
let achToastTimer = null;

function showAchievementToast(def) {
	achToastQueue.push(def);
	processAchToastQueue();
}

function processAchToastQueue() {
	if (achToastShowing || achToastQueue.length === 0) return;
	const toast = document.getElementById('achToast');
	if (!toast) {
		// DOM not ready — retry shortly without losing queue
		setTimeout(processAchToastQueue, 200);
		return;
	}
	const def = achToastQueue.shift();
	achToastShowing = true;
	const iconEl = toast.querySelector('.ach-toast__icon');
	const nameEl = toast.querySelector('.ach-toast__name');
	const descEl = toast.querySelector('.ach-toast__desc');
	if (iconEl) iconEl.textContent = def.icon || '🏆';
	if (nameEl) nameEl.textContent = def.name || '';
	if (descEl) descEl.textContent = def.desc || '';
	toast.classList.remove('show');
	// force reflow so CSS transition retriggers
	void toast.offsetWidth;
	requestAnimationFrame(() => {
		toast.classList.add('show');
	});
	try { playSfx('achievement', 0.75); } catch (e) {}
	clearTimeout(achToastTimer);
	achToastTimer = setTimeout(() => {
		toast.classList.remove('show');
		setTimeout(() => {
			achToastShowing = false;
			processAchToastQueue();
		}, 450);
	}, 3400);
}

function unlockAchievement(id, silent = false) {
	// Most achievements blocked in Casual; mode-intro ones are allowed
	const casualAllowed = ['play_casual'];
	if (state.game.mode === GAME_MODE_CASUAL && !casualAllowed.includes(id)) return;
	const data = state.achievements[id];
	if (!data || data.unlocked) return;
	data.unlocked = true;
	saveAchievements();
	if (!silent) {
		const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
		if (def) showAchievementToast(def);
	}
}

function unlockModePlayAchievement(mode) {
	if (mode === GAME_MODE_CASUAL) unlockAchievement('play_casual');
	else if (mode === GAME_MODE_RANKED) unlockAchievement('play_ranked');
	else if (mode === GAME_MODE_HEARTS) unlockAchievement('play_hearts');
	else if (mode === GAME_MODE_DESAFIANTE) unlockAchievement('play_desafiante');
}

function claimAchievement(id) {
	const data = state.achievements[id];
	const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
	if (!data || !data.unlocked || data.claimed || !def || def.special || def.noReward || !def.reward) return;
	data.claimed = true;
	state.game.coins += def.reward;
	saveAchievements();
	saveCoins();
	renderCoins();
	renderMainCoins();
	renderAchievementsList();
	playSfx('reward', 0.8);
}

function checkCubeAchievements() {
	const total = state.game.totalCubesEver;
	if (total >= 1)    unlockAchievement('first_cube');
	if (total >= 10)   unlockAchievement('cubes_10');
	if (total >= 50)   unlockAchievement('cubes_50');
	if (total >= 100)  unlockAchievement('cubes_100');
	if (total >= 500)  unlockAchievement('cubes_500');
	if (total >= 1000) unlockAchievement('cubes_1000');
}

function checkLevelAchievements(silent = false) {
	const lvl = state.game.level;
	// "Supera el nivel X" = current level is greater than X
	if (lvl > 1)   unlockAchievement('level_1', silent);
	if (lvl > 5)   unlockAchievement('level_5', silent);
	if (lvl > 10)  unlockAchievement('level_10', silent);
	if (lvl > 20)  unlockAchievement('level_20', silent);
	if (lvl > 30)  unlockAchievement('level_30', silent);
	if (lvl > 50)  unlockAchievement('level_50', silent);
	if (lvl > 70)  unlockAchievement('level_70', silent);
	if (lvl > 100) unlockAchievement('level_100', silent);
}





// utils.js
// ============================================================================
// ============================================================================


const invariant = (condition, message) => {
	if (!condition) throw new Error(message);
};


/////////
// DOM //
/////////

const $ = selector => document.querySelector(selector);
const handleClick = (element, handler) => element.addEventListener('click', handler);
const handlePointerDown = (element, handler) => {
	element.addEventListener('touchstart', handler);
	element.addEventListener('mousedown', handler);
};



////////////////////////
// Formatting Helpers //
////////////////////////

// Converts a number into a formatted string with thousand separators.

////////////////////
// AUDIO SYSTEM  //
////////////////////
const AUDIO_BASE = 'data/sounds/';
const SFX = {
	achievement: AUDIO_BASE + 'achievement.mp3',
	click: AUDIO_BASE + 'click.mp3',
	cash: AUDIO_BASE + 'cash.mp3',
	levelup: AUDIO_BASE + 'levelup.mp3',
	reward: AUDIO_BASE + 'reward.mp3',
	break: AUDIO_BASE + 'break.mp3',
	music: AUDIO_BASE + 'music.mp3'
};

const audioUnlocked = { value: false };
const sfxCache = {};
let musicAudio = null;
let musicShouldPlay = false;

function getSfx(key) {
	if (!sfxCache[key]) {
		const a = new Audio(SFX[key]);
		a.preload = 'auto';
		sfxCache[key] = a;
	}
	return sfxCache[key];
}

function playSfx(key, volume = 0.7) {
	if (!audioUnlocked.value) return;
	try {
		const base = getSfx(key);
		const a = base.cloneNode();
		a.volume = volume;
		a.play().catch(() => {});
	} catch (e) {}
}

function ensureMusic() {
	if (!musicAudio) {
		musicAudio = new Audio(SFX.music);
		musicAudio.loop = true;
		musicAudio.volume = 0;
		musicAudio.preload = 'auto';
	}
	return musicAudio;
}

let musicFadeTimer = null;
const MUSIC_TARGET_VOL = 0.35;

function startMusic() {
	musicShouldPlay = true;
	if (!audioUnlocked.value) return;
	try {
		const m = ensureMusic();
		if (m.paused) {
			m.volume = 0;
			m.play().catch(() => {});
		}
		fadeMusicTo(MUSIC_TARGET_VOL, 2200);
	} catch (e) {}
}

function pauseMusic() {
	musicShouldPlay = false;
	fadeMusicTo(0, 500, () => {
		if (musicAudio && !musicShouldPlay) musicAudio.pause();
	});
}

function fadeMusicTo(target, durationMs, onDone) {
	if (!musicAudio) return;
	clearInterval(musicFadeTimer);
	const start = musicAudio.volume;
	const diff = target - start;
	if (Math.abs(diff) < 0.01) {
		musicAudio.volume = target;
		if (onDone) onDone();
		return;
	}
	const steps = Math.max(1, Math.floor(durationMs / 40));
	let i = 0;
	musicFadeTimer = setInterval(() => {
		i++;
		const t = i / steps;
		musicAudio.volume = Math.max(0, Math.min(1, start + diff * t));
		if (i >= steps) {
			clearInterval(musicFadeTimer);
			musicAudio.volume = target;
			if (onDone) onDone();
		}
	}, 40);
}

function unlockAudio() {
	if (audioUnlocked.value) return;
	audioUnlocked.value = true;
	// warm up a silent play attempt on each buffer
	Object.keys(SFX).forEach(k => {
		try { getSfx(k); } catch (e) {}
	});
	ensureMusic();
	if (musicShouldPlay) startMusic();
}

// Unlock on first pointer / key interaction
['pointerdown', 'touchstart', 'keydown'].forEach(ev => {
	window.addEventListener(ev, unlockAudio, { once: true, passive: true });
});

// Button click SFX (skip pause button)
document.addEventListener('click', (e) => {
	const btn = e.target.closest('button');
	if (!btn) return;
	if (btn.classList.contains('pause-btn') || btn.closest('.pause-btn')) return;
	// pause control is a div, not button — still skip any .pause-btn
	playSfx('click', 0.55);
}, true);

const formatNumber = num => num.toLocaleString();



////////////////////
// Math Constants //
////////////////////

const PI = Math.PI;
const TAU = Math.PI * 2;
const ETA = Math.PI * 0.5;



//////////////////
// Math Helpers //
//////////////////

// Clamps a number between min and max values (inclusive)
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

// Linearly interpolate between numbers a and b by a specific amount.
// mix >= 0 && mix <= 1
const lerp = (a, b, mix) => (b - a) * mix + a;




////////////////////
// Random Helpers //
////////////////////

// Generates a random number between min (inclusive) and max (exclusive)
const random = (min, max) => Math.random() * (max - min) + min;

// Generates a random integer between and possibly including min and max values
const randomInt = (min, max) => ((Math.random() * (max - min + 1)) | 0) + min;

// Returns a random element from an array
const pickOne = arr => arr[Math.random() * arr.length | 0];




///////////////////
// Color Helpers //
///////////////////

// Converts an { r, g, b } color object to a 6-digit hex code.
const colorToHex = color => {
	return '#' +
		(color.r | 0).toString(16).padStart(2, '0') +
		(color.g | 0).toString(16).padStart(2, '0') +
		(color.b | 0).toString(16).padStart(2, '0');
};

// Operates on an { r, g, b } color object.
// Returns string hex code.
// `lightness` must range from 0 to 1. 0 is pure black, 1 is pure white.
const shadeColor = (color, lightness) => {
	let other, mix;
	if (lightness < 0.5) {
		other = 0;
		mix = 1 - (lightness * 2);
	} else {
		other = 255;
		mix = lightness * 2 - 1;
	}
	return '#' +
		(lerp(color.r, other, mix) | 0).toString(16).padStart(2, '0') +
		(lerp(color.g, other, mix) | 0).toString(16).padStart(2, '0') +
		(lerp(color.b, other, mix) | 0).toString(16).padStart(2, '0');
};





////////////////////
// Timing Helpers //
////////////////////

const _allCooldowns = [];

const makeCooldown = (rechargeTime, units=1) => {
	let timeRemaining = 0;
	let lastTime = 0;

	const initialOptions = { rechargeTime, units };

	const updateTime = () => {
		const now = state.game.time;
		// Reset time remaining if time goes backwards.
		if (now < lastTime) {
			timeRemaining = 0;
		} else {
			// update...
			timeRemaining -= now-lastTime;
			if (timeRemaining < 0) timeRemaining = 0;
		}
		lastTime = now;
	};

	const canUse = () => {
		updateTime();
		return timeRemaining <= (rechargeTime * (units-1));
	};

	const cooldown = {
		canUse,
		useIfAble() {
			const usable = canUse();
			if (usable) timeRemaining += rechargeTime;
			return usable;
		},
		mutate(options) {
			if (options.rechargeTime) {
				// Apply recharge time delta so change takes effect immediately.
				timeRemaining -= rechargeTime-options.rechargeTime;
				if (timeRemaining < 0) timeRemaining = 0;
				rechargeTime = options.rechargeTime;
			}
			if (options.units) units = options.units;
		},
		reset() {
			timeRemaining = 0;
			lastTime = 0;
			this.mutate(initialOptions);
		}
	};

	_allCooldowns.push(cooldown);

	return cooldown;
};

const resetAllCooldowns = () => _allCooldowns.forEach(cooldown => cooldown.reset());

const makeSpawner = ({ chance, cooldownPerSpawn, maxSpawns }) => {
	const cooldown = makeCooldown(cooldownPerSpawn, maxSpawns);
	return {
		shouldSpawn() {
			return Math.random() <= chance && cooldown.useIfAble();
		},
		mutate(options) {
			if (options.chance) chance = options.chance;
			cooldown.mutate({
				rechargeTime: options.cooldownPerSpawn,
				units: options.maxSpawns
			});
		}
	};
};




////////////////////
// Vector Helpers //
////////////////////

const normalize = v => {
	const mag = Math.hypot(v.x, v.y, v.z);
	return {
		x: v.x / mag,
		y: v.y / mag,
		z: v.z / mag
	};
}

// Curried math helpers
const add = a => b => a + b;
// Curried vector helpers
const scaleVector = scale => vector => {
	vector.x *= scale;
	vector.y *= scale;
	vector.z *= scale;
};








////////////////
// 3D Helpers //
////////////////

// Clone array and all vertices.
function cloneVertices(vertices) {
	return vertices.map(v => ({ x: v.x, y: v.y, z: v.z }));
}

// Copy vertex data from one array into another.
// Arrays must be the same length.
function copyVerticesTo(arr1, arr2) {
	const len = arr1.length;
	for (let i=0; i<len; i++) {
		const v1 = arr1[i];
		const v2 = arr2[i];
		v2.x = v1.x;
		v2.y = v1.y;
		v2.z = v1.z;
	}
}

// Compute triangle midpoint.
// Mutates `middle` property of given `poly`.
function computeTriMiddle(poly) {
	const v = poly.vertices;
	poly.middle.x = (v[0].x + v[1].x + v[2].x) / 3;
	poly.middle.y = (v[0].y + v[1].y + v[2].y) / 3;
	poly.middle.z = (v[0].z + v[1].z + v[2].z) / 3;
}

// Compute quad midpoint.
// Mutates `middle` property of given `poly`.
function computeQuadMiddle(poly) {
	const v = poly.vertices;
	poly.middle.x = (v[0].x + v[1].x + v[2].x + v[3].x) / 4;
	poly.middle.y = (v[0].y + v[1].y + v[2].y + v[3].y) / 4;
	poly.middle.z = (v[0].z + v[1].z + v[2].z + v[3].z) / 4;
}

function computePolyMiddle(poly) {
	if (poly.vertices.length === 3) {
		computeTriMiddle(poly);
	} else {
		computeQuadMiddle(poly);
	}
}

// Compute distance from any polygon (tri or quad) midpoint to camera.
// Sets `depth` property of given `poly`.
// Also triggers midpoint calculation, which mutates `middle` property of `poly`.
function computePolyDepth(poly) {
	computePolyMiddle(poly);
	const dX = poly.middle.x;
	const dY = poly.middle.y;
	const dZ = poly.middle.z - cameraDistance;
	poly.depth = Math.hypot(dX, dY, dZ);
}

// Compute normal of any polygon. Uses normalized vector cross product.
// Mutates `normalName` property of given `poly`.
function computePolyNormal(poly, normalName) {
	// Store quick refs to vertices
	const v1 = poly.vertices[0];
	const v2 = poly.vertices[1];
	const v3 = poly.vertices[2];
	// Calculate difference of vertices, following winding order.
	const ax = v1.x - v2.x;
	const ay = v1.y - v2.y;
	const az = v1.z - v2.z;
	const bx = v1.x - v3.x;
	const by = v1.y - v3.y;
	const bz = v1.z - v3.z;
	// Cross product
	const nx = ay*bz - az*by;
	const ny = az*bx - ax*bz;
	const nz = ax*by - ay*bx;
	// Compute magnitude of normal and normalize
	const mag = Math.hypot(nx, ny, nz);
	const polyNormal = poly[normalName];
	polyNormal.x = nx / mag;
	polyNormal.y = ny / mag;
	polyNormal.z = nz / mag;
}

// Apply translation/rotation/scale to all given vertices.
// If `vertices` and `target` are the same array, the vertices will be mutated in place.
// If `vertices` and `target` are different arrays, `vertices` will not be touched, instead the
// transformed values from `vertices` will be written to `target` array.
function transformVertices(vertices, target, tX, tY, tZ, rX, rY, rZ, sX, sY, sZ) {
	// Matrix multiplcation constants only need calculated once for all vertices.
	const sinX = Math.sin(rX);
	const cosX = Math.cos(rX);
	const sinY = Math.sin(rY);
	const cosY = Math.cos(rY);
	const sinZ = Math.sin(rZ);
	const cosZ = Math.cos(rZ);

	// Using forEach() like map(), but with a (recycled) target array.
	vertices.forEach((v, i) => {
		const targetVertex = target[i];
		// X axis rotation
		const x1 = v.x;
		const y1 = v.z*sinX + v.y*cosX;
		const z1 = v.z*cosX - v.y*sinX;
		// Y axis rotation
		const x2 = x1*cosY - z1*sinY;
		const y2 = y1;
		const z2 = x1*sinY + z1*cosY;
		// Z axis rotation
		const x3 = x2*cosZ - y2*sinZ;
		const y3 = x2*sinZ + y2*cosZ;
		const z3 = z2;

		// Scale, Translate, and set the transform.
		targetVertex.x = x3 * sX + tX;
		targetVertex.y = y3 * sY + tY;
		targetVertex.z = z3 * sZ + tZ;
	});
}

// 3D projection on a single vertex.
// Directly mutates the vertex.
const projectVertex = v => {
	const focalLength = cameraDistance * sceneScale;
	const depth = focalLength / (cameraDistance - v.z);
	v.x = v.x * depth;
	v.y = v.y * depth;
};

// 3D projection on a single vertex.
// Mutates a secondary target vertex.
const projectVertexTo = (v, target) => {
	const focalLength = cameraDistance * sceneScale;
	const depth = focalLength / (cameraDistance - v.z);
	target.x = v.x * depth;
	target.y = v.y * depth;
};





// PERF.js
// ============================================================================
// ============================================================================

// Dummy no-op functions.
// I use these in a special build for custom performance profiling.
const PERF_START = () => {};
const PERF_END = () => {};
const PERF_UPDATE = () => {};




// 3dModels.js
// ============================================================================
// ============================================================================

// Define models once. The origin is the center of the model.

// A simple cube, 8 vertices, 6 quads.
// Defaults to an edge length of 2 units, can be influenced with `scale`.
function makeCubeModel({ scale=1 }) {
	return {
		vertices: [
			// top
			{ x: -scale, y: -scale, z: scale },
			{ x:  scale, y: -scale, z: scale },
			{ x:  scale, y:  scale, z: scale },
			{ x: -scale, y:  scale, z: scale },
			// bottom
			{ x: -scale, y: -scale, z: -scale },
			{ x:  scale, y: -scale, z: -scale },
			{ x:  scale, y:  scale, z: -scale },
			{ x: -scale, y:  scale, z: -scale }
		],
		polys: [
			// z = 1
			{ vIndexes: [0, 1, 2, 3] },
			// z = -1
			{ vIndexes: [7, 6, 5, 4] },
			// y = 1
			{ vIndexes: [3, 2, 6, 7] },
			// y = -1
			{ vIndexes: [4, 5, 1, 0] },
			// x = 1
			{ vIndexes: [5, 6, 2, 1] },
			// x = -1
			{ vIndexes: [0, 3, 7, 4] }
		]
	};
}

// Not very optimized - lots of duplicate vertices are generated.
function makeRecursiveCubeModel({ recursionLevel, splitFn, color, scale=1 }) {
	const getScaleAtLevel = level => 1 / (3 ** level);

	// We can model level 0 manually. It's just a single, centered, cube.
	let cubeOrigins = [{ x: 0, y: 0, z: 0 }];

	// Recursively replace cubes with smaller cubes.
	for (let i=1; i<=recursionLevel; i++) {
		const scale = getScaleAtLevel(i) * 2;
		const cubeOrigins2 = [];
		cubeOrigins.forEach(origin => {
			cubeOrigins2.push(...splitFn(origin, scale));
		});
		cubeOrigins = cubeOrigins2;
	}

	const finalModel = { vertices: [], polys: [] };

	// Generate single cube model and scale it.
	const cubeModel = makeCubeModel({ scale: 1 });
	cubeModel.vertices.forEach(scaleVector(getScaleAtLevel(recursionLevel)));

	// Compute the max distance x, y, or z origin values will be.
	// Same result as `Math.max(...cubeOrigins.map(o => o.x))`, but much faster.
	const maxComponent = getScaleAtLevel(recursionLevel) * (3 ** recursionLevel - 1);

	// Place cube geometry at each origin.
	cubeOrigins.forEach((origin, cubeIndex) => {
		// To compute occlusion (shading), find origin component with greatest
		// magnitude and normalize it relative to `maxComponent`.
		const occlusion = Math.max(
			Math.abs(origin.x),
			Math.abs(origin.y),
			Math.abs(origin.z)
		) / maxComponent;
		// At lower iterations, occlusion looks better lightened up a bit.
		const occlusionLighter = recursionLevel > 2
			? occlusion
			: (occlusion + 0.8) / 1.8;
		// Clone, translate vertices to origin, and apply scale
		finalModel.vertices.push(
			...cubeModel.vertices.map(v => ({
				x: (v.x + origin.x) * scale,
				y: (v.y + origin.y) * scale,
				z: (v.z + origin.z) * scale
			}))
		);
		// Clone polys, shift referenced vertex indexes, and compute color.
		finalModel.polys.push(
			...cubeModel.polys.map(poly => ({
				vIndexes: poly.vIndexes.map(add(cubeIndex * 8))
			}))
		);
	});

	return finalModel;
}


// o: Vector3D - Position of cube's origin (center).
// s: Vector3D - Determines size of menger sponge.
function mengerSpongeSplit(o, s) {
	return [
		// Top
		{ x: o.x + s, y: o.y - s, z: o.z + s },
		{ x: o.x + s, y: o.y - s, z: o.z + 0 },
		{ x: o.x + s, y: o.y - s, z: o.z - s },
		{ x: o.x + 0, y: o.y - s, z: o.z + s },
		{ x: o.x + 0, y: o.y - s, z: o.z - s },
		{ x: o.x - s, y: o.y - s, z: o.z + s },
		{ x: o.x - s, y: o.y - s, z: o.z + 0 },
		{ x: o.x - s, y: o.y - s, z: o.z - s },
		// Bottom
		{ x: o.x + s, y: o.y + s, z: o.z + s },
		{ x: o.x + s, y: o.y + s, z: o.z + 0 },
		{ x: o.x + s, y: o.y + s, z: o.z - s },
		{ x: o.x + 0, y: o.y + s, z: o.z + s },
		{ x: o.x + 0, y: o.y + s, z: o.z - s },
		{ x: o.x - s, y: o.y + s, z: o.z + s },
		{ x: o.x - s, y: o.y + s, z: o.z + 0 },
		{ x: o.x - s, y: o.y + s, z: o.z - s },
		// Middle
		{ x: o.x + s, y: o.y + 0, z: o.z + s },
		{ x: o.x + s, y: o.y + 0, z: o.z - s },
		{ x: o.x - s, y: o.y + 0, z: o.z + s },
		{ x: o.x - s, y: o.y + 0, z: o.z - s }
	];
}



// Helper to optimize models by merging duplicate vertices within a threshold,
// and removing all polys that share the same vertices.
// Directly mutates the model.
function optimizeModel(model, threshold=0.0001) {
	const { vertices, polys } = model;

	const compareVertices = (v1, v2) => (
		Math.abs(v1.x - v2.x) < threshold &&
		Math.abs(v1.y - v2.y) < threshold &&
		Math.abs(v1.z - v2.z) < threshold
	);

	const comparePolys = (p1, p2) => {
		const v1 = p1.vIndexes;
		const v2 = p2.vIndexes;
		return (
			(
				v1[0] === v2[0] ||
				v1[0] === v2[1] ||
				v1[0] === v2[2] ||
				v1[0] === v2[3]
			) && (
				v1[1] === v2[0] ||
				v1[1] === v2[1] ||
				v1[1] === v2[2] ||
				v1[1] === v2[3]
			) && (
				v1[2] === v2[0] ||
				v1[2] === v2[1] ||
				v1[2] === v2[2] ||
				v1[2] === v2[3]
			) && (
				v1[3] === v2[0] ||
				v1[3] === v2[1] ||
				v1[3] === v2[2] ||
				v1[3] === v2[3]
			)
		);
	};


	vertices.forEach((v, i) => {
		v.originalIndexes = [i];
	});

	for (let i=vertices.length-1; i>=0; i--) {
		for (let ii=i-1; ii>=0; ii--) {
			const v1 = vertices[i];
			const v2 = vertices[ii];
			if (compareVertices(v1, v2)) {
				vertices.splice(i, 1);
				v2.originalIndexes.push(...v1.originalIndexes);
				break;
			}
		}
	}

	vertices.forEach((v, i) => {
		polys.forEach(p => {
			p.vIndexes.forEach((vi, ii, arr) => {
				const vo = v.originalIndexes;
				if (vo.includes(vi)) {
					arr[ii] = i;
				}
			});
		});
	});

	polys.forEach(p => {
		const vi = p.vIndexes;
		p.sum = vi[0] + vi[1] + vi[2] + vi[3];
	});
	polys.sort((a, b) => b.sum - a.sum);

	// Assumptions:
	// 1. Each poly will either have no duplicates or 1 duplicate.
	// 2. If two polys are equal, they are both hidden (two cubes touching),
	//    therefore both can be removed.
	for (let i=polys.length-1; i>=0; i--) {
		for (let ii=i-1; ii>=0; ii--) {
			const p1 = polys[i];
			const p2 = polys[ii];
			if (p1.sum !== p2.sum) break;
			if (comparePolys(p1, p2)) {
				polys.splice(i, 1);
				polys.splice(ii, 1);
				i--;
				break;
			}
		}
	}

	return model;
}





// Entity.js
// ============================================================================
// ============================================================================

class Entity {
	constructor({ model, color, wireframe=false }) {
		const vertices = cloneVertices(model.vertices);
		const shadowVertices = cloneVertices(model.vertices);
		const colorHex = colorToHex(color);
		const darkColorHex = shadeColor(color, 0.4);

		const polys = model.polys.map(p => ({
			vertices: p.vIndexes.map(vIndex => vertices[vIndex]),
			color: color, // custom rgb color object
			wireframe: wireframe,
			strokeWidth: wireframe ? 2 : 0, // Set to non-zero value to draw stroke
			strokeColor: colorHex, // must be a CSS color string
			strokeColorDark: darkColorHex, // must be a CSS color string
			depth: 0,
			middle: { x: 0, y: 0, z: 0 },
			normalWorld: { x: 0, y: 0, z: 0 },
			normalCamera: { x: 0, y: 0, z: 0 }
		}));

		const shadowPolys = model.polys.map(p => ({
			vertices: p.vIndexes.map(vIndex => shadowVertices[vIndex]),
			wireframe: wireframe,
			normalWorld: { x: 0, y: 0, z: 0 }
		}));

		this.projected = {}; // Will store 2D projected data
		this.model = model;
		this.vertices = vertices;
		this.polys = polys;
		this.shadowVertices = shadowVertices;
		this.shadowPolys = shadowPolys;
		this.reset();
	}

	// Better names: resetEntity, resetTransform, resetEntityTransform
	reset() {
		this.x = 0;
		this.y = 0;
		this.z = 0;
		this.xD = 0;
		this.yD = 0;
		this.zD = 0;

		this.rotateX = 0;
		this.rotateY = 0;
		this.rotateZ = 0;
		this.rotateXD = 0;
		this.rotateYD = 0;
		this.rotateZD = 0;

		this.scaleX = 1;
		this.scaleY = 1;
		this.scaleZ = 1;

		this.projected.x = 0;
		this.projected.y = 0;
	}

	transform() {
		transformVertices(
			this.model.vertices,
			this.vertices,
			this.x,
			this.y,
			this.z,
			this.rotateX,
			this.rotateY,
			this.rotateZ,
			this.scaleX,
			this.scaleY,
			this.scaleZ
		);

		copyVerticesTo(this.vertices, this.shadowVertices);
	}

	// Projects origin point, stored as `projected` property.
	project() {
		projectVertexTo(this, this.projected);
	}
}





// getTarget.js
// ============================================================================
// ============================================================================

// All active targets
const targets = [];

// Pool target instances by color, using a Map.
// keys are color objects, and values are arrays of targets.
// Also pool wireframe instances separately.
const targetPool = new Map(allColors.map(c=>([c, []])));
const targetWireframePool = new Map(allColors.map(c=>([c, []])));



const getTarget = (() => {

	const slowmoSpawner = makeSpawner({
		chance: 0.35,
		cooldownPerSpawn: 9000,
		maxSpawns: 1
	});

	const spinnerSpawner = makeSpawner({
		chance: 0.08,
		cooldownPerSpawn: 12000,
		maxSpawns: 1
	});

	// Cached array instances, no need to allocate every time.
	const axisOptions = [
		['x', 'y'],
		['y', 'z'],
		['z', 'x']
	];

	function getTargetOfStyle(color, wireframe) {
		const pool = wireframe ? targetWireframePool : targetPool;
		let target = pool.get(color).pop();
		if (!target) {
			target = new Entity({
				model: optimizeModel(makeRecursiveCubeModel({
					recursionLevel: 1,
					splitFn: mengerSpongeSplit,
					scale: targetRadius
				})),
				color: color,
				wireframe: wireframe
			});

			// Init any properties that will be used.
			// These will not be automatically reset when recycled.
			target.color = color;
			target.wireframe = wireframe;
			// Some properties don't have their final value yet.
			// Initialize with any value of the right type.
			target.hit = false;
			target.maxHealth = 0;
			target.health = 0;
			target.isResistant = false;
		}
		return target;
	}

	return function getTarget() {
		const level = state.game.level;
		const desafiante = isDesafianteGame();

		// Target Parameters
		let color = pickOne(allColors);
		let wireframe = false;
		let health = 1;
		let maxHealth = 1;
		let isResistant = false;

		const spinner = (level >= 5 || desafiante) && isInGame() && spinnerSpawner.shouldSpawn();
		const onScreen = targets.length;
		// Only one slow-mo cube allowed on screen at a time
		const slowmoOnScreen = targets.some(t => t.wireframe);

		// --- DESAFIANTE: no level-based spawn order ---
		if (desafiante) {
			const slowChance = slowmoOnScreen ? 0 : clamp(0.05 - onScreen * 0.01, 0.01, 0.05);
			const strongChance = clamp(0.10 - onScreen * 0.02, 0.01, 0.10);
			const roll = Math.random();
			if (roll < slowChance) {
				color = BLUE;
				wireframe = true;
			} else if (roll < slowChance + strongChance) {
				isResistant = true;
				maxHealth = randomInt(3, 5);
				health = maxHealth;
				color = pickOne(allColors);
			}
		}
		// --- CLASSIC / HEARTS: level-based ---
		else {
			// Slow-mo from level 10: base 30%, -1% per cube on screen (max 1 on screen)
			if (level >= 10 && !slowmoOnScreen) {
				const slowChance = clamp(0.30 - onScreen * 0.01, 0.05, 0.30);
				if (Math.random() < slowChance) {
					color = BLUE;
					wireframe = true;
				}
			}
			// Resistant from level 20 (only if not already slow-mo)
			if (!wireframe && level >= 20) {
				let resistantCount = 0;
				let normalCount = 0;
				for (const t of targets) {
					if (t.isResistant) resistantCount++;
					else normalCount++;
				}
				let chance = 0.17 - (resistantCount * 0.05) + (normalCount * 0.01);
				chance = clamp(chance, 0.02, 0.35);
				if (Math.random() < chance) {
					isResistant = true;
					maxHealth = level >= 30 ? randomInt(3, 5) : 3;
					health = maxHealth;
					color = pickOne(allColors);
				}
			}
		}

		const target = getTargetOfStyle(color, wireframe);
		target.hit = false;
		target.maxHealth = maxHealth;
		target.health = health;
		target.isResistant = isResistant;
		updateTargetHealth(target, 0);

		const spinSpeeds = [
			Math.random() * 0.1 - 0.05,
			Math.random() * 0.1 - 0.05
		];

		if (spinner) {
			spinSpeeds[0] = -0.25;
			spinSpeeds[1] = 0;
			target.rotateZ = random(0, TAU);
		}

		const axes = pickOne(axisOptions);
		spinSpeeds.forEach((spinSpeed, i) => {
			switch (axes[i]) {
				case 'x': target.rotateXD = spinSpeed; break;
				case 'y': target.rotateYD = spinSpeed; break;
				case 'z': target.rotateZD = spinSpeed; break;
			}
		});

		return target;
	}
})();


const updateTargetHealth = (target, healthDelta) => {
	target.health += healthDelta;
	// Resistant cubes look like normal cubes; only the outer sphere shows the barrier.
	if (!target.wireframe) {
		for (let p of target.polys) {
			p.strokeWidth = 0;
			p.strokeColor = makeTargetGlueColor(target);
		}
	}
};


const returnTarget = target => {
	target.reset();
	const pool = target.wireframe ? targetWireframePool : targetPool;
	pool.get(target.color).push(target);
};


function resetAllTargets() {
	while(targets.length) {
		returnTarget(targets.pop());
	}
}





// createBurst.js
// ============================================================================
// ============================================================================

// Track all active fragments
const frags = [];
// Pool inactive fragments by color, using a Map.
// keys are color objects, and values are arrays of fragments.
// // Also pool wireframe instances separately.
const fragPool = new Map(allColors.map(c=>([c, []])));
const fragWireframePool = new Map(allColors.map(c=>([c, []])));


const createBurst = (() => {
	// Precompute some private data to be reused for all bursts.
	const basePositions = mengerSpongeSplit({ x:0, y:0, z:0 }, fragRadius*2);
	const positions = cloneVertices(basePositions);
	const prevPositions = cloneVertices(basePositions);
	const velocities = cloneVertices(basePositions);

	const basePositionNormals = basePositions.map(normalize);
	const positionNormals = cloneVertices(basePositionNormals);


	const fragCount = basePositions.length;

	function getFragForTarget(target) {
		const pool = target.wireframe ? fragWireframePool : fragPool;
		let frag = pool.get(target.color).pop();
		if (!frag) {
			frag = new Entity({
				model: makeCubeModel({ scale: fragRadius }),
				color: target.color,
				wireframe: target.wireframe
			});
			frag.color = target.color;
			frag.wireframe = target.wireframe;
		}
		return frag;
	}

	return (target, force=1) => {
		// Calculate fragment positions, and what would have been the previous positions
		// when still a part of the larger target.
		transformVertices(
			basePositions, positions,
			target.x, target.y, target.z,
			target.rotateX, target.rotateY, target.rotateZ,
			1, 1, 1
		);
		transformVertices(
			basePositions, prevPositions,
			target.x - target.xD, target.y - target.yD, target.z - target.zD,
			target.rotateX - target.rotateXD, target.rotateY - target.rotateYD, target.rotateZ - target.rotateZD,
			1, 1, 1
		);

		// Compute velocity of each fragment, based on previous positions.
		// Will write to `velocities` array.
		for (let i=0; i<fragCount; i++) {
			const position = positions[i];
			const prevPosition = prevPositions[i];
			const velocity = velocities[i];

			velocity.x = position.x - prevPosition.x;
			velocity.y = position.y - prevPosition.y;
			velocity.z = position.z - prevPosition.z;
		}



		// Apply target rotation to normals
		transformVertices(
			basePositionNormals, positionNormals,
			0, 0, 0,
			target.rotateX, target.rotateY, target.rotateZ,
			1, 1, 1
		);


		for (let i=0; i<fragCount; i++) {
			const position = positions[i];
			const velocity = velocities[i];
			const normal = positionNormals[i];

			const frag = getFragForTarget(target);

			frag.x = position.x;
			frag.y = position.y;
			frag.z = position.z;
			frag.rotateX = target.rotateX;
			frag.rotateY = target.rotateY;
			frag.rotateZ = target.rotateZ;


			const burstSpeed = 2 * force;
			const randSpeed = 2 * force;
			const rotateScale = 0.015;
			frag.xD = velocity.x + (normal.x * burstSpeed) + (Math.random() * randSpeed);
			frag.yD = velocity.y + (normal.y * burstSpeed) + (Math.random() * randSpeed);
			frag.zD = velocity.z + (normal.z * burstSpeed) + (Math.random() * randSpeed);
			frag.rotateXD = frag.xD * rotateScale;
			frag.rotateYD = frag.yD * rotateScale;
			frag.rotateZD = frag.zD * rotateScale;

			frags.push(frag);
		};
	}
})();


const returnFrag = frag => {
	frag.reset();
	const pool = frag.wireframe ? fragWireframePool : fragPool;
	pool.get(frag.color).push(frag);
};





// sparks.js
// ============================================================================
// ============================================================================

const sparks = [];
const sparkPool = [];


function addSpark(x, y, xD, yD, color = null) {
	const spark = sparkPool.pop() || {};

	spark.x = x + xD * 0.5;
	spark.y = y + yD * 0.5;
	spark.xD = xD;
	spark.yD = yD;
	spark.life = random(220, 420);
	spark.maxLife = spark.life;
	spark.color = color;

	sparks.push(spark);

	return spark;
}


// Spherical spark burst
function sparkBurst(x, y, count, maxSpeed, color = null) {
	const angleInc = TAU / count;
	for (let i=0; i<count; i++) {
		const angle = i * angleInc + angleInc * Math.random();
		const speed = (1 - Math.random() ** 3) * maxSpeed;
		addSpark(
			x,
			y,
			Math.sin(angle) * speed,
			Math.cos(angle) * speed,
			color
		);
	}
}

// Barrier / shield shatter particles (cyan-blue)
function shieldBurst(x, y, big = false) {
	const count = big ? 28 : 14;
	const maxSpeed = big ? 14 : 9;
	const colors = [
		'rgba(120, 200, 255, 0.95)',
		'rgba(80, 170, 255, 0.9)',
		'rgba(180, 230, 255, 0.85)',
		'rgba(100, 160, 255, 0.8)'
	];
	const angleInc = TAU / count;
	for (let i = 0; i < count; i++) {
		const angle = i * angleInc + angleInc * Math.random();
		const speed = (1 - Math.random() ** 2) * maxSpeed;
		addSpark(
			x, y,
			Math.sin(angle) * speed,
			Math.cos(angle) * speed,
			colors[i % colors.length]
		);
	}
	// extra outer ring fragments
	if (big) {
		for (let i = 0; i < 12; i++) {
			const angle = (TAU / 12) * i;
			addSpark(
				x + Math.sin(angle) * targetRadius * 1.2,
				y + Math.cos(angle) * targetRadius * 1.2,
				Math.sin(angle) * 6,
				Math.cos(angle) * 6,
				'rgba(160, 220, 255, 0.7)'
			);
		}
	}
}


// Make a target "leak" sparks from all vertices.
// This is used to create the effect of target glue "shedding".
let glueShedVertices;
function glueShedSparks(target) {
	if (!glueShedVertices) {
		glueShedVertices = cloneVertices(target.vertices);
	} else {
		copyVerticesTo(target.vertices, glueShedVertices);
	}

	glueShedVertices.forEach(v => {
		if (Math.random() < 0.4) {
			projectVertex(v);
			addSpark(
				v.x,
				v.y,
				random(-12, 12),
				random(-12, 12)
			);
		}
	});
}

function returnSpark(spark) {
	sparkPool.push(spark);
}





// hud.js
// ============================================================================
// ============================================================================

const hudContainerNode = $('.hud');

function setHudVisibility(visible) {
	if (visible) {
		hudContainerNode.style.display = 'block';
	} else {
		hudContainerNode.style.display = 'none';
	}
}


///////////
// Score //
///////////
const scoreNode = $('.score-lbl');
const cubeCountNode = $('.cube-count-lbl');

function renderScoreHud() {
	if (isCasualGame()) {
		scoreNode.style.display = 'none';
		cubeCountNode.style.opacity = 1;
	} else {
		scoreNode.innerText = `Puntos: ${state.game.score}`;
		scoreNode.style.display = 'block';
		cubeCountNode.style.opacity = 0.7;
	}
	cubeCountNode.innerText = `Cubos: ${state.game.cubeCount}`;
	renderHudBuffs();
}

function renderHudBuffs() {
	const modeEl = $('.hud-buff--mode');
	const shopEl = $('.hud-buff--shop');
	const debuffEl = $('.hud-buff--debuff');
	if (!modeEl || !shopEl || !debuffEl) return;

	let modeBuff = '';
	let modeDebuff = '';
	if (isCasualGame()) {
		modeBuff = 'Casual · sin muerte';
		modeDebuff = 'Sin monedas / logros';
	} else if (isHeartsGame()) {
		modeBuff = 'Hearts · 3 vidas';
		modeDebuff = '';
	} else if (isDesafianteGame()) {
		modeBuff = 'Desafiante · x2 monedas · más cubos';
		modeDebuff = 'Slow-mo débil · más strong';
	} else {
		modeBuff = 'Clásico · niveles endless';
		modeDebuff = '';
	}

	const shopParts = [];
	const slowSec = (state.upgrades.slowmoDuration / 1000).toFixed(1);
	if (state.upgrades.slowmoDuration > 1500) shopParts.push(`Slow-Mo ${slowSec}s`);
	if (state.upgrades.touchPower > 1) shopParts.push(`Touch x${state.upgrades.touchPower.toFixed(1)}`);
	if (state.upgrades.mining > 1) shopParts.push(`Mining x${state.upgrades.mining.toFixed(2)}`);
	const shopBuff = shopParts.length ? shopParts.join(' · ') : 'Sin upgrades de tienda';

	modeEl.textContent = modeBuff ? `▲ ${modeBuff}` : '';
	shopEl.textContent = `◆ ${shopBuff}`;
	debuffEl.textContent = modeDebuff ? `▼ ${modeDebuff}` : '';
}

renderScoreHud();


//////////////////
// Level Bar    //
//////////////////
const levelBarNode = $('.level-bar');
const levelBarFillNode = $('.level-bar__fill');
const levelBarTextNode = $('.level-bar__text');

function renderLevelBar() {
	if (!hasLevelBar()) {
		levelBarNode.style.display = 'none';
		return;
	}
	levelBarNode.style.display = 'block';
	const progress = getLevelProgress();
	const pct = Math.floor(progress * 100);
	levelBarFillNode.style.width = `${pct}%`;
	levelBarTextNode.innerText = `Nivel ${state.game.level} · ${pct}%`;
}

renderLevelBar();


//////////////////
// Coins HUD    //
//////////////////
const coinsValNode = $('.coins-val');
const mainCoinsValNode = $('.main-coins-val');

function renderCoins() {
	if (coinsValNode) coinsValNode.textContent = state.game.coins;
}
function renderMainCoins() {
	if (mainCoinsValNode) mainCoinsValNode.textContent = state.game.coins;
}
renderCoins();
renderMainCoins();


//////////////////
// Lives HUD    //
//////////////////
const livesNode = $('.lives-lbl');
function renderLives() {
	if (!livesNode) return;
	if (isHeartsGame()) {
		livesNode.style.display = 'block';
		livesNode.textContent = '❤️'.repeat(Math.max(0, state.game.lives)) + '🖤'.repeat(Math.max(0, 3 - state.game.lives));
	} else {
		livesNode.style.display = 'none';
	}
}

function updateHudForMode() {
	renderLevelBar();
	renderLives();
	const coinsLbl = $('.coins-lbl');
	if (coinsLbl) {
		coinsLbl.style.display = canEarnCoinsAndAchievements() ? 'flex' : 'none';
	}
}


//////////////////
// Pause Button //
//////////////////

handlePointerDown($('.pause-btn'), () => pauseGame());


////////////////////
// Slow-Mo Status //
////////////////////

const slowmoNode = $('.slowmo');
const slowmoBarNode = $('.slowmo__bar');

function renderSlowmoStatus(percentRemaining) {
	slowmoNode.style.opacity = percentRemaining === 0 ? 0 : 1;
	slowmoBarNode.style.transform = `scaleX(${percentRemaining.toFixed(3)})`;
}





// menus.js
// ============================================================================
// ============================================================================

// Top-level menu containers
const menuContainerNode = $('.menus');
const menuMainNode = $('.menu--main');
const menuModesNode = $('.menu--modes');
const menuPauseNode = $('.menu--pause');
const menuScoreNode = $('.menu--score');
const menuShopNode = $('.menu--shop');
const menuAchievementsNode = $('.menu--achievements');

const finalScoreLblNode = $('.final-score-lbl');
const highScoreLblNode = $('.high-score-lbl');
const levelReachedLblNode = $('.level-reached-lbl');

const shopCoinsValueNode = $('.shop-coins-value');
const slowmoDurationValNode = $('.slowmo-duration-val');
const touchPowerValNode = $('.touch-power-val');
const miningValNode = $('.mining-val');
const shopBuyBtnSlowmo = $('.shop-buy-btn[data-item="slowmo"]');
const shopBuyBtnTouch = $('.shop-buy-btn[data-item="touch"]');
const shopBuyBtnMining = $('.shop-buy-btn[data-item="mining"]');

let previousMenuBeforeShop = MENU_MAIN;

function showMenu(node) {
	node.classList.add('active');
}
function hideMenu(node) {
	node.classList.remove('active');
}

function coinBtnLabel(price) {
	return `<img src="data/images/coin.png" class="coin-icon" style="width:1em;height:1em;vertical-align:middle"> ${price}`;
}

function renderShop() {
	if (shopCoinsValueNode) shopCoinsValueNode.textContent = state.game.coins;
	const currentSec = (state.upgrades.slowmoDuration / 1000).toFixed(1);
	if (slowmoDurationValNode) slowmoDurationValNode.textContent = currentSec;
	if (touchPowerValNode) touchPowerValNode.textContent = state.upgrades.touchPower.toFixed(1);
	if (miningValNode) miningValNode.textContent = state.upgrades.mining.toFixed(2);

	if (shopBuyBtnSlowmo) {
		const maxed = state.upgrades.slowmoDuration >= 60000;
		shopBuyBtnSlowmo.innerHTML = maxed ? 'MAX' : coinBtnLabel(state.upgrades.slowmoPrice);
		shopBuyBtnSlowmo.disabled = maxed || state.game.coins < state.upgrades.slowmoPrice;
	}
	if (shopBuyBtnTouch) {
		const maxed = state.upgrades.touchPower >= 3;
		shopBuyBtnTouch.innerHTML = maxed ? 'MAX' : coinBtnLabel(state.upgrades.touchPowerPrice);
		shopBuyBtnTouch.disabled = maxed || state.game.coins < state.upgrades.touchPowerPrice;
	}
	if (shopBuyBtnMining) {
		shopBuyBtnMining.innerHTML = coinBtnLabel(state.upgrades.miningPrice);
		shopBuyBtnMining.disabled = state.game.coins < state.upgrades.miningPrice;
	}
}

// When true, achievements screen is view-only (no claim buttons)
let achievementsViewOnly = false;
let previousMenuBeforeAchievements = MENU_MAIN;

function getBestLevelAcrossModes() {
	let best = state.game.level || 1;
	[GAME_MODE_RANKED, GAME_MODE_HEARTS, GAME_MODE_DESAFIANTE].forEach(mode => {
		try {
			const p = loadModeProgress(mode);
			if (p && p.level > best) best = p.level;
		} catch (e) {}
	});
	return best;
}

function getAchievementProgress(def) {
	// returns { current, target, ratio } for progress bar
	const data = state.achievements[def.id] || {};
	if (data.unlocked) return { current: 1, target: 1, ratio: 1 };

	const id = def.id;
	if (id === 'first_cube') {
		const c = state.game.totalCubesEver || 0;
		return { current: Math.min(c, 1), target: 1, ratio: Math.min(c, 1) };
	}
	if (id.startsWith('cubes_')) {
		const target = parseInt(id.split('_')[1], 10);
		const c = state.game.totalCubesEver || 0;
		return { current: Math.min(c, target), target, ratio: Math.min(1, c / target) };
	}
	if (id.startsWith('level_')) {
		const need = parseInt(id.split('_')[1], 10); // "supera nivel N" => level > N
		const best = getBestLevelAcrossModes();
		// progress toward reaching level need+1
		const target = need + 1;
		return { current: Math.min(best, target), target, ratio: Math.min(1, best / target) };
	}
	if (id === 'first_slowmo' || id === 'first_resist' || id.startsWith('play_')) {
		return { current: 0, target: 1, ratio: 0 };
	}
	return { current: 0, target: 1, ratio: 0 };
}

function renderAchievementsList() {
	const list = document.getElementById('achList');
	if (!list) return;
	list.innerHTML = '';
	ACHIEVEMENT_DEFS.forEach(def => {
		const data = state.achievements[def.id] || { unlocked: false, claimed: false };
		const item = document.createElement('div');
		item.className = 'ach-item';
		if (!achievementsViewOnly && data.unlocked && !data.claimed && !def.special && !def.noReward && def.reward) {
			item.classList.add('claimable');
		} else if (data.unlocked) {
			item.classList.add('unlocked');
		} else {
			item.classList.add('locked');
		}

		let rewardHtml = '';
		if (def.special) {
			rewardHtml = '<span style="opacity:0.6;font-size:0.75rem">En desarrollo</span>';
		} else if (def.noReward || !def.reward) {
			rewardHtml = data.unlocked
				? '<span style="opacity:0.55;font-size:0.72rem">✓</span>'
				: '<span style="opacity:0.4;font-size:0.7rem">—</span>';
		} else if (data.claimed) {
			rewardHtml = '<span style="opacity:0.5">✓</span>';
		} else if (data.unlocked && !achievementsViewOnly) {
			rewardHtml = `<button class="btn ach-claim-btn" data-id="${def.id}"><img src="data/images/coin.png" class="coin-icon" style="width:0.9em;height:0.9em"> ${def.reward}</button>`;
		} else if (data.unlocked && achievementsViewOnly) {
			rewardHtml = `<span class="ach-item__reward" style="opacity:0.7"><img src="data/images/coin.png" class="coin-icon" style="width:0.9em;height:0.9em"> ${def.reward}</span>`;
		} else {
			rewardHtml = `<span class="ach-item__reward"><img src="data/images/coin.png" class="coin-icon" style="width:0.9em;height:0.9em"> ${def.reward}</span>`;
		}

		const prog = getAchievementProgress(def);
		const pct = Math.floor(prog.ratio * 100);
		const progressHtml = `
			<div class="ach-progress">
				<div class="ach-progress__track">
					<div class="ach-progress__fill" style="width:${pct}%"></div>
				</div>
				<div class="ach-progress__label">${data.unlocked ? 'Completado' : `${prog.current}/${prog.target}`}</div>
			</div>`;

		item.innerHTML = `
			<div class="ach-item__icon">${data.unlocked ? def.icon : '🔒'}</div>
			<div class="ach-item__body">
				<div class="ach-item__name">${def.name}</div>
				<div class="ach-item__desc">${def.desc}</div>
				${progressHtml}
			</div>
			${rewardHtml}
		`;
		list.appendChild(item);
	});

	// Claim buttons (only if not view-only)
	if (!achievementsViewOnly) {
		list.querySelectorAll('.ach-claim-btn').forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				claimAchievement(btn.dataset.id);
			});
		});
	}
}

function renderMenus() {
	hideMenu(menuMainNode);
	hideMenu(menuModesNode);
	hideMenu(menuPauseNode);
	hideMenu(menuScoreNode);
	hideMenu(menuShopNode);
	hideMenu(menuAchievementsNode);

	switch (state.menus.active) {
		case MENU_MAIN:
			renderMainCoins();
			showMenu(menuMainNode);
			break;
		case MENU_MODES:
			showMenu(menuModesNode);
			break;
		case MENU_PAUSE:
			showMenu(menuPauseNode);
			break;
		case MENU_SCORE:
			finalScoreLblNode.textContent = formatNumber(state.game.score);
			if (isNewHighScore()) {
				highScoreLblNode.textContent = '¡Nuevo Récord!';
			} else {
				highScoreLblNode.textContent = `Récord: ${formatNumber(getHighScore())}`;
			}
			if (hasLevelBar()) {
				levelReachedLblNode.textContent = `Llegaste al nivel ${state.game.level}`;
				levelReachedLblNode.style.display = 'block';
			} else {
				levelReachedLblNode.style.display = 'none';
			}
			showMenu(menuScoreNode);
			break;
		case MENU_SHOP:
			renderShop();
			showMenu(menuShopNode);
			break;
		case MENU_ACHIEVEMENTS:
			renderAchievementsList();
			showMenu(menuAchievementsNode);
			break;
	}

	setHudVisibility(appReady && !isMenuVisible());
	menuContainerNode.classList.toggle('has-active', isMenuVisible());
	menuContainerNode.classList.toggle('interactive-mode', isMenuVisible() && pointerIsDown);
}

renderMenus();


////////////////////
// Button Actions //
////////////////////

// Main
handleClick($('.play-modes-btn'), () => setActiveMenu(MENU_MODES));
handleClick($('.shop-btn'), () => {
	previousMenuBeforeShop = MENU_MAIN;
	setActiveMenu(MENU_SHOP);
});
handleClick($('.achievements-btn'), () => {
	achievementsViewOnly = false;
	previousMenuBeforeAchievements = MENU_MAIN;
	setActiveMenu(MENU_ACHIEVEMENTS);
});

// Modes
handleClick($('.modes-back-btn'), () => setActiveMenu(MENU_MAIN));

document.querySelectorAll('.mode-card').forEach(card => {
	card.addEventListener('click', () => {
		const mode = card.dataset.mode;
		if (mode === 'legend') return;
		let gameMode = GAME_MODE_RANKED;
		if (mode === 'casual') gameMode = GAME_MODE_CASUAL;
		else if (mode === 'hearts') gameMode = GAME_MODE_HEARTS;
		else if (mode === 'desafiante') gameMode = GAME_MODE_DESAFIANTE;
		setGameMode(gameMode);
		setActiveMenu(null);
		resetGame();
	});
});

// Pause
handleClick($('.resume-btn'), () => resumeGame());
handleClick($('.menu-btn--pause'), () => {
	saveModeProgress();
	gamePaused = false;
	setActiveMenu(MENU_MAIN);
	startMusic();
});
handleClick($('.shop-btn--pause'), () => {
	previousMenuBeforeShop = MENU_PAUSE;
	setActiveMenu(MENU_SHOP);
});
handleClick($('.achievements-btn--pause'), () => {
	achievementsViewOnly = true; // view only, no claiming
	previousMenuBeforeAchievements = MENU_PAUSE;
	setActiveMenu(MENU_ACHIEVEMENTS);
});

// Score
handleClick($('.play-again-btn'), () => {
	setActiveMenu(null);
	resetGame();
});
handleClick($('.menu-btn--score'), () => {
	setActiveMenu(MENU_MAIN);
	startMusic();
});

// Shop
handleClick($('.shop-close-btn'), () => setActiveMenu(previousMenuBeforeShop));

handleClick(shopBuyBtnSlowmo, () => {
	if (state.upgrades.slowmoDuration >= 60000) return;
	if (state.game.coins < state.upgrades.slowmoPrice) return;
	state.game.coins -= state.upgrades.slowmoPrice;
	state.upgrades.slowmoDuration += 1000;
	state.upgrades.slowmoPrice = Math.ceil(state.upgrades.slowmoPrice * 1.5);
	saveCoins();
	saveUpgrades();
	renderCoins();
	renderMainCoins();
	renderShop();
	playSfx('cash', 0.7);
});

handleClick(shopBuyBtnTouch, () => {
	if (state.upgrades.touchPower >= 3) return;
	if (state.game.coins < state.upgrades.touchPowerPrice) return;
	state.game.coins -= state.upgrades.touchPowerPrice;
	state.upgrades.touchPower = Math.min(3, +(state.upgrades.touchPower + 0.2).toFixed(1));
	state.upgrades.touchPowerPrice = state.upgrades.touchPowerPrice * 2;
	saveCoins();
	saveUpgrades();
	renderCoins();
	renderMainCoins();
	renderShop();
	playSfx('cash', 0.7);
});

handleClick(shopBuyBtnMining, () => {
	if (state.game.coins < state.upgrades.miningPrice) return;
	state.game.coins -= state.upgrades.miningPrice;
	state.upgrades.mining = +(state.upgrades.mining + 0.25).toFixed(2);
	state.upgrades.miningPrice = Math.ceil(state.upgrades.miningPrice * 1.5);
	saveCoins();
	saveUpgrades();
	renderCoins();
	renderMainCoins();
	renderShop();
	playSfx('cash', 0.7);
});

// Achievements
handleClick($('.ach-back-btn'), () => setActiveMenu(previousMenuBeforeAchievements));


// actions.js
// ============================================================================
// ============================================================================

//////////////////
// MENU ACTIONS //
//////////////////

function setActiveMenu(menu) {
	state.menus.active = menu;
	renderMenus();
}


/////////////////
// HUD ACTIONS //
/////////////////

function setScore(score) {
	state.game.score = score;
	renderScoreHud();
}

function incrementScore(inc) {
	if (isInGame()) {
		state.game.score += inc;
		if (state.game.score < 0) {
			state.game.score = 0;
		}
		renderScoreHud();
		renderLevelBar();
		checkLevelUp();
	}
}

function setCubeCount(count) {
	state.game.cubeCount = count;
	renderScoreHud();
}

function incrementCubeCount(inc) {
	if (isInGame()) {
		state.game.cubeCount += inc;
		renderScoreHud();
	}
}


//////////////////
// GAME ACTIONS //
//////////////////

function setGameMode(mode) {
	state.game.mode = mode;
}

function resetGame() {
	resetAllTargets();
	state.game.time = 0;
	gamePaused = false;
	state.game.lives = 3;
	startMusic();

	// Restore level + bar progress for all modes except Casual
	if (!isCasualGame()) {
		const saved = loadModeProgress(state.game.mode);
		state.game.level = saved.level;
		const req = getLevelRequirement(state.game.level);
		const gained = Math.floor(req * saved.progress);
		state.game.scoreAtLevelStart = 0;
		state.game.score = gained;
	} else {
		state.game.level = 1;
		state.game.scoreAtLevelStart = 0;
		state.game.score = 0;
	}

	resetAllCooldowns();
	setCubeCount(0);
	spawnTime = getSpawnDelay();
	renderScoreHud();
	renderLevelBar();
	renderCoins();
	renderLives();
	updateHudForMode();
	checkLevelAchievements(true);
	unlockModePlayAchievement(state.game.mode);
}

function pauseGame() {
	if (!state.menus.active || gamePaused) {
		gamePaused = true;
		setActiveMenu(MENU_PAUSE);
		pauseMusic();
	}
}

function resumeGame() {
	gamePaused = false;
	setActiveMenu(null);
	startMusic();
}

function endGame() {
	gamePaused = false;
	pauseMusic();
	saveModeProgress();
	handleCanvasPointerUp();
	if (isNewHighScore()) {
		setHighScore(state.game.score);
	}
	setActiveMenu(MENU_SCORE);
}



////////////////////////
// KEYBOARD SHORTCUTS //
////////////////////////

window.addEventListener('keydown', event => {
	if (event.key === 'p') {
		isPaused() ? resumeGame() : pauseGame();
	}
});






// tick.js
// ============================================================================
// ============================================================================


let spawnTime = 0;
const maxSpawnX = 450;
const pointerDelta = { x: 0, y: 0 };
const pointerDeltaScaled = { x: 0, y: 0 };

// Temp slowmo state. Should be relocated once this stabilizes.
// slowmoDuration is now in state.upgrades.slowmoDuration
let slowmoRemaining = 0;
let spawnExtra = 0;
const spawnExtraDelay = 300;
let targetSpeed = 1;


function tick(width, height, simTime, simSpeed, lag) {
	PERF_START('frame');
	PERF_START('tick');

	state.game.time += simTime;

	if (slowmoRemaining > 0) {
		slowmoRemaining -= simTime;
		if (slowmoRemaining < 0) {
			slowmoRemaining = 0;
		}
		targetSpeed = pointerIsDown ? 0.075 : 0.3;
	} else {
		const menuPointerDown = isMenuVisible() && pointerIsDown;
		targetSpeed = menuPointerDown ? 0.025 : 1;
	}

	renderSlowmoStatus(slowmoRemaining / state.upgrades.slowmoDuration);

	gameSpeed += (targetSpeed - gameSpeed) / 22 * lag;
	gameSpeed = clamp(gameSpeed, 0, 1);

	const centerX = width / 2;
	const centerY = height / 2;

	const simAirDrag = 1 - (airDrag * simSpeed);
	const simAirDragSpark = 1 - (airDragSpark * simSpeed);

	// Pointer Tracking
	// -------------------

	// Compute speed and x/y deltas.
	// There is also a "scaled" variant taking game speed into account. This serves two purposes:
	//  - Lag won't create large spikes in speed/deltas
	//  - In slow mo, speed is increased proportionately to match "reality". Without this boost,
	//    it feels like your actions are dampened in slow mo.
	const forceMultiplier = 1 / (simSpeed * 0.75 + 0.25);
	pointerDelta.x = 0;
	pointerDelta.y = 0;
	pointerDeltaScaled.x = 0;
	pointerDeltaScaled.y = 0;
	const lastPointer = touchPoints[touchPoints.length - 1];

	if (pointerIsDown && lastPointer && !lastPointer.touchBreak) {
		pointerDelta.x = (pointerScene.x - lastPointer.x);
		pointerDelta.y = (pointerScene.y - lastPointer.y);
		pointerDeltaScaled.x = pointerDelta.x * forceMultiplier;
		pointerDeltaScaled.y = pointerDelta.y * forceMultiplier;
	}
	const pointerSpeed = Math.hypot(pointerDelta.x, pointerDelta.y);
	const pointerSpeedScaled = pointerSpeed * forceMultiplier;

	// Track points for later calculations, including drawing trail.
	touchPoints.forEach(p => p.life -= simTime);

	if (pointerIsDown) {
		touchPoints.push({
			x: pointerScene.x,
			y: pointerScene.y,
			life: touchPointLife
		});
	}

	while (touchPoints[0] && touchPoints[0].life <= 0) {
		touchPoints.shift();
	}


	// Entity Manipulation
	// --------------------
	PERF_START('entities');

	// Spawn targets
	spawnTime -= simTime;
	if (spawnTime <= 0) {
		if (spawnExtra > 0) {
			spawnExtra--;
			spawnTime = spawnExtraDelay;
		} else {
			spawnTime = getSpawnDelay();
		}
		const target = getTarget();
		const spawnRadius = Math.min(centerX * 0.8, maxSpawnX);
		target.x = (Math.random() * spawnRadius * 2 - spawnRadius);
		target.y = centerY + targetHitRadius * 2;
		target.z = (Math.random() * targetRadius*2 - targetRadius);
		target.xD = Math.random() * (target.x * -2 / 120);
		target.yD = -20;
		targets.push(target);
	}

	// Animate targets and remove when offscreen
	const leftBound = -centerX + targetRadius;
	const rightBound = centerX - targetRadius;
	const ceiling = -centerY - 120;
	const boundDamping = 0.4;

	targetLoop:
	for (let i = targets.length - 1; i >= 0; i--) {
		const target = targets[i];
		target.x += target.xD * simSpeed;
		target.y += target.yD * simSpeed;

		if (target.y < ceiling) {
			target.y = ceiling;
			target.yD = 0;
		}

		if (target.x < leftBound) {
			target.x = leftBound;
			target.xD *= -boundDamping;
		} else if (target.x > rightBound) {
			target.x = rightBound;
			target.xD *= -boundDamping;
		}

		if (target.z < backboardZ) {
			target.z = backboardZ;
			target.zD *= -boundDamping;
		}

		target.yD += gravity * simSpeed;
		target.rotateX += target.rotateXD * simSpeed;
		target.rotateY += target.rotateYD * simSpeed;
		target.rotateZ += target.rotateZD * simSpeed;
		target.transform();
		target.project();

		// Remove if offscreen
		if (target.y > centerY + targetHitRadius * 2) {
			targets.splice(i, 1);
			returnTarget(target);
			if (isInGame()) {
				if (isCasualGame()) {
					// pure casual: nothing happens
				} else if (isHeartsGame()) {
					state.game.lives--;
					renderLives();
					if (state.game.lives <= 0) endGame();
				} else {
					// Ranked & Desafiante: die
					endGame();
				}
			}
			continue;
		}


		// If pointer is moving really fast, we want to hittest multiple points along the path.
		// We can't use scaled pointer speed to determine this, since we care about actual screen
		// distance covered.
		const hitTestCount = Math.ceil(pointerSpeed / targetRadius * 2);
		// Resistant: dual hitbox — barrier (larger) + cube (normal). Use the larger one.
		const hitRadius = target.isResistant ? targetHitRadius * 1.55 : targetHitRadius;
		for (let ii=1; ii<=hitTestCount; ii++) {
			const percent = 1 - (ii / hitTestCount);
			const hitX = pointerScene.x - pointerDelta.x * percent;
			const hitY = pointerScene.y - pointerDelta.y * percent;
			const distance = Math.hypot(
				hitX - target.projected.x,
				hitY - target.projected.y
			);

			if (distance <= hitRadius) {
				// Hit! (though we don't want to allow hits on multiple sequential frames)
				if (!target.hit) {
					target.hit = true;

					target.xD += pointerDeltaScaled.x * hitDampening;
					target.yD += pointerDeltaScaled.y * hitDampening;
					target.rotateXD += pointerDeltaScaled.y * 0.001;
					target.rotateYD += pointerDeltaScaled.x * 0.001;

					const sparkSpeed = 7 + pointerSpeedScaled * 0.125;

					if (pointerSpeedScaled > minPointerSpeed) {
						// Touch Power determines slash damage
						target.health -= state.upgrades.touchPower;
						if (hasLevelBar()) incrementScore(10);

						if (target.health <= 0) {
							incrementCubeCount(1);

							state.game.totalCubesEver++;
							saveTotalCubes();
							checkCubeAchievements();

							if (target.wireframe) unlockAchievement('first_slowmo');
							if (target.isResistant) unlockAchievement('first_resist');

							if (canEarnCoinsAndAchievements()) {
								let base = target.isResistant ? target.maxHealth : 1;
								let coinsEarned = Math.floor(base * state.upgrades.mining);
								if (isDesafianteGame()) coinsEarned *= 2;
								if (coinsEarned < 1) coinsEarned = 1;
								state.game.coins += coinsEarned;
								saveCoins();
								renderCoins();
							}

							createBurst(target, forceMultiplier);
							sparkBurst(hitX, hitY, 8, sparkSpeed);
							if (target.isResistant) {
								shieldBurst(hitX, hitY, true);
								playSfx('break', 0.8);
							}

							if (target.wireframe) {
								let duration = state.upgrades.slowmoDuration;
								if (isDesafianteGame()) duration = Math.floor(duration * 0.5);
								slowmoRemaining = duration;
								spawnTime = 0;
								spawnExtra = 2;
							}
							targets.splice(i, 1);
							returnTarget(target);

							if (hasLevelBar() && checkLevelUp()) {
								renderLevelBar();
								checkLevelAchievements();
							}
						} else {
							sparkBurst(hitX, hitY, 8, sparkSpeed);
							if (target.isResistant) {
								shieldBurst(hitX, hitY, false);
							} else {
								glueShedSparks(target);
							}
							updateTargetHealth(target, 0);
						}
					} else {
						if (hasLevelBar()) incrementScore(5);
						sparkBurst(hitX, hitY, 3, sparkSpeed);
					}
				}
				// Break the current loop and continue the outer loop.
				// This skips to processing the next target.
				continue targetLoop;
			}
		}

		// This code will only run if target hasn't been "hit".
		target.hit = false;
	}

	// ========================
	// Cube-cube collisions with inertia
	// ========================
	const collideRadius = targetRadius * 1.85;
	const collideRadiusSq = collideRadius * collideRadius;
	for (let i = 0; i < targets.length; i++) {
		const a = targets[i];
		for (let j = i + 1; j < targets.length; j++) {
			const b = targets[j];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const dz = b.z - a.z;
			const distSq = dx * dx + dy * dy + dz * dz;
			if (distSq >= collideRadiusSq || distSq < 0.0001) continue;

			const dist = Math.sqrt(distSq);
			const nx = dx / dist;
			const ny = dy / dist;
			const nz = dz / dist;

			// Separate overlapping cubes
			const overlap = collideRadius - dist;
			const half = overlap * 0.5;
			a.x -= nx * half;
			a.y -= ny * half;
			a.z -= nz * half;
			b.x += nx * half;
			b.y += ny * half;
			b.z += nz * half;

			// Relative velocity along collision normal
			const dvx = b.xD - a.xD;
			const dvy = b.yD - a.yD;
			const dvz = b.zD - a.zD;
			const velAlongNormal = dvx * nx + dvy * ny + dvz * nz;

			// Only resolve if they are approaching each other
			if (velAlongNormal >= 0) continue;

			// Elastic-ish impulse (equal mass assumption)
			const restitution = 0.65;
			const impulse = -(1 + restitution) * velAlongNormal * 0.5;

			a.xD -= impulse * nx;
			a.yD -= impulse * ny;
			a.zD -= impulse * nz;
			b.xD += impulse * nx;
			b.yD += impulse * ny;
			b.zD += impulse * nz;

			// Slight spin from impact
			const spinImpulse = impulse * 0.008;
			a.rotateXD += spinImpulse * (Math.random() - 0.5);
			a.rotateYD += spinImpulse * (Math.random() - 0.5);
			b.rotateXD += spinImpulse * (Math.random() - 0.5);
			b.rotateYD += spinImpulse * (Math.random() - 0.5);
		}
	}

	// Re-project after position corrections from collisions
	for (let i = 0; i < targets.length; i++) {
		targets[i].transform();
		targets[i].project();
	}

	// Animate fragments and remove when offscreen.
	const fragBackboardZ = backboardZ + fragRadius;
	// Allow fragments to move off-screen to sides for a while, since shadows are still visible.
	const fragLeftBound = -width;
	const fragRightBound = width;

	for (let i = frags.length - 1; i >= 0; i--) {
		const frag = frags[i];
		frag.x += frag.xD * simSpeed;
		frag.y += frag.yD * simSpeed;
		frag.z += frag.zD * simSpeed;

		frag.xD *= simAirDrag;
		frag.yD *= simAirDrag;
		frag.zD *= simAirDrag;

		if (frag.y < ceiling) {
			frag.y = ceiling;
			frag.yD = 0;
		}

		if (frag.z < fragBackboardZ) {
			frag.z = fragBackboardZ;
			frag.zD *= -boundDamping;
		}

		frag.yD += gravity * simSpeed;
		frag.rotateX += frag.rotateXD * simSpeed;
		frag.rotateY += frag.rotateYD * simSpeed;
		frag.rotateZ += frag.rotateZD * simSpeed;
		frag.transform();
		frag.project();

		// Removal conditions
		if (
			// Bottom of screen
			frag.projected.y > centerY + targetHitRadius ||
			// Sides of screen
			frag.projected.x < fragLeftBound ||
			frag.projected.x > fragRightBound ||
			// Too close to camera
			frag.z > cameraFadeEndZ
		) {
			frags.splice(i, 1);
			returnFrag(frag);
			continue;
		}
	}

	// 2D sparks
	for (let i = sparks.length - 1; i >= 0; i--) {
		const spark = sparks[i];
		spark.life -= simTime;
		if (spark.life <= 0) {
			sparks.splice(i, 1);
			returnSpark(spark);
			continue;
		}
		spark.x += spark.xD * simSpeed;
		spark.y += spark.yD * simSpeed;
		spark.xD *= simAirDragSpark;
		spark.yD *= simAirDragSpark;
		spark.yD += gravity * simSpeed;
	}

	PERF_END('entities');

	// 3D transforms
	// -------------------

	PERF_START('3D');

	// Aggregate all scene vertices/polys
	allVertices.length = 0;
	allPolys.length = 0;
	allShadowVertices.length = 0;
	allShadowPolys.length = 0;
	targets.forEach(entity => {
		allVertices.push(...entity.vertices);
		allPolys.push(...entity.polys);
		allShadowVertices.push(...entity.shadowVertices);
		allShadowPolys.push(...entity.shadowPolys);
	});

	frags.forEach(entity => {
		allVertices.push(...entity.vertices);
		allPolys.push(...entity.polys);
		allShadowVertices.push(...entity.shadowVertices);
		allShadowPolys.push(...entity.shadowPolys);
	});

	// Scene calculations/transformations
	allPolys.forEach(p => computePolyNormal(p, 'normalWorld'));
	allPolys.forEach(computePolyDepth);
	allPolys.sort((a, b) => b.depth - a.depth);

	// Perspective projection
	allVertices.forEach(projectVertex);

	allPolys.forEach(p => computePolyNormal(p, 'normalCamera'));

	PERF_END('3D');

	PERF_START('shadows');

	// Rotate shadow vertices to light source perspective
	transformVertices(
		allShadowVertices,
		allShadowVertices,
		0, 0, 0,
		TAU/8, 0, 0,
		1, 1, 1
	);

	allShadowPolys.forEach(p => computePolyNormal(p, 'normalWorld'));

	const shadowDistanceMult = Math.hypot(1, 1);
	const shadowVerticesLength = allShadowVertices.length;
	for (let i=0; i<shadowVerticesLength; i++) {
		const distance = allVertices[i].z - backboardZ;
		allShadowVertices[i].z -= shadowDistanceMult * distance;
	}
	transformVertices(
		allShadowVertices,
		allShadowVertices,
		0, 0, 0,
		-TAU/8, 0, 0,
		1, 1, 1
	);
	allShadowVertices.forEach(projectVertex);

	PERF_END('shadows');

	PERF_END('tick');
}





// draw.js
// ============================================================================
// ============================================================================

function draw(ctx, width, height, viewScale) {
	PERF_START('draw');

	const halfW = width / 2;
	const halfH = height / 2;


	// 3D Polys
	// ---------------
	ctx.lineJoin = 'bevel';

	PERF_START('drawShadows');
	ctx.fillStyle = shadowColor;
	ctx.strokeStyle = shadowColor;
	allShadowPolys.forEach(p => {
		if (p.wireframe) {
			ctx.lineWidth = 2;
			ctx.beginPath();
			const { vertices } = p;
			const vCount = vertices.length;
			const firstV = vertices[0];
			ctx.moveTo(firstV.x, firstV.y);
			for (let i=1; i<vCount; i++) {
				const v = vertices[i];
				ctx.lineTo(v.x, v.y);
			}
			ctx.closePath();
			ctx.stroke();
		} else {
			ctx.beginPath();
			const { vertices } = p;
			const vCount = vertices.length;
			const firstV = vertices[0];
			ctx.moveTo(firstV.x, firstV.y);
			for (let i=1; i<vCount; i++) {
				const v = vertices[i];
				ctx.lineTo(v.x, v.y);
			}
			ctx.closePath();
			ctx.fill();
		}
	});
	PERF_END('drawShadows');

	PERF_START('drawPolys');

	allPolys.forEach(p => {
		if (!p.wireframe && p.normalCamera.z < 0) return;

		if (p.strokeWidth !== 0) {
			ctx.lineWidth = p.normalCamera.z < 0 ? p.strokeWidth * 0.5 : p.strokeWidth;
			ctx.strokeStyle = p.normalCamera.z < 0 ? p.strokeColorDark : p.strokeColor;
		}

		const { vertices } = p;
		const lastV = vertices[vertices.length - 1];
		const fadeOut = p.middle.z > cameraFadeStartZ;

		if (!p.wireframe) {
			const normalLight = p.normalWorld.y * 0.5 + p.normalWorld.z * -0.5;
			const lightness = normalLight > 0
				? 0.1
				: ((normalLight ** 32 - normalLight) / 2) * 0.9 + 0.1;
			ctx.fillStyle = shadeColor(p.color, lightness);
		}

		// Fade out polys close to camera. `globalAlpha` must be reset later.
		if (fadeOut) {
			// If polygon gets really close to camera (outside `cameraFadeRange`) the alpha
			// can go negative, which has the appearance of alpha = 1. So, we'll clamp it at 0.
			ctx.globalAlpha = Math.max(0, 1 - (p.middle.z - cameraFadeStartZ) / cameraFadeRange);
		}

		ctx.beginPath();
		ctx.moveTo(lastV.x, lastV.y);
		for (let v of vertices) {
			ctx.lineTo(v.x, v.y);
		}

		if (!p.wireframe) {
			ctx.fill();
		}
		if (p.strokeWidth !== 0) {
			ctx.stroke();
		}

		if (fadeOut) {
			ctx.globalAlpha = 1;
		}
	});
	PERF_END('drawPolys');


	// Resistant cube shields: transparent blue spheres with visible edges
	// ------------------------------------------------------------------
	targets.forEach(target => {
		if (!target.isResistant || !target.projected) return;

		const px = target.projected.x;
		const py = target.projected.y;
		// Perspective scale similar to projection
		const depth = cameraDistance / (cameraDistance - (target.z || 0));
		const r = targetRadius * 2.05 * Math.max(0.35, depth);

		// Fade near camera like polys
		let alpha = 1;
		if (target.z > cameraFadeStartZ) {
			alpha = Math.max(0, 1 - (target.z - cameraFadeStartZ) / cameraFadeRange);
		}
		if (alpha <= 0.02) return;

		ctx.save();
		ctx.globalAlpha = alpha * 0.35;
		// Fill sphere
		ctx.beginPath();
		ctx.arc(px, py, r, 0, TAU);
		ctx.fillStyle = 'rgba(80, 160, 255, 0.35)';
		ctx.fill();

		// Outer rim
		ctx.globalAlpha = alpha * 0.9;
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'rgba(140, 200, 255, 0.95)';
		ctx.stroke();

		// Latitude / longitude style edges for a spherical wire look
		ctx.globalAlpha = alpha * 0.55;
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = 'rgba(160, 210, 255, 0.85)';

		// Horizontal ellipse (equator)
		ctx.beginPath();
		ctx.ellipse(px, py, r, r * 0.35, 0, 0, TAU);
		ctx.stroke();

		// Second latitude
		ctx.beginPath();
		ctx.ellipse(px, py - r * 0.35, r * 0.78, r * 0.22, 0, 0, TAU);
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(px, py + r * 0.35, r * 0.78, r * 0.22, 0, 0, TAU);
		ctx.stroke();

		// Vertical meridians
		ctx.beginPath();
		ctx.ellipse(px, py, r * 0.35, r, 0, 0, TAU);
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(px, py, r * 0.7, r, 0, 0, TAU);
		ctx.stroke();

		ctx.restore();
	});


	PERF_START('draw2D');

	// 2D Sparks
	// ---------------
	sparks.forEach(spark => {
		const lifeT = spark.life / spark.maxLife;
		const scale = lifeT ** 0.5 * 1.6;
		ctx.globalAlpha = Math.max(0.15, lifeT);
		ctx.lineWidth = spark.color ? sparkThickness * 1.35 : sparkThickness;
		ctx.strokeStyle = spark.color || sparkColor;
		ctx.beginPath();
		ctx.moveTo(spark.x, spark.y);
		ctx.lineTo(spark.x - spark.xD * scale, spark.y - spark.yD * scale);
		ctx.stroke();
	});
	ctx.globalAlpha = 1;


	// Touch Strokes
	// ---------------

	ctx.strokeStyle = touchTrailColor;
	const touchPointCount = touchPoints.length;
	for (let i=1; i<touchPointCount; i++) {
		const current = touchPoints[i];
		const prev = touchPoints[i-1];
		if (current.touchBreak || prev.touchBreak) {
			continue;
		}
		const scale = current.life / touchPointLife;
		ctx.lineWidth = scale * touchTrailThickness;
		ctx.beginPath();
		ctx.moveTo(prev.x, prev.y);
		ctx.lineTo(current.x, current.y);
		ctx.stroke();
	}

	PERF_END('draw2D');

	PERF_END('draw');
	PERF_END('frame');

	// Display performance updates.
	PERF_UPDATE();
}





// canvas.js
// ============================================================================
// ============================================================================

function setupCanvases() {
	const ctx = canvas.getContext('2d');
	// devicePixelRatio alias
	const dpr = window.devicePixelRatio || 1;
	// View will be scaled so objects appear sized similarly on all screen sizes.
	let viewScale;
	// Dimensions (taking viewScale into account!)
	let width, height;

	function handleResize() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		viewScale = h / 1000;
		width = w / viewScale;
		height = h / viewScale;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
	}

	// Set initial size
	handleResize();
	// resize fullscreen canvas
	window.addEventListener('resize', handleResize);


	// Run game loop
	let lastTimestamp = 0;
	function frameHandler(timestamp) {
		let frameTime = timestamp - lastTimestamp;
		lastTimestamp = timestamp;

		// always queue another frame
		raf();

		// If game is paused, we'll still track frameTime (above) but all other
		// game logic and drawing can be avoided.
		if (isPaused()) return;

		// make sure negative time isn't reported (first frame can be whacky)
		if (frameTime < 0) {
			frameTime = 17;
		}
		// - cap minimum framerate to 15fps[~68ms] (assuming 60fps[~17ms] as 'normal')
		else if (frameTime > 68) {
			frameTime = 68;
		}

		const halfW = width / 2;
		const halfH = height / 2;

		// Convert pointer position from screen to scene coords.
		pointerScene.x = pointerScreen.x / viewScale - halfW;
		pointerScene.y = pointerScreen.y / viewScale - halfH;

		const lag = frameTime / 16.6667;
		const simTime = gameSpeed * frameTime;
		const simSpeed = gameSpeed * lag;
		tick(width, height, simTime, simSpeed, lag);

		// Auto clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		// Auto scale drawing for high res displays, and incorporate `viewScale`.
		// Also shift canvas so (0, 0) is the middle of the screen.
		// This just works with 3D perspective projection.
		const drawScale = dpr * viewScale;
		ctx.scale(drawScale, drawScale);
		ctx.translate(halfW, halfH);
		draw(ctx, width, height, viewScale);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
	const raf = () => requestAnimationFrame(frameHandler);
	// Start loop
	raf();
}





// interaction.js
// ============================================================================
// ============================================================================

// Interaction
// -----------------------------

function handleCanvasPointerDown(x, y) {
	if (!pointerIsDown) {
		pointerIsDown = true;
		pointerScreen.x = x;
		pointerScreen.y = y;
		// On when menus are open, point down/up toggles an interactive mode.
		// We just need to rerender the menu system for it to respond.
		if (isMenuVisible()) renderMenus();
	}
}

function handleCanvasPointerUp() {
	if (pointerIsDown) {
		pointerIsDown = false;
		touchPoints.push({
			touchBreak: true,
			life: touchPointLife
		});
		// On when menus are open, point down/up toggles an interactive mode.
		// We just need to rerender the menu system for it to respond.
		if (isMenuVisible()) renderMenus();
	}
}

function handleCanvasPointerMove(x, y) {
	if (pointerIsDown) {
		pointerScreen.x = x;
		pointerScreen.y = y;
	}
}


// Use pointer events if available, otherwise fallback to touch events (for iOS).
if ('PointerEvent' in window) {
	canvas.addEventListener('pointerdown', event => {
		event.isPrimary && handleCanvasPointerDown(event.clientX, event.clientY);
	});

	canvas.addEventListener('pointerup', event => {
		event.isPrimary && handleCanvasPointerUp();
	});

	canvas.addEventListener('pointermove', event => {
		event.isPrimary && handleCanvasPointerMove(event.clientX, event.clientY);
	});

	// We also need to know if the mouse leaves the page. For this game, it's best if that
	// cancels a swipe, so essentially acts as a "mouseup" event.
	document.body.addEventListener('mouseleave', handleCanvasPointerUp);
} else {
	let activeTouchId = null;
	canvas.addEventListener('touchstart', event => {
		if (!pointerIsDown) {
			const touch = event.changedTouches[0];
			activeTouchId = touch.identifier;
			handleCanvasPointerDown(touch.clientX, touch.clientY);
		}
	});
	canvas.addEventListener('touchend', event => {
		for (let touch of event.changedTouches) {
			if (touch.identifier === activeTouchId) {
				handleCanvasPointerUp();
				break;
			}
		}
	});
	canvas.addEventListener('touchmove', event => {
		for (let touch of event.changedTouches) {
			if (touch.identifier === activeTouchId) {
				handleCanvasPointerMove(touch.clientX, touch.clientY);
				event.preventDefault();
				break;
			}
		}
	}, { passive: false });
}





// index.js
// ============================================================================
// ============================================================================

setupCanvases();

// ========================
// Initialize persistent data
// ========================
state.game.coins = loadCoins();
loadUpgrades();
loadAchievements();
loadTotalCubes();
renderCoins();
renderMainCoins();
renderLevelBar();

// ========================
// SPLASH / LOADING SEQUENCE
// ========================
(function runSplash() {
	const splash = document.getElementById('splash');
	const logoStage = document.getElementById('splashLogo');
	const creditsStage = document.getElementById('splashCredits');
	const loadStage = document.getElementById('splashLoad');
	const tapStage = document.getElementById('splashTap');
	const barFill = document.getElementById('splashBarFill');
	const pctNode = document.getElementById('splashPct');
	if (!splash) {
		setActiveMenu(MENU_MAIN);
		return;
	}

	// Hide menus/HUD during splash
	if (menuContainerNode) menuContainerNode.style.visibility = 'hidden';
	if (hudContainerNode) hudContainerNode.style.display = 'none';

	const wait = (ms) => new Promise(r => setTimeout(r, ms));

	function showStage(el) {
		[logoStage, creditsStage, loadStage, tapStage].forEach(s => s && s.classList.remove('is-visible'));
		if (el) el.classList.add('is-visible');
	}

	function hideStage(el) {
		if (el) el.classList.remove('is-visible');
	}

	function loadAsset(url, type) {
		return new Promise((resolve) => {
			if (type === 'image') {
				const img = new Image();
				img.onload = () => resolve(true);
				img.onerror = () => resolve(false);
				img.src = url;
			} else {
				const a = new Audio();
				const done = () => resolve(true);
				a.addEventListener('canplaythrough', done, { once: true });
				a.addEventListener('error', () => resolve(false), { once: true });
				a.preload = 'auto';
				a.src = url;
				// fallback timeout
				setTimeout(() => resolve(true), 8000);
			}
		});
	}

	const assets = [
		{ url: '192.png', type: 'image' },
		{ url: '512.png', type: 'image' },
		{ url: 'data/images/coin.png', type: 'image' },
		{ url: 'data/sounds/achievement.mp3', type: 'audio' },
		{ url: 'data/sounds/click.mp3', type: 'audio' },
		{ url: 'data/sounds/cash.mp3', type: 'audio' },
		{ url: 'data/sounds/levelup.mp3', type: 'audio' },
		{ url: 'data/sounds/reward.mp3', type: 'audio' },
		{ url: 'data/sounds/break.mp3', type: 'audio' },
		{ url: 'data/sounds/music.mp3', type: 'audio' }
	];

	async function preloadWithBar() {
		showStage(loadStage);
		let done = 0;
		const total = assets.length;
		const update = () => {
			const pct = Math.round((done / total) * 100);
			if (barFill) barFill.style.width = pct + '%';
			if (pctNode) pctNode.textContent = pct + '%';
		};
		update();
		for (const asset of assets) {
			await loadAsset(asset.url, asset.type);
			done++;
			update();
			// small yield so bar animates smoothly
			await wait(40);
		}
		if (barFill) barFill.style.width = '100%';
		if (pctNode) pctNode.textContent = '100%';
		await wait(250);
	}

	async function sequence() {
		// 1. Logo
		showStage(logoStage);
		await wait(2200);
		hideStage(logoStage);
		await wait(800);

		// 2. Credits
		showStage(creditsStage);
		await wait(2800);
		hideStage(creditsStage);
		await wait(700);

		// 3. Load bar + real preload
		await preloadWithBar();
		// Smooth exit of load stage before tap prompt
		hideStage(loadStage);
		await wait(650);

		// 4. Tap to start
		showStage(tapStage);
	}

	function finishSplash() {
		unlockAudio();
		appReady = true;

		// Prepare music at 0 volume, then fade in for main menu
		try {
			const m = ensureMusic();
			m.volume = 0;
		} catch (e) {}

		hideStage(tapStage);
		splash.classList.add('is-done');

		setTimeout(() => {
			splash.remove();
			if (menuContainerNode) menuContainerNode.style.visibility = '';
			setActiveMenu(MENU_MAIN);
			startMusic(); // music on main menu, gradual fade-in
		}, 500);
	}

	tapStage.addEventListener('pointerdown', (e) => {
		e.preventDefault();
		e.stopPropagation();
		finishSplash();
	}, { once: true });

	// Safety: never treat splash as in-game
	appReady = false;
	setHudVisibility(false);
	sequence();
})();
