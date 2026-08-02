'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function normaliserTexteSimple(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function createBrowserContext() {
  const window = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    Date,
    Math,
    JSON,
    RegExp,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Set,
    Map,
    Intl,
    FLAIR_GEO: {
      normaliserTexteSimple,
      normaliserCleGeographie: normaliserTexteSimple,
      labelRegionCommerciale: value => String(value || ''),
      signalRegion: signal => signal?.region_nom || signal?.region || signal?.region_signal || '',
      estRegionNationaleFlair: value => ['france', 'france entiere', 'national'].includes(normaliserTexteSimple(value))
    },
    FLAIR_COPILOTE: {},
    FLAIR_SOURCE_VALIDATOR: {},
    FLAIR_SIGNAL_VALIDATOR: {},
    plafonnerScoreParChaleur: score => Number(score) || 0
  };

  window.window = window;
  window.globalThis = window;
  window.self = window;

  return vm.createContext(window);
}

function resolveProjectRoot(customRoot) {
  if (customRoot) return path.resolve(customRoot);
  return path.resolve(__dirname, '..');
}

function firstExisting(root, candidates) {
  for (const candidate of candidates) {
    const fullPath = path.join(root, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  throw new Error(`Fichier introuvable dans ${root}: ${candidates.join(', ')}`);
}

function loadScript(context, filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(code, context, { filename: filePath, displayErrors: true });
}

function loadFlairEnvironment(options = {}) {
  const root = resolveProjectRoot(options.projectRoot || process.env.FLAIR_PROJECT_ROOT);
  const context = createBrowserContext();

  const lexiquePath = firstExisting(root, [
    'flair-metier-lexique.js'
  ]);
  const secteursPath = firstExisting(root, [
    'flair-metier-secteurs.js'
  ]);
  const sourceRulesPath = firstExisting(root, [
    'source-veille-rules.js',
    'source-veille-rules (1)(3).js'
  ]);
  const metierPath = firstExisting(root, [
    'flair-metier.js',
    'flair-metier (1)(1).js'
  ]);

  loadScript(context, lexiquePath);
  loadScript(context, secteursPath);
  loadScript(context, sourceRulesPath);
  loadScript(context, metierPath);

  if (!context.FLAIR_SOURCE_VEILLE) {
    throw new Error('window.FLAIR_SOURCE_VEILLE n’a pas été exposé.');
  }
  if (!context.FLAIR_METIER) {
    throw new Error('window.FLAIR_METIER n’a pas été exposé.');
  }

  return {
    root,
    context,
    lexiquePath,
    secteursPath,
    sourceRulesPath,
    metierPath,
    FLAIR_METIER_LEXIQUE: context.FLAIR_METIER_LEXIQUE,
    FLAIR_METIER_SECTEURS: context.FLAIR_METIER_SECTEURS,
    FLAIR_SOURCE_VEILLE: context.FLAIR_SOURCE_VEILLE,
    FLAIR_METIER: context.FLAIR_METIER
  };
}

module.exports = {
  normaliserTexteSimple,
  createBrowserContext,
  loadFlairEnvironment
};
