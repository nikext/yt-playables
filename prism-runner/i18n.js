/*
 * Prism Runner: all player-facing strings, one dictionary per language.
 * The game picks one with PlayablesSDK.getLanguage() and falls back to English.
 */
(function () {
  'use strict';
  window.PR_I18N = {
    en: {
      retry: 'Retry',
      play: 'Play', best: 'Best', newBest: 'New best!', tapRetry: 'Tap to retry',
      paused: 'Paused', tapContinue: 'Tap to continue', trails: 'Trails',
      hintMove: 'Swipe to move', hintMoveKey: '← → to move',
      hintColor: 'Tap to change color', hintColorKey: 'Space to change color',
      hintMatch: 'Match your color!', newTrail: 'New trail unlocked!',
      shattered: 'Shattered!', shield: 'Shield', slow: 'Slow-mo',
      trailNames: ['Glow', 'Bubbles', 'Sparkle', 'Ribbon', 'Comet']
    },
    es: {
      retry: 'Otra vez',
      play: 'Jugar', best: 'Récord', newBest: '¡Nuevo récord!', tapRetry: 'Toca para reintentar',
      paused: 'Pausa', tapContinue: 'Toca para continuar', trails: 'Estelas',
      hintMove: 'Desliza para moverte', hintMoveKey: '← → para moverte',
      hintColor: 'Toca para cambiar de color', hintColorKey: 'Espacio: cambiar color',
      hintMatch: '¡Iguala tu color!', newTrail: '¡Nueva estela!',
      shattered: '¡Hecho añicos!', shield: 'Escudo', slow: 'Cámara lenta',
      trailNames: ['Brillo', 'Burbujas', 'Destellos', 'Cinta', 'Cometa']
    },
    pt: {
      retry: 'De novo',
      play: 'Jogar', best: 'Recorde', newBest: 'Novo recorde!', tapRetry: 'Toque para jogar de novo',
      paused: 'Pausado', tapContinue: 'Toque para continuar', trails: 'Rastros',
      hintMove: 'Deslize para mover', hintMoveKey: '← → para mover',
      hintColor: 'Toque para mudar a cor', hintColorKey: 'Espaço: mudar a cor',
      hintMatch: 'Combine sua cor!', newTrail: 'Novo rastro!',
      shattered: 'Estilhaçado!', shield: 'Escudo', slow: 'Câmera lenta',
      trailNames: ['Brilho', 'Bolhas', 'Faíscas', 'Fita', 'Cometa']
    },
    fr: {
      retry: 'Rejouer',
      play: 'Jouer', best: 'Record', newBest: 'Nouveau record !', tapRetry: 'Touchez pour rejouer',
      paused: 'Pause', tapContinue: 'Touchez pour continuer', trails: 'Traînées',
      hintMove: 'Glissez pour bouger', hintMoveKey: '← → pour bouger',
      hintColor: 'Touchez pour changer de couleur', hintColorKey: 'Espace : changer de couleur',
      hintMatch: 'Suivez votre couleur !', newTrail: 'Nouvelle traînée !',
      shattered: 'Brisé !', shield: 'Bouclier', slow: 'Ralenti',
      trailNames: ['Lueur', 'Bulles', 'Étincelles', 'Ruban', 'Comète']
    },
    de: {
      retry: 'Nochmal',
      play: 'Spielen', best: 'Rekord', newBest: 'Neuer Rekord!', tapRetry: 'Tippen für neue Runde',
      paused: 'Pause', tapContinue: 'Tippen zum Fortsetzen', trails: 'Spuren',
      hintMove: 'Wischen zum Bewegen', hintMoveKey: '← → zum Bewegen',
      hintColor: 'Tippen für Farbwechsel', hintColorKey: 'Leertaste: Farbe wechseln',
      hintMatch: 'Gleiche deine Farbe an!', newTrail: 'Neue Spur freigeschaltet!',
      shattered: 'Zersplittert!', shield: 'Schild', slow: 'Zeitlupe',
      trailNames: ['Glühen', 'Blasen', 'Funkeln', 'Band', 'Komet']
    }
  };
})();
