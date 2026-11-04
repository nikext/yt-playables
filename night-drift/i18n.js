/*
 * Night Drift: every player-facing string, one dictionary per language.
 * The game picks one with PlayablesSDK.getLanguage() and falls back to English.
 */
(function () {
  'use strict';
  window.ND_I18N = {
    en: {
      play: 'Drive', best: 'Best', garage: 'Garage', paint: 'Paint', trail: 'Trail',
      unlock: 'Unlock', equipped: 'Equipped', equip: 'Equip', reach: 'Best', paused: 'Paused',
      tapContinue: 'Tap to continue', resume: 'Resume', restart: 'Restart', menu: 'Menu',
      gameOver: 'Wrecked', newBest: 'New best!', score: 'Score', tokens: 'Tokens',
      maxCombo: 'Max combo', holdDrift: 'Hold to drift', holdKey: 'Hold Space to drift',
      release: 'Release to straighten', niceDrift: 'Nice drift!', scrape: 'Scrape',
      crash: 'Crash', boost: 'Boost', drift: 'Drift', retry: 'Retry', newItem: 'New unlock!',
      paints: ['Neon', 'Ice', 'Sunset', 'Ultra', 'Pearl', 'Gold'],
      trails: ['Magenta', 'Cyan', 'Ember', 'Ghost', 'Spectrum']
    },
    es: {
      play: 'Conducir', best: 'Récord', garage: 'Garaje', paint: 'Pintura', trail: 'Estela',
      unlock: 'Desbloquear', equipped: 'Equipado', equip: 'Equipar', reach: 'Récord', paused: 'Pausa',
      tapContinue: 'Toca para continuar', resume: 'Seguir', restart: 'Reiniciar', menu: 'Menú',
      gameOver: 'Destrozado', newBest: '¡Nuevo récord!', score: 'Puntos', tokens: 'Fichas',
      maxCombo: 'Combo máx.', holdDrift: 'Mantén para derrapar', holdKey: 'Mantén Espacio para derrapar',
      release: 'Suelta para enderezar', niceDrift: '¡Buen derrape!', scrape: 'Roce',
      crash: 'Choque', boost: 'Turbo', drift: 'Derrape', retry: 'Otra vez', newItem: '¡Desbloqueado!',
      paints: ['Neón', 'Hielo', 'Ocaso', 'Ultra', 'Perla', 'Oro'],
      trails: ['Magenta', 'Cian', 'Brasa', 'Fantasma', 'Espectro']
    },
    pt: {
      play: 'Dirigir', best: 'Recorde', garage: 'Garagem', paint: 'Pintura', trail: 'Rastro',
      unlock: 'Desbloquear', equipped: 'Equipado', equip: 'Equipar', reach: 'Recorde', paused: 'Pausado',
      tapContinue: 'Toque para continuar', resume: 'Continuar', restart: 'Reiniciar', menu: 'Menu',
      gameOver: 'Destruído', newBest: 'Novo recorde!', score: 'Pontos', tokens: 'Fichas',
      maxCombo: 'Combo máx.', holdDrift: 'Segure para derrapar', holdKey: 'Segure Espaço para derrapar',
      release: 'Solte para endireitar', niceDrift: 'Belo drift!', scrape: 'Raspão',
      crash: 'Batida', boost: 'Turbo', drift: 'Drift', retry: 'De novo', newItem: 'Desbloqueado!',
      paints: ['Neon', 'Gelo', 'Poente', 'Ultra', 'Pérola', 'Ouro'],
      trails: ['Magenta', 'Ciano', 'Brasa', 'Fantasma', 'Espectro']
    },
    fr: {
      play: 'Rouler', best: 'Record', garage: 'Garage', paint: 'Peinture', trail: 'Traînée',
      unlock: 'Débloquer', equipped: 'Équipé', equip: 'Équiper', reach: 'Record', paused: 'Pause',
      tapContinue: 'Touchez pour continuer', resume: 'Reprendre', restart: 'Recommencer', menu: 'Menu',
      gameOver: 'Épave', newBest: 'Nouveau record !', score: 'Score', tokens: 'Jetons',
      maxCombo: 'Combo max', holdDrift: 'Maintenez pour drifter', holdKey: 'Maintenez Espace pour drifter',
      release: 'Relâchez pour redresser', niceDrift: 'Beau drift !', scrape: 'Frottement',
      crash: 'Choc', boost: 'Turbo', drift: 'Drift', retry: 'Rejouer', newItem: 'Débloqué !',
      paints: ['Néon', 'Glace', 'Couchant', 'Ultra', 'Nacre', 'Or'],
      trails: ['Magenta', 'Cyan', 'Braise', 'Fantôme', 'Spectre']
    },
    de: {
      play: 'Fahren', best: 'Rekord', garage: 'Garage', paint: 'Lack', trail: 'Spur',
      unlock: 'Freischalten', equipped: 'Aktiv', equip: 'Wählen', reach: 'Rekord', paused: 'Pause',
      tapContinue: 'Tippen zum Fortsetzen', resume: 'Weiter', restart: 'Neustart', menu: 'Menü',
      gameOver: 'Schrott', newBest: 'Neuer Rekord!', score: 'Punkte', tokens: 'Chips',
      maxCombo: 'Max. Combo', holdDrift: 'Halten zum Driften', holdKey: 'Leertaste halten zum Driften',
      release: 'Loslassen zum Geradeziehen', niceDrift: 'Starker Drift!', scrape: 'Streifer',
      crash: 'Crash', boost: 'Boost', drift: 'Drift', retry: 'Nochmal', newItem: 'Freigeschaltet!',
      paints: ['Neon', 'Eis', 'Abend', 'Ultra', 'Perle', 'Gold'],
      trails: ['Magenta', 'Cyan', 'Glut', 'Geist', 'Spektrum']
    }
  };
})();
