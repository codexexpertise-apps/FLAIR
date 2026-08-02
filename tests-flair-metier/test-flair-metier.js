'use strict';

const assert = require('assert');
const { loadFlairEnvironment, normaliserTexteSimple } = require('./test-env');
const { lexicalCases, classificationCases, sourceRuleCases, scoringCases } = require('./corpus-signaux');

let passes = 0;
let failures = 0;
let knownDefects = 0;

function test(name, fn, options = {}) {
  try {
    fn();
    passes += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    if (options.knownDefect) {
      knownDefects += 1;
      console.log(`⚠ DÉFAUT HISTORIQUE DOCUMENTÉ — ${name}`);
      console.log(`  ${error.message}`);
      return;
    }
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${error.stack || error.message}`);
  }
}

function includesRule(result, fragment) {
  return (result?.matched_rules || []).some(rule => String(rule.id || '').includes(fragment));
}

function run() {
  const env = loadFlairEnvironment();
  const lexique = env.FLAIR_METIER_LEXIQUE;
  const secteurs = env.FLAIR_METIER_SECTEURS;
  const metier = env.FLAIR_METIER;
  const source = env.FLAIR_SOURCE_VEILLE;

  console.log('\nFLAIR — TESTS DE NON-RÉGRESSION');
  console.log(`Racine testée : ${env.root}`);
  console.log(`Moteur lexical : ${env.lexiquePath}`);
  console.log(`Classification secteurs : ${env.secteursPath}`);
  console.log(`Moteur métier : ${env.metierPath}`);
  console.log(`Règles veille : ${env.sourceRulesPath}\n`);


  test('API publique FLAIR_METIER_LEXIQUE disponible en correspondances génériques', () => {
    assert.strictEqual(typeof lexique, 'object');
    assert.strictEqual(lexique.mode, 'correspondances_generiques');
    ['normaliserTexteFlair', 'keywordMatchesText', 'motClePresentMetier', 'diagnostiquerCorrespondance']
      .forEach(name => assert.strictEqual(typeof lexique[name], 'function', `${name} absent`));
  });

  test('API publique FLAIR_METIER_SECTEURS disponible avec le correctif lexical', () => {
    assert.strictEqual(typeof secteurs, 'object');
    assert.strictEqual(secteurs.mode, 'correspondances_generiques');
    assert.strictEqual(typeof secteurs.detecterSecteurSousSecteur, 'function');
    assert.ok(Array.isArray(secteurs.rules));
    assert.ok(secteurs.rules.length >= 25, `Seulement ${secteurs.rules.length} règles sectorielles`);
  });

  test('API publique FLAIR_METIER disponible', () => {
    assert.strictEqual(typeof metier, 'object');
    ['motCleFlairPresent', 'detecterSecteurSousSecteur', 'calculerTimingCommercial', 'scoringLocal', 'calculerScoreDistributionIA']
      .forEach(name => assert.strictEqual(typeof metier[name], 'function', `${name} absent`));
  });

  test('API publique FLAIR_SOURCE_VEILLE disponible', () => {
    assert.strictEqual(typeof source.analyserSignalAvecRegles, 'function');
    assert.strictEqual(typeof source.detecterFamilleStrategiqueProjet, 'function');
    assert.strictEqual(typeof source.normaliserTexteFlair, 'function');
  });

  lexicalCases.forEach(item => {
    test(`Lexique : ${item.id}`, () => {
      const texte = normaliserTexteSimple(item.texte);
      const actual = metier.motCleFlairPresent(texte, item.motCle);
      assert.strictEqual(actual, item.attenduCible, `attendu ${item.attenduCible}, reçu ${actual}`);
    }, { knownDefect: item.defautHistoriquePossible });
  });

  classificationCases.forEach(item => {
    test(`Classification : ${item.id}`, () => {
      const actual = metier.detecterSecteurSousSecteur(item.signal);
      if (item.attenduCible.secteur) {
        assert.strictEqual(actual.secteur, item.attenduCible.secteur, JSON.stringify(actual));
      }
      if (item.attenduCible.secteurInterdit) {
        assert.notStrictEqual(actual.secteur, item.attenduCible.secteurInterdit, JSON.stringify(actual));
      }
      if (item.attenduCible.sousContient) {
        assert.ok(normaliserTexteSimple(actual.sous).includes(normaliserTexteSimple(item.attenduCible.sousContient)), JSON.stringify(actual));
      }
      assert.ok(Object.prototype.hasOwnProperty.call(actual, 'confiance'));
      assert.ok(Array.isArray(actual.indices));
    }, { knownDefect: item.defautHistoriquePossible });
  });

  sourceRuleCases.forEach(item => {
    test(`Règles veille : ${item.id}`, () => {
      const analyse = source.analyserSignalAvecRegles(item.signal);
      if (item.attendu.regleInclut) {
        assert.ok(includesRule(analyse, item.attendu.regleInclut), JSON.stringify(analyse.matched_rules));
      }
      if (item.attendu.regleExclut) {
        assert.ok(!includesRule(analyse, item.attendu.regleExclut), JSON.stringify(analyse.matched_rules));
      }
      if (item.attendu.famille) {
        const famille = source.detecterFamilleStrategiqueProjet(item.signal);
        assert.strictEqual(famille?.id, item.attendu.famille, JSON.stringify(famille));
      }
    });
  });

  scoringCases.forEach(item => {
    test(`Timing et scoring ne lèvent pas d’erreur : ${item.id}`, () => {
      const timing = metier.calculerTimingCommercial(item.signal);
      assert.ok(timing && typeof timing === 'object');
      assert.ok(Object.prototype.hasOwnProperty.call(timing, 'phase'));

      const local = metier.scoringLocal(item.signal);
      assert.ok(local && typeof local === 'object');
      const score = local.score ?? local.score_final_distribue ?? local.score_pertinence;
      assert.ok(Number.isFinite(Number(score)), JSON.stringify(local));
    });
  });

  test('La façade FLAIR_METIER reste large et compatible', () => {
    const keys = Object.keys(metier);
    assert.ok(keys.length >= 60, `Seulement ${keys.length} propriétés publiques`);
  });

  console.log('\nRÉSUMÉ');
  console.log(`Tests réussis : ${passes}`);
  console.log(`Tests échoués : ${failures}`);
  console.log(`Défauts historiques documentés : ${knownDefects}`);

  if (failures > 0) process.exitCode = 1;
}

run();
